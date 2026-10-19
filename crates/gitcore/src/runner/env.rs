pub const NO_PROMPT_ENV: &[(&str, &str)] = &[
    ("GIT_TERMINAL_PROMPT", "0"),
    ("GIT_SSH_COMMAND", "ssh -o BatchMode=yes"),
    ("GCM_INTERACTIVE", "never"),
    ("LC_ALL", "C"),
];
