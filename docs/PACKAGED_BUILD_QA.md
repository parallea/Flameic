# Packaged Windows Build QA

Date: June 10, 2026

## Release Identity

- Product version: `0.1.0-alpha`
- Windows bundle version: `0.1.0-1`
- Target audience: 1-3 trusted Windows testers
- Final installed package: NSIS
- Final installed executable:
  `C:\Users\ayush\AppData\Local\AgentBoard\agentboard.exe`

The numeric Windows prerelease is required because MSI rejects textual prerelease identifiers.
The npm package, Cargo package, diagnostics report, and app UI identify the release as
`0.1.0-alpha`.

## Build

```powershell
$env:CARGO_TARGET_DIR='D:\Flameic-cargo-target'
npm run tauri build
```

Artifacts:

- MSI:
  `D:\Flameic-cargo-target\release\bundle\msi\AgentBoard_0.1.0-1_x64_en-US.msi`
- NSIS:
  `D:\Flameic-cargo-target\release\bundle\nsis\AgentBoard_0.1.0-1_x64-setup.exe`

SHA-256:

- MSI: `C2858637FAA7645F2AD03DB8B8438464489F282528CCD7EB5259FF76E450C8AE`
- NSIS: `3B01B7DF8677EA4EF485D916C79354FAC78CA91CF588BA199ABA4CCD20511ED8`
- Final NSIS-installed executable:
  `2BEC3DE7AB598E12262D87290664067A83C68E2F116D189BE00840DC73D2FD3C`

## Validation Commands

Passed:

- `npm run type-check`
- `npm run build`
- `npm run self_review`
- `cargo metadata --manifest-path src-tauri\Cargo.toml --format-version 1 --no-deps`
- `cargo test --manifest-path src-tauri\Cargo.toml runtime_backend_flow -- --nocapture`
- `$env:CARGO_TARGET_DIR='D:\Flameic-cargo-target'; npm run tauri build`

The first alpha bundle attempt used `0.1.0-alpha` directly in Tauri and failed because WiX permits
only numeric MSI prerelease identifiers. Mapping Windows bundle metadata to `0.1.0-1` resolved the
failure without changing the public alpha version.

## Alpha UI And Diagnostics

- The sidebar and top bar show **Alpha** / **Alpha build** labels.
- The About/support panel shows `v0.1.0-alpha`.
- **Report issue** opens a local issue-report flow.
- **Export diagnostics** writes JSON under `%APPDATA%\AgentBoard\diagnostics`.
- Diagnostics include app version, OS information, agent detection, workspace registry summaries,
  recent UI errors, and the active workspace log-folder path.
- Diagnostics exclude source contents, prompts, and log contents.
- Reports are never uploaded automatically.

The compiled production frontend contains the alpha label, version, report-issue action, and
diagnostics action.

## Command Contract

The original 14 frontend/backend commands are unchanged. One command was added:

- `export_diagnostics`

Frontend and Rust registration match exactly at 15 commands. `npm run self_review` now fails on
version drift, missing release-hardening docs, or command-contract drift.

## Installer Lifecycle QA

The successful full lifecycle sequence used MSI SHA-256
`266BF95EBE79A74954E8752D54CE2A835E47D8A1BE4C10E45AA03C62EE3C0969`:

1. Snapshot app data, workspace registry, pipeline metadata, and session-log hashes.
2. Install/update NSIS and launch the packaged app.
3. Uninstall NSIS.
4. Reinstall NSIS and launch.
5. Uninstall NSIS before MSI testing.
6. Install MSI with administrator elevation and launch.
7. Uninstall MSI with administrator elevation.
8. Reinstall NSIS and launch.

Passed:

- NSIS update/reinstall preserved app data.
- NSIS uninstall removed the executable.
- NSIS uninstall did not delete any registered workspace.
- MSI installed and launched on this machine.
- MSI uninstall removed the installed executable.
- MSI uninstall did not delete app data or any registered workspace.
- Switching NSIS to MSI to NSIS caused no data loss.
- The final NSIS installation launches successfully.

The first non-elevated MSI attempt returned `1603` with Windows Installer error 1925: insufficient
privileges for an all-users installation. The elevated MSI install and uninstall then passed, with
Windows Installer status `0` recorded in both verbose logs.

Rustfmt later changed whitespace only, requiring final artifacts to be regenerated. The exact final
NSIS SHA-256 `3B01B7DF...ED8` then passed update, launch, uninstall, data preservation, reinstall,
and relaunch. Two attempts to repeat UAC for the exact final MSI SHA-256 `C2858637...C8AE` were
canceled. The final MSI is therefore build-verified but is not approved for this tester round.

## Data And Session Preservation

Baseline and final state:

- App-data files: 19 before, 19 after
- Registered workspaces: 3 before, 3 after
- Existing session logs: 12 before, 12 after
- Missing registered workspaces: 0
- Changed baseline pipeline hashes: 0
- Changed or removed baseline session-log hashes: 0

During the exact final NSIS lifecycle pass, `%APPDATA%\AgentBoard\workspaces.json` retained SHA-256:

`6A374B9C63E5461850EF26E600044AE5B5E755FEA78BDE667D88C7CA236A4646`

The packaged app launched after each install/reinstall. Session restoration remains log-based and
is covered by `runtime_backend_flow`; the lifecycle snapshots verify that every pre-existing log
needed for restoration survived.

Evidence is stored under:

- `release-qa-evidence`: successful MSI install/uninstall logs and lifecycle snapshots
- `release-qa-evidence-final-nsis`: exact final NSIS lifecycle snapshots and passing summary

## Previously Verified Packaged Workflows

The June 9 packaged pass verified:

- Packaged `tauri.localhost` loading without Vite ports.
- Bundled sample workspace and skill loading.
- Existing real workspace loading.
- PowerShell and Codex execution.
- Durable session restoration after restart.
- Context menus, log-folder opening, and clear-history confirmation.
- No WebView console warnings, errors, or unhandled exceptions.

The June 10 changes are limited to release identity, alpha/support UI, local diagnostics, release
documentation, and installer lifecycle verification.

## Remaining Limitations

- Artifacts are not Authenticode signed.
- No clean Windows VM pass was performed.
- No clean standard-user account pass was performed.
- MSI requires administrator elevation.
- The exact final MSI artifact is not approved for distribution; use NSIS for this tester round.
- Codex verification depends on a locally installed and authenticated Codex CLI.
- GitHub OAuth, remote marketplace work, and ConPTY remain intentionally out of scope.

## Release Assessment

Overall confidence for sharing the final NSIS artifact with 1-3 trusted testers: **0.98**

The package is ready for a small trusted alpha. It is not ready for broad or untrusted
distribution until signing and clean-machine testing are complete.
