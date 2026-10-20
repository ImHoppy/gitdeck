use crate::handlers::repo::hub;
use crate::server::AppState;
use gitcore::{commands::stats, GitRunner};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use workspace::RepoId;

#[derive(Deserialize)]
pub struct StatsParams {
    id: RepoId,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct Author {
    name: String,
    email: String,
    commits: u64,
    added: u64,
    removed: u64,
    first: i64,
    last: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Stats {
    commits: u64,
    added: u64,
    removed: u64,
    first: Option<i64>,
    last: Option<i64>,
    files: u64,
    /// Authors by commit count; the same person under several names stays one by email.
    authors: Vec<Author>,
    /// `YYYY-MM` → commits, oldest first, months without commits included.
    months: Vec<(String, u64)>,
    extensions: Vec<(String, u64)>,
}

pub async fn get(app: &AppState, p: StatsParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    // an unborn HEAD has no history: empty statistics, not an error
    let (log, files) = futures::join!(hub.runner.run(&path, stats::LOG_ARGS), hub.runner.run_ok(&path, stats::FILES_ARGS));
    let commits = log.ok().filter(|o| o.ok()).map(|o| stats::parse_log(&o.stdout)).unwrap_or_default();
    let extensions = files.map(|o| stats::files_by_extension(&o)).unwrap_or_default();

    let mut authors: HashMap<String, Author> = HashMap::new();
    let mut months: BTreeMap<String, u64> = BTreeMap::new();
    for c in &commits {
        let a = authors.entry(c.email.to_lowercase()).or_insert_with(|| Author { first: c.time, last: c.time, ..Default::default() });
        if a.name.is_empty() || c.time >= a.last {
            (a.name, a.email) = (c.author.clone(), c.email.clone());
        }
        a.commits += 1;
        a.added += c.added;
        a.removed += c.removed;
        a.first = a.first.min(c.time);
        a.last = a.last.max(c.time);
        *months.entry(month(c.time)).or_default() += 1;
    }
    let mut authors: Vec<Author> = authors.into_values().collect();
    authors.sort_by(|a, b| b.commits.cmp(&a.commits).then_with(|| a.name.cmp(&b.name)));

    let stats = Stats {
        commits: commits.len() as u64,
        added: commits.iter().map(|c| c.added).sum(),
        removed: commits.iter().map(|c| c.removed).sum(),
        first: commits.iter().map(|c| c.time).min(),
        last: commits.iter().map(|c| c.time).max(),
        files: extensions.iter().map(|(_, n)| n).sum(),
        authors,
        months: fill_months(months),
        extensions,
    };
    Ok(serde_json::to_value(stats)?)
}

/// UTC `YYYY-MM` of a unix time (civil-from-days, no date crate needed).
fn month(t: i64) -> String {
    let z = t.div_euclid(86_400) + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!("{y:04}-{m:02}")
}

fn fill_months(counts: BTreeMap<String, u64>) -> Vec<(String, u64)> {
    let (Some(first), Some(last)) = (counts.keys().next().cloned(), counts.keys().next_back().cloned()) else {
        return Vec::new();
    };
    let parse = |s: &str| (s[..4].parse::<i64>().unwrap_or(0), s[5..].parse::<i64>().unwrap_or(1));
    let (mut y, mut m) = parse(&first);
    let end = parse(&last);
    let mut out = Vec::new();
    while (y, m) <= end {
        let key = format!("{y:04}-{m:02}");
        out.push((key.clone(), counts.get(&key).copied().unwrap_or(0)));
        (y, m) = if m == 12 { (y + 1, 1) } else { (y, m + 1) };
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn months_from_unix_time() {
        assert_eq!(month(0), "1970-01");
        assert_eq!(month(1_792_491_976), "2026-10");
        assert_eq!(month(951_782_400), "2000-02"); // 2000-02-29
    }

    #[test]
    fn gaps_are_filled() {
        let counts = BTreeMap::from([("2025-11".to_string(), 2), ("2026-02".to_string(), 1)]);
        let filled = fill_months(counts);
        assert_eq!(filled.iter().map(|(k, _)| k.as_str()).collect::<Vec<_>>(), ["2025-11", "2025-12", "2026-01", "2026-02"]);
        assert_eq!(filled[1].1, 0);
    }
}
