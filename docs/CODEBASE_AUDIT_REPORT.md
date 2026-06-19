# Codebase Audit Report

Audit date: 2026-06-17

Scope: full repository inventory, active Tauri/Vite frontend, Rust backend command layer, docs, tests, scripts, and config. Generated/heavy folders were skipped for inventory: `node_modules`, `dist`, `build`, `target`, `.git`, installer evidence/artifacts, and binary files. No live Codex deployments were run. No live GitHub API call was run during this audit.

Methodology:

- Pass 1: inventoried important frontend, backend, docs, tests, scripts, and config with generated/heavy folders excluded.
- Pass 2: audited every registered Tauri command in `src-tauri/src/lib.rs`, including inputs, outputs, filesystem writes, network calls, process spawns, token handling, diagnostics, and persistence paths.
- Pass 3: audited every frontend backend invocation through `src/lib/tauri.ts`, `src/App.tsx`, `src/components/**`, and `src/lib/**`.
- Pass 4: traced product features from UI state to backend command to persistence/runtime and back to UI.
- Pass 5: deep-audited GitHub Marketplace search, preview, install, update, uninstall, trust, cache, rate limits, and token handling.
- Pass 6: analyzed GitHub sign-in/device-flow feasibility without building it.
- Pass 7: ranked next sprint options based on code/test evidence.

## 1. Executive Summary

AgentBoard is currently a Windows desktop control plane for local coding agents. The active app is Tauri 2 + React/Vite + TypeScript, with a single Rust backend file handling workspace persistence, local filesystem reads/writes, Git calls, subprocess agent execution, session logs, deployment records, local skills, GitHub skill imports, and diagnostics.

Genuinely working, based on code and tests:

- Workspace registry and sample workspace onboarding.
- Pipeline loading from explicit `.agentboard/pipelines.json`.
- Concerned-file reading with workspace-relative path safety.
- Local skill loading from `.agentboard/skills/<skill>/SKILL.md` plus `skill.json`.
- Agent profiles and deployment records in `%APPDATA%/AgentBoard`.
- Deployment preflight for targets, empty source, task requirements, provider availability, selected skills, Git classification, log writability, and Codex sandbox mode.
- PowerShell runtime execution, simultaneous sessions, targeted stop, durable logs, and session restoration.
- Codex command construction for inspect/edit sandbox flags, but not a live successful Codex deployment in this audit.
- GitHub Marketplace backend mechanics for search/preview/install/update/uninstall/trust/cache/token, verified by fixtures and focused tests, with major product caveats below.
- Diagnostics export that excludes source contents, prompts, and log contents.

Partially working:

- GitHub Marketplace: real code exists, but search is repository-level, detection is exact-path-only, README fallback is installable, and install/update force-refresh preview. This explains the README-only problem.
- Codex/Claude/Gemini/Aider runtime: command construction exists, but only PowerShell runtime behavior is deeply proven by current tests. Codex flags are tested, not a live successful paid-model run.
- Profile `model` and `effort` fields are stored and shown, but runtime providers do not receive them.
- Review/PR support is draft text only. PR publishing is disabled.
- Worktree isolation can create worktrees but does not clean them up and does not copy uncommitted changes.
- Skill enable/disable toggles are mostly frontend state; GitHub trust state is persisted, but generic enablement is not.

Documented but not implemented:

- GitHub OAuth/device login.
- Secure persistent GitHub token storage.
- Automatic pipeline discovery.
- Interactive ConPTY terminal.
- Real PR publishing.
- Workspace removal.
- Custom provider execution contract.
- Global marketplace ratings/reviews.
- Raw URL install and local skill import UI.

Broken or risky:

- Marketplace can honestly install local skill folders, but many GitHub results are README-derived drafts, not formal skills.
- Install cannot proceed from cached preview under core API rate limit because backend force-refreshes preview.
- Obsolete `src/app/**` prototype pages contain static/fake data and Next-style UI not used by the Tauri/Vite entry.
- Docs are partially stale: `README.md` still says GitHub remote skill search/install is coming soon, while later docs and code say it is implemented.

Tester readiness:

- The current app is safe enough for 1-3 trusted Windows testers if the promise is limited to local workspace supervision, explicit pipeline metadata, profile/deployment staging, PowerShell/Codex CLI launching where the tester already has CLIs/auth, local skills, GitHub skill import with review caveats, and log/diagnostic collection.
- It is not ready for a broad "GitHub Marketplace installs usable skills" claim.

Honest tester promise today:

> AgentBoard can open a local workspace, read explicit `.agentboard` pipeline metadata, create agent profiles, preflight deployments, stage/run local CLI sessions, preserve logs, load local skills, and import GitHub repository text as untrusted skill drafts for review. GitHub Marketplace is alpha and may return README drafts rather than formal skills.

## 2. Architecture Overview

The active runtime path is:

- `src/main.tsx` mounts `src/App.tsx`.
- `src/App.tsx` owns most app state and active UI.
- `src/lib/tauri.ts` wraps Tauri `invoke` calls.
- `src-tauri/src/lib.rs` registers 33 Tauri commands.
- Rust reads/writes local app/workspace files, calls Git, calls GitHub, spawns local agent CLI processes, writes logs, and emits Tauri events.

```text
User action
  -> src/App.tsx or active component state
  -> agentboardApi wrapper in src/lib/tauri.ts
  -> Tauri invoke command
  -> Rust command in src-tauri/src/lib.rs
  -> filesystem / GitHub network / git process / agent process
  -> JSON command result or agent-output/agent-status event
  -> React state update
  -> UI panel, inspector, log drawer, toast
```

Main persistence locations:

- Global: `%APPDATA%/AgentBoard/workspaces.json`, `agents.json`, `deployments.json`, `preferences.json`, `recent_sessions.json`, `github-marketplace-cache.json`, `diagnostics/`.
- Workspace: `<workspace>/.agentboard/workspace.json`, `pipelines.json`, `skills/`, `logs/`, `sessions/`, `reviews/`.

Skills system:

- Local and GitHub-imported skills live under `<workspace>/.agentboard/skills/<name>/`.
- Valid active skills need `SKILL.md` and `skill.json`.
- GitHub imports additionally require `source.json`.
- Prompt injection blocks untrusted/disabled GitHub imports in `src/lib/prompt.ts:23`.

Marketplace system:

- UI component: `src/components/skills/GithubMarketplace.tsx`.
- Backend commands: `github_marketplace_*` in `src-tauri/src/lib.rs:1548`.
- Search uses GitHub repo search plus tree/contents APIs.
- Installs never execute remote code; they write local instruction files only.

Deployment system:

- UI modals: `src/components/deployment/DeploymentModals.tsx`.
- Frontend orchestration: `src/App.tsx:4219`, `src/App.tsx:4245`.
- Backend preflight: `src-tauri/src/lib.rs:2200`.
- Backend runtime: `src-tauri/src/lib.rs:1154`.

