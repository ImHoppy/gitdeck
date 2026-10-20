use crate::{
    auth, browser, cli, command_log::CommandLog, events::Event, handlers, lifecycle::Lifecycle, live::LiveWorkspace,
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
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::sync::{broadcast, mpsc, Mutex};
use gitcore::ProcessRunner;
use workspace::Config;

pub struct AppState {
    pub config: std::sync::Mutex<Config>,
    pub config_path: std::path::PathBuf,
    pub runner: ProcessRunner,
    pub token: String,
    pub events: broadcast::Sender<Event>,
    pub live: Mutex<Option<LiveWorkspace>>,
    pub lifecycle: Lifecycle,
    pub commands: Arc<CommandLog>,
}

impl AppState {
    fn busy(&self) -> bool {
        // a held lock means a workspace is being opened: count it as work
        self.live.try_lock().map_or(true, |l| l.as_ref().is_some_and(|l| l.hub.busy()))
    }
}

const EVENT_BUFFER: usize = 256;

type Shared = Arc<AppState>;

pub async fn run(args: cli::Args) -> anyhow::Result<()> {
    let dir = cli::config_dir();
    let config_path = args.config.unwrap_or_else(|| dir.join("config.toml"));
    let config = Config::load(&config_path)?;
    let git = config.git.clone();
    let token = auth::load_or_create(&dir)?;
    let open = args.open.as_deref().map(|p| std::path::absolute(p).unwrap_or_else(|_| p.to_path_buf()));
    let url = browser::login_url(&args.bind, &token, open.as_deref());
    let listener = match tokio::net::TcpListener::bind(args.bind).await {
        Ok(l) => l,
        Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => {
            // one server for every window: a second launch only opens another window
            println!("gitd already running");
            if !args.no_open && (args.browser || !crate::launcher::ask_running(&args.bind, &token, open.as_deref())) {
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
        events,
        live: Mutex::new(None),
        lifecycle: Lifecycle::new(Duration::from_secs(args.grace), args.keep),
        commands,
    });

    let router = Router::new()
        .route("/login", get(login))
        .route("/ws", get(ws_upgrade))
        .route("/window", get(window))
        .route("/avatar", get(avatar))
        .route("/blob", get(blob))
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
    #[cfg(windows)]
    crate::tray::spawn(app.clone(), browser::login_url(&args.bind, &app.token, None));
    let shutdown = app.clone();
    axum::serve(listener, router)
        .with_graceful_shutdown(async move { shutdown.lifecycle.shutdown.notified().await })
        .await?;
    Ok(())
}

fn authorized(app: &AppState, headers: &HeaderMap) -> bool {
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
    let forwarder = tokio::spawn(forward_events(app.events.subscribe(), tx.clone()));
    while let Some(Ok(msg)) = stream.next().await {
        let Message::Text(text) = msg else { continue };
        let Ok(req) = serde_json::from_str::<Request>(&text) else { continue };
        let (app, tx) = (app.clone(), tx.clone());
        tokio::spawn(async move {
            let call = handlers::dispatch(&app, &req.method, req.params);
            let result = if handlers::is_read(&req.method) { gitcore::runner::interactive(call).await } else { call.await };
            let resp = Response::from_result(req.id, result);
            let _ = tx.send(serde_json::to_string(&resp).unwrap_or_default());
        });
    }
    forwarder.abort();
    drop(tx);
    let _ = writer.await;
    let state = app.clone();
    app.lifecycle.disconnected(move || state.busy()).await;
}

async fn forward_events(mut events: broadcast::Receiver<Event>, tx: mpsc::UnboundedSender<String>) {
    loop {
        match events.recv().await {
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
