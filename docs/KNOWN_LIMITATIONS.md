# Known Limitations

- Rust and the Tauri CLI must be installed before `npm run tauri dev` or `npm run tauri build` can run.
- Agent CLI invocation flags differ by version. Current defaults are:
  - `claude --print <prompt>`
  - `codex exec <prompt>`
  - `gemini -p <prompt>`
  - `aider --message <prompt>`
  - `powershell -NoProfile -ExecutionPolicy Bypass -Command <prompt>`
  - `cmd /C <prompt>`
- The v1 log panel is not a full terminal.
- Stopping a session uses process termination, not graceful in-process cancellation.
- GitHub remote skill search and installation are intentionally disabled.
- Broken import detection is a lightweight heuristic.
- Tauri build was scaffolded, but local verification depends on Rust/Cargo being available on the machine.
