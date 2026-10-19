use serde::Serialize;

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize)]
pub struct StatusCounts {
    pub staged: u32,
    pub unstaged: u32,
    pub untracked: u32,
    pub conflicts: u32,
}

impl StatusCounts {
    pub fn dirty(&self) -> u32 {
        self.unstaged + self.untracked + self.conflicts
    }
}
