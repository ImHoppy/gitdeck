use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Head {
    Branch { name: String },
    Detached { sha: String },
    Unborn { name: String },
}

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize)]
pub struct Tracking {
    pub ahead: Option<u32>,
    pub behind: Option<u32>,
    pub gone: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Operation {
    Rebase,
    Merge,
    CherryPick,
    Revert,
}
