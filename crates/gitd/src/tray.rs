use crate::server::AppState;
use std::sync::Arc;
use tokio::runtime::Handle;
use tray_icon::{
    menu::{CheckMenuItem, Menu, MenuEvent, MenuItem},
    Icon, TrayIcon, TrayIconBuilder,
};

/// Windows tray icon with Open / Keep running / Quit, on its own thread with a Win32 message loop.
#[cfg(windows)]
pub fn spawn(app: Arc<AppState>, url: String) {
    let runtime = Handle::current();
    std::thread::spawn(move || {
        let Some(_tray) = build(app, url, runtime) else { return };
        pump_messages();
    });
}

/// macOS menu bar item with Open / Keep running / Quit. AppKit only takes it on the main thread,
/// so it is built in the window loop; with `--browser` there is no such loop and no item.
#[cfg(target_os = "macos")]
pub fn spawn(app: Arc<AppState>, url: String) {
    let runtime = Handle::current();
    crate::window::on_main(Box::new(move || {
        if let Some(tray) = build(app, url, runtime) {
            // the item stays until gitd exits
            std::mem::forget(tray);
        }
    }));
}

fn build(app: Arc<AppState>, url: String, runtime: Handle) -> Option<TrayIcon> {
    let open = MenuItem::new("Open", true, None);
    let keep = CheckMenuItem::new("Keep running", true, app.lifecycle.keep_running(), None);
    let quit = MenuItem::new("Quit", true, None);
    let menu = Menu::new();
    menu.append_items(&[&open, &keep, &quit]).ok()?;
    let (open_id, keep_id, quit_id) = (open.id().clone(), keep.id().clone(), quit.id().clone());
    MenuEvent::set_event_handler(Some(move |e: MenuEvent| {
        if e.id == open_id {
            crate::launcher::show(&url, false);
        } else if e.id == keep_id {
            app.toggle_keep_running(&runtime);
        } else if e.id == quit_id {
            app.lifecycle.shutdown.notify_one();
        }
    }));
    let builder = TrayIconBuilder::new().with_menu(Box::new(menu)).with_tooltip("gitdeck");
    // a menu bar item is a template: macOS draws it in the bar's own colour
    #[cfg(target_os = "macos")]
    let builder = builder.with_icon(icon(crate::icon::template())).with_icon_as_template(true);
    #[cfg(windows)]
    let builder = builder.with_icon(icon(crate::icon::rgba()));
    builder.build().ok()
}

#[cfg(windows)]
fn pump_messages() {
    use windows_sys::Win32::UI::WindowsAndMessaging::{DispatchMessageW, GetMessageW, TranslateMessage, MSG};
    let mut msg: MSG = unsafe { std::mem::zeroed() };
    // SAFETY: plain Win32 message loop on the thread that owns the tray window
    unsafe {
        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
}

fn icon((rgba, size): (Vec<u8>, u32)) -> Icon {
    Icon::from_rgba(rgba, size, size).expect("valid icon size")
}
