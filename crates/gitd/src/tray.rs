use crate::{browser, server::AppState};
use std::sync::Arc;
use tray_icon::{
    menu::{CheckMenuItem, Menu, MenuEvent, MenuItem},
    Icon, TrayIconBuilder,
};

const SIZE: u32 = 32;

/// Windows tray icon with Open / Keep running / Quit, on its own thread with a Win32 message loop.
pub fn spawn(app: Arc<AppState>, url: String) {
    std::thread::spawn(move || {
        let open = MenuItem::new("Open", true, None);
        let keep = CheckMenuItem::new("Keep running", true, app.lifecycle.keep_running(), None);
        let quit = MenuItem::new("Quit", true, None);
        let menu = Menu::new();
        if menu.append_items(&[&open, &keep, &quit]).is_err() {
            return;
        }
        let (open_id, keep_id, quit_id) = (open.id().clone(), keep.id().clone(), quit.id().clone());
        MenuEvent::set_event_handler(Some(move |e: MenuEvent| {
            if e.id == open_id {
                browser::open(&url);
            } else if e.id == keep_id {
                app.lifecycle.set_keep_running(!app.lifecycle.keep_running());
            } else if e.id == quit_id {
                app.lifecycle.shutdown.notify_one();
            }
        }));
        let Ok(_tray) = TrayIconBuilder::new().with_menu(Box::new(menu)).with_tooltip("gitdeck").with_icon(icon()).build()
        else {
            return;
        };
        pump_messages();
    });
}

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

/// A filled circle in the accent colour, so no image file has to ship.
fn icon() -> Icon {
    let mut rgba = Vec::with_capacity((SIZE * SIZE * 4) as usize);
    let c = (SIZE as f32 - 1.0) / 2.0;
    for y in 0..SIZE {
        for x in 0..SIZE {
            let d = ((x as f32 - c).powi(2) + (y as f32 - c).powi(2)).sqrt();
            let alpha = if d <= c - 1.0 { 255 } else if d <= c { 128 } else { 0 };
            rgba.extend_from_slice(&[0x44, 0x93, 0xf8, alpha]);
        }
    }
    Icon::from_rgba(rgba, SIZE, SIZE).expect("valid icon size")
}
