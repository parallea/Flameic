# Prompt Transport QA

Date: June 18, 2026

## Root Cause

`run_agent` passed the full generated prompt as the final `codex exec` argument. On Windows the
resolved `codex.cmd` launch crosses `cmd.exe` command-line limits when imported skills make the
prompt large. Session metadata also serialized the prompt into logs.

## Implemented Contract

- Every session writes UTF-8 prompt metadata and full instructions to
  `<execution-workspace>\.agentboard\prompts\<session-id>.md`.
- Codex always receives a short bootstrap that references the relative prompt file.
- Codex sandbox flags remain `read-only` for inspect-only and `workspace-write` for edit.
- Other conversational providers switch to file transport above 6,000 characters, above 12,000
  UTF-8 bytes, or when a selected GitHub skill is present.
- Oversized PowerShell and Command Prompt tasks use `.ps1`/`.cmd` files.
- Logs contain prompt path and size/count metadata, not prompt text or prompt-bearing argv.
- Restored sessions reload prompt text from the prompt file.
- Known GitHub token prefixes are redacted before prompt files are written.
- Diagnostics do not enumerate or include prompt files.

No selected skill is omitted for size. File transport removes the command-line budget constraint.
Exact duplicate skill name/source pairs are injected once with a visible warning. Skills sharing a
display title retain installed-name, repository, and candidate-path provenance.

## Automated Verification

Passed:

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

Focused Rust tests cover:

- oversized Codex argv exclusion and prompt-file creation;
- large GitHub skill transport and duplicate metric/content guards;
- GitHub token redaction;
- inspect-only/build-task preflight warning;
- diagnostics prompt privacy.

## Live Verification

One live Codex request was run through `run_agent_core` with:

- an oversized reviewed GitHub `superpowers` fixture;
- inspect-only mode;
- `--sandbox read-only`;
- a short bootstrap referencing `.agentboard/prompts/<session-id>.md`.

Result: Codex launched, read the prompt file, returned `AGENTBOARD_PROMPT_FILE_OK`, completed as
`completed_inspection`, and the log did not contain `The command line is too long` or the full
skill content.

## Remaining Limitations

- Prompt files are intentionally durable and are not automatically age-pruned.
- Live file-transport verification was performed for Codex only.
- Maximum prompt size is bounded by available memory and filesystem capacity rather than an
  AgentBoard hard limit.
