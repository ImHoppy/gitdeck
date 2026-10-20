use std::{collections::HashMap, path::PathBuf, sync::OnceLock};
use tao::{
    dpi::LogicalSize,
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoopBuilder, EventLoopProxy},
    platform::windows::EventLoopBuilderExtWindows,
    window::{Icon, WindowBuilder, WindowId},
};
use wry::{NewWindowResponse, WebContext, WebViewBuilder};

enum Request {
    Open(String),
    Title(WindowId, String),
}

static WINDOWS: OnceLock<EventLoopProxy<Request>> = OnceLock::new();

/// Native windows (WebView2) on their own thread; `open` adds one per call.
pub fn start(data_dir: PathBuf) {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let event_loop = EventLoopBuilder::<Request>::with_user_event().with_any_thread(true).build();
        let _ = tx.send(event_loop.create_proxy());
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
                Event::UserEvent(Request::Open(url)) => {
                    let (rgba, size) = crate::tray::icon_rgba();
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
                    let webview = WebViewBuilder::new_with_web_context(&mut context)
                        .with_url(url)
                        // window.open (the commit page pop-out) becomes another native window
                        .with_new_window_req_handler(move |url, _| {
                            let _ = popups.send_event(Request::Open(url));
                            NewWindowResponse::Deny
                        })
                        // the page names the repo it shows; the title bar and taskbar follow
                        .with_document_title_changed_handler(move |title| {
                            let _ = titles.send_event(Request::Title(id, title));
                        })
                        .build(&window);
                    match webview {
                        Ok(webview) => {
                            open.insert(window.id(), (window, webview));
                        }
                        Err(e) => eprintln!("could not create the window: {e}"),
                    }
                }
                Event::WindowEvent { window_id, event: WindowEvent::CloseRequested, .. } => {
                    open.remove(&window_id);
                }
                _ => {}
            }
        });
    });
    if let Ok(proxy) = rx.recv() {
        let _ = WINDOWS.set(proxy);
    }
}

/// False when windows were never started, so the caller can fall back to the browser.
pub fn open(url: &str) -> bool {
    WINDOWS.get().is_some_and(|p| p.send_event(Request::Open(url.to_string())).is_ok())
}
