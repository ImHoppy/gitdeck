use super::release::Asset;
use anyhow::{bail, Context};
use sha2::{Digest, Sha256};
use std::{
    path::{Path, PathBuf},
    time::Duration,
};

const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(300);
const MAX_BYTES: u64 = 200 * 1024 * 1024;

/// Downloads `asset` and checks it against the sha256 GitHub recorded; an asset without one is refused.
pub fn download(asset: &Asset) -> anyhow::Result<Vec<u8>> {
    let expected = asset.sha256().context("the release publishes no checksum for this binary")?;
    let agent: ureq::Agent = ureq::Agent::config_builder().timeout_global(Some(DOWNLOAD_TIMEOUT)).build().into();
    let mut resp = agent.get(&asset.browser_download_url).header("User-Agent", super::USER_AGENT).call()?;
    let bytes = resp.body_mut().with_config().limit(MAX_BYTES).read_to_vec()?;
    if bytes.len() as u64 != asset.size {
        bail!("downloaded {} bytes instead of {}", bytes.len(), asset.size);
    }
    let actual = format!("{:x}", Sha256::digest(&bytes));
    if !actual.eq_ignore_ascii_case(expected) {
        bail!("checksum mismatch: got {actual}, the release says {expected}");
    }
    Ok(bytes)
}

fn sibling(exe: &Path, suffix: &str) -> PathBuf {
    let mut name = exe.file_name().unwrap_or_default().to_os_string();
    name.push(suffix);
    exe.with_file_name(name)
}

fn stem_and_ext(exe: &Path) -> (String, String) {
    let stem = exe.file_stem().unwrap_or_default().to_string_lossy().into_owned();
    let ext = exe.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    (stem, ext)
}

/// `gitd.exe` running 0.6.0 moves aside as `gitd-0.6.0.exe`.
fn versioned(exe: &Path, version: &str) -> PathBuf {
    let (stem, ext) = stem_and_ext(exe);
    exe.with_file_name(format!("{stem}-{version}{ext}"))
}

/// Puts `bytes` in place of `exe`, which runs `current`. A running exe can be renamed on Windows
/// but not overwritten, so it moves aside under its version, removed at the next start.
pub fn replace_exe(exe: &Path, current: &str, bytes: &[u8]) -> anyhow::Result<()> {
    let new = sibling(exe, ".new");
    std::fs::write(&new, bytes).with_context(|| format!("cannot write next to {}", exe.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&new, std::fs::Permissions::from_mode(0o755))?;
    }
    if cfg!(windows) {
        let old = versioned(exe, current);
        let _ = std::fs::remove_file(&old);
        std::fs::rename(exe, &old).context("cannot move the running gitd aside")?;
        if let Err(e) = std::fs::rename(&new, exe) {
            let _ = std::fs::rename(&old, exe);
            return Err(e).context("cannot put the new gitd in place");
        }
    } else {
        std::fs::rename(&new, exe).context("cannot put the new gitd in place")?;
    }
    Ok(())
}

/// The exes earlier updates moved aside, free to delete once their process is gone.
pub fn remove_leftovers(exe: &Path) {
    let _ = std::fs::remove_file(sibling(exe, ".new"));
    let (stem, ext) = stem_and_ext(exe);
    let Some(dir) = exe.parent().and_then(|d| std::fs::read_dir(d).ok()) else { return };
    for entry in dir.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let version = name.strip_prefix(&format!("{stem}-")).and_then(|rest| rest.strip_suffix(ext.as_str()));
        if version.is_some_and(|v| super::release::parse_version(v).is_some()) {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn swaps_the_binary_and_cleans_up() {
        let dir = std::env::temp_dir().join(format!("gitd-update-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let exe = dir.join("gitd.exe");
        std::fs::write(&exe, b"old").unwrap();
        let other = dir.join("gitd-tools.exe");
        std::fs::write(&other, b"keep").unwrap();
        replace_exe(&exe, "0.6.0", b"new").unwrap();
        assert_eq!(std::fs::read(&exe).unwrap(), b"new");
        assert!(!sibling(&exe, ".new").exists());
        if cfg!(windows) {
            assert_eq!(std::fs::read(dir.join("gitd-0.6.0.exe")).unwrap(), b"old");
        }
        remove_leftovers(&exe);
        assert!(!dir.join("gitd-0.6.0.exe").exists());
        assert!(other.exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn refuses_an_asset_without_checksum() {
        let asset = Asset { name: "gitd".into(), browser_download_url: "https://invalid.example/gitd".into(), size: 1, digest: None };
        assert!(download(&asset).unwrap_err().to_string().contains("no checksum"));
    }
}
