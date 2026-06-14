# UX QA Review

Date: June 9, 2026

## Scope

This pass tested AgentBoard as a first-time Windows desktop user. It did not redesign the product
or change the 14-command Tauri contract.

The tested path was:

1. Understand the product and current workspace.
2. Open the workspace dialog.
3. Read agent availability and pipeline health.
4. Discover normal-click and right-click actions.
5. Select and inspect a pipeline node.
6. Generate a reviewed prompt.
7. Run a harmless PowerShell command.
8. Run a no-edit Codex prompt.
9. Open logs and reload the WebView to verify restoration.
10. Identify disabled and coming-soon features.

## What Was Confusing

- `local control plane` described the implementation style, not what AgentBoard helps a user do.
- A populated workspace had no concise explanation of the recommended node-to-agent workflow.
- Workspace opening uses full-path entry rather than a native folder picker, which was easy to
  mistake for folder creation.
- Right-click was documented in the pipeline view but was not obvious for workspaces, agents,
  skills, sessions, or files.
- Pipeline health counts did not explain which statuses contributed to each count.
- PowerShell and CMD prompts are executable shell commands, while Codex and Claude prompts are
  agent instructions. The command surface did not make that distinction explicit.
- Missing agents disabled Run, but the nearby guidance initially still described how the agent
  would receive a task.
- Some backend errors were accurate but too technical as the first sentence.
- Several icon-only controls relied only on symbol recognition.
- Destructive actions needed a clearer statement about confirmation and irreversibility.

## What Changed

- Changed the product subtitle to `plan · run · review`.
- Added a dismissible Getting started strip:
  - Select a node.
  - Generate a prompt.
  - Review and run.
  - Right-click items for more actions.
- Rewrote onboarding to explain that AgentBoard plans, runs, and reviews local coding-agent work.
- Clarified that Open workspace accepts an existing Windows folder and does not create a new
  project directory.
- Added Enter-key submission, an empty-path disabled reason, and starter-metadata expectations to
  the workspace dialog.
- Added hover affordances and persistent low-priority right-click hints to object lists.
- Added health-count tooltips defining Healthy, Needs attention, Running, and Recent sessions.
- Added shell safety guidance and a one-click harmless PowerShell smoke command:
  `Write-Output AgentBoardSmokeTest`.
- Added state-specific install/configuration guidance when an agent is unavailable.
- Added tooltips and accessible labels to top-bar, inspector, log, rerun, and file controls.
- Expanded empty states for sessions, scanner, Git, skills, files, and missing pipeline data.
- Added human-readable error guidance while retaining the exact backend text as Technical detail.
- Clarified delete/remove disabled reasons and strengthened the irreversible Clear history
  confirmation.

## Live Results

- Product purpose, workflow, workspace name, health, agent availability, and right-click hint were
  visible in the first screen.
- Workspace dialog clearly stated that the folder must exist and starter metadata requires
  confirmation.
- A nonexistent folder produced a human-readable error and preserved the original backend error.
- Workspace, agent, node, skill, and session context menus opened successfully.
- Selecting `Video Upload` opened Summary, Files, Scanner, Git, and Prompt inspector tabs.
- Prompt generation produced a real 1,401-character node-aware prompt.
- PowerShell completed `Write-Output AgentBoardSmokeTest`; its log contained
  `AgentBoardSmokeTest`.
- Codex completed `Do not edit files. Reply only with AgentBoardCodexSmokeTest.`; its log contained
  `AgentBoardCodexSmokeTest`.
- Reloading the WebView restored six sessions, including the new Codex and PowerShell runs.
- Gemini and Aider displayed install-needed state and a disabled Run reason.
- Settings and marketplace controls were disabled and labeled coming soon.
- Clear history opened an irreversible-action confirmation. The QA pass dismissed it, so no logs
  were deleted.

## Actions Hidden Behind Context Menus

These secondary actions remain context-menu only:

- Workspace rename, Explorer reveal, removal, and properties.
- Agent-specific availability check and properties.
- Node-specific Run with Codex, Run with Claude, scanner attachment, metadata editing, and
  deletion.
