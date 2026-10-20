use crate::server::AppState;
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
                crate::launcher::show(&url, false);
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

/// The favicon (a branch graph on an accent tile) drawn in code, so no image file has to ship.
fn icon() -> Icon {
    let (rgba, size) = icon_rgba();
    Icon::from_rgba(rgba, size, size).expect("valid icon size")
}

pub fn icon_rgba() -> (Vec<u8>, u32) {
    let mut rgba = Vec::with_capacity((SIZE * SIZE * 4) as usize);
    for y in 0..SIZE {
        for x in 0..SIZE {
            let (px, py) = (x as f32 + 0.5, y as f32 + 0.5);
            let tile = coverage(rounded_rect(px, py, 16.0, 7.0));
            let mark = coverage(graph(px, py));
            let mix = |bg: f32, fg: f32| (bg + (fg - bg) * mark) as u8;
            rgba.extend_from_slice(&[mix(0x00 as f32, 255.0), mix(0x78 as f32, 255.0), mix(0xd4 as f32, 255.0), (tile * 255.0) as u8]);
        }
    }
    (rgba, SIZE)
}

/// Signed distance to a square of half-size `half` centred on the tile, with corner radius `r`.
fn rounded_rect(x: f32, y: f32, half: f32, r: f32) -> f32 {
    let (dx, dy) = ((x - 16.0).abs() - (half - r), (y - 16.0).abs() - (half - r));
    (dx.max(0.0).powi(2) + dy.max(0.0).powi(2)).sqrt() + dx.max(dy).min(0.0) - r
}

/// Signed distance to the white mark: the main lane, the branch curve and three commits.
fn graph(x: f32, y: f32) -> f32 {
    let dot = |cx: f32, cy: f32| ((x - cx).powi(2) + (y - cy).powi(2)).sqrt() - 3.0;
    let lane = segment(x, y, (11.0, 7.0), (11.0, 25.0)) - 1.3;
    // the curve as a few straight pieces is plenty at 32 px
    let curve = [(11.0, 20.0), (12.0, 16.0), (16.0, 15.0), (20.0, 14.0), (21.0, 10.0)]
        .windows(2)
        .map(|w| segment(x, y, w[0], w[1]) - 1.3)
        .fold(f32::MAX, f32::min);
    [dot(11.0, 7.0), dot(11.0, 25.0), dot(21.0, 10.0), lane, curve].into_iter().fold(f32::MAX, f32::min)
}

fn segment(x: f32, y: f32, a: (f32, f32), b: (f32, f32)) -> f32 {
    let (bx, by) = (b.0 - a.0, b.1 - a.1);
    let t = (((x - a.0) * bx + (y - a.1) * by) / (bx * bx + by * by)).clamp(0.0, 1.0);
    ((x - a.0 - bx * t).powi(2) + (y - a.1 - by * t).powi(2)).sqrt()
}

/// Antialiased fill from a signed distance.
fn coverage(d: f32) -> f32 {
    (0.5 - d).clamp(0.0, 1.0)
}
