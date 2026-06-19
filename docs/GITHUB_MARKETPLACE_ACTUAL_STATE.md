# GitHub Marketplace Actual State

Audit date: 2026-06-17

Scope: GitHub Marketplace backend, React marketplace UI, prompt generation, deployment skill
selection, docs, and fixture tests. No live GitHub API call or live Codex deployment was run.

## Bottom Line

GitHub Marketplace now discovers skill candidates inside repositories instead of treating each
repository as one install target. A repo can expose multiple candidates such as
`skills/react/SKILL.md` and `skills/fastapi/SKILL.md`; the user previews and installs the selected
candidate.

README-only repositories are no longer presented as normal formal skills. They appear as
`README draft` candidates, require explicit `Create draft from README` confirmation, install as
untrusted, and write `sourceContentKind: "readme_draft"` to `source.json`.

GitHub imports still default to untrusted. Untrusted or disabled GitHub skills are not injected into
agent prompts. Reviewed/trusted GitHub skills include both repository provenance and
`sourceContentKind` in generated prompts.

GitHub login/device flow, ratings/reviews, pipeline discovery, ConPTY, and remote-code execution are
still not implemented.

## Search And Discovery

Search still uses GitHub repository search, then probes each result with the repository Git tree API.
Candidate discovery uses tree metadata only; it does not fetch every file.

Supported formal skill candidate layouts:

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

Legacy exact directories `skills/SKILL.md`, `skills/skill.json`, `agentboard/SKILL.md`, and
`agentboard/skill.json` are still recognized for compatibility.

Discovery is bounded:

- maximum 20 candidates per repository
- tree metadata only before preview
- generated/dependency directories ignored, including `node_modules`, `dist`, `build`, `target`,
  `.git`, `vendor`, `coverage`, `.next`, `out`, `.turbo`, `.cache`, and `__pycache__`

Candidate fields include repo identity, candidate path/name, selected `SKILL.md`, `skill.json`, and
README paths, `sourceContentKind`, installability, warnings, nested status, installed status, and
preview-cache status.

## Preview

Preview is candidate-level. The frontend sends repo plus candidate id/path. The backend resolves the
candidate from the current tree and fetches only the selected candidate files:

- formal candidate: candidate `SKILL.md`, nearby `skill.json` when present, and nearby README when
  present
- README draft: repository `README.md`

Preview returns:

- `repoFullName`
- `commitSha`
- `candidateId`
- `candidatePath`
- selected remote paths
- Git blob SHAs for fetched content
- `sourceContentKind`
- `cachedAt`

Text files larger than 256 KiB are rejected. No repository scripts or install commands are run.

## Install

Install uses the selected candidate paths. It writes:

```text
SKILL.md
skill.json
source.json
```

Formal skill installs write the candidate `SKILL.md`, normalize or generate `skill.json`, and record:

```json
{
  "source": "github",
  "sourceContentKind": "formal_skill",
  "candidatePath": "skills/react",
  "skillMarkdownPath": "skills/react/SKILL.md",
  "skillJsonPath": "skills/react/skill.json",
  "repoFullName": "owner/repo",
  "repoUrl": "https://github.com/owner/repo",
  "commitSha": "...",
  "warning": "Remote code was not executed."
}
```

README draft installs write README content into local `SKILL.md`, generate `skill.json`, and record:

```json
{
  "sourceContentKind": "readme_draft",
  "readmePath": "README.md",
  "warning": "Draft created from repository README. Review and edit before use."
}
```

Remote permissions are never elevated. Generated/normalized manifests use read-only filesystem
permission and disable shell/network.

## Cache And Rate Limits

Search and preview cache remain under:

```text
%APPDATA%\AgentBoard\github-marketplace-cache.json
```

Preview cache keys include workspace, repo, and candidate id so multiple candidates in one repo do
not overwrite one another.

Install no longer force-refreshes preview. It can use a fresh cached preview when repo, candidate
id/path, commit SHA, and selected paths match the install request. This allows installing from an
already-open fresh preview even when the GitHub core quota is low.

Update still attempts a force-refresh. If GitHub is rate-limited, the backend leaves the installed
skill untouched and returns a cached-rate-limited status when a cached preview is available.

The frontend no longer calls a forced GitHub search after install. It refreshes local workspace
skills and updates the current result state locally. GitHub search refresh happens only when the
user searches/refreshes explicitly.

## Trust And Prompt Injection

Imported GitHub skills default to `untrusted`. The Marketplace shows a post-install callout:

```text
Installed but not selectable until reviewed.
```

Actions include:

- Review now
- Mark reviewed
- Keep untrusted
- Open installed folder

Create Agent and Deploy Agent show untrusted GitHub skills disabled with:

```text
Review this GitHub skill before enabling.
```

Prompt generation includes only reviewed/trusted GitHub skills. Included GitHub skills contain:

```text
Skill source: GitHub import from <repoFullName>
sourceContentKind: formal_skill
```

or:

```text
sourceContentKind: readme_draft
```

Untrusted, disabled, or invalid GitHub skills are excluded from generated prompts.

## What Is Still Out Of Scope

- GitHub OAuth/device flow
- persistent secure token storage
- ratings/reviews
- private repo UX beyond manual token access
- arbitrary repository/package discovery beyond the bounded candidate paths above
- semantic validation of remote instructions
- repository clone/archive download
- remote code execution
- pipeline discovery
- ConPTY terminal
- live Codex deployment verification

## Verification Added

Focused Rust tests cover:

- nested formal candidate discovery
- multiple candidates in one repo
- README-only draft classification
- formal install `source.json.sourceContentKind = "formal_skill"`
- README draft install warning and `sourceContentKind = "readme_draft"`
- cached preview matching for install

Existing coverage still includes update backup/trust preservation, uninstall-to-trash, and prompt
trust gating. The prompt-preview script now asserts `sourceContentKind` is included for reviewed
GitHub skills and untrusted content is excluded.
