use std::process::Command;

pub fn open(url: &str) {
    let spawned = if cfg!(windows) {
        // the empty argument is the window title `start` expects before the target
        Command::new("cmd").args(["/c", "start", "", url]).spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(url).spawn()
    } else {
        Command::new("xdg-open").arg(url).spawn()
    };
    if let Err(e) = spawned {
        eprintln!("could not open the browser: {e}");
    }
}
