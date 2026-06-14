# Runtime Verification

Date: June 9, 2026

## Command Contract

The frontend exposes 14 `invokeCommand` calls. Rust defines 14 `#[tauri::command]` functions, and
all 14 are registered in `tauri::generate_handler!`.

| Frontend invoke | Rust command | Registered | Result |
| --- | --- | --- | --- |
| `bootstrap` | `bootstrap` | Yes | Pass |
| `add_workspace` | `add_workspace` | Yes | Pass |
| `open_sample_workspace` | `open_sample_workspace` | Yes | Pass |
| `load_workspace` | `load_workspace` | Yes | Pass |
| `detect_agents` | `detect_agents` | Yes | Pass |
| `read_file` | `read_file` | Yes | Pass |
| `scan_workspace` | `scan_workspace` | Yes | Pass |
| `git_status` | `git_status` | Yes | Pass |
| `create_worktree` | `create_worktree` | Yes | Pass |
| `run_agent` | `run_agent` | Yes | Pass |
| `stop_session` | `stop_session` | Yes | Pass |
| `list_sessions` | `list_sessions` | Yes | Pass |
| `clear_session_history` | `clear_session_history` | Yes | Pass |
| `open_logs_folder` | `open_logs_folder` | Yes | Pass |

## Commands Tested

- `npm run type-check`
- `npm run build`
- `npm run self_review`
- `cargo metadata --format-version 1`
- `cargo test runtime_backend_flow -- --nocapture`
- `npm run tauri dev` with `CARGO_TARGET_DIR=D:\Flameic-cargo-target`
- `powershell -Command "Write-Output AgentBoardSmokeTest"` through `run_agent`
- Minimal no-edit Claude and Codex prompts through `run_agent`
- Git initialization, status, commit, worktree creation, and cleanup in a disposable D: workspace
- WebView2 DevTools protocol checks against the real Tauri window

## Passed

- The sample workspace opens and loads as the only registered workspace.
- `.agentboard/pipelines.json` loads one pipeline with six nodes.
- All six pipeline nodes can be selected and each declared concerned file loads.
- The reality scanner completed and displayed 24 findings.
- Git status and worktree creation work in a disposable repository.
- PowerShell completed with `AgentBoardSmokeTest`; Codex completed its no-edit smoke prompt.
- A sleeping PowerShell session stopped as `stopped`, not `failed`.
- Successful and failed backend calls produce visible status and toast feedback.
- Existing `.agentboard/logs/` files restore when a workspace loads.
- Restored sessions are grouped by agent and timestamp and can be selected to view their logs.
- New sessions persist start and final metadata, including exit code and terminal status.
- A stale `running` record from an earlier app process restores as `stopped`.
- Claude subscription/access output is classified as `external_blocked` and displayed as
  `Claude access blocked`.
- Common Windows mojibake is cleaned in live and restored display text without rewriting raw logs.
- Session history clearing requires confirmation and retains currently running session logs.
- The Terminal/Logs panel can open the active workspace's log directory.
- Missing Gemini and Aider commands are labeled `install needed`.

## Detection Results

| Command | Detection |
| --- | --- |
| Git | Available |
| PowerShell | Available |
| CMD | Available |
| Claude Code | Available |
| Codex | Available |
| Gemini CLI | Missing / install needed |
| Aider | Missing / install needed |

## Failed Or Blocked

- Claude launches, but the installed CLI reports that organization subscription access is disabled.
  AgentBoard preserves this as `external_blocked`; it does not report a false success.
- Gemini and Aider cannot be executed because they are not installed.

## Runtime Defects Fixed

- Nested the frontend `run_agent` payload under the required `request` argument.
- Prevented fast child-process events from racing frontend session insertion and log initialization.
- Normalized Windows paths before passing worktree targets to Git.
- Migrated and deduplicated old workspace registry entries and accepted a UTF-8 BOM.
- Preserved exact Git stderr and marked requested process termination as `stopped`.
- Resolved Windows command shims and launched `.cmd` and `.bat` tools through CMD.
- Added `--skip-git-repo-check` for Codex execution in supported non-Git workspaces.
- Restored session history and log contents from workspace `.agentboard/logs/`.
- Added durable session metadata records for start and final process state.
- Distinguished Claude access blocks from generic failures.
- Added display-only Windows encoding cleanup while preserving raw log files.
- Added confirmed history clearing and logs-folder opening commands.

## Files Changed

- `src/App.tsx`
- `src/lib/types.ts`
- `src/lib/tauri.ts`
- `src-tauri/src/lib.rs`
- `docs/SESSION_PERSISTENCE.md`
- `docs/RUNTIME_VERIFICATION.md`

## Remaining Issues

- Claude cannot complete until subscription access is enabled or an Anthropic API key is configured.
- Gemini and Aider require local installation before execution can be verified.
- Legacy logs created before session metadata cannot recover an exact exit code or full original
  prompt; AgentBoard infers their status from filename and content.

## Confidence

| Module | Confidence |
| --- | --- |
| Invoke/command registration contract | 0.99 |
| Bootstrap and workspace registry | 0.96 |
| Pipeline loading and node selection | 0.97 |
| Concerned-file reading | 0.97 |
| Reality scanner | 0.95 |
| Git status and worktrees | 0.94 |
| Local command detection | 0.96 |
| Process execution, stopping, and live logs | 0.94 |
| Visible frontend success/error handling | 0.94 |
| Codex integration | 0.95 |
| Claude integration | 0.58 |
| Cross-restart session/log persistence | 0.94 |
| Session history controls | 0.93 |
| Windows output display cleanup | 0.90 |
