# Agent Deployment UX

Date: June 10, 2026

## Implemented

AgentBoard now treats deployment targets as the primary entry point. A user can deploy an agent
profile to a workspace, a folder represented by a concerned-file path, a concerned file, or a
pipeline node. Deployments appear beneath their target in the workspace rail with status colors,
and their generated prompt, target, skills, runtime session, and log are available in the
inspector.

The dashboard shows active deployments, errors needing attention, tasks created today, pipelines,
active workspaces, running sessions, and recent deployment activity. Raw logs remain in the
collapsed terminal drawer and deployment/session details.

## Direct Deployment

Workspace, folder, and file context menus open the four-step Deploy Agent flow:

1. Confirm the prefilled target.
2. Select an existing profile or create one.
3. Choose inspect-only or edit mode, enter the task, choose compatible installed skills,
   select isolation, and choose Run now or Stage only.
4. Run preflight and review the target, agent, sandbox, source-file count, Git state, skills,
   isolation, and action before deployment.

Stage only creates a durable `staged` record and does not call the runtime. Run now saves the
record first, generates a target-scoped prompt, then calls the existing `run_agent` command.
Runtime status and the session log path are copied back to the deployment record.

Edit mode requires a concrete task and profile write permission. Inspect-only allows an empty task
because AgentBoard supplies an explicit inspect-and-report instruction. Empty workspaces cannot
launch in edit mode.

## Pipeline Deployment

The pipeline-node context menu opens the same flow with pipeline and node metadata prefilled. The
generated prompt includes the workspace, pipeline and node names, node status, concerned files,
known issues, checks, matching scanner findings, and compatible selected skills. It explicitly
limits work to concerned files unless the user expands scope.

## Agent Profile Schema

Profiles contain `id`, `name`, `provider`, flexible `model` string, `effort`, `defaultSkills`,
file/shell/network permissions, `isolationMode`, `description`, `createdAt`, and `updatedAt`.
Provider values are `codex`, `claude`, `gemini`, `aider`, `powershell`, `cmd`, or `custom`.

A profile is configuration only. Saving a model or provider does not assert that a model exists,
that a CLI is installed, or that authentication is valid. Runtime launch still uses detected local
commands.

## Deployment Schema

Deployments contain `id`, profile and agent identity, target type/path/label, optional pipeline and
node metadata, selected skills, generated prompt, `runMode`, isolation, status, optional session
and log links, and creation/update timestamps.

Status values include `staged`, `running`, `completed`, `completed_inspection`, `failed`,
`stopped`, and `external_blocked`.

## Preflight And Run Modes

Preflight checks target existence/type, source-file presence, `.agentboard`-only targets, concrete
edit tasks, provider availability, selected local skills, log-folder writability, Git
classification, profile write permission, and pipeline-node concerned files.

An empty workspace or folder shows: **This target has no source files. Deploying an agent may do
nothing.** The user can cancel, explicitly run inspect-only anyway, or see the disabled
Create starter files action.

Non-Git targets are warnings, not fatal failures. The confirmation explains that worktree
isolation and Git diff review are unavailable and switches isolation to the same workspace.

Codex run modes are enforced using flags supported by the installed `codex-cli 0.139.0`:

- inspect-only: `codex exec --sandbox read-only`
- edit: `codex exec --sandbox workspace-write`

Other providers retain their existing execution contracts. AgentBoard shows that read-only
inspection is provider-controlled when it cannot enforce a sandbox.

## Storage

Profiles and deployments use global application data:

```text
%APPDATA%\AgentBoard\agents.json
%APPDATA%\AgentBoard\deployments.json
```

Workspace session logs remain under `<workspace>\.agentboard\logs`. On restart, global records are
loaded during bootstrap and deployment status/log links are reconciled with restored session
metadata.

Workspace skills, including GitHub imports, remain under:

```text
<workspace>\.agentboard\skills
```

GitHub imports show source and trust state in Create Agent and Deploy Agent. Untrusted or disabled
imports are blocked from selection and prompt injection. Reviewed or trusted imports use the same
content injection path as local skills and add:

```text
Skill source: GitHub import from <repoFullName>
```

## Isolation

Worktree isolation is optional. `worktree_per_deployment` requests a unique worktree through the
existing session runtime. If creation fails, AgentBoard shows the error and requires confirmation
before falling back to the original workspace. Starting another shared-folder session also
requires an explicit concurrency-risk confirmation.

## Verification

- `npm run type-check`: passed
- `npm run build`: passed
- `cargo metadata --manifest-path src-tauri\Cargo.toml --format-version 1 --no-deps`: passed
- `cargo test --manifest-path src-tauri\Cargo.toml runtime_backend_flow -- --nocapture`: passed
- Profile and deployment save/list/update/delete persistence is covered by
  `runtime_backend_flow`.
- The same test also reverified simultaneous PowerShell sessions, independent stop, separate logs,
  and session restoration.
- Runtime QA verifies empty-target blocking, explicit inspect-only allowance, concrete task
  requirements, non-empty source detection, missing pipeline scope, Git warning classification,
  provider/skill checks, and log-folder writability.
- Runtime QA verifies exact Codex sandbox arguments for inspect-only and edit.
- A PowerShell `LineA`/`LineB` run verifies each output and spawn event appears once in emitted
  events and once in the durable log. The log is non-empty before `run_agent` returns.
- Live `tauri dev` verification created/restored a Codex profile, selected the installed Software
  Engineering Debugger skill, saved a workspace deployment, linked its session/log, displayed the
  failed status under the workspace, and restored both profile and deployment after app restart.
- The live Codex session reached the local CLI but failed because the account usage limit was
  reached. AgentBoard retained the log and displayed the backend error rather than reporting a
  false success.
- A direct prompt smoke check verified that pipeline-node prompts include concerned files and
  scanner context, while file prompts explicitly prohibit edits outside the selected file.

## Coming Soon And Limits

- GitHub Marketplace v1 is implemented; OAuth and persistent token storage are not.
- Automatic pipeline discovery is not implemented.
- ConPTY terminal support is not implemented.
- Custom profiles can be staged but cannot Run now until a custom executable contract exists.
- Folder targets shown in this sprint are derived from declared concerned-file paths; AgentBoard
  does not crawl the workspace into a new file explorer.
- Codex sandbox mode is enforced. For other CLIs, profile permissions and inspect-only behavior
  remain provider-controlled or prompt-level and are not an operating-system sandbox.
- Provider model strings are intentionally flexible and are not validated against remote model
  catalogs.

## Confidence

Confidence score: **0.94 / 1.00** for preflight behavior, Codex run-mode enforcement, durable
exact-once logging, profile/deployment persistence, and target-aware prompt generation. Packaged
build verification remains separate.
