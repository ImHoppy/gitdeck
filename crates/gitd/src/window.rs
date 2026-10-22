use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Mutex, OnceLock,
    },
};
use tao::{
    dpi::LogicalSize,
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoop, EventLoopBuilder, EventLoopProxy},
    window::{Icon, WindowBuilder, WindowId},
};
use wry::{NewWindowResponse, WebContext, WebViewBuilder};

pub enum Request {
    Open(String),
    Title(WindowId, String),
    Zoom(f64),
}

static WINDOWS: OnceLock<EventLoopProxy<Request>> = OnceLock::new();
static OPEN: AtomicUsize = AtomicUsize::new(0);
static ZOOM: Mutex<f64> = Mutex::new(1.0);

/// Lets the page tell a gitdeck window from a browser tab, which zooms by itself.
const MARK_WINDOW: &str = "window.gitdeckWindow = true";

/// The zoom of every native window, open now or later.
pub fn set_zoom(level: f64) {
    *ZOOM.lock().unwrap() = level;
    if let Some(proxy) = WINDOWS.get() {
        let _ = proxy.send_event(Request::Zoom(level));
    }
}

/// How many native windows are open: an update restart reopens one only if there were some.
pub fn open_count() -> usize {
    OPEN.load(Ordering::Relaxed)
}

/// Native windows (WebView2, WKWebView, WebKitGTK) on their own thread; `open` adds one per call.
#[cfg(not(target_os = "macos"))]
pub fn start(data_dir: PathBuf) {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        #[cfg(windows)]
        use tao::platform::windows::EventLoopBuilderExtWindows;
        #[cfg(not(windows))]
        use tao::platform::unix::EventLoopBuilderExtUnix;
        let mut builder = EventLoopBuilder::<Request>::with_user_event();
        builder.with_any_thread(true);
        #[cfg(target_os = "linux")]
        {
            crate::desktop_entry::install();
            builder.with_app_id(crate::desktop_entry::APP_ID);
        }
        let event_loop = builder.build();
        let _ = tx.send(event_loop.create_proxy());
        run(event_loop, data_dir);
    });
    if let Ok(proxy) = rx.recv() {
        let _ = WINDOWS.set(proxy);
    }
}

/// macOS only runs windows on the main thread: `main` builds the loop there and calls `run`.
#[cfg(target_os = "macos")]
pub fn main_thread_loop() -> EventLoop<Request> {
    let event_loop = EventLoopBuilder::<Request>::with_user_event().build();
    let _ = WINDOWS.set(event_loop.create_proxy());
    crate::mac_menu::install();
    event_loop
}

pub fn run(event_loop: EventLoop<Request>, data_dir: PathBuf) -> ! {
    let proxy = event_loop.create_proxy();
    // one profile for every window, so the login cookie is shared
    let mut context = WebContext::new(Some(data_dir));
    let mut open: HashMap<WindowId, (tao::window::Window, wry::WebView)> = HashMap::new();
    event_loop.run(move |event, target, flow| {
        *flow = ControlFlow::Wait;
        match event {
            Event::UserEvent(Request::Title(id, title)) => {
                if let Some((window, _)) = open.get(&id) {
                    window.set_title(&title);
                }
            }
            Event::UserEvent(Request::Zoom(level)) => {
                for (_, webview) in open.values() {
                    let _ = webview.zoom(level);
                }
            }
            Event::UserEvent(Request::Open(url)) => {
                let (rgba, size) = crate::icon::rgba();
                let Ok(window) = WindowBuilder::new()
                    .with_title("gitdeck")
                    .with_inner_size(LogicalSize::new(1400.0, 900.0))
                    .with_window_icon(Icon::from_rgba(rgba, size, size).ok())
                    .build(target)
                else {
                    return;
                };
                let popups = proxy.clone();
                let titles = proxy.clone();
                let id = window.id();
                let builder = WebViewBuilder::new_with_web_context(&mut context)
                    .with_url(url)
                    .with_initialization_script(MARK_WINDOW)
                    // window.open (the commit page pop-out) becomes another native window
                    .with_new_window_req_handler(move |url, _| {
                        let _ = popups.send_event(Request::Open(url));
                        NewWindowResponse::Deny
                    })
                    // the page names the repo it shows; the title bar and taskbar follow
                    .with_document_title_changed_handler(move |title| {
                        let _ = titles.send_event(Request::Title(id, title));
                    });
                let webview = attach(builder, &window);
                match webview {
                    Ok(webview) => {
                        let _ = webview.zoom(*ZOOM.lock().unwrap());
                        open.insert(window.id(), (window, webview));
                        OPEN.store(open.len(), Ordering::Relaxed);
                    }
                    Err(e) => eprintln!("could not create the window: {e}"),
                }
            }
            Event::WindowEvent { window_id, event: WindowEvent::CloseRequested, .. } => {
                open.remove(&window_id);
                OPEN.store(open.len(), Ordering::Relaxed);
            }
            _ => {}
        }
    });
}

#[cfg(not(target_os = "linux"))]
fn attach(builder: WebViewBuilder<'_>, window: &tao::window::Window) -> wry::Result<wry::WebView> {
    builder.build(window)
}

/// `build` on Linux only works under X11; the GTK box works under Wayland too.
#[cfg(target_os = "linux")]
fn attach(builder: WebViewBuilder<'_>, window: &tao::window::Window) -> wry::Result<wry::WebView> {
    use tao::platform::unix::WindowExtUnix;
    use wry::WebViewBuilderExtUnix;
    builder.build_gtk(window.default_vbox().expect("tao windows have a box"))
}

/// A Linux host reached over SSH has no desktop to open a window on.
#[cfg(not(target_os = "macos"))]
pub fn has_display() -> bool {
    cfg!(windows) || std::env::var_os("DISPLAY").is_some() || std::env::var_os("WAYLAND_DISPLAY").is_some()
}

/// False when windows were never started, so the caller can fall back to the browser.
pub fn open(url: &str) -> bool {
    WINDOWS.get().is_some_and(|p| p.send_event(Request::Open(url.to_string())).is_ok())
}
