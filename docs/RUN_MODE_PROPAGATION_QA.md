# Run Mode Propagation QA

Date: June 18, 2026

## Root Cause

The frontend and backend enums were already consistent: `edit` and `inspect_only`. Persistence,
prompt generation, Codex sandbox selection, and success classification all consumed the provided
mode correctly.

The mode was changed before those stages:

1. Empty workspace/folder preflight blocked Edit mode.
2. The confirmation screen's `launchBlocked` condition also prohibited Edit on an empty target.
3. The only continuation action changed modal state to `inspect_only`.
4. Selecting a profile without Write files also changed modal state to `inspect_only` in an effect.

Consequently the deployment record, prompt, `run_agent` request, sandbox, and
`completed_inspection` status were internally consistent—but consistently represented the
unintended inspect-only mode.

## Fix

- Empty targets no longer force inspect-only. Edit may create files inside scope when a concrete
  task and Write files permission are present.
- Profile selection never silently changes the selected mode.
- Missing Write files permission blocks Edit with a clear reason.
- Inspect-only build/create/fix/implement/generate/write tasks show a prominent warning and require
  **Switch to Edit mode** or **Continue inspect-only**.
- Preflight returns `requestedRunMode`.
- The final button submits the immutable draft that passed preflight.
- The final confirmation renders the exact prompt builder used by runtime launch.
- AgentBoard reruns preflight immediately before persistence/runtime launch.
- Saved deployment mode and returned session mode must match.
- Rust rejects generated prompts whose declared mode conflicts with the `run_agent` request.
- Deployment persistence rejects `edit + completed_inspection` and
  `inspect_only + completed`.
- Status events include the authoritative session run mode.

## Prompt And Sandbox Contract

Edit prompt:

```text
Run mode: edit.
You may create and edit files inside the declared target scope...
```

Inspect-only prompt:

```text
Run mode: inspect only.
Do not create, edit, rename, or delete files.
```

Codex remains:

```text
edit         -> --sandbox workspace-write -> completed
inspect_only -> --sandbox read-only       -> completed_inspection
```

Prompt-file transport remains unchanged and continues to keep large prompts out of argv.

## Tests

Frontend/script coverage:

- Edit draft payload preserves `runMode: "edit"`.
- Draft fingerprints distinguish edit from inspect-only preflight.
- Build-worded task detection.
- Edit and inspect-only prompt wording.
- Presence of prominent modal guardrails and final file-write confirmation.

Rust `run_mode_propagation_flow` coverage:

- Edit deployment persistence and reload.
- Empty-target Edit preflight remains Edit and is not blocked when writes are allowed.
- Missing write permission blocks without converting mode.
- Inspect-only build task remains inspect-only and warns.
- Prompt/request mode mismatch prevents process launch.
- Controlled PowerShell inspect run creates no file and completes as `completed_inspection`.
- Controlled PowerShell edit run creates `calculator-smoke.txt` and completes as `completed`.
- Invalid mode/status persistence is rejected.
- Codex edit/inspect sandbox flags remain correct.

The existing large-prompt transport regression also passed.

## Manual Verification

A controlled local PowerShell smoke used separate empty workspaces:

- Inspect-only build-worded case: no calculator file was created; final status was
  `completed_inspection`.
- Edit case: `calculator-smoke.txt` was created with `Calculator App`; final status was
  `completed`.

No live Codex deployment was repeated for this fix. Codex command construction is covered by the
focused sandbox tests, and the prior one-request prompt-file live verification remains valid.

## Remaining Limitations

- Non-Codex providers do not have an operating-system read-only sandbox; inspect-only is advisory
  for those CLIs.
- Historical deployment records created before this fix may still show the inspect-only mode that
  was actually launched. New runs create a new visible session and show its session ID and mode.
