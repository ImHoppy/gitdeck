//! Pictures hosted outside GitHub, as GitHub's own camo proxy serves them. A body's `bodyHTML`
//! carries `<img src="https://camo.githubusercontent.com/…" data-canonical-src="<original>">`, so
//! gitd can show them while only ever talking to GitHub.

use std::collections::HashMap;

const CAMO: &str = "https://camo.githubusercontent.com/";

/// Adds `original URL → camo URL` for every proxied picture in `html`.
pub(crate) fn collect(html: &str, into: &mut HashMap<String, String>) {
    for tag in html.split("<img ").skip(1) {
        let tag = tag.split_once('>').map_or(tag, |(t, _)| t);
        if let (Some(src), Some(original)) = (attr(tag, "src"), attr(tag, "data-canonical-src")) {
            if src.starts_with(CAMO) && !original.is_empty() {
                into.insert(original, src);
            }
        }
    }
}

fn attr(tag: &str, name: &str) -> Option<String> {
    let needle = format!(" {name}=\"");
    let at = format!(" {tag}").find(&needle)?;
    let value = tag[at + needle.len() - 1..].split('"').next()?;
    Some(unescape(value))
}

fn unescape(s: &str) -> String {
    s.replace("&quot;", "\"").replace("&#39;", "'").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_originals_to_camo() {
        let html = r#"<p><a href="https://camo.githubusercontent.com/e3/68"><img src="https://camo.githubusercontent.com/e3/68" alt="shot" data-canonical-src="https://img.example.fr/file/a.png?x=1&amp;y=2" style="max-width: 100%;"></a></p>
<img src="https://github.com/user-attachments/assets/1" alt="kept as is">
<img alt="no canonical" src="https://camo.githubusercontent.com/zz">"#;
        let mut m = HashMap::new();
        collect(html, &mut m);
        assert_eq!(m.len(), 1);
        assert_eq!(m["https://img.example.fr/file/a.png?x=1&y=2"], "https://camo.githubusercontent.com/e3/68");
    }
}
