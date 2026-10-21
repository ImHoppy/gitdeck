//! Pictures in PR bodies and comments, fetched by gitd so the page never calls GitHub. Only
//! GitHub's image hosts are accepted, so the proxy can't be pointed at anything else.

use std::{
    path::{Path, PathBuf},
    sync::OnceLock,
    time::Duration,
};
use tokio::sync::Semaphore;

const TIMEOUT: Duration = Duration::from_secs(20);
const MAX_BYTES: u64 = 25 * 1024 * 1024;
const PARALLEL: usize = 4;

pub fn cache_dir() -> PathBuf {
    crate::cli::config_dir().join("gh-images")
}

/// The host and path of an accepted image URL; `None` for anything else.
fn parts(url: &str) -> Option<(String, &str)> {
    let rest = url.strip_prefix("https://")?;
    let (host, path) = rest.split_once('/').map_or((rest, ""), |(h, p)| (h, p));
    if host.contains(['@', ':']) {
        return None;
    }
    Some((host.to_ascii_lowercase(), path))
}

pub fn allowed(url: &str) -> bool {
    let Some((host, path)) = parts(url) else { return false };
    match host.as_str() {
        // attachments (`user-attachments/assets/…`, old `<o>/<r>/assets/…`) and repo files (`<o>/<r>/raw/…`)
        "github.com" => {
            let segments: Vec<&str> = path.split('/').collect();
            path.starts_with("user-attachments/") || matches!(segments.get(2), Some(&"assets") | Some(&"raw"))
        }
        h => h.ends_with(".githubusercontent.com"),
    }
}

/// Private repos' attachments need the login; it goes only to GitHub itself, never to camo or a
/// redirect target (ureq drops the header on redirects).
pub fn wants_token(url: &str) -> bool {
    parts(url).is_some_and(|(host, _)| host == "github.com" || host == "raw.githubusercontent.com")
}

pub async fn get(cache: &Path, url: &str, token: Option<String>) -> Option<Vec<u8>> {
    let file = cache.join(format!("{:016x}", fnv(url)));
    if let Ok(bytes) = tokio::fs::read(&file).await {
        return Some(bytes);
    }
    static LIMIT: OnceLock<Semaphore> = OnceLock::new();
    let _permit = LIMIT.get_or_init(|| Semaphore::new(PARALLEL)).acquire().await.ok()?;
    let url = url.to_string();
    let bytes = tokio::task::spawn_blocking(move || fetch(&url, token.as_deref())).await.ok()??;
    let _ = tokio::fs::create_dir_all(cache).await;
    let _ = tokio::fs::write(&file, &bytes).await;
    Some(bytes)
}

fn fetch(url: &str, token: Option<&str>) -> Option<Vec<u8>> {
    let agent: ureq::Agent = ureq::Agent::config_builder().timeout_global(Some(TIMEOUT)).build().into();
    let mut req = agent.get(url);
    if let Some(token) = token {
        req = req.header("Authorization", &format!("token {token}"));
    }
    let resp = req.call().ok()?;
    resp.into_body().with_config().limit(MAX_BYTES).read_to_vec().ok().filter(|b| !b.is_empty())
}

pub fn content_type(bytes: &[u8]) -> &'static str {
    match super::drafts::kind(bytes) {
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("jpg") => "image/jpeg",
        Some("mp4") => "video/mp4",
        Some("mov") => "video/quicktime",
        _ if bytes.trim_ascii_start().starts_with(b"<svg") || bytes.trim_ascii_start().starts_with(b"<?xml") => "image/svg+xml",
        _ => "application/octet-stream",
    }
}

fn fnv(s: &str) -> u64 {
    s.bytes().fold(0xcbf29ce484222325, |h, b| (h ^ b as u64).wrapping_mul(0x100000001b3))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_github_image_hosts() {
        assert!(allowed("https://github.com/user-attachments/assets/0d2e-11"));
        assert!(allowed("https://github.com/AvaCreation/ui/assets/12/abc"));
        assert!(allowed("https://github.com/a/b/raw/main/docs/shot.png"));
        assert!(allowed("https://camo.githubusercontent.com/abc/def"));
        assert!(allowed("https://private-user-images.githubusercontent.com/1/2.png?jwt=x"));
        assert!(!allowed("http://github.com/user-attachments/assets/x"));
        assert!(!allowed("https://github.com/a/b/pull/3"));
        assert!(!allowed("https://evil.com/x.png"));
        assert!(!allowed("https://githubusercontent.com.evil.com/x.png"));
        assert!(!allowed("https://user@github.com/user-attachments/assets/x"));
        assert!(!allowed("https://github.com:8443/user-attachments/assets/x"));
    }

    #[test]
    fn the_token_goes_to_github_only() {
        assert!(wants_token("https://github.com/user-attachments/assets/x"));
        assert!(!wants_token("https://camo.githubusercontent.com/x"));
    }

    #[test]
    fn svg_is_served_as_svg() {
        assert_eq!(content_type(b"  <svg xmlns=\"\"/>"), "image/svg+xml");
        assert_eq!(content_type(b"\x89PNG\r\n\x1a\n.."), "image/png");
    }
}
