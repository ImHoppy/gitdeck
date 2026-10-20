use crate::server::AppState;
use axum::{
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};
use gitcore::{commands::tree, GitRunner};
use std::{collections::HashMap, path::Component, path::Path};

const MAX_BYTES: usize = 50 * 1024 * 1024;

/// A file's bytes for an `<img>`: `rev` is `worktree`, `index`, or a commit.
pub async fn serve(app: &AppState, q: &HashMap<String, String>) -> Response {
    let (Some(id), Some(rev), Some(path)) = (q.get("repo").and_then(|r| r.parse().ok()), q.get("rev"), q.get("path")) else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    // a repo-relative path only: nothing above the worktree
    if Path::new(path).components().any(|c| !matches!(c, Component::Normal(_))) {
        return StatusCode::BAD_REQUEST.into_response();
    }
    let Ok(hub) = crate::handlers::repo::hub(app).await else { return StatusCode::NOT_FOUND.into_response() };
    let Ok(entry) = hub.entry(id) else { return StatusCode::NOT_FOUND.into_response() };
    let bytes = match rev.as_str() {
        "worktree" => tokio::fs::read(entry.path.join(path)).await.ok(),
        rev => {
            let sha = if rev == "index" { "" } else { rev };
            let args = tree::show_args(sha, path);
            let args: Vec<&str> = args.iter().map(String::as_str).collect();
            hub.runner.run_ok(&entry.path, &args).await.ok()
        }
    };
    match bytes {
        Some(b) if b.len() <= MAX_BYTES => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            ([(header::CONTENT_TYPE, mime.as_ref().to_string())], b).into_response()
        }
        Some(_) => StatusCode::PAYLOAD_TOO_LARGE.into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}
