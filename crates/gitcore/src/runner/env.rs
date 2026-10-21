pub const NO_PROMPT_ENV: &[(&str, &str)] = &[
    ("GIT_TERMINAL_PROMPT", "0"),
    ("GIT_SSH_COMMAND", "ssh -o BatchMode=yes"),
    ("GCM_INTERACTIVE", "never"),
    ("LC_ALL", "C"),
];

/// On top of `NO_PROMPT_ENV`, which gh also needs since it runs git itself.
pub const GH_ENV: &[(&str, &str)] = &[
    ("GH_PROMPT_DISABLED", "1"),
    ("GH_NO_UPDATE_NOTIFIER", "1"),
    ("GH_SPINNER_DISABLED", "1"),
    ("NO_COLOR", "1"),
];
