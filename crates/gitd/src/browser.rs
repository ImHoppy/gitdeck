use std::process::{Command, Stdio};

/// Opens `url` in its own chromeless app window (Edge or Chrome `--app`), falling back to a
/// browser tab. Each call is a new window, so several can be open at once.
pub fn open(url: &str) {
    let app = format!("--app={url}");
    let spawned = if cfg!(windows) {
        // `start` finds msedge through App Paths; the empty argument is the window title it expects,
        // and cmd would split the query on a bare `&`
        let (url, app) = (url.replace('&', "^&"), app.replace('&', "^&"));
        Command::new("cmd").args(["/c", "start", "", "msedge", &app]).status().is_ok_and(|s| s.success())
            || Command::new("cmd").args(["/c", "start", "", &url]).spawn().is_ok()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(url).spawn().is_ok()
    } else {
        ["chromium", "google-chrome", "microsoft-edge"]
            .iter()
            .any(|b| Command::new(b).arg(&app).stdout(Stdio::null()).stderr(Stdio::null()).spawn().is_ok())
            || Command::new("xdg-open").arg(url).spawn().is_ok()
    };
    if !spawned {
        eprintln!("could not open a browser window for {url}");
    }
}

/// `/login` link for this server; `open` asks the page to show the repo at that path.
pub fn login_url(bind: &std::net::SocketAddr, token: &str, open: Option<&std::path::Path>) -> String {
    let mut url = format!("http://{bind}/login?token={token}");
    if let Some(path) = open {
        url.push_str("&open=");
        url.push_str(&encode(&path.to_string_lossy()));
    }
    url
}

pub fn encode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn login_url_carries_the_encoded_path() {
        let bind = "127.0.0.1:7777".parse().unwrap();
        let url = login_url(&bind, "t", Some(std::path::Path::new("E:/My Repo")));
        assert_eq!(url, "http://127.0.0.1:7777/login?token=t&open=E%3A%2FMy%20Repo");
    }
}
