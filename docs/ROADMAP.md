# Roadmap

## Near Term

- Add configurable agent invocation templates per workspace.
- Persist enabled skills per queue item and session.
- Persist queue state under `.agentboard/sessions`.
- Add richer diff viewer with file-level hunks.
- Add explicit prompt approval before shell agents run.

## Desktop Hardening

- Add Windows ConPTY terminal embedding.
- Track subprocess status in persistent session files.
- Add structured JSONL log format.
- Add safe task cancellation and restart.
- Add long-path normalization tests on Windows.

## Collaboration

- Add review comments under `.agentboard/reviews`.
- Generate PR branch names and PR descriptions from completed sessions.
- Add GitHub integration only after explicit user credential approval.

## Skills

- Add review-only GitHub skill search.
- Add skill diff/review modal before local installation.
- Add per-agent compatibility warnings.
- Add skill provenance and checksum metadata.
