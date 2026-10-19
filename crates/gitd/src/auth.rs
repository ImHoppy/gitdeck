use rand::Rng;
use std::path::Path;

const TOKEN_FILE: &str = "token";
pub const COOKIE: &str = "gitdeck_token";

pub fn load_or_create(dir: &Path) -> anyhow::Result<String> {
    let path = dir.join(TOKEN_FILE);
    if let Ok(t) = std::fs::read_to_string(&path) {
        let t = t.trim().to_string();
        if !t.is_empty() {
            return Ok(t);
        }
    }
    let token: String = rand::rng()
        .sample_iter(rand::distr::Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();
    std::fs::create_dir_all(dir)?;
    std::fs::write(&path, &token)?;
    Ok(token)
}

pub fn cookie_matches(cookie_header: Option<&str>, token: &str) -> bool {
    cookie_header.is_some_and(|h| {
        h.split(';')
            .filter_map(|kv| kv.trim().split_once('='))
            .any(|(k, v)| k == COOKIE && v == token)
    })
}
