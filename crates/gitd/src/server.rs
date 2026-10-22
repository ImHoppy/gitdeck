use crate::{
    auth, browser, cli, command_log::CommandLog, events::{Event, Scoped}, handlers, lifecycle::Lifecycle, live::LiveWorkspace,
    protocol::{Request, Response},
    static_files,
};
use axum::{
    extract::{ws::{Message, WebSocket}, Query, State, WebSocketUpgrade},
    http::{header, HeaderMap, StatusCode, Uri},
    response::{IntoResponse, Redirect, Response as HttpResponse},
    routing::get,
    Router,
};
use futures::{SinkExt, StreamExt};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::sync::{broadcast, mpsc, watch, Mutex};
use gitcore::ProcessRunner;
use workspace::Config;

pub struct AppState {
    pub config: std::sync::Mutex<Config>,
    pub config_path: std::path::PathBuf,
    pub runner: ProcessRunner,
    pub token: String,
    pub events: broadcast::Sender<Event>,
    pub workspace_events: broadcast::Sender<Scoped>,
    pub live: Mutex<HashMap<String, LiveWorkspace>>,
    /// The workspace each window shows, by connection.
    pub bindings: std::sync::Mutex<HashMap<u64, String>>,
    pub lifecycle: Lifecycle,
    pub commands: Arc<CommandLog>,
    pub github: Arc<crate::github::Github>,
    pub updater: crate::updater::Updater,
}

impl AppState {
    pub fn busy(&self) -> bool {
        // a held lock means a workspace is being opened: count it as work
        self.live.try_lock().map_or(true, |l| l.values().any(|l| l.hub.busy()))
    }

    pub fn toggle_keep_running(self: &Arc<Self>, runtime: &tokio::runtime::Handle) {
        let keep = !self.lifecycle.keep_running();
        self.lifecycle.set_keep_running(keep);
        if !keep && self.lifecycle.idle() {
            let app = self.clone();
            runtime.spawn(async move { app.lifecycle.wind_down(|| app.busy()).await });
        }
    }
}

const EVENT_BUFFER: usize = 256;

static NEXT_CONNECTION: AtomicU64 = AtomicU64::new(1);

pub type Shared = Arc<AppState>;

pub async fn run(args: cli::Args) -> anyhow::Result<()> {
    let dir = cli::config_dir();
    let config_path = args.config.unwrap_or_else(|| dir.join("config.toml"));
    let config = Config::load(&config_path)?;
    let addr = args.bind.unwrap_or_else(|| config.listen_addr());
    let local = local_addr(addr);
    crate::window::set_zoom(config.zoom.unwrap_or(1.0));
    let git = config.git.clone();
    let github_prs = config.github_prs;
    let token = auth::load_or_create(&dir)?;
    let open = args.open.as_deref().map(|p| std::path::absolute(p).unwrap_or_else(|_| p.to_path_buf()));
    let url = browser::login_url(&local, &token, open.as_deref());
    let listener = match bind(addr, std::env::var_os(crate::updater::REPLACE_ENV).is_some()).await {
        Ok(l) => l,
        Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => {
            // one server for every window: a second launch only opens another window
            println!("gitd already running");
            if !args.no_open && (args.browser || !crate::launcher::ask_running(&local, &token, open.as_deref())) {
                browser::open(&url);
            }
            return Ok(());
        }
        Err(e) => return Err(e.into()),
    };
    let events = broadcast::channel(EVENT_BUFFER).0;
    let commands = Arc::new(CommandLog::new(events.clone()));
    let sink = commands.clone();
    let app = Arc::new(AppState {
        config: std::sync::Mutex::new(config),
        config_path,
        token,
        runner: {
            let runner = ProcessRunner::default().with_sink(Arc::new(move |rec| sink.push(rec)));
            runner.set_git(git);
            runner
        },
        events: events.clone(),
        workspace_events: broadcast::channel(EVENT_BUFFER).0,
        live: Mutex::default(),
        bindings: Default::default(),
        lifecycle: Lifecycle::new(Duration::from_secs(args.grace), args.keep),
        commands,
        github: Arc::new(crate::github::Github::new(github_prs, events.clone())),
        updater: crate::updater::Updater::new(events.clone()),
    });
    crate::updater::spawn(app.clone());

    let router = Router::new()
        .route("/login", get(login))
        .route("/ws", get(ws_upgrade))
        .route("/window", get(window))
        .route("/avatar", get(avatar))
        .route("/blob", get(blob))
        .route("/api/gh/image", get(crate::github::http::image))
        .route(
            "/api/gh/draft",
            get(crate::github::http::draft_file)
                .post(crate::github::http::draft_upload)
                .layer(axum::extract::DefaultBodyLimit::max(crate::github::drafts::MAX_BYTES)),
        )
        .fallback(get(web))
        .with_state(app.clone());

    println!("gitd listening on {url}");
    #[cfg(not(target_os = "macos"))]
    if !args.browser && crate::window::has_display() {
        crate::window::start(dir.join("webview"));
    }
    let app_browser = args.browser;
    if !args.no_open {
        crate::launcher::show(&url, app_browser);
    }
    #[cfg(any(windows, target_os = "macos"))]
    crate::tray::spawn(app.clone(), browser::login_url(&local, &app.token, None));
    #[cfg(target_os = "linux")]
    crate::indicator::spawn(app.clone(), browser::login_url(&local, &app.token, None));
    let shutdown = app.clone();
    axum::serve(listener, router)
        .with_graceful_shutdown(async move { shutdown.lifecycle.shutdown.notified().await })
        .await?;
    Ok(())
}

