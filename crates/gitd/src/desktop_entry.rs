use std::path::Path;

/// The window's app id: GNOME and KDE find the taskbar icon through the `.desktop` file of this name.
pub const APP_ID: &str = "io.github.imhoppy.gitdeck";

const ICON: &str = include_str!("../../../web/public/favicon.svg");

/// Writes the desktop entry and icon to the user's data dir, so a window shows the gitdeck icon.
pub fn install() {
    let Some(data) = std::env::var_os("XDG_DATA_HOME")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| Path::new(&h).join(".local/share")))
    else {
        return;
    };
    let Ok(exe) = std::env::current_exe() else { return };
    let entry = format!(
        "[Desktop Entry]\nType=Application\nName=gitdeck\nComment=Git repository browser\nExec=\"{}\" --open %f\nIcon={APP_ID}\nTerminal=false\nCategories=Development;RevisionControl;\nStartupWMClass={APP_ID}\n",
        exe.display()
    );
    write_if_changed(&data.join(format!("icons/hicolor/scalable/apps/{APP_ID}.svg")), ICON);
    write_if_changed(&data.join(format!("applications/{APP_ID}.desktop")), &entry);
}

fn write_if_changed(path: &Path, content: &str) {
    if std::fs::read_to_string(path).is_ok_and(|c| c == content) {
        return;
    }
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    if let Err(e) = std::fs::write(path, content) {
        eprintln!("could not write {}: {e}", path.display());
    }
}
