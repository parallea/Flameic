# Agent Deployment UX

Date: June 18, 2026

## Implemented

AgentBoard now treats deployment targets as the primary entry point. A user can deploy an agent
profile to a workspace, a folder represented by a concerned-file path, a concerned file, or a
pipeline node. Deployments appear beneath their target in the workspace rail with status colors,
and their generated prompt, target, skills, runtime session, and log are available in the
inspector.

The dashboard shows active deployments, errors needing attention, tasks created today, pipelines,
active workspaces, running sessions, and recent deployment activity. Raw logs remain in the
collapsed terminal drawer and deployment/session details.

## Agent Result Review

Every edit-mode session captures a target-scoped before manifest before provider launch and writes
a persisted result review after the process exits. The deployment and session inspectors show a
summary, created/modified/deleted files, bounded text diffs, sensitive/binary/large states, Open,
Reveal, Accept changes, Revert changes, Open raw log, and Open review folder.

Review does not require Git. Accept only marks the persisted review accepted. Revert uses bounded
before snapshots and expected post-run hashes; it does not commit, overwrite conflicts, touch
`.agentboard`, or operate outside the recorded target. Inspect-only sessions show that no edit
review is generated. See `AGENT_RESULT_REVIEW_QA.md`.

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
because AgentBoard supplies an explicit inspect-and-report instruction. Empty workspaces may launch
in edit mode when the profile allows writes and the task is concrete; the agent may create files
inside the declared target scope.

If an inspect-only task contains build/edit verbs such as `build`, `create`, `fix`, or `implement`,
preflight shows: **Build tasks require edit mode. Inspect-only will only report findings.** The mode
is not changed automatically. The generated inspect-only prompt treats the requested change as
context to assess and explicitly prohibits implementation.

The modal also presents a prominent choice: **Switch to Edit mode** or **Continue inspect-only**.
The final confirmation shows the run mode, effective sandbox, and whether file creation/editing is
allowed, plus the exact generated prompt used for runtime launch. Submission uses the immutable
draft that passed preflight rather than reconstructing a draft from mutable modal state.

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

An empty workspace or folder receives a mode-specific warning. Inspect-only requires explicit
confirmation because there may be little to report. Edit mode remains selected and may create
files within scope; it is not converted to inspect-only.

Preflight returns the exact `requestedRunMode` it checked. The frontend rejects a response with a
different mode and reruns preflight immediately before save/run. Missing write permission is a
blocker with the message: **Edit mode cannot run because the selected agent profile does not allow
Write files.**

Non-Git targets are warnings, not fatal failures. The confirmation explains that worktree
isolation and Git diff review are unavailable and switches isolation to the same workspace.

Codex run modes are enforced using flags supported by the installed `codex-cli 0.139.0`:

- inspect-only: `codex exec --sandbox read-only`
- edit: `codex exec --sandbox workspace-write`

Other providers retain their existing execution contracts. AgentBoard shows that read-only
inspection is provider-controlled when it cannot enforce a sandbox.

## Environment Blockers

AgentBoard inspects the completed session log before assigning a terminal status. Clear external
toolchain failures are classified as `blocked_environment` instead of `completed`,
`completed_inspection`, or generic `failed`. Structured blocker metadata records the provider,
missing tool/template, user-readable cause, suggested action, and fallback choices.

Covered signals include missing WinGet, missing `dotnet new winui` templates, .NET first-run/user
directory access failures, missing SDK/workload/template errors, missing Visual Studio workloads,
and environment setup blocked by elevation, permissions, or sandbox restrictions.

The deployment and session inspectors show:

- retry after installing WinUI tooling;
- build a simpler HTML/CSS/JS desktop prototype;
- build WPF if its templates are available;
- run an environment audit only.

AgentBoard does not silently change the target framework.

Windows-app task preflight recognizes phrases such as `Windows app`, `WinUI`, `desktop app`, and
`calculator for Windows`. It checks `dotnet --info` and `dotnet new list winui`; when a WinUI skill
is selected it also checks `winget --version`. Missing tooling normally produces a warning. An
Edit run is blocked when an explicitly selected WinUI skill requires an unavailable WinUI
template.

## Prompt Transport

Every runtime session writes a UTF-8 prompt record before process launch:

```text
<execution-workspace>\.agentboard\prompts\<session-id>.md
```

