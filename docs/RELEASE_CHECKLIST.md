# AgentBoard v0.1.0-alpha Release Checklist

Date: June 18, 2026

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
- [x] GitHub Marketplace commands plus `open_skill_folder` were added without changing existing
      command signatures.
- [x] Seven Agent Result Review commands were added without requiring Git or changing existing
      command signatures.

## Agent Result Review Gates

- [x] Edit-mode launch records a target-scoped before manifest before provider process launch.
- [x] Review metadata persists at `.agentboard/reviews/<session-id>/review.json`.
- [x] Created, modified, and deleted files are detected in non-Git workspaces.
- [x] `.agentboard`, `.git`, dependency, build, target, and virtual-environment directories are
      excluded.
- [x] Small safe text files receive bounded unified diff previews.
- [x] Sensitive files are marked and inline content is hidden.
- [x] Binary and large files are marked without unsafe inline previews.
- [x] Accept changes updates review status without committing or deleting files.
- [x] Revert deletes created files only when unchanged, restores modified files only when the
      current hash matches, and restores deleted files only from safe before snapshots.
- [x] Revert refuses out-of-scope, `.agentboard`, changed-after-review, and snapshot-unavailable
      operations with conflict details.
- [x] Session and deployment inspectors show summary, changed files, diff state, Open, Reveal,
      Accept, Revert, Open raw log, and Open review folder.
- [x] Revert confirmation lists revertable and unavailable files.
- [x] Inspect-only sessions do not produce pending edit reviews.
- [x] Eight focused Rust tests cover create/accept, modify/revert, delete/revert, exclusions,
      sensitive hiding, conflict preservation, persisted reload, and inspect-only bypass.
- [x] Live Tauri Case 1 verified create/diff/accept and accepted-review restoration after restart.
- [x] Live Tauri Case 2 verified create/revert confirmation, file removal, and `reverted` status.
- [x] Real PowerShell safe-workspace flow verified modified-file diff/revert and sensitive `.env`
      hiding.
- [ ] Repeat the README and `.env` cases visually in the Tauri inspector.
- [ ] Repeat accepted/reverted review restoration in the packaged NSIS build.

## GitHub Skills Marketplace Gates

- [x] Search uses backend GitHub API calls and supports sort, language, stars, and detected-file
      filters.
- [x] Repository cards expose metadata, detected candidates, quality, and install status.
- [x] Candidate discovery supports documented root and nested formal skill layouts.
- [x] Preview opens a selected candidate and requires confirmation for README-only drafts.
- [x] Install writes only `SKILL.md`, normalized `skill.json`, and `source.json`.
- [x] `source.json` records `sourceContentKind`, candidate path, selected remote paths, repo
      metadata, commit SHA, and the no-remote-code warning.
- [x] README-only imports are labeled as drafts and install through **Create draft from README**.
- [x] Install can use a fresh matching cached preview instead of forcing a live refresh.
- [x] Imported skills default to untrusted and cannot enter prompts.
- [x] Reviewed/trusted GitHub skills appear in Create Agent and Deploy Agent.
- [x] Prompt preview includes GitHub content, source provenance, and `sourceContentKind`.
- [x] Update previews changed files and creates a timestamped backup.
- [x] Uninstall moves the skill folder to `.agentboard/skills/.trash`.
- [x] Duplicate names support cancel, rename, or overwrite after backup.
- [x] Optional GitHub token storage is session-only and never written to cache.
- [x] Marketplace cache is stored under `%APPDATA%\AgentBoard`.
- [x] Rust marketplace fixture tests cover nested candidates, multiple candidates, README drafts,
      install metadata, README draft warning, and cached preview matching.
- [x] Runtime tests cover install, trust, update metadata, backup, and trash lifecycle.
- [x] Live root formal skill QA passed against `joeseesun/qiaomu-skill-publisher`.
- [x] Live nested formal skill QA passed against
      `carlosmarte/agent-skills-progressive-readme-updater`.
- [x] Live README draft QA passed against `Imbad0202/academic-research-skills`.
- [x] Live prompt preview proved reviewed GitHub source/provenance injection and disabled-skill
      exclusion.
- [x] Cache-aware install used fresh matching preview without consuming additional core quota.
- [x] Rate-limited update returned `cached_rate_limited`, preserved installed files unchanged, and
      showed cached/rate-limited UI state.
- [x] Repeat V1.1 minimum search/preview/install/review/stage/restart/update-rate-limit
      walkthrough in packaged NSIS.
- [ ] Repeat packaged GitHub uninstall walkthrough before wider external handoff.

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
- [x] Empty source targets allow scoped creation in edit mode and require explicit confirmation
      only for inspect-only continuation.