Session/log system:

- `run_agent` writes one log per session under `.agentboard/logs`.
- Rust emits `agent-output` and `agent-status`.
- Frontend listener setup handles React Strict Mode cleanup (`src/App.tsx:3577`).
- Workspace load restores sessions/logs from backend history.

## 3. File/Module Inventory

| Path | Purpose | Major exports/functions | Risk/complexity | Active? |
| --- | --- | --- | --- | --- |
| `src/main.tsx` | Vite entry; mounts `App` and toaster. | `createRoot(...).render(<App />)` | Low | Active |
| `src/App.tsx` | Main active desktop UI and state orchestration. | Dashboard, rail, inspector, logs drawer, context menus, profile/deployment/session actions. | Very high | Active |
| `src/lib/tauri.ts` | Typed frontend command wrapper. | `invokeCommand`, `agentboardApi` | Medium | Active |
| `src/lib/types.ts` | Frontend mirror of backend DTOs. | Workspace, skill, GitHub, profile, deployment, session, diagnostics types. | Medium | Active |
| `src/lib/prompt.ts` | Prompt generation and trust gating. | `generateAgentPrompt`, `generateDeploymentPrompt`, `skillCanInject` | High | Active |
| `src/lib/githubRateLimit.ts` | GitHub quota/retry text helpers. | `formatGithubRetry`, `githubUserFacingError`, `canOpenGithubPreview` | Medium | Active |
| `src/components/deployment/DeploymentModals.tsx` | Create/edit profile and deploy-agent modal. | `CreateAgentModal`, `DeployAgentModal` | High | Active |
| `src/components/skills/GithubMarketplace.tsx` | Marketplace search/preview/install/update/uninstall/token UI. | `GithubSkillsMarketplace` | High | Active |
| `src/components/Sidebar.tsx` | Static Next-style prototype sidebar with fake workspaces. | `Sidebar` | Medium | Inactive in Tauri |
| `src/components/Topbar.tsx` | Static prototype topbar with fake "Run All". | `Topbar` | Medium | Inactive in Tauri |
| `src/components/AppLayout.tsx` | Next-style layout shell. | `AppLayout` | Low | Inactive in Tauri |
| `src/components/ui/*` | Next-style image/icon/logo wrappers. | `AppIcon`, `AppImage`, `AppLogo` | Low/medium | Only prototype pages |
| `src/app/**` | Next-style prototype pages. | Static dashboard, pipeline, marketplace pages. | Medium | Inactive in Tauri/Vite |
| `src-tauri/src/lib.rs` | Entire Rust backend. | 33 commands, DTOs, persistence, GitHub, runtime, tests. | Very high | Active |
| `src-tauri/src/main.rs` | Tauri binary entry. | `agentboard_lib::run()` | Low | Active |
| `src-tauri/src/main_backup.rs` | Old backend snapshot. | Previous app code. | Medium | Obsolete |
| `src-tauri/Cargo.toml` | Rust package/dependencies. | `reqwest`, `serde`, `tauri`. | Low | Active |
| `src-tauri/tauri.conf.json` | Desktop window/build/bundle config. | Vite dev URL, dist path, bundle resources. | Medium | Active |
| `src-tauri/capabilities/default.json` | Tauri capability. | `core:default` only. | Low | Active |
| `package.json` | JS scripts/dependencies. | `build`, `self_review`, prompt/rate tests, Tauri scripts. | Medium | Active |
| `vite.config.mjs`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js` | Frontend build/style config. | Vite, TypeScript, Tailwind. | Medium | Active |
| `scripts/self_review.mjs` | Repo gate script. | Config/doc/command-contract/build/rate checks. | High | Active |
| `scripts/prompt_preview_test.mjs` | Prompt trust gate smoke. | Reviewed GitHub skill injects; untrusted excluded. | Medium | Active |
| `scripts/github_marketplace_rate_limit_test.mjs` | GitHub quota UI helper test. | Raw epoch sanitation, cached preview gating. | Medium | Active |
| `scripts/release_lifecycle_qa.ps1` | Packaging lifecycle QA helper. | Snapshot/install/uninstall checks. | Medium | Active for release |
| `sample-workspace/**` | Bundled sample workspace. | Pipeline JSON, sample source files, skills. | Medium | Active sample |
| `docs/ARCHITECTURE.md` | High-level architecture, stale command count. | Runtime/storage overview. | Low | Partially stale |
| `docs/AGENT_DEPLOYMENT_UX.md` | Deployment feature doc. | Preflight/runtime claims and limits. | Medium | Mostly current |
| `docs/DEPLOYMENT_PREFLIGHT_QA.md` | Preflight QA evidence. | Empty target/log/Git/Codex sandbox checks. | Medium | Mostly current |
| `docs/GITHUB_SKILLS_MARKETPLACE.md` | Marketplace design/QA. | Search/install/trust/token/cache docs. | Medium | Mostly current, optimistic |
| `docs/KNOWN_ALPHA_LIMITATIONS.md` | Tester limitations. | Runtime, marketplace, diagnostics, data safety caveats. | Low | Current |
| `docs/PACKAGED_BUILD_QA.md` | Packaging evidence. | NSIS/MSI hashes/lifecycle. | Medium | Stale command count, old artifact-specific |
| `docs/RUNTIME_VERIFICATION.md` | Runtime evidence from June 9. | 14-command era runtime checks. | Medium | Stale command count |
| `docs/ROADMAP.md` | Near-term ideas. | Some items now implemented. | Low | Stale |
| `docs/RELEASE_CHECKLIST.md` | Alpha release gates. | Build/install/marketplace/deployment gates. | Medium | Mostly current |

## 4. Backend Command Contract

Total backend commands: **33**.

Evidence:

- `#[tauri::command]` functions are in `src-tauri/src/lib.rs:771-1736`.
- Registration is in `tauri::generate_handler!` at `src-tauri/src/lib.rs:731`.
- Frontend wrappers are in `src/lib/tauri.ts:57`.
- `npm run self_review` passed and checks frontend/Rust command contract drift.

| Command | Rust function | Frontend caller | Purpose | Inputs -> outputs | Side effects | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bootstrap` | `bootstrap` `lib.rs:771` | `App.tsx:3490` | Initialize app state. | none -> `AppBootstrap` | Creates `%APPDATA%/AgentBoard` defaults; loads sessions. | Working | Tests cover bootstrap path. |
| `add_workspace` | `add_workspace` `lib.rs:824` | `App.tsx:4133` | Register workspace. | path/createStarter -> `WorkspaceSummary` | Writes global `workspaces.json`, may create `.agentboard` metadata. | Working | Requires existing folder; starter prompt in UI. |
| `open_sample_workspace` | `open_sample_workspace` `lib.rs:892` | `App.tsx:4164` | Copy/open sample. | none -> `WorkspaceSummary` | Copies bundled/dev sample into app data; registers workspace. | Working | Covered by runtime test. |
| `load_workspace` | `load_workspace` `lib.rs:949` | `App.tsx:3519` | Load workspace bundle. | workspaceId -> `WorkspaceBundle` | Ensures `.agentboard` dirs/files, reads skills/logs/Git. | Working | Main way Git/session state enters UI. |
| `detect_agents` | `detect_agents` `lib.rs:792` | `App.tsx:4529` | Check local CLIs. | none -> `AgentAvailability[]` | PATH/process detection. | Working | Does not validate auth. |
| `read_file` | `read_file` `lib.rs:986` | `App.tsx:3684` | Read concerned file. | workspacePath/relativePath -> `FileReadResult` | Read-only. | Working | Rejects absolute/parent traversal via safe join. |
| `scan_workspace` | `scan_workspace` `lib.rs:1146` | `App.tsx:4064` | Reality scanner. | workspacePath -> `RealityIssue[]` | Read-only recursive scan. | Working | Heuristic only. |
| `git_status` | `git_status` `lib.rs:1013` | wrapper only; load uses internal | Git repo/diff summary. | workspacePath -> `GitStatus` | Spawns `git`. | Working/unused direct | UI mostly receives Git status via `load_workspace`. |
| `create_worktree` | `create_worktree` `lib.rs:1104` | `App.tsx:4411`, `4563` | Create Git worktree. | workspacePath/nodeId -> path | Spawns `git worktree add`; writes sibling `.agentboard-worktrees`. | Partial | No cleanup; uncommitted changes not copied. |
| `run_agent` | `run_agent` `lib.rs:1154` | `App.tsx:3816` | Start provider subprocess. | `RunAgentRequest` -> `SessionInfo` | Spawns CLI; writes logs; emits events; may create worktree. | Working/risky | PowerShell proven; other CLIs depend on install/auth. |
| `stop_session` | `stop_session` `lib.rs:1403` | `App.tsx:4546` | Stop active process. | sessionId -> bool | Windows `taskkill /T /F`. | Working | Forceful, not graceful. |
| `run_multi_agent_smoke_test` | `run_multi_agent_smoke_test` `lib.rs:1449` | `App.tsx:3938` | Start two PowerShell smoke sessions. | workspacePath/name -> `SessionInfo[]` | Spawns two PowerShell processes. | Working | Used for multi-agent verification. |
| `list_sessions` | `list_sessions` `lib.rs:1488` | wrapper only | Return in-memory active sessions. | none -> `SessionInfo[]` | Read state only. | Unused direct | Bootstrap/load restore sessions instead. |
| `list_agent_profiles` | `list_agent_profiles` `lib.rs:1499` | `App.tsx:3491` | Load profiles. | none -> `AgentProfile[]` | Reads `%APPDATA%/AgentBoard/agents.json`. | Working | Covered. |
| `save_agent_profile` | `save_agent_profile` `lib.rs:1505` | `App.tsx:4196` | Create/update profile. | profile -> profile | Writes `agents.json`. | Working | Model/effort stored only. |
| `delete_agent_profile` | `delete_agent_profile` `lib.rs:1511` | wrapper only | Delete profile. | id -> bool | Writes `agents.json`. | Unused | No active UI delete path. |
| `list_deployments` | `list_deployments` `lib.rs:1517` | `App.tsx:3492` | Load deployment records. | none -> `AgentDeployment[]` | Reads global deployments. | Working | Covered. |
| `save_deployment` | `save_deployment` `lib.rs:1523` | `App.tsx:4287` | Create deployment record. | deployment -> deployment | Writes `deployments.json`. | Working | Stage-only uses this. |
| `update_deployment` | `update_deployment` `lib.rs:1529` | `App.tsx:3447`, `3462` | Persist status/session/log links. | deployment -> deployment | Writes `deployments.json`. | Working | Used by event/status reconciliation. |
| `delete_deployment` | `delete_deployment` `lib.rs:1535` | `App.tsx:4363` | Remove deployment record. | id -> bool | Writes `deployments.json`. | Working | UI asks confirmation. |
| `deployment_preflight` | `deployment_preflight` `lib.rs:1541` | `App.tsx:4230` | Validate target/run settings. | `DeploymentPreflightRequest` -> result | Temporary log write probe; reads skills/Git/source count. | Working | Core previous-failure fix. |
| `github_marketplace_search` | `github_marketplace_search` `lib.rs:1548` | `GithubMarketplace.tsx:143` | GitHub repo search/detection. | search request -> result | GitHub network; cache write. | Partial | Repo-level; exact path detection. |
| `github_marketplace_preview` | `github_marketplace_preview` `lib.rs:1557` | `GithubMarketplace.tsx:169` | Preview candidate files. | workspace/repo/force -> preview | GitHub network; cache write. | Partial | Formal-first, README fallback. |
| `github_marketplace_install` | `github_marketplace_install` `lib.rs:1566` | `GithubMarketplace.tsx:209` | Install GitHub import. | install request -> result | GitHub network; writes skill files/backups. | Partial | Force-refreshes preview; README drafts. |
| `github_marketplace_update` | `github_marketplace_update` `lib.rs:1575` | `GithubMarketplace.tsx:267` | Update GitHub import. | workspace/name/confirm -> plan/result | GitHub network; backup/write. | Partial | No semantic review/merge. |
| `github_marketplace_uninstall` | `github_marketplace_uninstall` `lib.rs:1584` | `GithubMarketplace.tsx:302`, `App.tsx:4857` | Remove GitHub import. | workspace/name -> result | Moves folder to `.trash`. | Working | GitHub only. |
| `github_marketplace_set_trust` | `github_marketplace_set_trust` `lib.rs:1591` | `GithubMarketplace.tsx:250` | Set GitHub trust state. | workspace/name/trust -> `SkillInfo` | Writes `source.json` and `skill.json`. | Working | Trust gates prompt injection. |
| `github_marketplace_rate_limit` | `github_marketplace_rate_limit` `lib.rs:1598` | `GithubMarketplace.tsx:90` | Fetch GitHub quota. | none -> limits | GitHub network. | Working | Tested UX formatting. |
| `save_github_token` | `save_github_token` `lib.rs:1603` | `GithubMarketplace.tsx:317` | Save PAT for session. | token -> status | Stores in memory; validates via GitHub. | Working/partial | No OAuth, no secure persistence. |
| `clear_github_token` | `clear_github_token` `lib.rs:1637` | `GithubMarketplace.tsx:331` | Clear PAT. | none -> status | Clears memory. | Working | Session only. |
| `clear_session_history` | `clear_session_history` `lib.rs:1652` | `App.tsx:4480` | Delete completed logs. | workspacePath -> result | Deletes `.log` files, retains running. | Working/risky | Permanent delete after confirm. |
| `open_logs_folder` | `open_logs_folder` `lib.rs:1708` | `App.tsx:4517` | Open logs dir. | workspacePath -> path | Creates logs dir; launches Explorer/open/xdg-open. | Working | GUI side effect. |
| `export_diagnostics` | `export_diagnostics` `lib.rs:1736` | `App.tsx:4599` | Export local report. | recent errors/workspace/notes -> path | Writes diagnostics JSON. | Working | Excludes source/prompt/log contents. |

Mismatches: none found by `npm run self_review`.

Dead/low-use commands:

- `delete_agent_profile`: backend/wrapper only; no active UI delete.
- `list_sessions`: backend/wrapper only; bootstrap/load paths are used instead.
- Direct `git_status`: wrapper exists, but active UI gets Git data in `loadWorkspace`.

## 5. Frontend State And UI Flow

Dashboard (`src/App.tsx`, especially `RocketOverview` and render around `src/App.tsx:5151`):

- Owns workspace/session/deployment/scanner summary state via parent.
- Calls no backend directly; actions call parent callbacks.
- Working: workspace overview, node selection, sessions, scans, smoke test entry.
- Risk: large file centralization makes regressions likely.

Sidebar/workspace selector (`src/App.tsx:5398`, `src/App.tsx:5657`):

- Active sidebar is embedded in `App.tsx`, not `src/components/Sidebar.tsx`.
- Shows workspaces, agent profiles, deployments, sessions, skills, files derived from pipeline concerned files.
- Works from loaded backend state.
- Risk: folder targets are derived from concerned-file paths, not a real workspace file explorer.

Deployed agent tree/context menus (`src/App.tsx:4627`, `src/App.tsx:4750`, `src/App.tsx:4807`, `src/App.tsx:5037`):

- Workspace/node/file/folder/profile/deployment/session/skill context menus are implemented.
- Some actions are disabled with hints: workspace remove, reveal, edit local skill, Create PR.
- GitHub uninstall from skill context uses backend and reloads workspace.

Deployment modal (`src/components/deployment/DeploymentModals.tsx:377`):

- Owns modal draft state: profile, run mode, task, selected skills, isolation, run-now/stage-only, confirmations.
- Calls parent `onPreflight` and `onDeploy`.
- Working: target-first flow, skill compatibility/trust gate, empty target warnings, non-Git warning, custom provider stage-only block.
- Risk: inspect-only can run with empty task after confirmation by design.

Create/edit agent modal (`src/components/deployment/DeploymentModals.tsx:73`):

- Owns profile form state.
- Calls `save_agent_profile`.
- Working: create/update/duplicate via profile context.
- Partial: profile delete command exists but UI does not expose it; model/effort not passed to providers.

Skills panel (`src/App.tsx:1807`):

- Shows installed skills and `GithubSkillsMarketplace`.
- Local enable toggles are frontend-only (`src/App.tsx:4175`).
- GitHub untrusted/disabled skills are blocked in Create/Deploy and prompt generation.
- Risk: inspector enable button can make an untrusted GitHub skill look enabled transiently, but prompt generation still excludes it.

GitHub Marketplace panel (`src/components/skills/GithubMarketplace.tsx:57`):

- Calls search, preview, install, trust, update, uninstall, rate-limit, token commands.
- Working: real backend integration.
- Risk: README fallback and install force-refresh cause the main product issue.

Inspector (`src/App.tsx:2061`):

- Shows node/files/scanner/Git/prompt, workspace, agent, profile, deployment, session, skill, file data.
- PR draft generation is local text only (`src/App.tsx:4423`); Create PR buttons are disabled/coming soon.

Log drawer (`src/App.tsx:6337`):

- Groups sessions by provider, displays durable log lines, can clear/open logs.
- Works with backend events and restored logs.

Settings/diagnostics:

- There is no full settings screen.
- Diagnostics export exists in top/support UI via `exportDiagnostics` (`src/App.tsx:4595`).

Inactive prototype UI:

- `src/app/**`, `src/components/Sidebar.tsx`, `src/components/Topbar.tsx`, and `src/components/AppLayout.tsx` are Next-style/static prototype pages. They contain fake workspaces, agents, skills, ratings, toasts, and comments such as "Backend: POST /api/agents/edit"; they are not the Tauri runtime path because `src/main.tsx` mounts `src/App.tsx`.

## 6. Agent Profiles

Schema:

- Backend `AgentProfile` is defined at `src-tauri/src/lib.rs:609`.
- Frontend mirror is `src/lib/types.ts:257`.
- Fields: `id`, `name`, `provider`, `model`, `effort`, `defaultSkills`, `permissions`, `isolationMode`, `description`, timestamps.

Storage:

- `%APPDATA%/AgentBoard/agents.json`.
- Commands: list/save/delete at `src-tauri/src/lib.rs:1499`.

Provider support:

- Validation accepts `codex`, `claude`, `gemini`, `aider`, `powershell`, `cmd`, `custom` (`src-tauri/src/lib.rs:2058`).
- Runtime supports `claude`, `codex`, `gemini`, `aider`, `powershell`, `cmd`; it does not support `custom` (`src-tauri/src/lib.rs:4480`).
- UI blocks custom Run now and stages only (`src/components/deployment/DeploymentModals.tsx:473`).

Model/effort:

- Stored and displayed.
- Not passed to `codex`, `claude`, `gemini`, `aider`, PowerShell, or CMD command construction.

Permissions:

- Stored on profile.
- Edit mode preflight requires `writeFiles`.
- Shell/network permissions are included in generated prompt, but not OS-enforced.

Isolation:

- Profile default is `worktree_per_deployment` or `same_workspace`.
- Worktree requires Git and a node id for backend runtime.
- Non-Git warning switches UI to same workspace.

Verified:

- Profile persistence is covered by `runtime_backend_flow`.
- UI create/edit/duplicate works by code path.

Missing/risky:

- No UI delete despite backend command.
- No provider model catalog validation.
- No account/auth preflight for Codex/Claude/Gemini/Aider beyond executable availability.

## 7. Agent Deployment System

Flow:

```text
Right-click target
  -> DeployAgentModal target/profile/task/skills/run mode/isolation
  -> deployment_preflight
  -> save_deployment
  -> stage only OR run_agent
  -> session/log events
  -> update_deployment
  -> restore from global deployments and workspace logs after restart
```

Target types:

| Target type | Implemented? | Frontend | Backend | Limitations | Tester risk |
| --- | --- | --- | --- | --- | --- |
| Workspace | Yes | Workspace context menu `src/App.tsx:4627`; modal | Preflight target exists/source/Git/logs | Empty workspace edit blocked; inspect allowed with confirmation. | Low/medium |
| Folder | Yes | Folder context derived from concerned-file directories `src/App.tsx:5037` | Preflight folder exists/source count | Not a full file explorer. | Medium |
| File | Yes | File context from concerned files `src/App.tsx:5037` | Preflight file exists/type | File prompts prohibit outside edits; source count applies differently. | Low/medium |
| Pipeline node | Yes | Node context `src/App.tsx:4750` | Preflight requires concerned files | Requires explicit pipeline metadata. | Low |

Staged deployments:

- `save_deployment` creates durable `staged` record.
- No backend process starts.
- Works by code and tests.

Run-now deployments:

- Save record first, generate prompt, call `run_agent`, then update record with session/log/status.
- Working by orchestration and runtime tests; live Codex success not verified in this audit.

Status lifecycle:

- Deployment statuses include `staged`, `running`, `completed`, `completed_inspection`, `failed`, `stopped`, `external_blocked`.
- Frontend listens for `agent-status` and reconciles matching deployment records.

Restart restoration:

- Profiles/deployments load from app data during bootstrap.
- Sessions/logs load through workspace bundle.
- Deployment records are reconciled to linked session status in `src/App.tsx:3426`.

## 8. Deployment Preflight

Backend implementation: `deployment_preflight_impl` at `src-tauri/src/lib.rs:2200`.

Checks:

- Target exists and type matches (`src-tauri/src/lib.rs:2227`).
- Target stays inside workspace except synthetic pipeline target handling.
- Empty workspace/folder source count (`src-tauri/src/lib.rs:2250`).
- `.agentboard`-only/no-source warning and edit blocker.
- Edit mode requires concrete task (`src-tauri/src/lib.rs:2276`).
- Edit mode requires profile write permission (`src-tauri/src/lib.rs:2282`).
- Provider executable availability (`src-tauri/src/lib.rs:2289`).
- Selected skills exist (`src-tauri/src/lib.rs:2301`).
- Log folder writable probe (`src-tauri/src/lib.rs:2325`, `src-tauri/src/lib.rs:2504`).
- Git repo/non-Git/missing Git classification (`src-tauri/src/lib.rs:2333`, `src-tauri/src/lib.rs:2541`).
- Pipeline-node concerned-file requirement (`src-tauri/src/lib.rs:2338`).
- Provider run mode and effective sandbox (`src-tauri/src/lib.rs:2347`, `src-tauri/src/lib.rs:2406`).

Previous failure:

> Codex launched into an empty folder, with vague prompt, in read-only sandbox.

Status: **partially fixed, with the edit-mode failure fixed**.

Evidence:

- Empty edit deployments are blocked.
- Edit mode requires a concrete task.
- Codex edit mode uses `workspace-write`; inspect-only uses `read-only`.
- Inspect-only prompt explicitly says inspect/report and do not edit in `src/lib/prompt.ts:232`.
- UI requires explicit confirmation to run inspect-only against empty source (`src/components/deployment/DeploymentModals.tsx:499`).

Remaining risks:

- Empty inspect-only can still run by design after confirmation and may do little.
- Non-Codex providers receive prompt-level inspect guidance; AgentBoard cannot enforce read-only sandbox for them.

## 9. Runtime Providers

Backend command construction is in `agent_invocation` at `src-tauri/src/lib.rs:4480`.

| Provider | Detected? | Command | Inspect/edit behavior | Sandbox/write mode | Auth risk | Logs/stop/multiple sessions | Usability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Codex | PATH check for `codex` | `codex exec --sandbox <mode> --skip-git-repo-check <prompt>` | inspect -> read-only; edit -> workspace-write | Enforced through CLI flags | CLI account/usage can block | Yes via subprocess | Usable if Codex CLI/auth/credits work; success not live-tested here |
| PowerShell | PATH check for `powershell` | `powershell -NoProfile -ExecutionPolicy Bypass -Command <prompt>` | Prompt/command only | No sandbox | Local shell risk | Deeply tested | Actually usable |
| CMD | PATH check for `cmd` | `cmd /C <prompt>` | Prompt/command only | No sandbox | Local shell risk | Should work by generic runtime | Usable but not focused-tested |
| Claude | PATH check for `claude` | `claude --print <prompt>` | Prompt only | No enforced sandbox | Subscription/auth can block | Logs/status supported | Partial; external block classifier exists |
| Gemini | PATH check for `gemini` | `gemini -p <prompt>` | Prompt only | No enforced sandbox | Auth/install can block | Generic logs/status | Stage/run if installed, not proven |
| Aider | PATH check for `aider` | `aider --message <prompt>` | Prompt only | No enforced sandbox | Auth/install can block | Generic logs/status | Stage/run if installed, not proven |
| Custom | Profile validation only | none | Stage-only in UI | none | undefined | no runtime | Not run-now usable |

Codex-specific:

- Inspect flags: `codex exec --sandbox read-only --skip-git-repo-check <prompt>`.
- Edit flags: `codex exec --sandbox workspace-write --skip-git-repo-check <prompt>`.
- Model/effort are not mapped to Codex flags.
- Non-Git workspaces are allowed with `--skip-git-repo-check`; UI warns about no worktree/diff.
- Usage-limit/auth errors become failed logs/status unless classifier specifically handles them; Claude has an explicit external-block classifier.

## 10. Logs And Sessions

Backend:

- Session DTO at `src-tauri/src/lib.rs:484`.
- `run_agent` creates `.agentboard/logs/<agent>-<session>.log` (`src-tauri/src/lib.rs:1227`).
- Writes start metadata, spawn event, stdout/stderr lines, and final metadata.
- `stop_session` updates active session status and kills process.
- `load_workspace` restores sessions/logs through `load_session_history`.

Frontend:

- Event listeners for `agent-output` and `agent-status` are set once with cleanup (`src/App.tsx:3577`).
- Log drawer groups and displays sessions (`src/App.tsx:6337`).
- Clear history calls backend and removes local UI state (`src/App.tsx:4468`).
- Open logs folder launches OS folder opener (`src/App.tsx:4512`).

Proven by tests:

- `runtime_backend_flow` verifies exact-once PowerShell lines, non-empty log before return, multi-agent overlap, targeted stop, separate logs, restoration.

Not proven:

- Interactive terminal behavior; ConPTY is not implemented.
- Reattach to child process after backend restart.
- Graceful cancellation.

## 11. Local Skills System

Storage:

- `<workspace>/.agentboard/skills/<skill-name>/SKILL.md`
- `<workspace>/.agentboard/skills/<skill-name>/skill.json`
- Optional GitHub `source.json`.

Loader:

- `load_skills` at `src-tauri/src/lib.rs:4078`.
- `load_skill_directory` at `src-tauri/src/lib.rs:3961`.
- Dot folders like `.trash` and `.backups` are skipped.

Trust/enable:

- Local skills are effectively enabled with trust state `local`.
- GitHub imports require `reviewed` or `trusted` for enabled/prompt use.
- Invalid skills appear as disabled/invalid entries where possible.

Prompt injection:

- Local and reviewed/trusted GitHub skills inject into prompts.
- Untrusted/disabled GitHub skills are excluded by `skillCanInject`.

Limitations:

- No dedicated local import UI.
- Generic enabled/disabled state is not persisted.
- No semantic safety review of skill content.

## 12. GitHub Marketplace Actual State

This section summarizes `docs/GITHUB_MARKETPLACE_ACTUAL_STATE.md`; that file is the detailed source of truth.

Search:

- Real backend GitHub repository search is implemented at `src-tauri/src/lib.rs:2726`.
- UI calls it from `src/components/skills/GithubMarketplace.tsx:143`.
- It uses GitHub repo search plus tree detection; it does not search individual skill packages.
- Token is used if manually saved in memory.
- Cache is used for fresh search results.

Preview:

- Backend preview is `src-tauri/src/lib.rs:2926`; fetch logic is `src-tauri/src/lib.rs:3223`.
- Probed paths are the exact nine `GITHUB_SKILL_PATHS` values at `src-tauri/src/lib.rs:2714`.
- Selection prefers `SKILL.md`, then `skill.json`, and only uses README when no formal markdown exists (`src-tauri/src/lib.rs:3739`).
- README-only is classified separately and shown with warning.
- Cached preview can be used for display under rate limit.

Install:

- Install creates a usable local folder shape: `SKILL.md`, `skill.json`, `source.json`.
- README-only content is converted into local `SKILL.md` only after explicit `allowReadmeDraft`.
- Manifest is normalized/generated with read/no-shell/no-network permissions.
- Imports default to untrusted and must be reviewed/trusted before prompt use.
- Frontend refreshes local skills after install.

Update:

- Implemented with preview compare and confirmed write.
- Backs up old files under `<skill-folder>/backups/<timestamp>`.
- Preserves trust state.
- Still depends on live preview refresh.

Uninstall:

- Implemented; moves GitHub skill folder to `.agentboard/skills/.trash/<name>-<timestamp>`.
- Selectors drop it because dot folders are skipped.

Trust:

- States: `untrusted`, `reviewed`, `trusted`, `disabled`, plus `local` and `invalid`.
- Stored in `source.json`, mirrored to manifest trusted bool.
- Affects UI selection and prompt injection.

Token/auth:

- Manual token exists and is session-only.
- GitHub login/device flow does not exist.
- No secure storage exists.
- Token is not returned to frontend after saving and not written to cache.

Rate limit:

- UX exists and raw epochs are sanitized.
- Cached preview is visible under rate limit.
- Install/update are blocked under core quota because backend force-refreshes preview.
- Requests can be wasteful because search may tree-probe each repo and frontend force-refreshes search after install.

Root cause of README-only problem:

- Repos often do not contain formal skill files at the exact checked paths.
- Detection does not check nested common skill layouts.
- README fallback is intentionally installable and converted to local `SKILL.md`.
- Install force-refresh and rate limits can push users toward cached README previews.
- Trust gating means installed drafts are not selectable until reviewed.

Question-by-question answers:

| Area | Answer |
| --- | --- |
| Real GitHub search? | Yes, through backend repository search, not frontend-only. |
| API/URL? | GitHub REST repository search, commit, tree, contents, and rate-limit endpoints under `https://api.github.com`. |
| Token used? | Yes when a manual token is saved; `github_request` attaches bearer auth. |
| Cache first? | Search and preview use a 15-minute `%APPDATA%/AgentBoard/github-marketplace-cache.json` cache. |
| Search target? | Repositories first; detected skill files second. It is not a code search for individual skills. |
| Preview probes `SKILL.md`? | Yes, but only exact configured paths. |
| Preview probes `skill.json`? | Yes, but only exact configured paths. |
| Preview probes `.agentboard/*`? | Yes for `.agentboard/SKILL.md` and `.agentboard/skill.json`. |
| Preview probes `skills/*`? | Only `skills/SKILL.md` and `skills/skill.json`, not `skills/<name>/SKILL.md`. |
| Preview probes README? | Yes, as fallback only when no formal markdown is selected. |
| Preview stops at README? | No; README is selected only after formal markdown search fails. The product issue is that many repos only match README. |
| README-only classified? | Yes, `readmeOnly` and warning are set. |
| Install creates usable folder shape? | Yes: `SKILL.md`, `skill.json`, `source.json`. |
| README converted to `SKILL.md`? | Yes, if the user explicitly allows README draft install. |
| `skill.json` generated? | Yes through `normalize_github_manifest`. |
| `source.json` generated? | Yes through `write_github_skill_install`. |
| Marked untrusted? | Yes, default `trustState` is `untrusted`. |
| Refresh after install? | Yes, frontend calls `onRefresh()`, then force-refreshes search. |
| Appears in Create/Deploy? | Yes only after workspace refresh; selectable only if reviewed/trusted. |
| Prompt preview includes installed content? | Only reviewed/trusted GitHub skills inject. This is tested. |
| Silent unusable install? | Not structurally silent, but README drafts and untrusted state can feel unusable. |
| Update implemented? | Yes; fetches latest, compares files/metadata, backs up, preserves trust. |
| Uninstall implemented? | Yes; moves to `.trash`. |
| Trust states stored? | In GitHub `source.json` and mirrored to manifest `trusted`. |
| Disabled actually disabled? | Disabled GitHub skills are not enabled or injected. |
| Manual token? | Yes. |
| GitHub sign-in/device flow? | No. |
| Token saved? | Memory only. |
| Token sanitized? | No direct token logging or diagnostics field found. |
| Rate-limit UX? | Yes, but install/update remain blocked because they force-refresh preview. |
| Backend cache fallback? | Preview display can fall back to cache; install cannot currently rely on cached preview. |
| Requests wasteful? | Yes, tree probes per search result and search refresh after install can burn quota. |

Recommended fix:

- Make marketplace results candidate-level, support nested formal skill layouts, separate README drafts from formal skills, make install cache-aware, and improve post-install review UX.

## 13. GitHub Login / Sign-in Feasibility

Today:

- GitHub login does not exist.
- Device Flow does not exist.
- Manual token entry exists in Marketplace.
- Token is saved only in Rust memory (`AppState.github_token` at `src-tauri/src/lib.rs:20`).
- No secure storage dependency is present.
- Diagnostics do not include token by design.

Best design:

- Keep authenticated GitHub client in Rust near `github_request`.
- Add Device Flow commands: start, poll, status, logout.
- Use Windows Credential Manager/keyring only if persistent login is required.
- Frontend shows verification URI/user code, polling status, account/rate-limit state, and logout.

Security risks:

- Token leakage through logs/diagnostics/errors.
- Overbroad scopes.
- Private repo metadata in cache.
- Long-lived credential lifecycle.

Recommendation:

- Fix Marketplace correctness first.
- Add GitHub login second.
- Do not combine unless the sprint is explicitly expanded and tested as two separable deliverables.

## 14. Pipeline System

Schema:

- Backend `PipelinesDocument`, `Pipeline`, `PipelineNode`, file/check structs start at `src-tauri/src/lib.rs:68`.
- Frontend types mirror them in `src/lib/types.ts`.

Loading:

- `load_pipelines` reads `<workspace>/.agentboard/pipelines.json` (`src-tauri/src/lib.rs:2695`).
- `initialize_workspace` creates an empty pipelines file if needed (`src-tauri/src/lib.rs:2688`).

Display:

- Active Tauri UI displays pipeline graph/list, nodes, concerned files, issues, and checks from loaded metadata.

Pipeline-node deployment:

- Implemented. Node context menu pre-fills target metadata and concerned files.
- Prompt includes pipeline/node metadata and concerned-file scope.
- Preflight blocks pipeline-node deployment with no concerned files.

Scanner connection:

- Reality scanner findings are heuristic and can be attached to prompt context.

Not implemented:

- Automatic pipeline discovery.
- Scanner-driven automatic pipeline updates.
- Manual vs automatic discovery distinction beyond docs.

## 15. Git / Worktree / Review

Git status:

- Backend `git_status` runs `git rev-parse`, `git status`, and diff stats.
- Non-Git is warning, not fatal, for deployment preflight.

Worktrees:

- Backend creates worktrees under a sibling `.agentboard-worktrees`.
- Branches are named `agentboard/<node>-<session>`.
- No cleanup command exists.
- Worktrees start from committed `HEAD`; uncommitted changes are not copied.

Review:

- Inspector can generate a local PR draft from node/scanner/Git context.
- Real PR creation/push is disabled/coming soon.
- No patch hunk review UI.

## 16. Diagnostics / Privacy / Data Safety

Diagnostics:

- Command `export_diagnostics` at `src-tauri/src/lib.rs:1736`.
- UI caller `src/App.tsx:4595`.
- Writes local JSON under `%APPDATA%/AgentBoard/diagnostics`.

Included:

- App version, timestamp, app data/log paths, OS info, detected agents, workspace registry summaries, recent UI errors, optional issue notes.

Excluded:

- Source contents.
- Prompts.
- Log contents.
- GitHub token.

Risks:

- Recent UI errors and user issue notes can include sensitive text if the user typed it.
- Local paths and machine/OS metadata are included.
- GitHub cache may include public preview text and repo metadata.

Data safety:

- Uninstall of the app is documented to preserve app data/workspaces.
- GitHub skill update backs up files.
- GitHub uninstall moves to `.trash`.
- Clear session history permanently deletes completed logs after confirmation.

## 17. Packaging / Release

Config:

- `package.json` version `0.1.0-alpha`.
- `src-tauri/Cargo.toml` version `0.1.0-alpha`.
- `src-tauri/tauri.conf.json` version `0.1.0-1` for Windows bundle compatibility.
- Bundle resources include sample workspace pipelines, skills, and source.

Docs:

- `docs/PACKAGED_BUILD_QA.md` records NSIS/MSI artifacts and hashes from June 10.
- NSIS was approved for 1-3 trusted testers then; MSI final artifact was not approved.

Current audit:

- No packaging build was run.
- The audit created documentation only after running normal dev checks.
- If Marketplace code changes next, package verification must be rerun.

Safe for 1-3 trusted testers:

- Yes for limited alpha claims in section 1.
- No for broad marketplace or untrusted-user distribution.

## 18. Tests And Evidence

Commands run during this audit:

| Command | Result | What it proves | What it does not prove |
| --- | --- | --- | --- |
| `git status --short` | Clean at start | No pre-existing tracked changes observed. | Does not prove generated ignored files absent. |
| `rg --files ...` | Passed | File inventory. | Does not inspect binary/generated content. |
| `npm run type-check` | Passed | TypeScript compile. | Runtime behavior. |
| `npm run build` | Passed | Production Vite build. | Packaged Tauri app. |
| `npm run self_review` | Passed | Config/docs presence, command contract, build, rate-limit test. | Live marketplace or runtime auth. |
| `npm run test:prompt-preview` | Passed | Reviewed GitHub skill injects; untrusted excluded. | Full UI selection flow. |
| `npm run test:github-marketplace-rate-limit` | Passed | Rate-limit messages/cached preview UI rules. | Live quota behavior. |
| `cargo metadata --manifest-path src-tauri/Cargo.toml --format-version 1 --no-deps` | Passed | Cargo package/deps metadata loads. | Rust tests/build. |
| `cargo test --manifest-path src-tauri/Cargo.toml runtime_backend_flow -- --nocapture` | Passed | Backend fixture flow: workspace, scanner, preflight, Codex arg construction, PowerShell runtime, multi-agent, sessions, GitHub skill lifecycle, diagnostics. | Live Codex success, live GitHub search quality, packaged app. |

Existing meaningful tests/scripts:

- `scripts/self_review.mjs`: command contract, config versions, docs existence, prompt provenance/trust checks, type/build/rate test.
- `scripts/prompt_preview_test.mjs`: focused prompt injection trust gate.
- `scripts/github_marketplace_rate_limit_test.mjs`: GitHub rate-limit UX helpers and component text guards.
- `runtime_backend_flow`: strongest backend integration fixture.
- `github_marketplace_live_search_and_preview`: ignored live test; not run by default.
- `scripts/release_lifecycle_qa.ps1`: installer lifecycle snapshot helper.

## 19. Feature Truth Table

| Feature | User-visible | Implemented in code | Dev verified | Packaged verified | Risk | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Workspace onboarding | Yes | Yes | Yes | Previously | Low | `add_workspace`, sample test | Requires existing folder or starter metadata. |
| Workspace registry | Yes | Yes | Yes | Previously | Low | `%APPDATA%/workspaces.json` | Works. |
| Pipeline loading | Yes | Yes | Yes | Previously | Low | `load_pipelines` | Explicit metadata only. |
| Automatic pipeline discovery | No | No | No | No | Medium | No scanner-to-pipeline code | Documented future. |
| Agent profiles | Yes | Yes | Yes | Previously | Medium | `agents.json`, tests | Model/effort not used at runtime. |
| Target-first deployment | Yes | Yes | Yes | Partially | Medium | Deploy modal/App orchestration | Strong. |
| Deployment preflight | Yes | Yes | Yes | Not rerun now | Low/medium | `deployment_preflight_impl` | Previous failure mostly fixed. |
| Codex inspect/edit | Yes | Yes | Args tested | Previously partial | Medium | `agent_invocation` | Live success depends on CLI/auth. |
| PowerShell runtime | Yes | Yes | Yes | Previously | Low | `runtime_backend_flow` | Best-proven provider. |
| Claude runtime | Yes | Yes | Partial | Previously partial | High | command construction | Auth/subscription can block. |
| Gemini runtime | Yes if installed | Yes | No focused | No | High | command construction | Install/auth unknown. |
| Aider runtime | Yes if installed | Yes | No focused | No | High | command construction | Install/auth unknown. |
| Custom profile run-now | No | No | N/A | N/A | Medium | UI blocks | Stage-only. |
| Multi-agent overlap | Yes | Yes | Yes | Previously | Low | runtime test | PowerShell proven. |
| Logs/session restore | Yes | Yes | Yes | Previously | Low/medium | runtime test | No process reattach. |
| Local skills | Yes | Yes | Yes | Previously | Medium | loader/sample | No import UI. |
| GitHub marketplace search | Yes | Yes | Fixture/focused | Not current | High | backend search | Repo-level/exact-path. |
| GitHub marketplace preview | Yes | Yes | Fixture/focused | Not current | High | preview code | README fallback. |
| GitHub marketplace install | Yes | Yes | Fixture | Not current | High | lifecycle test | README draft risk. |
| GitHub marketplace update | Yes | Yes | Fixture | Not current | Medium/high | lifecycle test | Live refresh/rate risk. |
| GitHub marketplace uninstall | Yes | Yes | Fixture | Not current | Medium | lifecycle test | Moves to trash. |
| GitHub trust/review state | Yes | Yes | Yes | Not current | Medium | prompt test | Inspector UI confusion. |
| GitHub manual token | Yes | Yes | Code/read | Not current | Medium | in-memory token | No persistence. |
| GitHub login/device flow | No | No | No | No | High | no commands | Should follow correctness. |
| GitHub rate-limit UX | Yes | Yes | Yes | Not current | Medium | rate test | Install cache gap. |
| GitHub cache | Yes | Yes | Code/read | Not current | Medium | cache functions | Preview display only under install gap. |
| GitHub prompt injection | Yes | Yes | Yes | Not current | Medium | prompt test | Trust-gated. |
| Raw URL install | No | No | No | No | Medium | no command/UI | Not implemented. |
| Local skill import | Manual folder only | Partial | Code/read | No | Medium | load_skills | No UI. |
| Git status | Yes | Yes | Yes | Previously | Low | load/git commands | Direct wrapper unused. |
| Worktrees | Yes | Yes | Yes | Previously | Medium | runtime test | No cleanup; committed HEAD only. |
| Review panel | Yes | Partial | Code/read | Previously | Medium | inspector | Draft text only. |
| PR preview | Yes | Partial | Code/read | Previously | Medium | `generatePrDraft` | Local text only. |
| Real PR publishing | Disabled | No | No | No | Medium | UI disabled | Not implemented. |
| Diagnostics export | Yes | Yes | Yes | Previously | Low/medium | command/test | User notes can contain secrets. |
| NSIS packaging | Yes | Config/docs | Previously | Yes on June 10 | Medium | packaged QA | Not rerun after docs audit. |
| MSI packaging | Config only for current round | Build/docs | Previously build | Not final approved | Medium/high | packaged QA | Use NSIS for testers. |
| ConPTY | No | No | No | No | Medium | docs only | Subprocess logs only. |

## 20. Critical Gaps

| Severity | Gap | Why it matters | Code location | Evidence | Difficulty | Suggested fix | Required before tester release? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Blocker | Marketplace formal skill discovery/install correctness | Current Marketplace can look like README downloader. | `src-tauri/src/lib.rs:2714`, `2926`, `2961`, `3739` | Exact paths, README installable, force refresh. | Medium | Candidate-level nested detection; separate README drafts; cache-aware install. | Required before Marketplace-focused testers. |
| High | GitHub login/device flow absent | Rate limits hurt Marketplace testing. | No commands; token only `lib.rs:1603` | Manual PAT only. | Medium/high | Add Device Flow after correctness. | Not before correctness. |
| High | Provider model/effort ignored | Profiles overpromise control. | `agent_invocation` | No model/effort args. | Medium | Provider-specific invocation templates. | Not blocker if documented. |
| High | Non-Codex sandbox is prompt-only | Inspect mode may still edit with other CLIs. | `provider_run_mode` | Warning only. | Hard | Provider-specific read-only modes or OS sandbox. | Required before broad trust, not alpha. |
| Medium | Custom provider cannot run | UI offers custom profile but stage-only. | `DeployAgentModal`, `agent_invocation` | No custom branch. | Medium | Define executable/template contract. | No. |
| Medium | Worktree cleanup missing | Testers can accumulate branches/folders. | `create_worktree` | No delete command. | Medium | Add cleanup/list worktree UI. | No, document. |
| Medium | Profile delete unused | Stale profiles accumulate. | `delete_agent_profile` | No UI action. | Low | Add confirmed delete. | No. |
| Medium | Static prototype pages remain | Can mislead audits/build maintainers. | `src/app/**`, `src/components/Sidebar.tsx` | Fake data/toasts. | Low | Remove or clearly quarantine. | No. |
| Medium | Docs stale/inconsistent | Founder/testers may rely on wrong claims. | `README.md`, old docs | GitHub coming soon vs implemented. | Low | Update docs after next sprint. | Yes before handoff. |
| Low | Diagnostics include user notes/recent errors | Users can paste secrets. | `export_diagnostics` | Issue notes included by design. | Low | Add warning/redaction hints. | No. |

## 21. Best Next Step

Ranked sprint options:

1. **A. Fix GitHub Marketplace so installed results become real usable skills.**
2. **B. Add GitHub login/device flow.**
3. **C. Do Marketplace correctness + login together.**
4. **D. Package current build and get testers.**
5. **E. Automatic pipeline discovery.**
6. **F. ConPTY terminal.**
7. **G. Global marketplace reviews/ratings.**

Recommended next sprint: **A. Fix GitHub Marketplace correctness.**

Why first:

- Credits are not the constraint, so do the evidence-based product fix.
- Deployment UX is now mostly working.
- The product needs one strong tester-visible loop.
- The confirmed weak link is Marketplace returning/installing README-derived drafts as if they were skills.
- GitHub login helps quota but not correctness.

Success criteria:

- Formal nested skills are detected and install as formal skills.
- README-only installs are labeled as drafts and opt-in.
- Preview/install share candidate/path/commit/checksum.
- Cached fresh preview can support install under rate limit where safe.
- Post-install review/trust flow is obvious.
- All current checks pass.

Avoid:

- OAuth/device flow in the same sprint.
- Any remote code execution/clone.
- Repeated live GitHub calls.
- Claims that README drafts are real skills.

Expected risk: medium.

Expected confidence after sprint: 0.88 for fixture/dev correctness, 0.80 for public GitHub behavior until one controlled live smoke.

## 22. Suggested Next Codex Prompt

See `docs/NEXT_STEP_DECISION.md` for the exact next Codex prompt. It is specific to the confirmed Marketplace candidate/discovery/cache/trust gap and intentionally excludes GitHub login from the immediate sprint.
