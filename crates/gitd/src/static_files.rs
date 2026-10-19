use axum::{
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Response},
};

#[derive(rust_embed::Embed)]
#[folder = "../../web/dist"]
struct WebDist;

const INDEX: &str = "index.html";

pub fn serve(uri: &Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    let path = if path.is_empty() { INDEX } else { path };
    match WebDist::get(path).or_else(|| WebDist::get(INDEX)) {
        Some(file) => {
            let mime = mime_guess::from_path(path).first_or_text_plain();
            ([(header::CONTENT_TYPE, mime.as_ref().to_string())], file.data).into_response()
        }
        None => (StatusCode::NOT_FOUND, "web build missing: run `bun run build` in web/").into_response(),
    }
}
