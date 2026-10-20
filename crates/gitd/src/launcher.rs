use crate::browser;

/// Shows `url` in a native window, or in the browser when asked or when there are no windows.
pub fn show(url: &str, in_browser: bool) {
    #[cfg(windows)]
    if !in_browser && crate::window::open(url) {
        return;
    }
    let _ = in_browser;
    browser::open(url);
}

/// Asks the gitd already listening on `bind` to show `open` in one of its windows.
pub fn ask_running(bind: &std::net::SocketAddr, token: &str, open: Option<&std::path::Path>) -> bool {
    use std::io::{Read, Write};
    let mut path = format!("/window?token={token}");
    if let Some(p) = open {
        path.push_str("&open=");
        path.push_str(&browser::encode(&p.to_string_lossy()));
    }
    let Ok(mut stream) = std::net::TcpStream::connect_timeout(bind, std::time::Duration::from_secs(2)) else { return false };
    let request = format!("GET {path} HTTP/1.1\r\nHost: {bind}\r\nConnection: close\r\n\r\n");
    let mut reply = String::new();
    stream.write_all(request.as_bytes()).is_ok() && stream.read_to_string(&mut reply).is_ok() && reply.starts_with("HTTP/1.1 204")
}
