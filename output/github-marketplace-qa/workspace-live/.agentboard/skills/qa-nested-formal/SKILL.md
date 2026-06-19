---
name: progressive-readme-updater
description: Update a single section of a README.md using progressive disclosure — parse the request, route to the one matching section template under references/, draft only that section, and inject it without disturbing the rest of the file or its table of contents. Delivers via git and the gh CLI (never the github-create_pull_request MCP tool). Trigger when the user asks to update/add/refresh a README section — installation (`npx skill add`, npm/pip install), Python/Node/Java environment setup, GitHub Actions / CI integration, usage, or badges — typically phrased `update readme ...` or `/SKILL.md update readme ...`. Skip for generating a whole README from scratch.
allowed-tools: Bash,Read,Write,Edit,Glob,Grep
argument-hint: "update readme <what to add/change> [--pr]"
---

# Progressive README Updater

Update **one section** of an existing `README.md` at a time. Instead of loading the whole
documentation surface, parse the request, **pull only the matching section template** from
[`references/`](references/), draft that section, and splice it into the README while leaving
every other section — and the table of contents — intact.

The single source of truth for structure is [`GIT_README_TEMPLATE.md`](GIT_README_TEMPLATE.md):
it carries the canonical section order plus the routing index below. The per-section formatting
rules and worked examples live in separate files under `references/` and are loaded **on demand**.

> **Progressive disclosure is the whole point.** Read the routing table, pick the ONE reference
> file that matches the request, and read only that file. Do not read the other reference files,
> and do not regenerate the entire README.

## When to use

Trigger when the user wants to add or refresh a specific part of a README, e.g.:

- `/SKILL.md update readme add \`npx skill add\` instruction`
- `/SKILL.md update readme with python environment setup`
- `/SKILL.md update readme with node environment setup`
- `/SKILL.md update readme with java environment setup`
- `/SKILL.md update readme with current github action integration setup`
- "update the readme usage section", "add CI badges to the readme"

Do **not** trigger for:

- Generating a brand-new README from nothing (use a README generator / `skill-repo-readme`).
- Editing docs that are not `README.md` (CHANGELOG, CONTRIBUTING, arbitrary `.md`).

## Section routing table

Match the request to exactly one row, then read only that reference file.

| If the request mentions…                                              | Read this reference                                            | Target `##` heading      |
|-----------------------------------------------------------------------|---------------------------------------------------------------|--------------------------|
| install, `npx skill add`, npm install, pip install, add a dependency  | [`references/installation.md`](references/installation.md)     | `## Installation`        |
| python env, venv, `requirements.txt`, `uv`, conda                     | [`references/environment-python.md`](references/environment-python.md) | `## Environment Setup` (Python) |
| node env, nvm, `package.json`, npm/pnpm/yarn scripts                  | [`references/environment-node.md`](references/environment-node.md)     | `## Environment Setup` (Node)   |
| java env, JDK, Maven, Gradle, `JAVA_HOME`                             | [`references/environment-java.md`](references/environment-java.md)     | `## Environment Setup` (Java)   |
| github action(s), CI, workflow, `.github/workflows`, pipeline         | [`references/github-actions.md`](references/github-actions.md) | `## CI / GitHub Actions` |
| usage, examples, how to run, quickstart, commands                     | [`references/usage.md`](references/usage.md)                   | `## Usage`               |
| badge(s), shields.io, status badge, coverage badge                   | [`references/badges.md`](references/badges.md)                 | (badge block, top of file) |

If the request is ambiguous or spans two rows, ask the user which section they mean before
reading anything. If it matches no row, read [`GIT_README_TEMPLATE.md`](GIT_README_TEMPLATE.md)
to see the full section list and ask which one to update.

## Execution workflow

### 1. Parse the request

Isolate the target section and the concrete payload (e.g. *Python 3.11 + `uv`*, *a `release.yml`
workflow*). Resolve the matching row in the routing table above.

### 2. Pull only the matching template (progressive disclosure)

Read the single routed `references/<section>.md`. Each reference file gives you four things:
the section **outline**, the **formatting example(s)**, the **injection rule** (where the section
goes and its anchor), and its **table-of-contents entry**. Do not read sibling reference files.

### 3. Read the current README

```bash
[ -f README.md ] && grep -n '^#' README.md   # list existing headings + TOC anchors
```

Locate the target heading. Note whether the section already exists (→ replace its body) or is
absent (→ insert it in canonical order per `GIT_README_TEMPLATE.md`).

### 4. Draft the section

Write the new markdown strictly in the shape the reference file specifies — same heading level,
same code-fence language tags, same tone. Fill in the user's specifics. Keep it scoped to the one
section; do not touch neighbouring content.

### 5. Inject, not regenerate

Use `Edit` to replace the existing section body **or** insert the new section at its canonical
position. Then reconcile the table of contents:

- If a `## Table of Contents` / `## Contents` block exists, add or update the one matching anchor
  link (lowercase, spaces→hyphens, punctuation stripped). Leave all other entries untouched.
- Never rewrite the whole file. Every unrelated section, badge, and link must survive byte-for-byte.

### 6. Verify

```bash
grep -n '^#' README.md          # confirm exactly the intended heading changed
git diff --stat README.md       # confirm only README.md is touched
```

The diff must be confined to the target section (plus at most one TOC line).

### 7. Deliver via git / gh — guardrails

Commit the change with standard git. Open a PR **only if the user asks** (`--pr`, "open a PR").
Full rules and the gh-enforcement rationale: [`references/git-delivery.md`](references/git-delivery.md).

- Use the **`gh` CLI** for every GitHub operation (`gh pr create`, `gh pr view`).
- **You are forbidden from using the `github-create_pull_request` MCP tool.** Native developer
  CLI tools only.
- Do not commit unrelated changes; stage `README.md` explicitly.

## Inputs

- `README.md` at the repo root (required; offer to scaffold from `GIT_README_TEMPLATE.md` if absent).
- [`GIT_README_TEMPLATE.md`](GIT_README_TEMPLATE.md) — canonical outline + routing index (bundled).
- [`references/`](references/) — one formatting+example file per section (bundled; load on demand).
- Authenticated `gh` CLI — only when the user requests a commit/PR.

## Output

End the turn with a short report:

```
## Progressive README Updater result

Section:   Environment Setup (Python)
Action:    inserted after ## Installation
Template:  references/environment-python.md
TOC:       added link [Environment Setup](#environment-setup)
Diff:      README.md  (+24 −0)
Delivery:  committed on branch readme/python-env   (no PR — not requested)
```
