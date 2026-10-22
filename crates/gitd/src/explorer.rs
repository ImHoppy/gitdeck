use anyhow::bail;
use std::process::Command;

const KEYS: [&str; 2] = [r"HKCU\Software\Classes\Directory\shell\gitdeck", r"HKCU\Software\Classes\Directory\Background\shell\gitdeck"];

/// Adds or removes "Open in gitdeck" on folders (and folder backgrounds) in Windows Explorer.
pub fn set(on: bool) -> anyhow::Result<()> {
    if !cfg!(windows) {
        bail!("the Explorer menu exists on Windows only");
    }
    let exe = std::env::current_exe()?;
    for (key, target) in KEYS.iter().zip(["%1", "%V"]) {
        let command = format!("\"{}\" --open \"{target}\"", exe.display());
        let icon = exe.display().to_string();
        let ok = if on {
            reg(&["add", key, "/ve", "/d", "Open in gitdeck", "/f"])?
                && reg(&["add", key, "/v", "Icon", "/d", &icon, "/f"])?
                && reg(&["add", &format!(r"{key}\command"), "/ve", "/d", &command, "/f"])?
        } else {
            reg(&["delete", key, "/f"])?
        };
        if !ok {
            bail!("reg failed on {key}");
        }
    }
    Ok(())
}

/// Whether "Open in gitdeck" is on the folder menu; `None` where there is no Explorer.
pub fn is_on() -> Option<bool> {
    cfg!(windows).then(|| reg(&["query", KEYS[0]]).unwrap_or(false))
}

fn reg(args: &[&str]) -> anyhow::Result<bool> {
    let mut cmd = Command::new("reg");
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    Ok(cmd.output()?.status.success())
}
