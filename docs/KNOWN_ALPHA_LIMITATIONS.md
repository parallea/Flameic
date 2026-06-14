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
- Non-Git deployments are supported after confirmation, but worktree isolation and Git diff review
  are unavailable.
- Provider model strings are flexible local configuration and are not validated against remote
  model catalogs.

## Product Scope

- GitHub OAuth and pull-request publishing are not implemented.
- GitHub Marketplace tokens are session-only and are never persisted.
- Unauthenticated GitHub search and core API quotas are low and can be exhausted by repository
  detection. Metadata may show with Detection unavailable until the core quota resets.
- Marketplace detection checks documented common skill paths rather than arbitrary repository
  layouts.
- Imported skill instructions are not semantically audited by AgentBoard. They remain untrusted
  until the user reviews or trusts them.
- Automatic pipeline discovery is not implemented; pipeline metadata remains explicit.
- Custom agent profiles can be staged but cannot Run now until a custom executable contract is
  implemented.
- Folder deployment targets are derived from declared concerned-file paths. This sprint does not
  add a workspace-crawling file explorer.
- Workspace removal and destructive metadata editing remain disabled.
- Reality scanning uses lightweight heuristics and can produce false positives or miss issues.
- Patch-hunk review is unavailable; the current Git contract exposes status and diff statistics.

## Diagnostics And Issue Reporting

- **Report issue** creates a local JSON file; it does not submit to an issue tracker.
- Diagnostics can include local paths, machine name, command availability, and recent UI error
  text. Testers should review the JSON before sharing it.
- Diagnostics intentionally exclude source contents, prompts, and log contents.

## Data Safety

- Agent profiles and deployment records are stored globally in `%APPDATA%\AgentBoard`.
- Public GitHub search and preview metadata is cached in
  `%APPDATA%\AgentBoard\github-marketplace-cache.json` for 15 minutes.
- Imported GitHub skills contain instruction/context files only. AgentBoard does not execute remote
  scripts or repository install commands.
- GitHub skill updates create local backups and uninstall moves folders to `.trash`.
- Workspace pipeline metadata and logs remain inside each workspace under `.agentboard`.
- Uninstall is expected to preserve `%APPDATA%\AgentBoard` and all workspace directories.
- Alpha testers should still maintain independent backups of important work.