The record contains the full generated prompt plus session ID, timestamp, target metadata,
selected-skill provenance, run mode, provider, model, character/UTF-8 byte counts, and the
AgentBoard source note. The prompt directory has a local `.gitignore` so generated prompt records
do not enter Git status.

Codex always receives a short bootstrap argument that points to this file. The full prompt is
never placed in Codex argv. This avoids the Windows `cmd.exe`/`.cmd` command-line limit while
preserving the existing `read-only` and `workspace-write` sandbox flags.

For other conversational providers, file transport is selected when the prompt exceeds 6,000
characters, exceeds 12,000 UTF-8 bytes, or contains a selected GitHub skill. Oversized PowerShell
and Command Prompt tasks use generated `.ps1`/`.cmd` script files so shell command semantics are
preserved.

Session logs record the prompt file path, prompt size, bootstrap size, selected-skill count, and
selected-skill character count. They do not serialize the full prompt or argv payload. Restored
sessions reload prompt text from the prompt file.

## Storage

Profiles and deployments use global application data:

```text
%APPDATA%\AgentBoard\agents.json
%APPDATA%\AgentBoard\deployments.json
```

Workspace session logs remain under `<workspace>\.agentboard\logs`. On restart, global records are
loaded during bootstrap and deployment status/log links are reconciled with restored session
metadata.

Workspace prompt records remain under `<workspace>\.agentboard\prompts` (or the execution
worktree's equivalent). Diagnostics continue to exclude prompt and log contents.

Agent result reviews remain under:

```text
<workspace>\.agentboard\reviews\<session-id>\review.json
```

The review folder also retains the capture manifest and safe bounded before snapshots required for
revert. Review status survives restart independently of the raw log drawer.

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
- `npm run test:agent-review`: passed (8 focused review tests)
- Profile and deployment save/list/update/delete persistence is covered by
  `runtime_backend_flow`.
- The same test also reverified simultaneous PowerShell sessions, independent stop, separate logs,
  and session restoration.
- Runtime QA verifies empty-target mode handling, explicit inspect-only allowance, concrete task
  requirements, empty-target edit creation, non-empty source detection, missing pipeline scope,
  Git warning classification, provider/skill checks, and log-folder writability.
- Runtime QA verifies exact Codex sandbox arguments for inspect-only and edit.
- Focused prompt-transport tests verify oversized Codex prompts stay out of argv, prompt files are
  written, bootstraps reference those files, GitHub skill metrics deduplicate, inspect/build
  mismatch warnings appear, GitHub token patterns are redacted, and diagnostics omit prompt
  contents.
- A live Codex manual test on June 18, 2026 launched one large reviewed GitHub-skill prompt through
  `run_agent_core`, completed in `read-only` mode, read the prompt file, returned
  `AGENTBOARD_PROMPT_FILE_OK`, and did not produce `The command line is too long`.
- A controlled PowerShell run-mode smoke created `calculator-smoke.txt` in Edit mode and completed
  as `completed`. A separate inspect-only run for a build-worded task created no file and completed
  as `completed_inspection`.
- Environment classification QA verifies missing WinGet, missing WinUI templates, .NET first-run
  access errors, missing workloads, setup permissions, and generic process failures. A controlled
  process that printed the missing-WinUI-template sentinel completed as `blocked_environment`.
- Agent review QA verifies created/modified/deleted detection, bounded unified diffs, exclusions,
  sensitive diff hiding, accept/revert persistence, conflict-safe revert, restart loading, and
  inspect-only bypass.
- Live Tauri QA in a disposable workspace verified create/diff/accept, accepted status after a
  desktop-process restart, revert confirmation contents, created-file removal, and `reverted`
  status. A real PowerShell safe-workspace test separately verified modified-file restoration and
  sensitive `.env` diff hiding.

For an edit-mode tester smoke that does not depend on a Windows UI toolchain, use:

```text
Create calculator-smoke.txt containing Calculator App.
```

An alternative browser-based smoke is:

```text
Create a simple calculator web app with index.html, style.css, and app.js.
```
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
- Large, binary, sensitive, or unhashable files may be reviewable only as metadata and may not be
  safely revertible. AgentBoard reports that state instead of retaining unbounded or secret-bearing
  snapshots.

## Confidence

Confidence score: **0.94 / 1.00** for preflight behavior, Codex run-mode enforcement, durable
exact-once logging, profile/deployment persistence, and target-aware prompt generation. Packaged
build verification remains separate.
