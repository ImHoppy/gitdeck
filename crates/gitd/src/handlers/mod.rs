mod changes;
mod config;
mod conflict;
mod cmd;
mod files;
mod interactive;
mod log;
mod meta;
mod project;
mod pulls;
pub mod repo;
mod setup;
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
        || matches!(method, "pr.status" | "pr.repos" | "pr.list" | "pr.view" | "pr.checks" | "pr.timeline" | "pr.repoInfo" | "pr.card" | "pr.findRepo" | "pr.switchedFrom")
        || matches!(method, "project.open" | "workspace.open" | "remote.list" | "reflog.list" | "worktree.list" | "conflict.list" | "repo.stats" | "commit.body" | "commit.lastMessage" | "tree.list" | "stash.list" | "repo.conflicts")
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
        "server.setFetchInterval" => meta::set_fetch_interval(app, serde_json::from_value(params)?).await,
        "server.setExplorerMenu" => setup::set_explorer_menu(app, serde_json::from_value(params)?).await,
        "server.setAutostart" => setup::set_autostart(app, serde_json::from_value(params)?).await,
        "server.setAutoUpdate" => setup::set_auto_update(app, serde_json::from_value(params)?).await,
        "server.finishSetup" => setup::finish(app).await,
        "commands.recent" => meta::commands(app),
        "jobs.list" => meta::jobs(app).await,
        "tree.list" => files::list(app, serde_json::from_value(params)?).await,
        "file.show" => files::show(app, serde_json::from_value(params)?).await,
        "file.blame" => files::blame(app, serde_json::from_value(params)?).await,
        "repo.sync" => repo::sync(app, serde_json::from_value(params)?).await,
        "server.setGithubPrs" => meta::set_github_prs(app, serde_json::from_value(params)?).await,
        "pr.status" => pulls::status(app, serde_json::from_value(params)?).await,
        "pr.repos" => pulls::repos(app, serde_json::from_value(params)?).await,
        "pr.list" => pulls::list(app, serde_json::from_value(params)?).await,
        "pr.findRepo" => pulls::find_repo(app, serde_json::from_value(params)?).await,
        "pr.view" => pulls::detail::view(app, serde_json::from_value(params)?).await,
        "pr.checks" => pulls::detail::checks(app, serde_json::from_value(params)?).await,
        "pr.timeline" => pulls::detail::timeline(app, serde_json::from_value(params)?).await,
        "pr.repoInfo" => pulls::detail::repo_info(app, serde_json::from_value(params)?).await,
        "pr.card" => pulls::detail::card(app, serde_json::from_value(params)?).await,
        "pr.fetch" => pulls::detail::fetch(app, serde_json::from_value(params)?).await,
        "pr.comment" => pulls::write::comment(app, serde_json::from_value(params)?).await,
        "pr.edit" => pulls::write::edit(app, serde_json::from_value(params)?).await,
        "pr.mutate" => pulls::write::mutate(app, serde_json::from_value(params)?).await,
        "pr.state" => pulls::write::state(app, serde_json::from_value(params)?).await,
        "pr.merge" => pulls::write::merge(app, serde_json::from_value(params)?).await,
        "pr.discardDraft" => pulls::write::discard_draft(app, serde_json::from_value(params)?).await,
        "pr.create" => pulls::create::create(app, serde_json::from_value(params)?).await,
        "pr.switch" => pulls::switch::switch(app, serde_json::from_value(params)?).await,
        "pr.switchBack" => pulls::switch::switch_back(app, serde_json::from_value(params)?).await,
        "pr.switchedFrom" => pulls::switch::switched_from(app, serde_json::from_value(params)?).await,
        "ui.navigate" => pulls::navigate(app, serde_json::from_value(params)?),
        _ => Err(anyhow!("unknown method {method}")),
    }
}
