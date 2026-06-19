import { readFileSync } from 'node:fs';

const typesSource = readFileSync(new URL('../src/lib/types.ts', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const rustSource = readFileSync(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');

for (const required of [
  "'blocked_environment'",
  'export interface EnvironmentBlocker',
  'environmentBlocker?: EnvironmentBlocker',
]) {
  if (!typesSource.includes(required)) {
    throw new Error(`Environment blocker type contract is missing: ${required}`);
  }
}

for (const required of [
  'Environment setup blocked the run',
  'Missing tool/template:',
  'blocker.fallbackOptions.map',
  'AgentBoard will not switch frameworks automatically.',
]) {
  if (!appSource.includes(required)) {
    throw new Error(`Environment blocker UI guidance is missing: ${required}`);
  }
}

for (const required of [
  '"missing_winget"',
  '"missing_winui_template"',
  '"dotnet_first_run_access"',
  '"blocked_environment"',
  '"winui_template_missing"',
  'Retry after installing the required WinUI tooling.',
  'Build a simpler HTML/CSS/JS desktop prototype instead.',
  'Build a WPF app if the WPF templates are available.',
  'Run an environment audit only.',
]) {
  if (!rustSource.includes(required)) {
    throw new Error(`Environment blocker backend classification is missing: ${required}`);
  }
}

console.log('Environment blocker UI/state tests passed.');
