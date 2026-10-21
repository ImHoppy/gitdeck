mod changes;
mod config;
mod conflict;
mod cmd;
mod files;
mod interactive;
mod log;
mod meta;
mod project;
pub mod repo;
mod stats;
mod tools;
mod tree;
mod workspace;

use crate::server::AppState;
use anyhow::anyhow;
use serde_json::Value;

/// Reads that answer what the user is looking at right now.
pub fn is_read(method: &str) -> bool {
    method.starts_with("log.")
        || method.starts_with("diff.")
        || method.starts_with("file.")
        || matches!(method, "remote.list" | "reflog.list" | "worktree.list" | "conflict.list" | "repo.stats" | "commit.body" | "commit.lastMessage" | "tree.list" | "stash.list" | "repo.conflicts")
}

pub async fn dispatch(app: &AppState, method: &str, params: Value) -> anyhow::Result<Value> {
    match method {
        "project.recent" => project::recent(app),
        "project.open" => project::open(app, serde_json::from_value(params)?).await,
        "project.init" => project::init(app, serde_json::from_value(params)?).await,
        "project.clone" => project::clone(app, serde_json::from_value(params)?).await,
        "fs.pickFolder" => project::pick_folder(serde_json::from_value(params)?).await,
        "project.cloneDirName" => project::clone_dir_name(serde_json::from_value(params)?),
        "workspace.list" => workspace::list(app),
        "workspace.open" => workspace::open(app, serde_json::from_value(params)?).await,
        "workspace.addRoot" => workspace::add_root(app, serde_json::from_value(params)?).await,
        "workspace.removeRoot" => workspace::remove_root(app, serde_json::from_value(params)?),
        "workspace.setNested" => workspace::set_nested(app, serde_json::from_value(params)?),
        "workspace.exclude" => workspace::exclude(app, serde_json::from_value(params)?),
        "workspace.fetchStale" => workspace::fetch_stale(app, serde_json::from_value(params)?).await,
        "repo.syncAll" => repo::sync_all(app, serde_json::from_value(params)?).await,
        "repo.updateSubmodules" => repo::update_submodules(app, serde_json::from_value(params)?).await,
        "repo.conflicts" => repo::conflicts(app, serde_json::from_value(params)?).await,
        "repo.rebase" => repo::rebase(app, serde_json::from_value(params)?).await,
        "repo.stats" => stats::get(app, serde_json::from_value(params)?).await,
        "conflict.list" => conflict::list(app, serde_json::from_value(params)?).await,
        "conflict.take" => conflict::take(app, serde_json::from_value(params)?).await,
        "conflict.resolved" => conflict::resolved(app, serde_json::from_value(params)?).await,
        "editor.open" => conflict::open_in_editor(app, serde_json::from_value(params)?).await,
        "server.setEditor" => meta::set_editor(app, serde_json::from_value(params)?).await,
        "server.setFileManager" => meta::set_file_manager(app, serde_json::from_value(params)?).await,
        "rebase.plan" => interactive::plan(app, serde_json::from_value(params)?).await,
        "rebase.interactive" => interactive::run(app, serde_json::from_value(params)?).await,
        "log.file" => log::file_history(app, serde_json::from_value(params)?).await,
        "gitConfig.get" => config::get(app, serde_json::from_value(params)?).await,
        "gitConfig.set" => config::set(app, serde_json::from_value(params)?).await,
        "remote.list" => tools::remotes(app, serde_json::from_value(params)?).await,
        "reflog.list" => tools::reflog(app, serde_json::from_value(params)?).await,
        "changes.ignore" => tools::ignore(app, serde_json::from_value(params)?).await,
        "tool.diff" => tools::difftool(app, serde_json::from_value(params)?).await,
        "tool.merge" => tools::mergetool(app, serde_json::from_value(params)?).await,
        "patch.save" => tools::save_patches(app, serde_json::from_value(params)?).await,
        "patch.apply" => tools::apply_patches(app, serde_json::from_value(params)?).await,
        "repo.archive" => tools::archive(app, serde_json::from_value(params)?).await,
        "worktree.list" => tools::worktrees(app, serde_json::from_value(params)?).await,
        "worktree.add" => tools::add_worktree(app, serde_json::from_value(params)?).await,
        "worktree.remove" => tools::remove_worktree(app, serde_json::from_value(params)?).await,
        "bisect" => tools::bisect(app, serde_json::from_value(params)?).await,
        "fs.pickFile" => tools::pick_file(serde_json::from_value(params)?).await,
        "log.open" => log::open(app, serde_json::from_value(params)?).await,
        "log.rows" => log::rows(app, serde_json::from_value(params)?).await,
        "log.ancestors" => log::ancestors(app, serde_json::from_value(params)?).await,
        "log.find" => log::find(app, serde_json::from_value(params)?).await,
        "commit.body" => log::body(app, serde_json::from_value(params)?).await,
        "diff.files" => changes::files(app, serde_json::from_value(params)?).await,
        "diff.file" => changes::file(app, serde_json::from_value(params)?).await,
        "stage.files" => changes::stage(app, serde_json::from_value(params)?).await,
        "changes.discard" => changes::discard(app, serde_json::from_value(params)?).await,
        "unstage.files" => changes::unstage(app, serde_json::from_value(params)?).await,
        "stage.lines" => changes::lines(app, serde_json::from_value(params)?).await,
        "commit.create" => changes::create(app, serde_json::from_value(params)?).await,
        "commit.template" => changes::template(app, serde_json::from_value(params)?).await,
        "commit.lastMessage" => changes::last_message(app, serde_json::from_value(params)?).await,
        "cmd.run" => cmd::run(app, serde_json::from_value(params)?).await,
        "stash.list" => cmd::stashes(app, serde_json::from_value(params)?).await,
        "repo.checkoutTracked" => tree::checkout_tracked(app, serde_json::from_value(params)?).await,
        "repo.submodule" => tree::submodule(app, serde_json::from_value(params)?).await,
        "repo.reveal" => tree::reveal(app, serde_json::from_value(params)?).await,
        "server.info" => meta::info(app).await,
        "server.keepRunning" => meta::keep_running(app, serde_json::from_value(params)?).await,
        "server.setAvatars" => meta::set_avatars(app, serde_json::from_value(params)?).await,
        "server.setGit" => meta::set_git(app, serde_json::from_value(params)?).await,
        "commands.recent" => meta::commands(app),
        "jobs.list" => meta::jobs(app).await,
        "tree.list" => files::list(app, serde_json::from_value(params)?).await,
        "file.show" => files::show(app, serde_json::from_value(params)?).await,
        "file.blame" => files::blame(app, serde_json::from_value(params)?).await,
        "repo.sync" => repo::sync(app, serde_json::from_value(params)?).await,
        _ => Err(anyhow!("unknown method {method}")),
    }
}
