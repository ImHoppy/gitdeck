/// A lone `\r` redraws the current line, as git's progress meters do.
#[derive(Debug, Default, Clone)]
pub struct Console {
    lines: Vec<String>,
    current: Vec<u8>,
    carriage: bool,
}

impl Console {
    pub fn feed(&mut self, bytes: &[u8]) {
        for &b in bytes {
            if self.carriage && b != b'\n' {
                self.current.clear();
            }
            self.carriage = false;
            match b {
                b'\r' => self.carriage = true,
                b'\n' => self.lines.push(String::from_utf8_lossy(&std::mem::take(&mut self.current)).into_owned()),
                _ => self.current.push(b),
            }
        }
    }

    pub fn lines(&self) -> &[String] {
        &self.lines
    }

    pub fn current(&self) -> String {
        String::from_utf8_lossy(&self.current).into_owned()
    }

    pub fn tail(&self, max: usize) -> String {
        let mut all: Vec<&str> = self.lines.iter().map(String::as_str).collect();
        let current = self.current();
        if !current.is_empty() {
            all.push(&current);
        }
        all[all.len().saturating_sub(max)..].join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redraws_progress_and_keeps_finished_lines() {
        let mut c = Console::default();
        c.feed(b"remote: Counting objects:  50% (1/2)\rremote: Counting objects: 100% (2/2), done.\n");
        c.feed(b"Receiving objects:  10% (1/10)\rReceiving obj");
        c.feed(b"ects:  40% (4/10)");
        assert_eq!(c.lines(), ["remote: Counting objects: 100% (2/2), done."]);
        assert_eq!(c.current(), "Receiving objects:  40% (4/10)");
    }

    #[test]
    fn crlf_ends_a_line() {
        let mut c = Console::default();
        c.feed(b"fatal: could not read\r");
        c.feed(b"\nnext\r\n");
        assert_eq!(c.lines(), ["fatal: could not read", "next"]);
        assert_eq!(c.tail(1), "next");
    }
}
