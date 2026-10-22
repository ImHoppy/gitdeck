use std::process::Command;

const SHELL_KEY: &str = r"HKCR\Directory\shell";

/// The program Windows opens folders with when it is not Explorer (File Pilot, Directory Opus…):
/// the default verb of `HKCR\Directory\shell`. `None` elsewhere, or when it is Explorer.
pub fn detect() -> Option<String> {
    if !cfg!(windows) {
        return None;
    }
    let verb = query(SHELL_KEY).filter(|v| !v.is_empty()).unwrap_or_else(|| "open".into());
    let command = query(&format!(r"{SHELL_KEY}\{verb}\command"))?;
    program(&command).filter(|p| !is_explorer(p))
}

fn query(key: &str) -> Option<String> {
    let mut cmd = Command::new("reg");
    cmd.args(["query", key, "/ve"]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    let out = cmd.output().ok().filter(|o| o.status.success())?;
    default_value(&String::from_utf8_lossy(&out.stdout))
}

/// The data of `reg query <key> /ve`; the value's name is localized, so it is found by its type.
fn default_value(output: &str) -> Option<String> {
    output.lines().find_map(|line| {
        let (_, rest) = line.split_once("REG_EXPAND_SZ").or_else(|| line.split_once("REG_SZ"))?;
        Some(rest.trim().to_string())
    })
}

/// The executable of a shell command line: its first token, quoted or not.
fn program(command: &str) -> Option<String> {
    let command = command.trim();
    let program = match command.strip_prefix('"') {
        Some(rest) => rest.split('"').next()?,
        None => command.split(' ').next()?,
    };
    (!program.is_empty()).then(|| program.to_string())
}

fn is_explorer(program: &str) -> bool {
    let name = program.rsplit(['\\', '/']).next().unwrap_or(program);
    name.eq_ignore_ascii_case("explorer.exe") || name.eq_ignore_ascii_case("explorer")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_default_value_whatever_its_localized_name() {
        let out = "\r\nHKEY_CLASSES_ROOT\\Directory\\shell\\open\\command\r\n    (par défaut)    REG_SZ    \"C:\\Fp\\FPilot.exe\" \"%1\"\r\n\r\n";
        assert_eq!(default_value(out).as_deref(), Some(r#""C:\Fp\FPilot.exe" "%1""#));
        assert_eq!(default_value("    (Default)    REG_EXPAND_SZ    %SystemRoot%\\Explorer.exe\r\n").as_deref(), Some(r"%SystemRoot%\Explorer.exe"));
        assert_eq!(default_value("    (Default)    REG_SZ    \r\n").as_deref(), Some(""));
        assert_eq!(default_value("HKEY_CLASSES_ROOT\\Directory\\shell\r\n"), None);
    }

    #[test]
    fn takes_the_program_of_a_command_line() {
        assert_eq!(program(r#""C:\Program Files\Fp\FPilot.exe" "%1""#).as_deref(), Some(r"C:\Program Files\Fp\FPilot.exe"));
        assert_eq!(program(r#"C:\Fp\FPilot.exe "%1""#).as_deref(), Some(r"C:\Fp\FPilot.exe"));
        assert_eq!(program(""), None);
    }

    #[test]
    fn knows_explorer() {
        assert!(is_explorer(r"C:\WINDOWS\Explorer.exe"));
        assert!(is_explorer("explorer"));
        assert!(!is_explorer(r"C:\Fp\FPilot.exe"));
    }
}
