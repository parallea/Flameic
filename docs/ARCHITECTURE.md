# AgentBoard Architecture

AgentBoard is a Windows desktop app built with Tauri, React, TypeScript, and Rust.

## Runtime Shape

- React/Vite renders the IDE-style control plane.
- Tauri exposes native commands through `window.__TAURI__.core.invoke`.
- Rust owns local filesystem access, workspace metadata, process spawning, Git commands, scans, worktree creation, and log files.
- Agent CLIs are user-owned local tools. AgentBoard launches `claude`, `codex`, `gemini`, `aider`, `powershell`, or `cmd` from the selected workspace folder.

## Storage

Global Windows app data:

```text
%APPDATA%/AgentBoard/
  workspaces.json
  preferences.json
  recent_sessions.json
```

Workspace data:

```text
<workspace>/.agentboard/
  workspace.json
  pipelines.json
  skills/
  logs/
  sessions/
  reviews/
```

## Native Command Surface

- `bootstrap`
- `add_workspace`
- `open_sample_workspace`
- `load_workspace`
- `detect_agents`
- `read_file`
- `scan_workspace`
- `git_status`
- `create_worktree`
- `run_agent`
- `stop_session`
- `list_sessions`

## Agent Execution

AgentBoard starts subprocesses in the selected workspace and streams stdout/stderr into the UI through Tauri events:

- `agent-output`
- `agent-status`

Logs are persisted to `<workspace>/.agentboard/logs/`.

## ConPTY Upgrade Path

The current v1 uses subprocess output capture. A production terminal should add Windows ConPTY for fully interactive sessions:

1. Add a Rust PTY layer using a maintained ConPTY crate or direct Windows API bindings.
2. Keep agent process ownership in Rust.
3. Stream PTY bytes through Tauri events.
4. Use a terminal renderer such as xterm.js in React.
5. Add explicit session permissions for shell commands and task prompts.
