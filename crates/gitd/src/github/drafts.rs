//! Pictures pasted into a comment that isn't sent yet: one folder per draft, uploaded by
//! `gh --attach` on submit, removed after success and kept after a failure for the retry.

use anyhow::bail;
use std::path::{Path, PathBuf};

/// GitHub's own limit for videos; pictures are smaller anyway.
pub const MAX_BYTES: usize = 100 * 1024 * 1024;

pub fn root() -> PathBuf {
    crate::cli::config_dir().join("drafts")
}

/// A draft id comes from the page: letters, digits and dashes only, so it stays one folder.
pub fn dir(root: &Path, draft: &str) -> anyhow::Result<PathBuf> {
    let valid = !draft.is_empty() && draft.len() <= 64 && draft.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    if !valid {
        bail!("bad draft id");
    }
    Ok(root.join(draft))
}

/// The extension GitHub accepts for these bytes, read from their signature.
pub fn kind(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("png")
    } else if bytes.starts_with(b"\xff\xd8\xff") {
        Some("jpg")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("gif")
    } else if bytes.len() > 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("webp")
    } else if bytes.len() > 12 && &bytes[4..8] == b"ftyp" {
        Some(if &bytes[8..10] == b"qt" { "mov" } else { "mp4" })
    } else {
        None
    }
}

/// `Screen Shot 1.PNG` → `Screen-Shot-1.png`, with the extension the bytes really have.
pub fn file_name(wanted: &str, ext: &str) -> String {
    let stem = Path::new(wanted).file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    let mut clean: String = stem.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' }).take(60).collect();
    clean = clean.trim_matches('-').to_string();
    if clean.is_empty() {
        clean = "image".into();
    }
    format!("{clean}.{ext}")
}

/// Saves `bytes`, renaming on a clash; answers the name the body should reference.
pub async fn save(dir: &Path, wanted: &str, bytes: &[u8]) -> anyhow::Result<String> {
    if bytes.len() > MAX_BYTES {
        bail!("{} is larger than {} MB", wanted, MAX_BYTES / 1024 / 1024);
    }
    let Some(ext) = kind(bytes) else { bail!("{wanted}: only PNG, JPEG, GIF, WebP, MP4 and MOV can be attached") };
    tokio::fs::create_dir_all(dir).await?;
    let base = file_name(wanted, ext);
    let mut name = base.clone();
    for n in 1.. {
        if !tokio::fs::try_exists(dir.join(&name)).await.unwrap_or(false) {
            break;
        }
        name = format!("{}-{n}.{ext}", base.trim_end_matches(&format!(".{ext}")));
    }
    tokio::fs::write(dir.join(&name), bytes).await?;
    Ok(name)
}

/// The draft's files that the body references as `./name`, as `--attach` paths; a picture whose
/// reference was deleted from the text is not uploaded.
pub fn referenced(dir: &Path, body: &str) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(dir) else { return Vec::new() };
    let mut names: Vec<String> = entries.filter_map(|e| e.ok()).map(|e| e.file_name().to_string_lossy().into_owned()).collect();
    names.sort();
    names.into_iter().filter(|n| body.contains(&format!("(./{n})"))).map(|n| format!("./{n}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signatures_and_names() {
        assert_eq!(kind(b"\x89PNG\r\n\x1a\nrest"), Some("png"));
        assert_eq!(kind(b"RIFF\0\0\0\0WEBPVP8 "), Some("webp"));
        assert_eq!(kind(b"\0\0\0\x20ftypqt  \0\0"), Some("mov"));
        assert_eq!(kind(b"<svg>"), None);
        assert_eq!(file_name("Screen Shot 1.PNG", "png"), "Screen-Shot-1.png");
        assert_eq!(file_name("../../etc/passwd", "jpg"), "passwd.jpg");
        assert_eq!(file_name("", "gif"), "image.gif");
        assert!(dir(Path::new("/d"), "../x").is_err());
        assert!(dir(Path::new("/d"), "a1-b2").is_ok());
    }

    #[tokio::test]
    async fn saves_without_clashing_and_attaches_what_the_body_uses() {
        let dir = std::env::temp_dir().join(format!("gitdeck-draft-test-{}", std::process::id()));
        let _ = tokio::fs::remove_dir_all(&dir).await;
        let png = b"\x89PNG\r\n\x1a\n....";
        assert_eq!(save(&dir, "shot.png", png).await.unwrap(), "shot.png");
        assert_eq!(save(&dir, "shot.png", png).await.unwrap(), "shot-1.png");
        assert!(save(&dir, "x.txt", b"hello").await.is_err());
        assert_eq!(referenced(&dir, "see ![a](./shot-1.png)"), ["./shot-1.png"]);
        let _ = tokio::fs::remove_dir_all(&dir).await;
    }
}
