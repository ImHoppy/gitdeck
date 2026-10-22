use serde::Deserialize;

pub const LATEST_URL: &str = "https://api.github.com/repos/ImHoppy/gitdeck/releases/latest";

pub type Version = (u32, u32, u32);

#[derive(Debug, Deserialize)]
pub struct Release {
    pub tag_name: String,
    pub assets: Vec<Asset>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Asset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
    /// `sha256:<hex>`, computed by GitHub on upload.
    pub digest: Option<String>,
}

/// The binary of this platform, as ci.yml's release job names it.
pub fn asset_name() -> Option<&'static str> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => Some("gitd-windows-x64.exe"),
        ("linux", "x86_64") => Some("gitd-linux-x64"),
        ("macos", "aarch64") => Some("gitd-macos-arm64"),
        _ => None,
    }
}

/// `v0.6.0` or `0.6.0`.
pub fn parse_version(s: &str) -> Option<Version> {
    let mut parts = s.trim().trim_start_matches('v').split('.').map(|p| p.parse::<u32>().ok());
    Some((parts.next()??, parts.next()??, parts.next()??))
}

pub fn display(v: Version) -> String {
    format!("{}.{}.{}", v.0, v.1, v.2)
}

impl Release {
    /// The version and this platform's binary, when the release is newer than `current`.
    pub fn newer_than(&self, current: Version, asset: &str) -> Option<(Version, Option<&Asset>)> {
        let version = parse_version(&self.tag_name).filter(|v| *v > current)?;
        Some((version, self.assets.iter().find(|a| a.name == asset)))
    }
}

impl Asset {
    pub fn sha256(&self) -> Option<&str> {
        self.digest.as_deref()?.strip_prefix("sha256:")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const LATEST: &str = r#"{"tag_name":"v0.7.0","draft":false,"assets":[
        {"name":"gitd-linux-x64","browser_download_url":"https://x/l","size":10,"digest":"sha256:aa"},
        {"name":"gitd-windows-x64.exe","browser_download_url":"https://x/w","size":12,"digest":null}]}"#;

    #[test]
    fn parses_versions() {
        assert_eq!(parse_version("v0.6.0"), Some((0, 6, 0)));
        assert_eq!(parse_version("1.2.3"), Some((1, 2, 3)));
        assert_eq!(parse_version("v1.2"), None);
        assert_eq!(parse_version("nightly"), None);
    }

    #[test]
    fn finds_a_newer_release_and_its_binary() {
        let release: Release = serde_json::from_str(LATEST).unwrap();
        let (version, asset) = release.newer_than((0, 6, 0), "gitd-linux-x64").unwrap();
        assert_eq!(version, (0, 7, 0));
        assert_eq!(asset.unwrap().sha256(), Some("aa"));
        assert!(release.newer_than((0, 6, 0), "gitd-windows-x64.exe").unwrap().1.unwrap().sha256().is_none());
        assert!(release.newer_than((0, 6, 0), "gitd-freebsd").unwrap().1.is_none());
        assert!(release.newer_than((0, 7, 0), "gitd-linux-x64").is_none());
        assert!(release.newer_than((1, 0, 0), "gitd-linux-x64").is_none());
    }
}
