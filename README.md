# AgentBoard

AgentBoard is a Windows desktop control plane for supervising local coding agents across project folders.

It lets you run multiple agents simuntaniously over a each file such that you can ask one agent to design while other to build a backend for the product simuntaniously. You can also identify the number of pipleines used in the project and see weather they are working or not such that you can also deploy an agent in the pipeline to fix that part which enable more efficient solution other than traditional where you deploy an agent to whole project and use much more tokens to read not so important parts of the projects.

## Prerequisites

- Node.js 20+
- Rust/Cargo for Tauri desktop runs and builds
- Microsoft WebView2 Runtime
- Optional local tools: `claude`, `codex`, `gemini`, `aider`, `git`

## Install

```powershell
npm install
```

## Run The Frontend Only

```powershell
npm run dev
```

This starts Vite at `http://127.0.0.1:4028`. Native desktop commands are only available inside Tauri.

## Run The Windows Desktop App

```powershell
npm run tauri dev
```

Equivalent:

```powershell
npm run windows:run
```

## Build

```powershell
npm run build
npm run tauri build
```

Equivalent:

```powershell
npm run windows:build
```

## Self Review

```powershell
npm run self_review
```

The script checks package/config files, TypeScript, frontend build, Tauri config, sample pipeline JSON, README/docs, and Windows scripts.

## Workspace Format

AgentBoard creates this structure inside each workspace:

```text
.agentboard/
  workspace.json
  pipelines.json
  skills/
  logs/
  sessions/
  reviews/
```

Global config is stored in:

```text
%APPDATA%/AgentBoard/
```

## Sample Workspace

Use **Open sample workspace** in the app or add:

```text
sample-workspace
```

The sample includes Video Upload, Transcription, Realtime VAD, Ghost Cursor, Voice Output, and Review/PR nodes.

## Current Scope

Working:

- Add/open workspace
- Agent CLI detection
- Pipeline graph and dashboard
- Code viewer
- Prompt generation
- Local skill loading and selection
- Reality scanner
- Git status and worktree creation
- Agent subprocess launch with log streaming
- PR draft generation

Coming soon and disabled in the UI:

- GitHub remote skill search/install
- Full interactive ConPTY terminal
- Real PR creation/push
- Team/history/settings screens
