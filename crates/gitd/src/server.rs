use crate::{auth, cli, handlers, protocol::{Request, Response}};
use axum::{
    extract::{ws::{Message, WebSocket}, Query, State, WebSocketUpgrade},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Redirect, Response as HttpResponse},
    routing::get,
    Router,
};
use futures::{SinkExt, StreamExt};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::mpsc;
use workspace::Config;

pub struct AppState {
    pub config: Config,
    pub token: String,
}

type Shared = Arc<AppState>;

pub async fn run(args: cli::Args) -> anyhow::Result<()> {
    let dir = cli::config_dir();
    let config_path = args.config.unwrap_or_else(|| dir.join("config.toml"));
    let config = Config::load(&config_path)?;
    let token = auth::load_or_create(&dir)?;
    let app = Arc::new(AppState { config, token });

    let router = Router::new()
        .route("/", get(index))
        .route("/login", get(login))
        .route("/ws", get(ws_upgrade))
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

async fn index(State(app): State<Shared>, headers: HeaderMap) -> HttpResponse {
    if !authorized(&app, &headers) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    "gitd running".into_response()
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
    drop(tx);
    let _ = writer.await;
}