fn local_addr(addr: std::net::SocketAddr) -> std::net::SocketAddr {
    use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
    match addr.ip() {
        IpAddr::V4(ip) if ip.is_unspecified() => std::net::SocketAddr::new(Ipv4Addr::LOCALHOST.into(), addr.port()),
        IpAddr::V6(ip) if ip.is_unspecified() => std::net::SocketAddr::new(Ipv6Addr::LOCALHOST.into(), addr.port()),
        _ => addr,
    }
}

const REPLACE_WAIT: Duration = Duration::from_secs(10);
const REPLACE_POLL: Duration = Duration::from_millis(200);

/// `replace`: the gitd this one was updated from is still exiting, so its port frees up shortly.
async fn bind(addr: std::net::SocketAddr, replace: bool) -> std::io::Result<tokio::net::TcpListener> {
    let deadline = tokio::time::Instant::now() + REPLACE_WAIT;
    loop {
        match tokio::net::TcpListener::bind(addr).await {
            Err(e) if replace && e.kind() == std::io::ErrorKind::AddrInUse && tokio::time::Instant::now() < deadline => {
                tokio::time::sleep(REPLACE_POLL).await;
            }
            result => return result,
        }
    }
}

pub fn authorized(app: &AppState, headers: &HeaderMap) -> bool {
    let cookie = headers.get(header::COOKIE).and_then(|v| v.to_str().ok());
    auth::cookie_matches(cookie, &app.token)
}

async fn login(State(app): State<Shared>, Query(q): Query<HashMap<String, String>>) -> HttpResponse {
    if q.get("token") != Some(&app.token) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    let cookie = format!("{}={}; HttpOnly; SameSite=Strict; Path=/", auth::COOKIE, app.token);
    let to = q.get("open").map_or("/".to_string(), |p| format!("/?open={}", browser::encode(p)));
    ([(header::SET_COOKIE, cookie)], Redirect::to(&to)).into_response()
}

/// A second `gitd` launch asks for a window here instead of starting another server.
async fn window(State(app): State<Shared>, Query(q): Query<HashMap<String, String>>, headers: HeaderMap) -> HttpResponse {
    if q.get("token") != Some(&app.token) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    let Some(host) = headers.get(header::HOST).and_then(|h| h.to_str().ok()) else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    let mut url = format!("http://{host}/login?token={}", app.token);
    if let Some(p) = q.get("open") {
        url.push_str(&format!("&open={}", browser::encode(p)));
    }
    crate::launcher::show(&url, false);
    StatusCode::NO_CONTENT.into_response()
}

