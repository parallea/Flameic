# Deployment Preflight QA

Date: June 10, 2026

## Preflight Checks

Before Run now, AgentBoard checks:

- target type and target-path existence
- workspace/folder source-file count
- targets containing only `.agentboard`
- concrete task text for edit mode
- selected provider availability on `PATH`
- selected local skill existence
- profile write permission for edit mode
- `.agentboard/logs` creation and write/flush ability
- Git classification: `git_repo`, `not_git_repo`, or `git_missing`
- concerned-file presence for pipeline-node targets
- provider/run-mode support and effective sandbox

Preflight is read-only with respect to source code. Its only filesystem write is a temporary probe
inside `.agentboard/logs`, which is flushed and removed.

## Empty Workspace

Workspace/folder targets with no recognized source files show:

> This target has no source files. Deploying an agent may do nothing.

Edit mode is blocked. Available actions are Cancel, Run inspect-only anyway, and disabled Create
starter files / coming soon. Inspect-only still requires an explicit confirmation before Run now.

## Run Modes

`inspect_only` generates an inspect-and-report task and successful runs finish as
`completed_inspection`. It tells the agent not to edit and not to wait for another task.

`edit` requires non-empty task text and profile Write files permission. The helper reads:
**Tell the agent what to build, fix, inspect, or verify.**

The installed `codex-cli 0.139.0` reports these supported values:

```text
--sandbox read-only
--sandbox workspace-write
--sandbox danger-full-access
```

AgentBoard uses only the first two:

- inspect-only: `--sandbox read-only`
- edit: `--sandbox workspace-write`

AgentBoard does not use `danger-full-access`.

## Git Handling

Missing Git and non-repository targets are warnings. For a non-repository target the UI says:

> Not a Git repository. Worktree isolation and Git diff review are unavailable.

Run now requires confirmation and switches to same-workspace execution. Raw `git` fatal output is
not used as the primary deployment warning.

## Log Duplication Root Cause

The backend had one stdout reader, one stderr reader, and one event emission per line. Duplication
came from the React Strict Mode lifecycle: the asynchronous listener effect could unmount before
the first `listen()` calls resolved, so their cleanup function was never retained. The second mount
registered another listener pair.

The effect now marks an unmounted setup as cancelled and immediately unregisters listeners that
resolve late. Synthetic frontend-only Started lines were also removed so visible output corresponds
to durable backend log lines.

## Durable Log Checks

The backend writes and flushes session metadata before `run_agent` returns. It writes and flushes
each stdout/stderr line before emitting the live event. The spawn event is now persisted as well as
emitted.

`runtime_backend_flow` runs:

```powershell
Write-Output "LineA"; Write-Output "LineB"
```

It asserts:

- the log length is greater than zero immediately after session creation
- `LineA` occurs once in emitted events and once in the log
- `LineB` occurs once in emitted events and once in the log
- the spawn event occurs once in emitted events and once in the log

## Automated Results

- `npm run type-check`: passed
- `npm run build`: passed
- `npm run self_review`: passed
- `cargo metadata --manifest-path src-tauri/Cargo.toml --format-version 1 --no-deps`: passed
- `cargo test --manifest-path src-tauri/Cargo.toml runtime_backend_flow -- --nocapture`: passed
- Multi-agent overlap, independent stop, and restoration remained passing.
- `npm run tauri dev`: compiled and launched the debug executable against Vite.

The runtime test used real temporary workspaces to verify empty-target blocking, explicit
inspect-only allowance, non-Git warning classification, log-folder writes, exact-once
PowerShell output, and immediate durable-log length.

## Live UI Evidence

The live app showed the workspace context menu with Deploy agent available for the empty
`New folder (4)` target, and the deployment modal rendered its target-first flow. Evidence is
stored under `evidence/deployment-preflight`.

The final escalated relaunch ran in a noninteractive Windows window station, so an additional
click-through screenshot of the confirmation warning could not be captured reliably. The empty
workspace and non-Git results below are therefore backed by the real backend command tests and
modal state logic, not claimed as a second unseen manual pass.

## Remaining Limits

- Inspect-only sandbox enforcement is explicit for Codex. Other providers remain
  provider-controlled.
- Source detection is extension-based.
- Starter source-file creation remains coming soon.
- GitHub marketplace, pipeline discovery, and ConPTY remain out of scope.

## Confidence

Confidence score: **0.94 / 1.00** before packaged-build verification.
