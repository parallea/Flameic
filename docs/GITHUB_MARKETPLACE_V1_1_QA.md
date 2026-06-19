# GitHub Marketplace V1.1 QA

Date: 2026-06-17

## Scope

Verify GitHub Marketplace candidate discovery, formal skill install, README draft install,
cache-aware install, review/trust UX, and prompt injection gating.

Do not run live Codex deployments for this QA pass.

## Preconditions

- AgentBoard opens a valid workspace.
- Optional GitHub token may be added for quota, but GitHub login/device flow is not implemented.
- Existing GitHub imports can remain installed; duplicate handling should be tested if names clash.

## 2026-06-17 Real-World QA Result

Status: **Passed for V1.1 trusted-tester scope.**

No live Codex deployments were run. Prompt checks used generated/staged prompt previews only.

### Baseline Commands

All passed:

```text
npm run type-check
npm run build
npm run self_review
npm run test:prompt-preview
npm run test:github-marketplace-rate-limit
cargo metadata --manifest-path src-tauri/Cargo.toml --format-version 1 --no-deps
cargo test --manifest-path src-tauri/Cargo.toml runtime_backend_flow -- --nocapture
cargo test --manifest-path src-tauri/Cargo.toml github_marketplace_ -- --nocapture
```

`github_marketplace_live_search_and_preview` remains ignored by default because it requires live
GitHub API access.

### Real GitHub Repositories Tested

| Case | Repository | Result |
| --- | --- | --- |
| Root formal skill | `joeseesun/qiaomu-skill-publisher` | Repository card appeared; formal candidate list appeared; preview showed candidate path `.`, commit `8bd944b7723e710d38f9fa4034e8ba6addbbdfed`, selected files `SKILL.md` and `README.md`, and `sourceContentKind: formal_skill`. |
| Nested formal skill | `carlosmarte/agent-skills-progressive-readme-updater` | Repository card appeared; nested candidate `.agents/skills/progressive-readme-updater` appeared; preview/install wrote formal `source.json` with commit `9db665c6dd506e016b237a2656dfcdb5d2ef6904`. |
| README draft | `Imbad0202/academic-research-skills` | Appeared under README drafts from broad search `agent skill README`; install required draft review path and wrote `sourceContentKind: readme_draft` at commit `88fc003e6abf5fe9fe86dc8200f8d4aa8d511956`. |

Installed paths:

```text
output/github-marketplace-qa/workspace-live/.agentboard/skills/qa-root-formal
output/github-marketplace-qa/workspace-live/.agentboard/skills/qa-nested-formal
output/github-marketplace-qa/workspace-live/.agentboard/skills/academic-research-skills
```

Each installed folder contains `SKILL.md`, `skill.json`, and `source.json`.

### Review And Trust Result

Passed:

- Post-install callout exists: `Installed but not selectable until reviewed.`
- Actions exist: Review now, Mark reviewed, Keep untrusted, Open installed folder.
- Deploy Agent disabled unreviewed GitHub skills with `Review this GitHub skill before enabling.`
- After marking reviewed, root formal and README draft skills became selectable.
- Disabled nested formal skill remained excluded.

### Prompt Preview Result

Passed. Proof artifact:

```text
output/github-marketplace-qa/dev-prompt-preview-proof.txt
```

Verified:

- reviewed formal GitHub skill content appears
- reviewed README draft content appears
- `Skill source: GitHub import from joeseesun/qiaomu-skill-publisher`
- `sourceContentKind: formal_skill`
- `sourceContentKind: readme_draft`
- disabled GitHub skill `carlosmarte/agent-skills-progressive-readme-updater` is excluded

### Cache And Rate-Limit Result

Passed.

- Fresh preview install did not consume additional GitHub core quota:
  `beforeInstallRemaining=32`, `afterInstallRemaining=32`.
- Artifact: `output/github-marketplace-qa/dev-cache-install-summary.json`.
- After exhausting anonymous GitHub core quota to `0/60`, update returned
  `cached_rate_limited`.
- Hashes for installed `SKILL.md`, `skill.json`, and `source.json` were unchanged.
- Packaged UI showed `GitHub core: 0/60`, a core API limit message, and
  `GitHub update check is rate-limited`.
- Artifact: `output/github-marketplace-qa/rate-limit-update-summary.json`.

### Packaged NSIS Result

Passed.

Built artifact:

