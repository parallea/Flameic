# Product Review

## What Works

- Tauri desktop scaffold with React/Vite frontend.
- `%APPDATA%/AgentBoard` global config.
- Workspace add/open flow and `.agentboard` initialization.
- Pipeline loading from `.agentboard/pipelines.json`.
- Pipeline dashboard counts for every requested node status.
- Clickable pipeline graph with status-coded nodes.
- Node detail review panel with files, issues, checks, skills, and actions.
- Code viewer with line numbers, missing-file handling, and highlighted line ranges.
- Prompt generator with workspace path, pipeline, node, status, files, issues, checks, skills, and scanner findings.
- Local skill loading from `.agentboard/skills`.
- Agent CLI detection for Claude, Codex, Gemini, Aider, Git, PowerShell, and CMD.
- Agent subprocess execution with logs saved under `.agentboard/logs`.
- Reality scanner for fake/mock/TODO/FIXME/stub/demo/not-implemented/skipped/hardcoded fake patterns and simple broken relative imports.
- Git status, branch, changed files, untracked files, and diff stat.
- Git worktree creation for selected node tasks.
- PR placeholder generation.
- Run queue UI.

## What Is Fake Or Mock

- GitHub skill repository search is UI-only and disabled as coming soon.
- Interactive terminal embedding is not implemented. The app uses subprocess logs.
- Create PR does not push or call GitHub; it generates a local PR draft only.
- Settings is disabled as coming soon. History opens the session timeline, and Skills opens the local skill search modal.

## What Is Production-Ready

- Local workspace metadata layout.
- Pipeline schema loading.
- Code viewer safety checks against parent path traversal.
- Prompt generation structure.
- Subprocess log persistence for non-interactive CLI runs.
- Scanner result attachment to prompts.

## What Needs ConPTY

- Fully interactive Claude/Codex/Gemini/Aider sessions.
- Shell prompt interaction after process start.
- Terminal resizing, key handling, Ctrl+C, and alternate screen support.

## Confidence Score Per Module

- Frontend shell and layout: 0.84
- Workspace storage: 0.78
- Pipeline dashboard and graph: 0.76
- Code viewer: 0.8
- Prompt generator: 0.84
- Skill loading: 0.72
- Agent detection: 0.74
- Agent subprocess execution: 0.65
- Git status and worktree: 0.7
- Reality scanner: 0.68
- Interactive terminal: 0.2
- GitHub skill search: 0.15
