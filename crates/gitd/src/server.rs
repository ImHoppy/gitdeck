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
    let token = auth::load_or_create(&dir)?;
    let listener = match tokio::net::TcpListener::bind(args.bind).await {
        Ok(l) => l,
        Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => {
            let url = format!("http://{}/login?token={token}", args.bind);
            println!("gitd already running, opening {url}");
            if !args.no_open {
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
        runner: ProcessRunner::default().with_sink(Arc::new(move |rec| sink.push(rec))),
        events,
        live: Mutex::new(None),
        lifecycle: Lifecycle::new(Duration::from_secs(args.grace), args.keep),
        commands,
    });

    let router = Router::new()
        .route("/login", get(login))
        .route("/ws", get(ws_upgrade))
        .fallback(get(web))
        .with_state(app.clone());

    let url = format!("http://{}/login?token={}", args.bind, app.token);
    println!("gitd listening on {url}");
    if !args.no_open {
        browser::open(&url);
    }
    #[cfg(windows)]
    crate::tray::spawn(app.clone(), url.clone());
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
    ([(header::SET_COOKIE, cookie)], Redirect::to("/")).into_response()
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
            let result = handlers::dispatch(&app, &req.method, req.params).await;
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
