<table>
<tr>
<td width="120"><img src="web/public/favicon.svg" width="100" alt="gitdeck"></td>
<td>
<b>gitdeck</b> is a fast take on the Git Extensions browse window.<br>
A small Rust server, <code>gitd</code>, runs where your repos live and opens in its own window.
Windows and Linux.
</td>
</tr>
</table>

## Why

I use Git Extensions every day, but it gets slow on big histories and it doesn't handle a project
made of several repos with lots of submodules very well. I also wanted to reach my repos from
another machine without remote desktop. So I rebuilt the parts I use.

## Features

- Workspaces with several root repos and their (nested) submodules in one tree
- Each submodule is a real repo: status, branch, ahead/behind, pull, push
- Background auto fetch for the whole workspace
- Pull always rebases with autostash, for one repo or all of them
- Stage, unstage or discard selected lines
- Fast commit graph, diffs, blame and file history
- GitHub pull requests through your own `gh` CLI (opt-in)

## Setup

Download the executable and run it. That's it, it opens in its own window.

## Remote

To use it from another machine, for example a laptop over a VPN, start it on the host bound to
the VPN address:

```
gitd --bind 10.0.0.5:7777 --keep --no-open
```

Then on the laptop open `http://10.0.0.5:7777/login?token=<token>`. The token is in
`%APPDATA%\gitdeck\token` on Windows or `~/.config/gitdeck/token` on Linux. The login sets a
cookie, so you only do it once per browser.
