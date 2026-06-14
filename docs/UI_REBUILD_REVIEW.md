# UI Rebuild Review

Date: June 9, 2026

## Recovered Rocket Direction

The surviving Rocket frontend and `docs/ROCKET_FRONTEND_INVENTORY.md` established the design
baseline:

- A compact 48-52px collapsible rail that expands to roughly 220px.
- A restrained near-black palette using `#141414`, `#111111`, and `#1a1a1a`.
- Thin `#2a2a2a` separators, green `#4ade80` as the primary signal, and small blue, amber,
  and red status accents.
- Compact 10-14px interface type with monospace metadata.
- Small radii, selected left-edge indicators, subtle hover movement, focus rings, and status
  pulses.
- A focused main workspace with secondary detail surfaces instead of many equally weighted
  dashboard panels.

The original felt clearer because navigation, current work, and detail inspection had distinct
visual roles. Its strongest ideas were retained while replacing static demo content with verified
Tauri state.

## Layout And UI Changes

- Rebuilt the app around a left rail, main canvas, optional right inspector, and collapsed bottom
  terminal.
- Added a quiet workspace overview with pipeline health, running state, recent sessions, local
  agents, and one primary command surface.
- Reduced persistent borders and card count. Secondary data now uses soft rows and separators.
- Simplified pipeline nodes to status, file, issue, and check counts. Long issue text moved to the
  inspector.
- Added compact History, Scanner, Git, Skills, and Files views that reveal only the selected
  workflow.
- Added smooth inspector, terminal, context-menu, focus, hover, and selected-state transitions,
  with reduced-motion support.
- Preserved keyboard shortcuts for command focus, prompt generation, node execution, scanning, and
  opening a workspace.

## Progressive Disclosure

Always visible:

- Current workspace and active view.
- Health, attention, running, and recent-session counts.
- Selected agent and primary command input.
- Collapsed terminal status.

One click away:

- Pipeline nodes.
- Session history and queue.
- Scanner findings.
- Git changed files and diff stat.
- Installed local skills.

Inspector or context menu:

- Raw paths and metadata.
- Node issues and checks.
- Concerned-file reasons.
- Node-scoped scanner findings.
- Session prompt, timestamps, exit code, and log path.
- Skill manifest JSON.
- Generated pull request title/body preview.

## Review Workflow

- Selecting a pipeline node opens a five-tab inspector: Summary, Files, Scanner, Git, and Prompt.
- Scanner findings are attached only when their file matches a concerned file for the selected
  node.
- Git review uses real changed/untracked files and real `diff --stat` output.
- Full patch hunks are not shown because the current backend contract does not expose them.
- Pull request title/body preview uses real node, scanner, and Git state.
- Pull request publishing remains disabled and labeled coming soon because GitHub integration is
  not configured.

## Context Menus

Implemented context menus:

- Workspace: open, scan, Git status, and properties.
- Agent: select for a run, details, availability refresh, logs, stop when running, and properties.
- Pipeline node: inspect, generate prompt, run prepared prompts, create worktree, open files,
  attach scanner findings, and properties through the inspector.
- Skill: enable/disable, inspect, and properties.
- Session: open log, rerun when prompt metadata exists, copy summary, open logs folder, and
  properties.
- File: open, copy path, attach to prompt, and properties.

Unsupported rename, edit, delete, marketplace, direct Explorer reveal, and pull request publishing
actions are disabled with an explicit reason. No action reports fake success.

## Simplified Or Moved

- Detailed node issues, checks, paths, scanner output, and prompt review moved out of the main
  pipeline canvas.
- Persistent full-height logs moved into a collapsed bottom drawer.
- Skill metadata and manifests moved into the inspector.
- Raw Git output moved beside the changed-file list.
- Advanced object actions moved to right-click menus.
- The previous broad dashboard panel grid was replaced by one command surface and two supporting
  overview regions.

## Backend Contract Preserved

No Rust files or Tauri commands changed in this sprint. The existing 14-command contract remains:

`bootstrap`, `add_workspace`, `open_sample_workspace`, `load_workspace`, `detect_agents`,
`read_file`, `scan_workspace`, `git_status`, `create_worktree`, `run_agent`, `stop_session`,
`list_sessions`, `clear_session_history`, and `open_logs_folder`.

## Verification Results

Passed:

- `npm run type-check`
- `npm run build`
- `npm run self_review`
- `cargo metadata --manifest-path src-tauri\Cargo.toml --format-version 1 --no-deps`
- `cargo test --manifest-path src-tauri\Cargo.toml runtime_backend_flow -- --nocapture`
- `npm run tauri dev` with `CARGO_TARGET_DIR=D:\Flameic-cargo-target`
- Live Tauri launch using `D:\Flameic-cargo-target`
- Sample workspace restored with one pipeline, six nodes, one local skill, and four saved sessions.
- Workspace, agent, pipeline node, skill, session, and file context menus opened in the real
  WebView.
- Disabled context actions displayed their reason.
- Selecting a node opened the five-tab inspector.
- Generating a prompt from a different node's context menu selected that node and focused the
  populated command input.
- Persisted sessions and log output opened in the bottom terminal after restart.
- No frontend toast errors appeared during the visual launch check.
- The final Tauri process built in dev mode, launched
  `D:\Flameic-cargo-target\debug\agentboard.exe`, and exposed an `AgentBoard` WebView at the
  configured Vite URL.

## Files Changed

- `src/App.tsx`
- `src/styles/tailwind.css`
- `docs/UI_REBUILD_REVIEW.md`

## Still Coming Soon

- GitHub authentication and pull request publishing.
- Full patch-hunk or side-by-side diff rendering.
- Workspace, pipeline-node, skill, and individual-log editing/deletion.
- Direct Explorer reveal for arbitrary workspace, skill, file, or log paths.
- Remote skill marketplace.
- Settings.

## Confidence

| Module | Confidence |
| --- | --- |
| Recovered Rocket visual system | 0.96 |
| Layout and progressive disclosure | 0.95 |
| Workspace overview | 0.96 |
| Pipeline selection and inspector | 0.97 |
| Review tabs and real data binding | 0.95 |
| Context menus and disabled states | 0.96 |
| Command input and prompt generation | 0.97 |
| Session history and log drawer | 0.96 |
| Local skills workflow | 0.95 |
| Responsive desktop hierarchy | 0.92 |
| Preserved 14-command contract | 0.99 |
