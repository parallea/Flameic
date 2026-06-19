# Agent Result Review V1 QA

Date: June 19, 2026

## Scope

Agent Result Review is generated for completed edit-mode sessions without requiring Git. Review
metadata is stored at:

```text
<workspace>/.agentboard/reviews/<session-id>/review.json
```

The same folder contains `capture.json` and bounded before-content snapshots used by safe revert.
Inspect-only sessions do not create edit reviews.

## Safety Rules

- `.agentboard`, `.git`, `node_modules`, `dist`, `build`, `target`, `.venv`, `venv`, and `.next`
  are excluded.
- Files larger than 1 MiB are marked large and do not receive inline diffs or snapshots.
- Hashing is bounded at 16 MiB. Files without an expected hash are not deleted or overwritten by
  revert.
- Diff previews are limited to text files no larger than 256 KiB.
- Sensitive files such as `.env`, key/certificate files, credential files, and private-key files
  retain metadata and hashes where bounded, but their content is not snapshotted and their inline
  diff is hidden.
- Revert never operates inside `.agentboard` or outside the recorded execution and target scope.
- Created and modified files are reverted only when their current hash still matches the generated
  review. Conflicts preserve current content and are returned to the UI.

## Automated Coverage

Run:

```powershell
npm run test:agent-review
```

Covered cases:

1. A created `hello.txt` appears as `created`; accepting persists `accepted`.
2. A modified `README.md` has a unified diff; revert restores original content.
3. A deleted `old.txt` appears as `deleted`; revert restores it.
4. Generated, dependency, Git, build, and AgentBoard metadata directories are ignored.
5. A changed `.env` is marked sensitive and has no inline diff or before snapshot.
6. A file changed after review generation returns a conflict and is not overwritten.
7. `review.json` reloads independently after the in-memory run state is gone.
8. Inspect-only capture returns no edit review.

## Manual Verification

Use a disposable registered workspace, not an important repository.

### Case 1: Create and accept

Task:

```text
Create hello.txt containing Hello from AgentBoard review.
```

Expected:

- The completed session/deployment inspector shows Result review.
- One created file is listed and its added content is visible.
- Open and Reveal work.
- Accept changes sets the review status to `accepted`.
- After restarting AgentBoard and reopening the workspace/session, the accepted review remains
  visible.

### Case 2: Create and revert

Task:

```text
Create temp-review-test.txt containing temporary review content.
```

Expected:

- One created file is listed.
- The confirmation dialog lists `temp-review-test.txt`.
- Revert removes the unchanged file and sets review status to `reverted`.

### Case 3: Modify and revert

Seed `README.md`, then ask the agent to change one line.

Expected:

- `README.md` is listed as modified.
- A unified diff is visible.
- Revert restores the exact original bytes when the file has not changed since review generation.

### Case 4: Sensitive file

Seed a disposable `.env`, then ask the agent to change it.

Expected:

- `.env` is marked sensitive.
- No inline content or diff is shown.
- Revert is unavailable because AgentBoard did not retain a secret-bearing before snapshot.

## Current Manual Result

Verification used a disposable workspace under `output/playwright/agent-review-workspace`.

- Case 1 passed in live `tauri dev`: PowerShell created `hello.txt`; the deployment inspector
  showed one created file and its unified diff; Accept changed status to `accepted`; after a full
  desktop-process restart the accepted review and diff reloaded from `review.json`.
- Case 2 passed in live `tauri dev`: PowerShell created `temp-review-test.txt`; the confirmation
  dialog listed that file; Confirm revert removed it and changed status to `reverted`.
- Cases 3 and 4 passed through the real PowerShell runtime in the ignored
  `agent_review_live_safe_workspace_flow` test: modified `README.md` produced a diff and reverted
  to exact original content; modified `.env` was marked sensitive with no inline diff.
- The eight non-ignored focused tests also passed.

The README and `.env` cases were not repeated visually in the Tauri inspector, and packaged NSIS
review persistence remains unverified.
