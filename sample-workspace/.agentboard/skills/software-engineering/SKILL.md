# Software Engineering Debugger

Use this skill when a task spans multiple files, a pipeline node is broken or partial, or a UI appears complete but the underlying behavior is not wired.

Workflow:

1. Inspect the existing code before editing.
2. Trace the user-facing action to the actual handler, data source, process, or route.
3. Prefer a small real fix over a broad visual rewrite.
4. Remove placeholder, fake, skipped, or mock behavior only when the real replacement is implemented.
5. Verify with the narrowest meaningful command available in the repository.
6. Summarize changed files, verification, and residual risk.
