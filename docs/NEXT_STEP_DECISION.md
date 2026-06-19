# Next Step Decision

Audit date: 2026-06-17

## Current Decision

The Marketplace correctness sprint is implemented in dev/test fixtures.

Next recommended step:

**Package/QA the corrected GitHub Marketplace flow before adding GitHub login/device flow.**

GitHub login is still useful for rate limits and private repositories, but it should follow a
packaged walkthrough of the corrected candidate discovery, install, review, and deploy prompt
preview loop.

## What Changed In Marketplace Correctness

- Search remains repository-level, but each repo now exposes detected skill candidates.
- Candidate discovery uses Git tree metadata and supports documented nested layouts:
  `skills/<name>`, `.codex/skills/<name>`, `.agents/skills/<name>`,
  `agentboard/skills/<name>`, and `packages/<name>`.
- Repos with multiple formal skill folders can show multiple installable candidates.
- README-only repositories are shown as **README drafts**, not as formal skills.
- Preview and install operate on a selected candidate id/path.
- Install writes `SKILL.md`, `skill.json`, and `source.json` with `sourceContentKind`,
  candidate path, selected remote paths, repo metadata, and commit SHA.
- Install can use a fresh matching cached preview instead of force-refreshing.
- Update still force-refreshes, but rate-limit fallback leaves the existing install untouched and
  reports cached status when available.
- Frontend no longer forces GitHub search refresh immediately after install.
- Post-install UI shows `Installed but not selectable until reviewed.` with review/trust actions.
- Create Agent and Deploy Agent show untrusted GitHub skills disabled with
  `Review this GitHub skill before enabling.`
- Prompt generation injects only reviewed/trusted GitHub skills and includes:

```text
Skill source: GitHub import from <repoFullName>
sourceContentKind: formal_skill
```

or:

```text
sourceContentKind: readme_draft
```

## Remaining Choices

| Rank | Next step | Recommendation | Reason |
| --- | --- | --- | --- |
| 1 | Packaged Marketplace V1.1 QA | Do next | Confirms the corrected tester loop in the actual Windows package. |
| 2 | GitHub login/device flow | Do after packaged QA | Improves rate limits/private repo access, but is not needed to prove install correctness. |
| 3 | GitHub reviews/ratings | Later | Requires a service/trust model and should not precede packaged correctness validation. |
| 4 | Pipeline discovery | Later | Deployment works with explicit pipeline metadata today. |
| 5 | ConPTY terminal | Later | Current subprocess logs remain usable for alpha testing. |

## Required Packaged QA

Before telling testers "GitHub Marketplace installs usable skills", run a packaged NSIS
walkthrough:

1. Search GitHub.
2. Confirm repo cards show formal candidates and README drafts separately.
3. Preview a nested formal candidate.
4. Install it without forcing a post-install GitHub search refresh.
5. Confirm `source.json.sourceContentKind = "formal_skill"`.
6. Confirm the post-install review callout appears.
7. Confirm the untrusted skill is disabled in Deploy Agent.
8. Mark reviewed and confirm it becomes selectable.
9. Generate prompt preview and confirm content, GitHub provenance, and `sourceContentKind`.
10. Install a README-only draft and confirm it is labeled as a draft with the required warning.
11. Run update and uninstall.

## Still Out Of Scope

- GitHub OAuth/device login
- persistent credential storage
- ratings/reviews
- arbitrary repository/package discovery beyond documented bounded candidate paths
- repository clone/archive download
- remote code execution
- pipeline discovery
- ConPTY
- live Codex deployments

## Confidence

Confidence after fixture coverage: **0.88** for Marketplace correctness in dev/test fixtures.

Confidence for public GitHub behavior remains **0.80** until a controlled packaged walkthrough
validates real search quality and candidate distribution.
