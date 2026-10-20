//! GitHub avatars, opt-in (`github_avatars` in the config): the only call gitd makes to a third
//! party. Every answer, a picture or "none", is cached on disk so each email is asked once.

use std::{
    path::{Path, PathBuf},
    sync::OnceLock,
    time::{Duration, SystemTime},
};
use tokio::sync::Semaphore;

const SIZE: u32 = 64;
const TIMEOUT: Duration = Duration::from_secs(10);
/// "No avatar" is asked again after a day: the author may have set one up since.
const NONE_TTL: Duration = Duration::from_secs(24 * 60 * 60);
const PARALLEL: usize = 4;

/// Where GitHub serves the avatar of the account behind `email`.
pub fn url(email: &str) -> String {
    let email = email.trim().to_lowercase();
    if let Some(user) = email.strip_suffix("@users.noreply.github.com") {
        return match user.split_once('+') {
            Some((id, _)) if id.chars().all(|c| c.is_ascii_digit()) => {
                format!("https://avatars.githubusercontent.com/u/{id}?s={SIZE}&v=4")
            }
            _ => format!("https://github.com/{user}.png?size={SIZE}"),
        };
    }
    format!("https://avatars.githubusercontent.com/u/e?email={}&s={SIZE}", crate::browser::encode(&email))
}

/// The cached or freshly fetched picture for `email`, None when the account has none.
pub async fn get(cache: &Path, email: &str) -> Option<Vec<u8>> {
    let key = format!("{:016x}", fnv(&email.trim().to_lowercase()));
    let (img, none) = (cache.join(format!("{key}.img")), cache.join(format!("{key}.none")));
    if let Ok(bytes) = tokio::fs::read(&img).await {
        return Some(bytes);
    }
    if fresh(&none).await {
        return None;
    }
    static LIMIT: OnceLock<Semaphore> = OnceLock::new();
    let _permit = LIMIT.get_or_init(|| Semaphore::new(PARALLEL)).acquire().await.ok()?;
    let url = url(email);
    let fetched = tokio::task::spawn_blocking(move || fetch(&url)).await.ok()?;
    let _ = tokio::fs::create_dir_all(cache).await;
    match fetched {
        Fetched::Image(bytes) => {
            let _ = tokio::fs::write(&img, &bytes).await;
            Some(bytes)
        }
        Fetched::None => {
            let _ = tokio::fs::write(&none, b"").await;
            None
        }
        // offline or GitHub down: nothing is cached, the next look asks again
        Fetched::Failed => None,
    }
}

pub fn cache_dir() -> PathBuf {
    crate::cli::config_dir().join("avatars")
}

pub fn content_type(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(b"\x89PNG") {
        "image/png"
    } else if bytes.starts_with(b"GIF8") {
        "image/gif"
    } else {
        "image/jpeg"
    }
}

enum Fetched {
    Image(Vec<u8>),
    None,
    Failed,
}

fn fetch(url: &str) -> Fetched {
    let agent: ureq::Agent = ureq::Agent::config_builder().timeout_global(Some(TIMEOUT)).http_status_as_error(false).build().into();
    match agent.get(url).call() {
        Ok(resp) if resp.status().is_success() => match resp.into_body().read_to_vec() {
            Ok(bytes) if !bytes.is_empty() => Fetched::Image(bytes),
            _ => Fetched::Failed,
        },
        Ok(resp) if resp.status().as_u16() == 404 => Fetched::None,
        _ => Fetched::Failed,
    }
}

async fn fresh(path: &Path) -> bool {
    let Ok(meta) = tokio::fs::metadata(path).await else { return false };
    meta.modified().ok().and_then(|m| SystemTime::now().duration_since(m).ok()).is_some_and(|age| age < NONE_TTL)
}

/// FNV-1a: a file name that stays the same across builds, unlike `DefaultHasher`.
fn fnv(s: &str) -> u64 {
    s.bytes().fold(0xcbf29ce484222325, |h, b| (h ^ b as u64).wrapping_mul(0x100000001b3))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn urls_by_email_kind() {
        assert_eq!(url("80094438+Mathu-lmn@users.noreply.github.com"), "https://avatars.githubusercontent.com/u/80094438?s=64&v=4");
        assert_eq!(url("octocat@users.noreply.github.com"), "https://github.com/octocat.png?size=64");
        assert_eq!(url("Dev.Hoppy@gmail.com"), "https://avatars.githubusercontent.com/u/e?email=dev.hoppy%40gmail.com&s=64");
    }

    #[test]
    fn cache_key_is_stable() {
        assert_eq!(fnv("a"), 0xaf63dc4c8601ec8c);
    }
}
