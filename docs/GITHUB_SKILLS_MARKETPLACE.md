# GitHub Skills Marketplace

Date: June 17, 2026

## Overview

AgentBoard searches GitHub repositories, discovers bounded skill candidates from Git tree metadata,
previews selected candidate files, and imports instruction/context files into the selected
workspace.

AgentBoard does not clone repositories, download archives, execute scripts, run package managers,
or invoke repository install commands.

## User Flow

1. Open a workspace and select **Skills -> Marketplace**.
2. Search by keyword and optionally filter by sort, language, minimum stars, or detected files.
3. Review repository cards and the detected candidates under each repo.
4. Open a specific candidate preview.
5. Install a formal skill, or explicitly choose **Create draft from README** for README-only repos.
6. Install into `<workspace>/.agentboard/skills/<safe-skill-name>/`.
7. Review the imported files. GitHub imports are not selectable until marked `reviewed` or
   `trusted`.
8. Enable the reviewed/trusted skill in Create Agent or Deploy Agent.
9. Update after reviewing changed files, or uninstall to `.trash`.

## Candidate Discovery

Search uses GitHub's repository search API. Detection then uses the repository Git tree API and
does not fetch every file.

Formal skill candidates are detected from:

```text
SKILL.md
skill.json
.agentboard/SKILL.md
.agentboard/skill.json
skills/<skill-name>/SKILL.md
skills/<skill-name>/skill.json
.codex/skills/<skill-name>/SKILL.md
.codex/skills/<skill-name>/skill.json
.agents/skills/<skill-name>/SKILL.md
.agents/skills/<skill-name>/skill.json
agentboard/skills/<skill-name>/SKILL.md
agentboard/skills/<skill-name>/skill.json
packages/<skill-name>/SKILL.md
packages/<skill-name>/skill.json
```

Candidate discovery is capped at 20 per repository and ignores generated/dependency folders such as
`node_modules`, `dist`, `build`, `target`, `.git`, and `vendor`.

Repositories with only `README.md` are shown separately as **README drafts**. They are not presented
as normal formal skills.

## Preview

Preview is candidate-level and returns the selected repo, commit SHA, candidate path, selected file
paths, Git blob SHAs, `sourceContentKind`, and cache timestamp.

Formal preview fetches:

- candidate `SKILL.md`
- nearby `skill.json`, when present
- nearby README, when present

README draft preview fetches repository `README.md` only and requires explicit confirmation before
install.

Text files larger than 256 KiB are rejected.

## Cache

Search and preview data is cached for 15 minutes in:

```text
%APPDATA%\AgentBoard\github-marketplace-cache.json
```

The cache contains public repository metadata and preview text. It does not contain the GitHub
token.

Install can use a fresh cached preview when the repo, candidate id/path, commit SHA, and selected
paths match. Install does not force a live preview refresh in that case.

Update still attempts a force-refresh. If rate-limited, AgentBoard leaves the existing install
unchanged and reports cached status when available.

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

Formal imports write `sourceContentKind: "formal_skill"` and record candidate path, selected remote
paths, repo metadata, commit SHA, timestamps, and:

```text
Remote code was not executed.
```

README draft imports write `sourceContentKind: "readme_draft"` and:

```text
Draft created from repository README. Review and edit before use.
```

## Trust States

- `untrusted`: default after GitHub import; blocked from agent prompts
- `reviewed`: user reviewed the content; selectable for compatible providers
- `trusted`: user explicitly trusts the content; selectable for compatible providers
- `disabled`: installed but blocked from prompts

After install, Marketplace shows:

```text
Installed but not selectable until reviewed.
```

Create Agent and Deploy Agent show untrusted GitHub skills disabled with:

```text
Review this GitHub skill before enabling.
```

Prompt generation enforces the trust gate. Reviewed/trusted GitHub skills include:

```text
Skill source: GitHub import from <repoFullName>
sourceContentKind: formal_skill
```

or:

```text
sourceContentKind: readme_draft
```

Untrusted, disabled, or invalid GitHub skills are not injected.

## Optional Token

No login is required. A personal access token can be entered in Marketplace to improve API limits.

The token is stored in Rust process memory only:

- never returned to the frontend after saving
- input cleared after validation
- not written to disk
- cleared when AgentBoard exits or the user selects Clear

