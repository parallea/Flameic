# AgentBoard v0.1.0-alpha Release Checklist

Date: June 10, 2026

This checklist is the release gate for sharing AgentBoard with 1-3 trusted Windows testers.

## Scope

- [x] Public version is `0.1.0-alpha` in npm, Cargo, lockfiles, diagnostics, and the app UI.
- [x] Tauri uses the MSI-compatible numeric prerelease `0.1.0-1` for Windows bundle metadata.
- [x] The UI clearly identifies the package as an Alpha build.
- [x] Local issue reporting and diagnostics export are available.
- [x] GitHub OAuth, GitHub PR publishing, pipeline discovery, and ConPTY remain excluded.
- [x] The original 14 desktop commands are unchanged.
- [x] `export_diagnostics` remains available for local diagnostics export.
- [x] `run_multi_agent_smoke_test` was added without changing existing command signatures.
- [x] Seven profile/deployment persistence commands were added without changing existing command
      signatures.
- [x] `deployment_preflight` was added without changing existing command signatures.
- [x] Nine GitHub Marketplace commands were added without changing existing command signatures.

## GitHub Skills Marketplace Gates

- [x] Search uses backend GitHub API calls and supports sort, language, stars, and detected-file
      filters.
- [x] Repository cards expose metadata, detected paths, quality, and install status.
- [x] Preview checks formal skill paths and requires confirmation for README-only drafts.
- [x] Install writes only `SKILL.md`, normalized `skill.json`, and `source.json`.
- [x] Imported skills default to untrusted and cannot enter prompts.
- [x] Reviewed/trusted GitHub skills appear in Create Agent and Deploy Agent.
- [x] Prompt preview includes GitHub content and source provenance.
- [x] Update previews changed files and creates a timestamped backup.
- [x] Uninstall moves the skill folder to `.agentboard/skills/.trash`.
- [x] Duplicate names support cancel, rename, or overwrite after backup.
- [x] Optional GitHub token storage is session-only and never written to cache.
- [x] Marketplace cache is stored under `%APPDATA%\AgentBoard`.
- [x] Runtime tests cover install, trust, update metadata, backup, and trash lifecycle.
- [x] Live GitHub API test returned 12 results for `software engineering agent skill`.
- [x] Live README fallback preview/install/trust/update-check/uninstall lifecycle passed against
      `mattpocock/skills`.
- [ ] Repeat full search/install/restart/update/uninstall walkthrough in packaged NSIS.

## Agent Deployment UX Gates

- [x] Agent profiles persist in `%APPDATA%\AgentBoard\agents.json`.
- [x] Deployment records persist in `%APPDATA%\AgentBoard\deployments.json`.
- [x] Workspace, concerned folder, concerned file, and pipeline-node targets open the deployment
      flow with prefilled scope.
- [x] Stage only creates a record without starting a backend session.
- [x] Run now reuses `run_agent` and records the returned session and log path.
- [x] Generated prompts differ by target type and pipeline prompts include concerned files.
- [x] Installed local skills can be selected and incompatible provider skills are disabled.
- [x] Deployments appear under their targets with durable status colors and inspector details.
- [x] Unsupported custom Run now, reveal, workspace removal, and destructive local-skill actions
      are disabled with reasons.
- [x] Profile/deployment CRUD and restoration are covered by `runtime_backend_flow`.
- [x] Live `tauri dev` restored a profile and its deployment/status/log link after restart.
- [x] Live provider failure remained visible and persisted instead of being reported as success.
- [x] Pipeline-node and file prompt scopes passed a direct generated-prompt smoke check.
- [x] Empty source targets block edit mode and require explicit inspect-only confirmation.
- [x] Edit mode requires concrete task text and profile write permission.
- [x] Codex inspect-only uses `--sandbox read-only`; edit uses `--sandbox workspace-write`.
- [x] Non-Git deployment is a confirmable warning and disables worktree isolation.
- [x] PowerShell exact-once logging verifies `LineA`, `LineB`, and spawn once in events and logs.
- [x] Session logs are non-empty before `run_agent` returns.
- [ ] Repeat a Run now deployment through successful completion when the selected Codex account has
      available usage.
