# Session Persistence

Date: June 9, 2026

## Storage

AgentBoard stores one append-only log per agent run:

```text
<workspace>/.agentboard/logs/<agent>-session-<timestamp>.log
```

The log contains raw `[stdout]`, `[stderr]`, and `[system]` records. New sessions write a JSON
`session-meta` record when they start and another when they finish. The final record preserves the
session ID, agent, prompt, optional pipeline node, selected skills, workspace and execution paths,
optional worktree path, timestamps, exit code, log path, and status:

- `staged`
- `running`
- `completed`
- `failed`
- `stopped`
- `external_blocked`

## Restoration

Loading a workspace scans `.agentboard/logs/`, parses the latest metadata record in each log, and
returns restored sessions and display lines with the workspace payload.

Older logs without metadata are restored from their filename and content. Their timestamp comes
from the filename or file modification time. Legacy completion status is inferred conservatively,
so an exact exit code and original prompt may be unavailable.

A persisted `running` session stays running only when the current backend still owns that process.
A run left behind by an earlier app process is restored as `stopped`.

Claude subscription or organization access failures are restored as `external_blocked` and shown
as `Claude access blocked`.

## Display Encoding

Log files are never rewritten during restoration. The backend and live frontend display path only
normalize common Windows mojibake sequences such as `Â·`, broken smart quotes, and broken dashes.
The original bytes remain in the `.log` file.

## History Controls

- **Open folder** opens the active workspace's `.agentboard/logs/` directory.
- **Clear** requires confirmation and deletes non-running `.log` files for the active workspace.
- Running session logs are retained and reported in the clear result.

Clearing history is permanent because the log files are the persistence source.
