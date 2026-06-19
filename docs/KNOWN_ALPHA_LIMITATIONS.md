# Known Alpha Limitations

Version: `0.1.0-alpha`

AgentBoard is suitable only for 1-3 trusted testers on Windows. It is not a production release.

## Distribution And Platform

- MSI, NSIS, and executable artifacts are not Authenticode signed. Windows may show SmartScreen or
  unknown-publisher warnings.
- Windows bundle metadata uses `0.1.0-1` because MSI prerelease identifiers must be numeric. The
  product, package, diagnostics, and UI version remain `0.1.0-alpha`.
- MSI installation is per-machine and requires administrator elevation. NSIS is the preferred
  package for the initial trusted-tester group.
- The June 17, 2026 NSIS artifact passed the GitHub Marketplace packaged flow and restart
  persistence check:
  `D:\Flameic-cargo-target\release\bundle\nsis\AgentBoard_0.1.0-1_x64-setup.exe`
  (`SHA256: 0C32540BD3190E29ECF74913CB32770C556A34F14B3B4D19A1EDC672574D205E`).
- MSI install/uninstall behavior passed on the immediately preceding alpha artifact. The exact
  final MSI hash was rebuilt after rustfmt-only changes, but its repeat UAC prompt was canceled.
  Do not distribute the MSI in this tester round.
- Testing is local-machine focused. A clean Windows VM and a clean standard-user account have not
  been verified.
- macOS and Linux packaging are not release-tested.
- Automatic updates and rollback are not implemented.

## Runtime

- AgentBoard depends on locally installed agent CLIs and their existing authentication.
- Agent CLI flags and output formats can change independently of AgentBoard.
- The log panel is a streamed process log, not an interactive ConPTY terminal.
- Stopping a session terminates the process rather than requesting graceful cancellation.
- Session restoration is log-based. Legacy logs may not retain the original prompt or exact exit
  code.
- Multiple sessions can run simultaneously, but AgentBoard cannot reconcile conflicting edits if
  the user confirms that two writing agents may share one workspace.
- Pipeline worktree isolation is optional. Worktrees and their branches are not cleaned up
  automatically.
- Worktrees start from committed `HEAD`; uncommitted changes in the source workspace are not copied
  into a new worktree.
- Logs restore after restart, but AgentBoard does not reattach to a child process left alive by a
  previous backend process.
- Codex inspect/edit mode is enforced through `read-only` and `workspace-write` sandbox flags.
  AgentBoard cannot enforce an equivalent read-only sandbox for every other third-party CLI;
  those providers show a provider-controlled warning.
- Source-file preflight uses a maintained extension list and may not recognize uncommon language
  extensions.
- Run modes use the exact persisted values `edit` and `inspect_only`. AgentBoard rejects mismatches
  between preflight, generated prompt, deployment record, session, and successful completion
  status. Third-party provider behavior outside Codex's enforced sandbox remains provider-owned.
- Non-Git deployments are supported after confirmation, but worktree isolation and Git diff review
  are unavailable.
- Provider model strings are flexible local configuration and are not validated against remote
  model catalogs.
- Environment blocker classification is pattern-based. It covers common WinGet, .NET, WinUI,
  Windows SDK/workload, Visual Studio, and setup-permission failures, but novel tool output may
  still appear as generic `failed`.
- Windows-app preflight is a readiness hint, not a complete Visual Studio component audit. A
  present `dotnet` command or WinUI template does not prove that build, deployment, and launch will
  succeed.
- AgentBoard presents framework fallback choices but never switches from WinUI to WPF or web
  automatically.
- Prompt records are stored locally under `.agentboard/prompts` so sessions can survive restart
  and avoid Windows command-line limits. They can contain user tasks and selected skill
  instructions, are ignored by Git, and are excluded from diagnostics, but they are not
  automatically age-pruned in this alpha.
- Codex prompt-file transport is live-verified. File transport for Claude, Gemini, and Aider is
  covered by shared construction logic but has not been live-tested against every CLI version.
- Agent result review is filesystem-snapshot based and does not require Git. Inline diffs are
  bounded to small text files; binary, large, and sensitive files show metadata-only states.
- Sensitive files are not snapshotted for revert. Files larger than the snapshot/hash limits may
  also be non-revertible. The UI marks those files rather than retaining secrets or unbounded data.
- Revert is optimistic, not a merge engine. If a file changes after review generation, AgentBoard
  preserves current content and reports a conflict. Partial reverts can therefore leave the review
  pending until the user resolves or accepts the remaining files.
- Review metadata and safe before snapshots persist under `.agentboard/reviews` and are not
  automatically age-pruned in this alpha.

## Product Scope

- GitHub OAuth and pull-request publishing are not implemented.
- GitHub login/device flow is not implemented. The next Marketplace hardening step should be adding
  that flow so testers do not rely on low anonymous public API quotas.
- GitHub Marketplace tokens are session-only and are never persisted.
- Unauthenticated GitHub search and core API quotas are low and can be exhausted by repository
  detection. June 17 QA intentionally exhausted core quota to `0/60`; metadata may show with
  Detection unavailable until the core quota resets.
- Marketplace discovery is candidate-based for documented formal skill layouts, including nested
  `skills/<name>`, `.codex/skills/<name>`, `.agents/skills/<name>`, `agentboard/skills/<name>`, and
  `packages/<name>` paths. It is still bounded and does not discover arbitrary repository layouts.
- README-only GitHub imports are drafts, not formal skills. They require explicit
  **Create draft from README** confirmation and remain untrusted until reviewed.
- Imported skill instructions are not semantically audited by AgentBoard. They remain untrusted
  until the user reviews or trusts them.
- Automatic pipeline discovery is not implemented; pipeline metadata remains explicit.
- Custom agent profiles can be staged but cannot Run now until a custom executable contract is
  implemented.
- Folder deployment targets are derived from declared concerned-file paths. This sprint does not
  add a workspace-crawling file explorer.
- Workspace removal and destructive metadata editing remain disabled.
- Reality scanning uses lightweight heuristics and can produce false positives or miss issues.
- Agent result review uses bounded unified text previews. Side-by-side diff, syntax highlighting,
  per-hunk staging, merge resolution, comments, approvals, and Git commit creation are not
  implemented.

## Diagnostics And Issue Reporting

- **Report issue** creates a local JSON file; it does not submit to an issue tracker.
- Diagnostics can include local paths, machine name, command availability, and recent UI error
  text. Testers should review the JSON before sharing it.
- Diagnostics intentionally exclude source contents, prompts, and log contents.
- Session logs include prompt paths and size/count metadata, but not full prompt text.

## Data Safety

- Agent profiles and deployment records are stored globally in `%APPDATA%\AgentBoard`.
- Public GitHub search and preview metadata is cached in
  `%APPDATA%\AgentBoard\github-marketplace-cache.json` for 15 minutes.
- GitHub install can use a fresh matching cached preview; update still attempts a live refresh and
  leaves the existing install untouched when rate-limited. June 17 QA verified `cached_rate_limited`
  preserved `SKILL.md`, `skill.json`, and `source.json` hashes unchanged.
- Imported GitHub skills contain instruction/context files only. AgentBoard does not execute remote
  scripts or repository install commands.
- GitHub skill updates create local backups and uninstall moves folders to `.trash`.
- Workspace pipeline metadata and logs remain inside each workspace under `.agentboard`.
- Agent result reviews and bounded before snapshots remain under `.agentboard/reviews`.
- Uninstall is expected to preserve `%APPDATA%\AgentBoard` and all workspace directories.
- Alpha testers should still maintain independent backups of important work.
