use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct Request {
    pub id: u64,
    pub method: String,
    #[serde(default)]
    pub params: Value,
    /// The workspace the sending window shows.
    #[serde(default)]
    pub ws: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum Response {
    Ok { id: u64, result: Value },
    Err { id: u64, error: String },
}

impl Response {
    pub fn from_result(id: u64, r: anyhow::Result<Value>) -> Self {
        match r {
            Ok(result) => Self::Ok { id, result },
            Err(e) => Self::Err { id, error: format!("{e:#}") },
        }
    }
}