- [ ] Complete the full create/deploy/restart modal walkthrough in the packaged NSIS build.

## Multi-Agent Execution Gates

- [x] Two PowerShell child processes can be alive at the same time.
- [x] Starting session B does not replace session A.
- [x] Session logs use independent paths and do not mix output.
- [x] Agent B's 3-second smoke command completes before Agent A's 5-second command.
- [x] Stopping one session leaves another session running.
- [x] Completed and stopped sessions restore from `.agentboard/logs`.
- [x] Pipeline-node runs can request a unique worktree per session.
- [x] Shared-workspace concurrency requires an explicit risk confirmation.
- [x] `tauri dev` live smoke shows two running sessions and Agent B finishing first.
- [x] Live targeted stop shows Agent A stopped while Agent B remains running and later completes.
- [x] A fresh dev app process restores the stopped/completed session rows from separate logs.
- [ ] Repeat the multi-agent smoke and reload flow in the packaged NSIS build.

## Build Gates

- [x] `npm run type-check`
- [x] `npm run build`
- [x] `npm run self_review`
- [x] `npm run test:prompt-preview`
- [x] `cargo metadata --manifest-path src-tauri\Cargo.toml --format-version 1 --no-deps`
- [x] `cargo test --manifest-path src-tauri\Cargo.toml runtime_backend_flow -- --nocapture`
- [x] Multi-agent overlap, independent logs, targeted stop, and restoration are asserted inside
      `runtime_backend_flow`.
- [x] Agent profile and deployment persistence are asserted inside `runtime_backend_flow`.
- [x] `$env:CARGO_TARGET_DIR='D:\Flameic-cargo-target'; npm run tauri build`
- [x] MSI and NSIS artifacts exist and have recorded SHA-256 hashes.
- [x] Packaged executable opens without a Vite development server.

## Install And Data Safety Gates

- [x] NSIS installs and launches.
- [x] NSIS uninstall removes the installed application.
- [x] NSIS uninstall leaves `%APPDATA%\AgentBoard` user data intact.
- [x] NSIS uninstall leaves registered workspace directories intact.
- [x] Workspace `.agentboard` metadata and logs survive uninstall/reinstall.
- [x] Reinstall restores the workspace registry and session history.
- [x] MSI installs and launches on this machine with administrator elevation (validated artifact
      SHA-256 `266BF95E...C0969`).
- [x] MSI uninstall removes the installed application without deleting user data or workspaces for
      the validated artifact.
- [x] Final machine state contains one working NSIS AgentBoard installation.

## Diagnostics And Privacy Gates

- [x] Diagnostics include app version and OS information.
- [x] Diagnostics include local agent detection.
- [x] Diagnostics include workspace registry summaries.
- [x] Diagnostics include recent UI errors.
- [x] Diagnostics include the active workspace log folder path.
- [x] Diagnostics exclude source contents, prompts, and log contents.
- [x] Reports are written locally under `%APPDATA%\AgentBoard\diagnostics`.
- [x] No report is uploaded automatically.

## Tester Handoff

- [ ] Share only the final artifact hashes recorded in `PACKAGED_BUILD_QA.md`.
- [ ] Tell testers the installers are unsigned and Windows may show a warning.
- [ ] Provide `KNOWN_ALPHA_LIMITATIONS.md`.
- [ ] Ask testers to use **Report issue** and share the generated JSON manually.
- [ ] Ask testers to back up important work independently before alpha testing.
- [ ] Limit distribution to 1-3 trusted testers.

## Go/No-Go

All local build and NSIS install/data-safety gates passed on June 10, 2026. The build is **go for
1-3 trusted testers using the final NSIS artifact only**. The exact final MSI hash was build-verified
after a formatting-only rebuild but its repeat UAC install was canceled, so it is not a release
artifact. Clean Windows VM testing remains pending.
