use crate::{handlers::repo::hub, server::AppState};
use gitcore::{
    commands::interactive::{self, TodoItem},
    GitRunner,
};
use serde::Deserialize;
use serde_json::Value;
use workspace::{sync, RepoId};

#[derive(Deserialize)]
pub struct PlanParams {
    id: RepoId,
    base: String,
}

/// What an interactive rebase onto `base` would replay.
pub async fn plan(app: &AppState, p: PlanParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    let args = interactive::plan_args(&p.base);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    Ok(serde_json::to_value(interactive::parse_plan(&hub.runner.run_ok(&path, &args).await?))?)
}

#[derive(Deserialize)]
pub struct RunParams {
    id: RepoId,
    base: String,
    todo: Vec<TodoItem>,
}

pub async fn run(app: &AppState, p: RunParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    let dir = crate::cli::config_dir().join("rebase").join(p.id.to_string());
    std::fs::create_dir_all(&dir)?;
    let message_file = |i: usize| interactive::sh_path(&dir.join(format!("message-{i}.txt")));
    let todo = interactive::todo(&p.todo, message_file)?;
    for (i, item) in p.todo.iter().enumerate() {
        if let Some(m) = &item.message {
            std::fs::write(dir.join(format!("message-{i}.txt")), m)?;
        }
    }
    let todo_file = dir.join("todo");
    std::fs::write(&todo_file, todo)?;
    let args = interactive::run_args(&p.base, &todo_file);
    let outcome = hub.queued(p.id, sync::raw(&hub.runner, &path, &args)).await;
    Ok(serde_json::to_value(outcome)?)
}
