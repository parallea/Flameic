# AgentBoard Install Test Matrix

Date: June 10, 2026

## Data Boundaries

| Data | Expected location | Installer ownership |
| --- | --- | --- |
| Installed executable | `%LOCALAPPDATA%\AgentBoard` or MSI-selected install directory | Installer-managed |
| Workspace registry and preferences | `%APPDATA%\AgentBoard` | User-managed; must survive uninstall |
| Diagnostics exports | `%APPDATA%\AgentBoard\diagnostics` | User-managed; must survive uninstall |
| Workspace metadata | `<workspace>\.agentboard` | User workspace; must never be deleted by uninstall |
| Session history and logs | `<workspace>\.agentboard\logs` | User workspace; must survive update/reinstall |

## Matrix

| Scenario | Package | Machine | Expected result | Status |
| --- | --- | --- | --- | --- |
| Existing install launch | NSIS `0.1.0` | Current Windows machine | App launches and existing data loads | Passed June 9 |
| Upgrade/reinstall to alpha | NSIS `0.1.0-alpha` | Current Windows machine | App replaces binaries; registry and logs remain | Passed June 10 |
| Silent uninstall | NSIS `0.1.0-alpha` | Current Windows machine | App files removed; user data and workspaces remain | Passed June 10 |
| Reinstall after uninstall | NSIS `0.1.0-alpha` | Current Windows machine | Registry and session history restore | Passed June 10 |
| Fresh install | MSI `0.1.0-alpha`, SHA `266BF95E...C0969` | Current Windows machine | Elevated installer succeeds and app launches | Passed June 10 |
| Silent uninstall | MSI `0.1.0-alpha`, SHA `266BF95E...C0969` | Current Windows machine | App files removed; user data and workspaces remain | Passed June 10 |
| Installer-family switch | NSIS to validated MSI to NSIS | Current Windows machine | No data loss; final install launches | Passed June 10 |
| Final-byte install | MSI SHA `C2858637...C8AE` | Current Windows machine | Repeat elevated install after rustfmt-only rebuild | UAC canceled; do not distribute |
| Fresh install | NSIS and MSI | Clean Windows VM | No hidden machine dependencies | Not run |
| Standard-user install | NSIS and MSI | Clean non-admin account | Install, launch, and uninstall without elevation surprises | Not run |

## Verification Procedure

1. Stop all `agentboard.exe` processes.
2. Record installer hashes, installed executable hash, registry hash, and selected workspace
   sentinel hashes.
3. Record workspace paths from `%APPDATA%\AgentBoard\workspaces.json`.
4. Record `.agentboard\logs` file counts and hashes for representative workspaces.
5. Run the installer or uninstaller silently with an installation log.
6. Confirm the expected executable is present or absent.
7. Confirm `%APPDATA%\AgentBoard` and its registry files are unchanged unless the app legitimately
   updates timestamps.
8. Confirm every registered external workspace still exists.
9. Confirm selected workspace source sentinels and `.agentboard` log sentinels retain their hashes.
10. Reinstall, launch the packaged app, and confirm workspace/session restoration.

## Safety Rules

- Never use an uninstall command that removes `%APPDATA%\AgentBoard` or registered workspaces.
- Never use recursive deletion against a path derived from `workspaces.json`.
- Do not run installer tests while an agent session is active.
- Keep installer logs and lifecycle evidence with the QA report.

## June 10 Evidence

- The successful full NSIS/MSI/NSIS matrix retained 19 app-data files, 3 registered workspaces, and
  12 session logs.
- The exact final NSIS pass retained `workspaces.json` SHA-256
  `6A374B9C63E5461850EF26E600044AE5B5E755FEA78BDE667D88C7CA236A4646`.
- All baseline pipeline and log hashes remained unchanged.
- A non-elevated MSI attempt failed with Windows Installer error 1925, as expected for the
  per-machine package. The elevated install and uninstall passed.
- The final installed package is the NSIS build at
  `%LOCALAPPDATA%\AgentBoard\agentboard.exe`.
