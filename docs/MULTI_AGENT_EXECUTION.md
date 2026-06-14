# Multi-Agent Execution

Date: June 10, 2026

## Runtime Model

AgentBoard owns a map of session controls keyed by collision-resistant session IDs. Every session
records:

- agent, task, workspace, and actual execution path
- optional pipeline node ID and name
- selected local skills
- `staged`, `running`, `completed`, `failed`, `stopped`, or `external_blocked` status
- dedicated append-only log path
- start and finish timestamps
- exit code when the process provides one
- optional unique Git worktree path

Each run spawns its child process immediately. Standard output and standard error are read on
independent threads and written only to that session's log. A separate waiter thread updates only
that session when its child exits. Starting another session does not replace or queue behind an
existing session.

Stop targets the selected session's stored PID. On Windows, AgentBoard uses
`taskkill /PID <pid> /T /F`, so child processes belonging to that session are terminated without
targeting other session PIDs.

## UI

The Overview screen separates active sessions from completed and failed sessions. Active rows show
the agent, workspace, node or task, status, elapsed runtime, log control, and a session-specific
stop button. Full metadata remains available in the inspector and durable output remains available
in the log drawer.

The PowerShell safety row includes **Run multi-agent smoke**. It starts these commands as separate
sessions:

```powershell
powershell -NoProfile -Command "Write-Output AgentA-Start; Start-Sleep -Seconds 5; Write-Output AgentA-Done"
powershell -NoProfile -Command "Write-Output AgentB-Start; Start-Sleep -Seconds 3; Write-Output AgentB-Done"
```

## Worktree Isolation

Worktree isolation is optional. For a pipeline-node run in a Git repository, the run control
defaults to creating a unique worktree and branch containing the node slug and session ID.

If worktree creation fails, AgentBoard shows the Git error and asks before falling back to the
original workspace. If another active session already uses that folder, AgentBoard requires a
second explicit confirmation that warns about concurrent writes.

The built-in smoke action bypasses this warning because its fixed commands only write process
output and do not modify the workspace.

## Verification

The `runtime_backend_flow` Rust test performs process-level checks:

- starts the exact 5-second Agent A and 3-second Agent B commands
- observes two distinct live PIDs with `running` status at the same time
- verifies Agent B completes while Agent A is still running
- verifies distinct log paths and prevents cross-session log content
- starts a second pair, force-stops one session, and verifies the other remains running and finishes
- reloads completed session metadata and logs from `.agentboard/logs`

Frontend verification covers TypeScript compilation, production build, and the command-contract
self review.

Live `tauri dev` verification also passed:

- [overlap screenshot](evidence/multi-agent/multi-agent-live-overlap.png): the app shows two running
  PowerShell sessions at once
- [completion-order screenshot](evidence/multi-agent/multi-agent-live-order.png): the running count
  drops to one after Agent B's shorter command finishes
- [targeted-stop screenshot](evidence/multi-agent/multi-agent-live-targeted-stop.png): Agent A is
  stopped while Agent B remains running
- [restart restoration screenshot](evidence/multi-agent/multi-agent-live-history-restored.png): a
  fresh app process restores Agent A as stopped and Agent B as completed

The live log pair used different files. Agent B finished with exit code 0 and `AgentB-Done`; Agent A
was stopped with no `AgentA-Done`.

## Current Limits

- Windows stop is forceful, not graceful.
- AgentBoard does not automatically remove worktrees or their branches.
- A new worktree starts from committed `HEAD`; uncommitted source changes are not copied into it.
- After an AgentBoard process restart, historical logs restore, but the app does not reattach to a
  child process left alive by the previous backend process.
- Shared-workspace confirmation reduces accidental conflicts but cannot merge concurrent edits.
- GitHub skills and pipeline discovery are intentionally outside this sprint.

## Confidence

Confidence score: **0.96 / 1.00** for local Windows simultaneous execution, targeted stop, separate
logs, and log-based restoration.