```text
D:\Flameic-cargo-target\release\bundle\nsis\AgentBoard_0.1.0-1_x64-setup.exe
SHA256: 0C32540BD3190E29ECF74913CB32770C556A34F14B3B4D19A1EDC672574D205E
```

Packaged app installed and launched from:

```text
C:\Users\ayush\AppData\Local\AgentBoard\agentboard.exe
```

Minimum packaged marketplace flow passed:

- search returned cached repository card for `joeseesun/qiaomu-skill-publisher`
- preview opened from cached candidate metadata
- install wrote `qa-package-formal-mqiey6da`
- mark reviewed set `trustState: reviewed` and `enabled: true`
- Deploy Agent checkbox was enabled and selectable
- Stage-only deployment generated a prompt with GitHub source and `sourceContentKind`
- restart preserved installed skill and selectable state

Artifacts:

```text
output/github-marketplace-qa/packaged-flow-summary.json
output/github-marketplace-qa/packaged-restart-summary.json
output/github-marketplace-qa/packaged-staged-prompt-proof.txt
output/github-marketplace-qa/packaged-flow-after-stage.png
```

### Remaining Limitations From This Pass

- GitHub OAuth/device login is still not implemented.
- Anonymous public GitHub quota is easy to exhaust during real discovery.
- README drafts are still draft imports and require manual review.
- No live Codex deployment was run in this pass by design.
- No reviews/ratings, pipeline discovery, or ConPTY were added or verified.

Recommended next step: **GitHub login/device flow**. It directly reduces the quota friction seen in
real-world QA without changing marketplace semantics.

## Formal Candidate Flow

1. Open **Skills -> Marketplace**.
2. Search for a query likely to return agent skills.
3. Confirm each repository card lists detected candidates under it.
4. Confirm formal candidates show badges such as **Formal skill** and **Nested skill** when
   applicable.
5. Preview a candidate with a path like `skills/<name>/SKILL.md`,
   `.codex/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md`,
   `agentboard/skills/<name>/SKILL.md`, or `packages/<name>/SKILL.md`.
6. Confirm preview shows candidate path, commit SHA, `sourceContentKind: formal_skill`, and
   selected files.
7. Install the candidate.
8. Confirm the UI does not immediately force-refresh GitHub search results.
9. Confirm the installed folder contains:

```text
SKILL.md
skill.json
source.json
```

10. Confirm `source.json` contains:

```json
{
  "sourceContentKind": "formal_skill",
  "candidatePath": "<selected candidate path>",
  "skillMarkdownPath": "<selected SKILL.md path>",
  "repoFullName": "<owner/repo>",
  "commitSha": "<commit>",
  "warning": "Remote code was not executed."
}
```

## README Draft Flow

1. Find or fixture a repository with only `README.md`.
2. Confirm it appears under **README drafts**, not as a formal skill.
3. Confirm the install button says **Create draft from README**.
4. Confirm install requires the README draft checkbox.
5. Install the draft.
6. Confirm the installed badge says **Draft — review required**.
7. Confirm `source.json` contains:

```json
{
  "sourceContentKind": "readme_draft",
  "readmePath": "README.md",
  "warning": "Draft created from repository README. Review and edit before use."
}
```

## Review And Trust

1. After GitHub install, confirm the callout says:

```text
Installed but not selectable until reviewed.
```

2. Confirm actions exist:

- Review now
- Mark reviewed
- Keep untrusted
- Open installed folder

3. Open Deploy Agent before review.
4. Confirm the GitHub skill is disabled with:

```text
Review this GitHub skill before enabling.
```

5. Mark reviewed.
6. Reopen Deploy Agent and confirm the skill is selectable.

## Prompt Preview

1. Generate a deployment prompt preview with a reviewed GitHub skill selected.
2. Confirm the prompt contains the skill title and content.
3. Confirm the prompt contains:

```text
Skill source: GitHub import from <repoFullName>
sourceContentKind: formal_skill
```

or:

```text
sourceContentKind: readme_draft
```

4. Mark the skill untrusted or disabled.
5. Generate the prompt again and confirm the skill content is excluded.

## Cache And Rate Limit

1. Preview a candidate.
2. Install from the open preview.
3. Confirm install succeeds without a forced preview refresh when cached preview metadata matches.
4. During update, if GitHub is rate-limited, confirm the existing installed folder remains intact
   and the UI reports cached/rate-limited status instead of replacing files.

## Out Of Scope Checks

Do not expect:

- GitHub OAuth/device login
- reviews/ratings
- private repo UX beyond manual token access
- pipeline discovery
- ConPTY
- remote code execution