GitHub OAuth/device login and persistent credential storage are not implemented.

## Update And Uninstall

Update fetches current remote content for the installed candidate, compares `SKILL.md`, normalized
`skill.json`, source metadata, and commit SHA, then requires confirmation before writing changes.

Confirmed updates save:

```text
<skill-folder>/backups/<timestamp>/
```

Uninstall moves the folder to:

```text
<workspace>/.agentboard/skills/.trash/<skill-name>-<timestamp>/
```

Duplicate overwrite creates a backup under `.agentboard/skills/.backups/` first.

## Tester Instructions

1. Open `sample-workspace`.
2. Open **Skills -> Marketplace**.
3. Search `software engineering agent skill`.
4. Confirm repository cards show detected candidates under each repo.
5. Preview a formal candidate such as `skills/<name>/SKILL.md` when available.
6. Install the formal skill and confirm the post-install review callout appears.
7. Confirm the folder contains `SKILL.md`, `skill.json`, and `source.json`.
8. Confirm `source.json.sourceContentKind` is `formal_skill`.
9. Confirm the skill is disabled in Deploy Agent with `Review this GitHub skill before enabling.`
10. Mark it `reviewed`, reopen Deploy Agent, and select it.
11. Generate a prompt preview and confirm skill content, GitHub source, and `sourceContentKind`.
12. Search for or fixture a README-only repo and confirm it appears under **README drafts**.
13. Confirm README install button says **Create draft from README**.
14. Confirm README draft `source.json.sourceContentKind` is `readme_draft`.
15. Run Update and review the changed-file confirmation or cached-rate-limited message.
16. Uninstall and confirm the folder moved to `.trash`.

## Verification

- Rust marketplace fixture tests cover nested candidates, multiple candidates, README draft
  classification, install metadata, README draft warning, and cached preview matching.
- `runtime_backend_flow` covers normalized permissions, untrusted install, reviewed enablement,
  update backup/metadata, and trash uninstall.
- `npm run test:prompt-preview` verifies reviewed GitHub content, source provenance, and
  `sourceContentKind` are injected while untrusted content is excluded.
- `npm run test:github-marketplace-rate-limit` verifies rate-limit messaging and cached preview
  behavior.

## 2026-06-17 QA Evidence

Real public GitHub repositories tested:

- `joeseesun/qiaomu-skill-publisher`: root `SKILL.md`; preview and install wrote
  `sourceContentKind: "formal_skill"` with candidate path `.` and commit
  `8bd944b7723e710d38f9fa4034e8ba6addbbdfed`.
- `carlosmarte/agent-skills-progressive-readme-updater`: nested formal candidate at
  `.agents/skills/progressive-readme-updater`; preview and install wrote formal source metadata
  with commit `9db665c6dd506e016b237a2656dfcdb5d2ef6904`.
- `Imbad0202/academic-research-skills`: README-only import shown as a README draft; install wrote
  `sourceContentKind: "readme_draft"` and required review before use.

Prompt preview proof:

```text
output/github-marketplace-qa/dev-prompt-preview-proof.txt
```

Packaged NSIS proof:

```text
D:\Flameic-cargo-target\release\bundle\nsis\AgentBoard_0.1.0-1_x64-setup.exe
SHA256: 0C32540BD3190E29ECF74913CB32770C556A34F14B3B4D19A1EDC672574D205E
output/github-marketplace-qa/packaged-flow-summary.json
output/github-marketplace-qa/packaged-restart-summary.json
```

Rate-limit proof:

```text
output/github-marketplace-qa/rate-limit-update-summary.json
```

The rate-limit pass exhausted anonymous GitHub core quota to `0/60`. Update returned
`cached_rate_limited`, preserved `SKILL.md`, `skill.json`, and `source.json` byte-for-byte, and the
Marketplace UI displayed the cached/rate-limited state.

## Remaining Limits

- GitHub OAuth/device flow is not implemented.
- Tokens are session-only.
- Private repositories depend on a manual token with appropriate access.
- Search is still repository-level; candidate discovery is bounded to documented paths.
- README drafts are convenience imports, not verified high-quality skills.
- AgentBoard does not semantically audit remote instructions; user review remains mandatory.
- No remote code is executed.
- Pipeline discovery, ConPTY, ratings/reviews, and GitHub PR publishing remain out of scope.