async fn avatar(State(app): State<Shared>, headers: HeaderMap, Query(q): Query<HashMap<String, String>>) -> HttpResponse {
    if !authorized(&app, &headers) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    let on = app.config.lock().unwrap().github_avatars;
    let Some(email) = q.get("email").filter(|_| on) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    match crate::avatars::get(&crate::avatars::cache_dir(), email).await {
        Some(bytes) => (
            [(header::CONTENT_TYPE, crate::avatars::content_type(&bytes)), (header::CACHE_CONTROL, "private, max-age=604800")],
            bytes,
        )
            .into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn blob(State(app): State<Shared>, headers: HeaderMap, Query(q): Query<HashMap<String, String>>) -> HttpResponse {
    if !authorized(&app, &headers) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    crate::blob::serve(&app, &q).await
}

async fn web(State(app): State<Shared>, headers: HeaderMap, uri: Uri) -> HttpResponse {
    if !authorized(&app, &headers) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    static_files::serve(&uri)
}

async fn ws_upgrade(State(app): State<Shared>, headers: HeaderMap, ws: WebSocketUpgrade) -> HttpResponse {
    if !authorized(&app, &headers) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    ws.on_upgrade(move |socket| client(app, socket))
}

async fn client(app: Shared, socket: WebSocket) {
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
    let writer = tokio::spawn(async move {
        while let Some(text) = rx.recv().await {
            if sink.send(Message::Text(text.into())).await.is_err() {
                break;
            }
        }
    });
    app.lifecycle.connected();
    let connection = NEXT_CONNECTION.fetch_add(1, Ordering::Relaxed);
    let (bound, shown) = watch::channel(None);
    let forwarder = tokio::spawn(forward_events(app.events.subscribe(), app.workspace_events.subscribe(), shown, tx.clone()));
    while let Some(Ok(msg)) = stream.next().await {
        let Message::Text(text) = msg else { continue };
        let Ok(req) = serde_json::from_str::<Request>(&text) else { continue };
        if let Some(ws) = req.ws.as_ref().filter(|ws| bound.borrow().as_ref() != Some(*ws)) {
            bound.send_replace(Some(ws.clone()));
            app.bindings.lock().unwrap().insert(connection, ws.clone());
        }
        let (app, tx) = (app.clone(), tx.clone());
        tokio::spawn(async move {
            let call = crate::live::WORKSPACE.scope(req.ws, handlers::dispatch(&app, &req.method, req.params));
            let result = if handlers::is_read(&req.method) { gitcore::runner::interactive(call).await } else { call.await };
            let resp = Response::from_result(req.id, result);
            let _ = tx.send(serde_json::to_string(&resp).unwrap_or_default());
        });
    }
    forwarder.abort();
    app.bindings.lock().unwrap().remove(&connection);
    drop(tx);
    let _ = writer.await;
    let state = app.clone();
    app.lifecycle.disconnected(move || state.busy()).await;
}

async fn forward_events(
    mut events: broadcast::Receiver<Event>,
    mut scoped: broadcast::Receiver<Scoped>,
    shown: watch::Receiver<Option<String>>,
    tx: mpsc::UnboundedSender<String>,
) {
    loop {
        let event = tokio::select! {
            event = events.recv() => event,
            event = scoped.recv() => match event {
                Ok((ws, event)) if shown.borrow().as_deref() == Some(&*ws) => Ok(event),
                Ok(_) => continue,
                Err(e) => Err(e),
            },
        };
        match event {
            Ok(event) => {
                if tx.send(serde_json::to_string(&event).unwrap_or_default()).is_err() {
                    return;
                }
            }
            Err(broadcast::error::RecvError::Lagged(_)) => continue,
            Err(broadcast::error::RecvError::Closed) => return,
        }
    }
}
