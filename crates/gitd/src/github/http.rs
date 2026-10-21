use super::{drafts, image};
use crate::server::{authorized, Shared};
use axum::{
    body::Bytes,
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use gitcore::{commands::gh::auth, GhRunner};
use std::collections::HashMap;

/// Served pictures can't run anything, even an SVG opened on its own.
const LOCKED_DOWN: &str = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

pub async fn image(State(app): State<Shared>, headers: HeaderMap, Query(q): Query<HashMap<String, String>>) -> Response {
    if !authorized(&app, &headers) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    let Some(url) = q.get("url").filter(|u| app.github.enabled() && image::allowed(u)) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let token = if image::wants_token(url) { login_token(&app).await } else { None };
    match image::get(&image::cache_dir(), url, token).await {
        Some(bytes) => (
            [
                (header::CONTENT_TYPE, image::content_type(&bytes)),
                (header::CACHE_CONTROL, "private, max-age=604800"),
                (header::CONTENT_SECURITY_POLICY, LOCKED_DOWN),
                (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
            ],
            bytes,
        )
            .into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

/// Read from gh for this one request, kept in memory only and never sent to the page.
async fn login_token(app: &Shared) -> Option<String> {
    let out = app.runner.gh_ok(&std::env::temp_dir(), auth::TOKEN_ARGS).await.ok()?;
    Some(String::from_utf8_lossy(&out).trim().to_string()).filter(|t| !t.is_empty())
}

pub async fn draft_file(State(app): State<Shared>, headers: HeaderMap, Query(q): Query<HashMap<String, String>>) -> Response {
    if !authorized(&app, &headers) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    let (Some(draft), Some(name)) = (q.get("draft"), q.get("name")) else { return StatusCode::BAD_REQUEST.into_response() };
    let Ok(dir) = drafts::dir(&drafts::root(), draft) else { return StatusCode::BAD_REQUEST.into_response() };
    if drafts::file_name(name, name.rsplit('.').next().unwrap_or("")) != *name {
        return StatusCode::BAD_REQUEST.into_response();
    }
    match tokio::fs::read(dir.join(name)).await {
        Ok(bytes) => ([(header::CONTENT_TYPE, image::content_type(&bytes)), (header::X_CONTENT_TYPE_OPTIONS, "nosniff")], bytes).into_response(),
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

pub async fn draft_upload(State(app): State<Shared>, headers: HeaderMap, Query(q): Query<HashMap<String, String>>, body: Bytes) -> Response {
    if !authorized(&app, &headers) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    let (Some(draft), Some(name)) = (q.get("draft"), q.get("name")) else { return StatusCode::BAD_REQUEST.into_response() };
    let saved = match drafts::dir(&drafts::root(), draft) {
        Ok(dir) => drafts::save(&dir, name, &body).await,
        Err(e) => Err(e),
    };
    match saved {
        Ok(name) => Json(serde_json::json!({ "name": name })).into_response(),
        Err(e) => (StatusCode::UNPROCESSABLE_ENTITY, e.to_string()).into_response(),
    }
}
