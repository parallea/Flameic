# Product Polish Review

Date: June 9, 2026

## UI Changes

- Refined the existing dark IDE palette with quieter surfaces, clearer borders, improved contrast,
  consistent radii, focus rings, reduced-motion support, and restrained hover elevation.
- Improved sidebar selection so Dashboard and History reflect the active workspace view.
- Added a dedicated no-workspace onboarding state with Open Folder, sample workspace, metadata
  requirements, and explicit starter-file approval.
- Simplified the workspace toolbar labels and added a complete keyboard shortcut legend:
  `Ctrl+K`, `Ctrl+G`, `Ctrl+R`, `Ctrl+Shift+S`, and `Ctrl+O`.
- Improved panel, modal, selected-node, empty-list, and empty-file states without changing the
  overall Rocket-inspired layout.

## Review Workflow Changes

- The review panel shows selected node status, concerned files, checks, and scanner findings that
  match the node's declared files.
- Git review shows changed and untracked files, status codes, available line counts, and raw
  `diff --stat` output. Changed files open in the existing file viewer.
- PR draft generation now produces separate title and body previews using real node, scanner, Git,
  and diff-stat data.
- Actual PR publishing is disabled and labeled as requiring GitHub integration.
- Full side-by-side patch rendering is not shown because the current backend contract does not
  return patch hunks.

## Queue And Session Changes

- Staged queue entries contain the actual prompt, agent, node, selected compatible skills,
  timestamp, and status.
- A staged entry runs only after an explicit Run action. Backend session events update it to
  `running`, `completed`, `failed`, `stopped`, or `external_blocked`.
- Started entries link to their durable session log.
- Sessions with persisted prompts can be rerun. Legacy restored logs without original prompt
  metadata show a disabled Rerun action.

## Workspace And Skills

- Opening a folder validates that `.agentboard/pipelines.json` exists.
- Missing metadata returns a starter-required result. The UI asks for confirmation before creating
  `.agentboard` directories and an empty pipeline document.
- Installed local skills show their path and compatibility with the selected agent.
- Only enabled, compatible skills are injected into generated prompts and backend run requests.
- Remote GitHub skill search and installation remain disabled and labeled coming soon.

## Files Changed

- `src/App.tsx`
- `src/styles/tailwind.css`
- `src/lib/types.ts`
- `src/lib/prompt.ts`
- `src/lib/tauri.ts`
- `src-tauri/src/lib.rs`
- `docs/PRODUCT_POLISH_REVIEW.md`

## Still Placeholder

- GitHub authentication and PR publishing are not implemented.
- Full patch-hunk and side-by-side diff APIs are not part of the 14-command backend contract.
- Automatic sequential queue execution is not implemented; queued runs require an explicit click.
- The run queue is current-session UI state and is not persisted independently of session logs.
- Open Folder uses a validated path entry dialog; a native filesystem picker plugin is not
  installed.
- Remote skill marketplace/search/install is disabled.
- Interactive ConPTY terminal and Settings remain labeled coming soon.

## Production-Ready

- Existing workspace, pipeline, file, scanner, Git, worktree, agent, and persistent log workflows.
- Node-aware prompt generation with compatible local skill injection.
- Node-scoped scanner review.
- Changed-file and diff-stat review using real Git data.
- PR title/body preview without false publishing success.
- Explicit queue execution with real backend lifecycle status and log linkage.
- Confirmed starter metadata creation without silent workspace mutation.
- Visible keyboard shortcuts, runtime status, errors, disabled states, and empty states.

## Confidence

| Module | Confidence |
| --- | --- |
| Visual system and responsive hierarchy | 0.93 |
| Selected-node review workflow | 0.95 |
| Scanner finding attachment | 0.96 |
| Git changed-file and diff-stat review | 0.92 |
| PR draft preview | 0.94 |
| Queue lifecycle and log linkage | 0.91 |
| Previous prompt rerun | 0.90 |
| Workspace onboarding validation | 0.95 |
| Local skill selection and prompt injection | 0.94 |
| Keyboard shortcuts and discoverability | 0.98 |
| Preserved 14-command runtime contract | 0.99 |
