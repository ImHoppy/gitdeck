use crate::{auth, cli, events::Event, handlers, live::LiveWorkspace, static_files, protocol::{Request, Response}};
use axum::{
    extract::{ws::{Message, WebSocket}, Query, State, WebSocketUpgrade},
    http::{header, HeaderMap, StatusCode, Uri},
    response::{IntoResponse, Redirect, Response as HttpResponse},
    routing::get,
    Router,
};
use futures::{SinkExt, StreamExt};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::{broadcast, mpsc, Mutex};
use gitcore::ProcessRunner;
use workspace::Config;

pub struct AppState {
    pub config: Config,
    pub runner: ProcessRunner,
    pub token: String,
    pub events: broadcast::Sender<Event>,
    pub live: Mutex<Option<LiveWorkspace>>,
}

const EVENT_BUFFER: usize = 256;

type Shared = Arc<AppState>;

pub async fn run(args: cli::Args) -> anyhow::Result<()> {
    let dir = cli::config_dir();
    let config_path = args.config.unwrap_or_else(|| dir.join("config.toml"));
    let config = Config::load(&config_path)?;
    let token = auth::load_or_create(&dir)?;
    let app = Arc::new(AppState {
        config,
        token,
        runner: ProcessRunner::default(),
        events: broadcast::channel(EVENT_BUFFER).0,
        live: Mutex::new(None),
    });

    let router = Router::new()
        .route("/login", get(login))
        .route("/ws", get(ws_upgrade))
        .fallback(get(web))
        .with_state(app.clone());

    let listener = tokio::net::TcpListener::bind(args.bind).await?;
    println!("gitd listening on http://{}/login?token={}", args.bind, app.token);
    axum::serve(listener, router).await?;
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
