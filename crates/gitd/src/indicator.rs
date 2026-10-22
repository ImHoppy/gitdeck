use crate::server::AppState;
use ksni::{menu::*, Icon, MenuItem, Tray, TrayMethods};
use std::{pin::pin, sync::Arc};

/// Linux status indicator (StatusNotifierItem / AppIndicator) with Open / Keep running / Quit,
/// shown only while `gitd` runs with no window, from one grace period after the last one closed.
pub fn spawn(app: Arc<AppState>, url: String) {
    tokio::spawn(async move {
        let mut shown = None;
        loop {
            let mut changed = pin!(app.lifecycle.clients_changed.notified());
            changed.as_mut().enable();
            if app.lifecycle.idle() && shown.is_none() {
                tokio::select! {
                    _ = changed.as_mut() => continue,
                    _ = tokio::time::sleep(app.lifecycle.grace()) => {}
                }
                // otherwise gitd is exiting right now
                if app.lifecycle.keep_running() || app.busy() {
                    // no session bus or no indicator host (a plain GNOME, an SSH session): nothing to show
                    shown = Indicator { app: app.clone(), url: url.clone() }.spawn().await.ok();
                }
            } else if !app.lifecycle.idle() {
                if let Some(handle) = shown.take() {
                    handle.shutdown().await;
                }
            }
            changed.await;
        }
    });
}

struct Indicator {
    app: Arc<AppState>,
    url: String,
}

impl Tray for Indicator {
    fn id(&self) -> String {
        "gitdeck".into()
    }

    fn title(&self) -> String {
        "gitdeck".into()
    }

    fn icon_pixmap(&self) -> Vec<Icon> {
        let (rgba, size) = crate::icon::rgba();
        let data = rgba.as_chunks::<4>().0.iter().flat_map(|&[r, g, b, a]| [a, r, g, b]).collect();
        vec![Icon { width: size as i32, height: size as i32, data }]
    }

    fn activate(&mut self, _x: i32, _y: i32) {
        crate::launcher::show(&self.url, false);
    }

    fn menu(&self) -> Vec<MenuItem<Self>> {
        vec![
            StandardItem { label: "Open".into(), activate: Box::new(|t: &mut Self| crate::launcher::show(&t.url, false)), ..Default::default() }
                .into(),
            CheckmarkItem {
                label: "Keep running".into(),
                checked: self.app.lifecycle.keep_running(),
                activate: Box::new(|t: &mut Self| t.app.toggle_keep_running(&tokio::runtime::Handle::current())),
                ..Default::default()
            }
            .into(),
            StandardItem { label: "Quit".into(), activate: Box::new(|t: &mut Self| t.app.lifecycle.shutdown.notify_one()), ..Default::default() }
                .into(),
        ]
    }
}