- [x] Edit mode requires concrete task text and profile write permission.
- [x] Profile changes and empty-target handling never silently downgrade edit mode to inspect-only.
- [x] Preflight echoes `requestedRunMode`; final submit and the immediate pre-run check must match it.
- [x] Inspect-only build tasks show prominent Switch to Edit / Continue inspect-only actions.
- [x] Final confirmation shows run mode, Codex sandbox, and whether files may be created/edited.
- [x] Codex inspect-only uses `--sandbox read-only`; edit uses `--sandbox workspace-write`.
- [x] Codex receives only a short prompt-file bootstrap; the generated deployment prompt is not
      placed in argv.
- [x] Session prompt records are written to `.agentboard/prompts/<session-id>.md` with target,
      provider, model, mode, skill provenance, and size metadata.
- [x] Large prompts and selected GitHub skills trigger file transport for conversational
      providers; duplicate skill sources are not injected twice.
- [x] Inspect-only build/create/fix/implement tasks produce an explicit edit-mode warning without
      silently changing mode.
- [x] Session logs record prompt path/counts without duplicating the full prompt.
- [x] Non-Git deployment is a confirmable warning and disables worktree isolation.
- [x] PowerShell exact-once logging verifies `LineA`, `LineB`, and spawn once in events and logs.
- [x] Session logs are non-empty before `run_agent` returns.
- [x] Missing external development tooling is classified as `blocked_environment`.
- [x] Session/deployment inspectors show missing tool/template, cause, next action, and explicit
      WinUI/web/WPF/audit choices.
- [x] Windows-app preflight checks .NET and WinUI template readiness and checks WinGet when a WinUI
      skill is selected.
- [x] WinUI-specific Edit runs block before launch when the required WinUI template is unavailable.
- [x] AgentBoard does not silently switch frameworks after an environment blocker.
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
- [x] `npm run test:github-marketplace-rate-limit`
- [x] `cargo metadata --manifest-path src-tauri\Cargo.toml --format-version 1 --no-deps`
- [x] `cargo test --manifest-path src-tauri\Cargo.toml runtime_backend_flow -- --nocapture`
- [x] `cargo test --manifest-path src-tauri\Cargo.toml github_marketplace_ -- --nocapture`
- [x] Focused prompt transport, duplicate GitHub skill, inspect/build mismatch, token redaction,
      and diagnostics privacy tests.
- [x] `npm run test:run-mode-propagation`
- [x] Rust `run_mode_propagation_flow` covers persistence, preflight, prompt/request mismatch
      rejection, PowerShell inspect/edit execution, status classification, and Codex sandbox flags.
- [x] `npm run test:environment-blocker`
- [x] `npm run test:agent-review`
- [x] Rust `environment_blocker_classification_flow` covers WinGet, WinUI template, .NET first-run,
      workload, Visual Studio, setup permission, runtime status override, and generic failure.
- [x] One live large-prompt Codex verification completed through the backend with
      `AGENTBOARD_PROMPT_FILE_OK` and no command-line-length failure.
- [x] Multi-agent overlap, independent logs, targeted stop, and restoration are asserted inside
      `runtime_backend_flow`.
- [x] Agent profile and deployment persistence are asserted inside `runtime_backend_flow`.
- [x] `$env:CARGO_TARGET_DIR='D:\Flameic-cargo-target'; npm run tauri build`
- [x] MSI and NSIS artifacts exist and have recorded SHA-256 hashes.
- [x] NSIS artifact for June 17 QA:
      `D:\Flameic-cargo-target\release\bundle\nsis\AgentBoard_0.1.0-1_x64-setup.exe`
      (`SHA256: 0C32540BD3190E29ECF74913CB32770C556A34F14B3B4D19A1EDC672574D205E`).
- [x] Packaged executable opens without a Vite development server.

## Install And Data Safety Gates

- [x] NSIS installs and launches.
- [x] NSIS packaged app completed minimum GitHub Marketplace V1.1 flow and preserved installed
      reviewed skill after restart.
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
- [x] Prompt-file contents are excluded even when `.agentboard/prompts` exists in the active
      workspace.
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

All local build gates and GitHub Marketplace V1.1 real-world/package gates passed on June 17, 2026.
The build is **go for 1-3 trusted testers using the final NSIS artifact only**, with GitHub
login/device flow called out as the next Marketplace hardening step. The exact final MSI hash was
build-verified after a formatting-only rebuild but its repeat UAC install was canceled, so it is not
a release artifact. Clean Windows VM testing and live Codex deployment completion remain pending.
