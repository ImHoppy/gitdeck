use muda::{AboutMetadata, Menu, PredefinedMenuItem, Submenu};

/// Without an Edit menu macOS sends no Cmd+C / Cmd+V / Cmd+A to the page.
pub fn install() {
    let app = Submenu::with_items(
        "gitdeck",
        true,
        &[
            &PredefinedMenuItem::about(None, Some(AboutMetadata::default())),
            &PredefinedMenuItem::separator(),
            &PredefinedMenuItem::hide(None),
            &PredefinedMenuItem::quit(None),
        ],
    );
    let edit = Submenu::with_items(
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(None),
            &PredefinedMenuItem::redo(None),
            &PredefinedMenuItem::separator(),
            &PredefinedMenuItem::cut(None),
            &PredefinedMenuItem::copy(None),
            &PredefinedMenuItem::paste(None),
            &PredefinedMenuItem::select_all(None),
        ],
    );
    let window = Submenu::with_items("Window", true, &[&PredefinedMenuItem::minimize(None), &PredefinedMenuItem::fullscreen(None)]);
    let (Ok(app), Ok(edit), Ok(window)) = (app, edit, window) else { return };
    let menu = Menu::new();
    if menu.append_items(&[&app, &edit, &window]).is_ok() {
        menu.init_for_nsapp();
        // the menu must outlive the app
        std::mem::forget(menu);
    }
}
