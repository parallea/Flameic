# Environment Blocker QA

Date: June 18, 2026

## Root Cause

AgentBoard previously derived terminal status from process exit plus run mode:

- successful edit process -> `completed`;
- successful inspect process -> `completed_inspection`;
- non-zero process -> `failed`.

Codex can exit successfully after correctly reporting that it cannot proceed because a required
external toolchain is missing. The reported WinUI run therefore looked like a completed AgentBoard
run even though no project was created.

## New Classification

After stdout/stderr readers finish, AgentBoard reads the durable session log and checks for
specific environment/toolchain blockers. A match overrides exit-based completion with:

```text
blocked_environment
```

The session stores:

- blocker code;
- missing tool/template;
- user-readable cause;
- suggested next action;
- explicit fallback options.

Classification is also applied when restoring completed sessions from logs.

Covered patterns:

- WinGet not recognized or not found;
- `No templates found matching: 'winui'`;
- .NET first-run or user-directory access errors;
- missing .NET/Windows SDK, workload, template, or MSBuild component;
- Visual Studio or required workload not found;
- setup blocked by elevation, permissions, or sandbox restrictions.

Generic application/test failures remain `failed`.

## UI Guidance

Deployment and session inspectors display the provider, missing tool/template, cause, and next
action. They also present:

1. Retry after installing WinUI tooling.
2. Build a simpler HTML/CSS/JS desktop prototype.
3. Build WPF if templates are available.
4. Run an environment audit only.

These are choices, not automatic framework changes.

## Windows App Preflight

Tasks containing `Windows app`, `WinUI`, `desktop app`, or `calculator for Windows` trigger
non-mutating readiness checks:

```text
dotnet --info
dotnet new list winui
```

When a selected skill is WinUI-specific, preflight also checks:

```text
winget --version
```

Missing tools normally warn that file creation may be blocked. If an Edit run explicitly selects
a WinUI skill and the WinUI project template is unavailable, preflight blocks the run with
fallback guidance.

## Tests

Rust `environment_blocker_classification_flow` verifies:

- WinGet missing -> `missing_winget`;
- WinUI template missing -> `missing_winui_template`;
- .NET unauthorized first-run -> `dotnet_first_run_access`;
- SDK/workload/template missing;
- Visual Studio workload missing;
- setup permission/elevation blocker;
- successful process log overridden to `blocked_environment`;
- generic non-zero process remains `failed`.

`npm run test:environment-blocker` verifies the TypeScript status contract and required inspector
guidance.

## Safe Tester Tasks

To verify AgentBoard Edit mode without WinUI prerequisites:

```text
Create calculator-smoke.txt containing Calculator App.
```

Or:

```text
Create a simple calculator web app with index.html, style.css, and app.js.
```

## Remaining Limitations

- Pattern matching cannot anticipate every third-party CLI message.
- Readiness checks do not prove that XAML compilation, deployment, or app launch will succeed.
- WinGet is optional for manual Visual Studio Installer remediation, but it is checked when the
  selected WinUI setup workflow expects it.