- Skill editing, Explorer reveal, deletion, and properties.
- Session summary copy, direct log reveal, individual deletion, and properties.
- File path copy, prompt attachment, Explorer reveal, and properties.

Unavailable edit, delete, removal, reveal, and marketplace actions are disabled with a reason.

## Actions Also Available Through Normal Clicks

- Open or initialize a workspace.
- Open the sample workspace.
- Refresh workspace and agent availability.
- Read agent availability.
- Open Pipeline, History, Scanner, Git, Skills, and Files.
- Select and inspect a pipeline node.
- Generate a node-aware prompt.
- Select an agent and run the reviewed prompt.
- Run a harmless PowerShell smoke command.
- Inspect node files, scanner findings, Git changes, and prompt review.
- Create a worktree from the node inspector.
- Enable or disable compatible local skills.
- Inspect sessions, open logs, and rerun prompts with metadata.
- Stop a running session.
- Open the logs folder.
- Clear completed session history with confirmation.

No critical run, inspection, log, scanner, Git, skill-toggle, or workspace-open action requires
right-click.

## Confirmation And Success Rules

- Starter metadata creation requires confirmation.
- Clearing completed session logs requires confirmation and states that the action cannot be
  undone.
- Workspace, node, skill, and individual-log delete/remove actions are not implemented and remain
  disabled. Their copy states that future deletion will require confirmation.
- Stop reports `Stop requested` only after the backend accepts the request. Final stopped status
  comes from the backend event.
- Run success is not reported when launch fails. Completion, failure, stopped, and
  external-blocked states come from backend events.
- Worktree, logs-folder, scanner, workspace, and history actions report success only after their
  invoke call resolves.

## What Remains Confusing

- Open workspace still uses path entry because no native folder-picker plugin is installed.
- `Healthy` combines tested and production-ready states; users needing exact status must open
  Pipeline.
- `Needs attention` combines broken, mock, and partial states; the tooltip explains this, but the
  overview intentionally stays compact.
- Git warnings retain exact command output after the friendly summary, which can still look
  technical.
- Properties and copy-path actions are intentionally secondary and remain context-menu only.
- Keyboard access to context-menu-only actions is not yet implemented.
- Full diff hunks, GitHub publishing, Settings, remote marketplace, and edit/delete flows remain
  unavailable.

## Backend Contract

No Rust command changed. The preserved commands are:

`bootstrap`, `add_workspace`, `open_sample_workspace`, `load_workspace`, `detect_agents`,
`read_file`, `scan_workspace`, `git_status`, `create_worktree`, `run_agent`, `stop_session`,
`list_sessions`, `clear_session_history`, and `open_logs_folder`.

## Verification Commands

Passed:

- `npm run type-check`
- `npm run build`
- `npm run self_review`
- `cargo metadata --manifest-path src-tauri\Cargo.toml --format-version 1 --no-deps`
- `cargo test --manifest-path src-tauri\Cargo.toml runtime_backend_flow -- --nocapture`
- `npm run tauri dev` with `CARGO_TARGET_DIR=D:\Flameic-cargo-target`
- Frontend invoke/registered-handler audit: 14 frontend commands and 14 registered Rust commands,
  with no differences.

The final desktop launch built successfully and started
`D:\Flameic-cargo-target\debug\agentboard.exe` with an `AgentBoard` WebView at the configured Vite
URL.

## Confidence

| Flow | Confidence |
| --- | --- |
| Understand AgentBoard within 60 seconds | 0.96 |
| Open or initialize a workspace | 0.95 |
| Read local agent availability | 0.98 |
| Understand pipeline health | 0.94 |
| Discover right-click actions | 0.94 |
| Select and inspect a node | 0.98 |
| Generate and review a prompt | 0.98 |
| Run PowerShell safely | 0.99 |
| Run Codex with a no-edit prompt | 0.97 |
| Find live and restored logs | 0.98 |
| Understand disabled/coming-soon features | 0.96 |
| Destructive-action safeguards | 0.97 |
| Human-readable error handling | 0.94 |
| Preserved 14-command contract | 0.99 |
