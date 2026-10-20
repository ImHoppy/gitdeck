// the .exe's own icon (taskbar, shortcuts, Explorer); the window and tray draw theirs in code
fn main() {
    println!("cargo:rerun-if-changed=assets/gitdeck.ico");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let mut res = winresource::WindowsResource::new();
        res.set_icon("assets/gitdeck.ico");
        if let Err(e) = res.compile() {
            println!("cargo:warning=no exe icon: {e}");
        }
    }
}
