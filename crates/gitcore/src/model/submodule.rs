use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SubmoduleFlag {
    UpToDate,
    Uninitialized,
    PointerDiffers,
    Conflict,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SubmoduleEntry {
    pub sha: String,
    pub path: String,
    pub flag: SubmoduleFlag,
}
