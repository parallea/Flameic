# GitHub Skills Marketplace

Date: June 10, 2026

## Overview

AgentBoard Marketplace v1 searches GitHub repositories, detects common skill files, previews
bounded text content, and imports instruction/context files into the selected workspace.

AgentBoard does not clone repositories, download archives, execute scripts, run package managers,
or invoke repository install commands.

## User Flow

1. Open a workspace and select **Skills → Marketplace**.
2. Search by keyword and optionally filter by sort, language, minimum stars, or detected files.
3. Open a repository card to preview `SKILL.md`, `skill.json`, or the README fallback.
4. Confirm README-draft installation when no formal `SKILL.md` exists.
5. Choose duplicate behavior: cancel, install as a new name, or overwrite after backup.
6. Install into `<workspace>/.agentboard/skills/<safe-skill-name>/`.
7. Review the imported files and mark the skill `reviewed` or `trusted`.
8. Enable the skill in Create Agent or Deploy Agent.
9. Update it after reviewing changed files, or uninstall it to `.trash`.

## GitHub API

Search uses GitHub's repository search API. Result detection uses the repository Git tree API to
look for:

- `SKILL.md`
- `skill.json`
- `README.md`
- `.agentboard/skill.json`
- `.agentboard/SKILL.md`
- `skills/SKILL.md`
- `skills/skill.json`
- `agentboard/skill.json`
- `agentboard/SKILL.md`

The query builder combines the user's keyword with `agent skill`. If that returns no repositories,
it retries ordered `SKILL.md`, `claude skill`, `codex skill`, `ai agent skill`, and
`developer skill` variants rather than making all synonyms mandatory in one overly restrictive
query.

Cards show repository owner/name, description, stars, forks, language, detected license, updated
date, topics, detected files, quality score, and install status.

GitHub has separate search and core API quotas. Without a token, public API access is typically
limited and shared with other GitHub activity from the same IP. When tree quota is exhausted,
repository metadata can still render with **Detection unavailable**. Preview/install remains
blocked until the core quota resets.

## Optional Token

No login is required. A personal access token can be entered in Marketplace to improve API limits.

Marketplace v1 stores the token in Rust process memory only:

- the token is never returned to the frontend after saving
- the input is cleared after validation
- the token is not written to disk
- the token is cleared when AgentBoard exits or the user selects Clear

OAuth and persistent credential storage are not implemented.

## Cache

Search and preview data is cached for 15 minutes in:

```text
%APPDATA%\AgentBoard\github-marketplace-cache.json
```

The cache contains public repository metadata and preview text. It does not contain the GitHub
token. Cached searches show a visible label and can be force-refreshed by lifecycle actions.

## Installation Files

An imported skill contains:

```text
SKILL.md
skill.json
source.json
```

`skill.json` is normalized to AgentBoard's schema. Remote permissions are never elevated:

```json
{
  "source": "github",
  "trusted": false,
  "permissions": {
    "filesystem": "read",
    "shell": false,
    "network": false
  }
}
```

`source.json` records the repository, URL, default branch, commit SHA, timestamps, stars/forks,
license, fetched paths, trust state, original remote `skill.json`, and this warning:

> Imported GitHub skill. Remote code was not executed.

Text files larger than 256 KiB are rejected.

## Trust States

- `untrusted`: default after import; previewable but blocked from agent prompts
- `reviewed`: user reviewed the content; selectable for compatible providers
- `trusted`: user explicitly trusts the content; selectable for compatible providers
- `disabled`: installed but blocked from prompts

Create Agent and Deploy Agent show source and trust state. Untrusted and disabled GitHub skills
cannot be selected. Prompt generation also enforces the trust check, so a stale profile selection
cannot inject untrusted content.

Enabled GitHub skills include this provenance line:

```text
Skill source: GitHub import from <repoFullName>
```

## Update And Uninstall

Update fetches current remote content, compares `SKILL.md`, normalized `skill.json`, and commit
metadata, shows changed files, and requires confirmation. Before replacement it saves:

```text
<skill-folder>/backups/<timestamp>/
```

Uninstall requires confirmation and moves the entire folder to:

```text
<workspace>/.agentboard/skills/.trash/<skill-name>-<timestamp>/
```

Duplicate overwrite creates a backup under `.agentboard/skills/.backups/` first.

## Error Handling

Marketplace reports selected-workspace errors, connectivity failures, invalid tokens, API rate
limits, missing repositories, absent skill files, malformed `skill.json`, oversized content,
duplicate names, unsafe Windows names, and filesystem write failures.

## Tester Instructions

1. Open `sample-workspace`.
2. Open **Skills → Marketplace**.
3. Search `software engineering agent skill`.
4. Open a result and review all detected files.
5. Install a formal skill, or explicitly confirm README draft installation.
6. Verify the folder under `.agentboard/skills`.
7. Confirm the skill initially shows `untrusted` and is blocked in Deploy Agent.
8. Mark it `reviewed`, reopen Deploy Agent, and select it.
9. Generate a prompt preview and confirm skill content plus the GitHub provenance line.
10. Restart AgentBoard and confirm the workspace skill reloads.
11. Run Update and review the changed-file confirmation.
12. Uninstall and confirm the folder moved to `.trash`.

## Verification

- `runtime_backend_flow` verifies safe-name rejection, normalized permissions, untrusted install,
  reviewed enablement, update backup/metadata, and trash uninstall.
- `npm run test:prompt-preview` verifies reviewed GitHub content and source provenance are injected,
  while untrusted content is excluded.
- Live GitHub search used `software engineering agent skill` and returned 12 detected results.
- Live preview selected `mattpocock/skills`, fetched `README.md`, required README-draft approval,
  installed it as untrusted, changed it to reviewed, returned `up_to_date`, and moved it to
  `.trash` on uninstall.
- The final-code live test finished with 33/60 GitHub core requests remaining.
- No Codex deployment or paid-model task is required for Marketplace verification.

## Remaining Limits

- GitHub OAuth is not implemented.
- Tokens are session-only.
- Private repositories depend on a token with appropriate access.
- Detection covers the documented common paths, not arbitrary nested skill layouts.
- Marketplace does not validate remote instructions for correctness or safety; user review remains
  mandatory.
- Pipeline discovery, ConPTY, and GitHub PR publishing remain out of scope.

## Confidence

Confidence score: **0.94 / 1.00** for dev-mode search, preview, install, trust gating, prompt
injection, update checks/backups, and trash uninstall. Packaged NSIS marketplace verification
remains separate.
