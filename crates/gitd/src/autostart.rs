use anyhow::{bail, Context};
use std::process::Command;

const NAME: &str = "gitdeck";

/// Starts `gitd --keep --no-open` at login: autostart only makes sense with "always keep running".
pub fn set(on: bool) -> anyhow::Result<()> {
    let exe = std::env::current_exe()?;
    let exe = exe.to_string_lossy();
    if cfg!(windows) {
        windows(on, &exe)
    } else if cfg!(target_os = "macos") {
        launchd(on, &exe)
    } else {
        systemd(on, &exe)
    }
}

fn windows(on: bool, exe: &str) -> anyhow::Result<()> {
    let key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
    let command = format!("\"{exe}\" --keep --no-open");
    let args: Vec<&str> = if on {
        vec!["add", key, "/v", NAME, "/t", "REG_SZ", "/d", &command, "/f"]
    } else {
        vec!["delete", key, "/v", NAME, "/f"]
    };
    run(Command::new("reg").args(args))
}

fn systemd(on: bool, exe: &str) -> anyhow::Result<()> {
    let home = std::env::var_os("HOME").context("HOME not set")?;
    let dir = std::path::Path::new(&home).join(".config/systemd/user");
    let unit = dir.join(format!("{NAME}.service"));
    if on {
        std::fs::create_dir_all(&dir)?;
        std::fs::write(
            &unit,
            format!("[Unit]\nDescription=gitdeck server\n\n[Service]\nExecStart={exe} --keep --no-open\nRestart=on-failure\n\n[Install]\nWantedBy=default.target\n"),
        )?;
        run(Command::new("systemctl").args(["--user", "enable", "--now", NAME]))
    } else {
        run(Command::new("systemctl").args(["--user", "disable", "--now", NAME]))?;
        std::fs::remove_file(&unit).or_else(|e| if e.kind() == std::io::ErrorKind::NotFound { Ok(()) } else { Err(e) })?;
        Ok(())
    }
}

fn launchd(on: bool, exe: &str) -> anyhow::Result<()> {
    let home = std::env::var_os("HOME").context("HOME not set")?;
    let dir = std::path::Path::new(&home).join("Library/LaunchAgents");
    let plist = dir.join(format!("com.{NAME}.gitd.plist"));
    let _ = Command::new("launchctl").arg("unload").arg(&plist).output();
    if on {
        std::fs::create_dir_all(&dir)?;
        std::fs::write(
            &plist,
            format!(
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\"><dict>
<key>Label</key><string>com.{NAME}.gitd</string>
<key>ProgramArguments</key><array><string>{exe}</string><string>--keep</string><string>--no-open</string></array>
<key>RunAtLoad</key><true/>
</dict></plist>
"
            ),
        )?;
        run(Command::new("launchctl").arg("load").arg(&plist))
    } else {
        std::fs::remove_file(&plist).or_else(|e| if e.kind() == std::io::ErrorKind::NotFound { Ok(()) } else { Err(e) })?;
        Ok(())
    }
}

fn run(cmd: &mut Command) -> anyhow::Result<()> {
    let out = cmd.output()?;
    if !out.status.success() {
        bail!("{}", String::from_utf8_lossy(&out.stderr).trim());
    }
    Ok(())
}
