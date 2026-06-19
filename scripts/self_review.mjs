import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const warnings = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function file(relativePath) {
  return path.join(root, relativePath);
}

function run(command, args, label) {
  try {
    execFileSync(command, args, {
      cwd: root,
      stdio: 'pipe',
      shell: false,
    });
    return true;
  } catch (error) {
    failures.push(`${label} failed:\n${String(error.stdout || '')}${String(error.stderr || '')}`);
    return false;
  }
}

function runNpm(args, label) {
  if (process.platform === 'win32') {
    return run('cmd.exe', ['/d', '/s', '/c', 'npm', ...args], label);
  }
  return run('npm', args, label);
}

check(existsSync(file('package.json')), 'package.json is missing');
check(existsSync(file('index.html')), 'index.html is missing');
check(existsSync(file('vite.config.mjs')), 'vite.config.mjs is missing');
check(existsSync(file('src/App.tsx')), 'src/App.tsx is missing');
check(existsSync(file('src/main.tsx')), 'src/main.tsx is missing');
check(existsSync(file('src-tauri/tauri.conf.json')), 'Tauri config is missing');
check(existsSync(file('src-tauri/Cargo.toml')), 'Cargo.toml is missing');
check(existsSync(file('README.md')), 'README.md is missing');
check(existsSync(file('docs/ARCHITECTURE.md')), 'ARCHITECTURE.md is missing');
check(
  existsSync(file('docs/ROCKET_FRONTEND_INVENTORY.md')),
  'ROCKET_FRONTEND_INVENTORY.md is missing'
);
check(existsSync(file('docs/PRODUCT_REVIEW.md')), 'PRODUCT_REVIEW.md is missing');
check(existsSync(file('docs/KNOWN_LIMITATIONS.md')), 'KNOWN_LIMITATIONS.md is missing');
check(existsSync(file('docs/ROADMAP.md')), 'ROADMAP.md is missing');
check(existsSync(file('docs/RELEASE_CHECKLIST.md')), 'RELEASE_CHECKLIST.md is missing');
check(existsSync(file('docs/INSTALL_TEST_MATRIX.md')), 'INSTALL_TEST_MATRIX.md is missing');
check(existsSync(file('docs/KNOWN_ALPHA_LIMITATIONS.md')), 'KNOWN_ALPHA_LIMITATIONS.md is missing');
check(existsSync(file('docs/MULTI_AGENT_EXECUTION.md')), 'MULTI_AGENT_EXECUTION.md is missing');
check(existsSync(file('docs/AGENT_DEPLOYMENT_UX.md')), 'AGENT_DEPLOYMENT_UX.md is missing');
check(existsSync(file('docs/DEPLOYMENT_PREFLIGHT_QA.md')), 'DEPLOYMENT_PREFLIGHT_QA.md is missing');
check(
  existsSync(file('docs/RUN_MODE_PROPAGATION_QA.md')),
  'RUN_MODE_PROPAGATION_QA.md is missing'
);
check(
  existsSync(file('docs/ENVIRONMENT_BLOCKER_QA.md')),
  'ENVIRONMENT_BLOCKER_QA.md is missing'
);
check(
  existsSync(file('docs/AGENT_RESULT_REVIEW_QA.md')),
  'AGENT_RESULT_REVIEW_QA.md is missing'
);
check(
  existsSync(file('docs/GITHUB_SKILLS_MARKETPLACE.md')),
  'GITHUB_SKILLS_MARKETPLACE.md is missing'
);

const packageJson = JSON.parse(readFileSync(file('package.json'), 'utf8'));
const releaseVersion = '0.1.0-alpha';
const windowsBundleVersion = '0.1.0-1';
check(packageJson.version === releaseVersion, `package.json version must be ${releaseVersion}`);
for (const script of ['dev', 'build', 'tauri', 'windows:run', 'windows:build', 'self_review']) {
  check(Boolean(packageJson.scripts?.[script]), `package.json script "${script}" is missing`);
}

try {
  const tauriConfig = JSON.parse(readFileSync(file('src-tauri/tauri.conf.json'), 'utf8'));
  check(
    tauriConfig.version === windowsBundleVersion,
    `tauri.conf.json version must be ${windowsBundleVersion} for MSI compatibility`
  );
} catch (error) {
  failures.push(`tauri.conf.json is invalid JSON: ${error.message}`);
}

const cargoToml = readFileSync(file('src-tauri/Cargo.toml'), 'utf8');
check(
  /^version = "0\.1\.0-alpha"$/m.test(cargoToml),
  `Cargo.toml version must be ${releaseVersion}`
);

const appSource = readFileSync(file('src/App.tsx'), 'utf8');
check(
  appSource.includes(`const APP_VERSION = '${releaseVersion}'`),
  `App UI version must be ${releaseVersion}`
);
const promptSource = readFileSync(file('src/lib/prompt.ts'), 'utf8');
check(
  promptSource.includes('Skill source: GitHub import from'),
  'GitHub skill prompt provenance is missing'
);
check(
  promptSource.includes("skill.trustState === 'reviewed'") &&
    promptSource.includes("skill.trustState === 'trusted'"),
  'GitHub skill prompt trust gate is missing'
);

const expectedCommands = [
  'add_workspace',
  'accept_agent_review',
  'bootstrap',
  'clear_session_history',
  'create_worktree',
  'detect_agents',
  'export_diagnostics',
  'get_agent_review',
  'git_status',
  'github_marketplace_install',
  'github_marketplace_preview',
  'github_marketplace_rate_limit',
  'github_marketplace_search',
  'github_marketplace_set_trust',
  'github_marketplace_uninstall',
  'github_marketplace_update',
  'list_agent_profiles',
  'list_agent_reviews',
  'list_deployments',
  'list_sessions',
  'load_workspace',
  'open_logs_folder',
  'open_review_file',
  'open_review_folder',
  'open_sample_workspace',
  'open_skill_folder',
  'read_file',
  'run_agent',
  'run_multi_agent_smoke_test',
  'save_agent_profile',
  'save_deployment',
  'save_github_token',
  'scan_workspace',
  'reveal_review_file',
  'revert_agent_review',
  'clear_github_token',
  'delete_agent_profile',
  'delete_deployment',
  'deployment_preflight',
  'stop_session',
  'update_deployment',
].sort();
const frontendCommands = [
  ...readFileSync(file('src/lib/tauri.ts'), 'utf8').matchAll(
    /invokeCommand(?:<[^>]+>)?\(\s*'([^']+)'/g
  ),
]
  .map((match) => match[1])
  .sort();
const rustSource = readFileSync(file('src-tauri/src/lib.rs'), 'utf8');
const handlerBlock = rustSource.match(/tauri::generate_handler!\[([\s\S]*?)\]\)/)?.[1] ?? '';
const rustCommands = handlerBlock
  .split(',')
  .map((command) => command.trim())
  .filter(Boolean)
  .sort();
check(
  JSON.stringify(frontendCommands) === JSON.stringify(expectedCommands),
  `Frontend command contract drifted: ${frontendCommands.join(', ')}`
);
check(
  JSON.stringify(rustCommands) === JSON.stringify(expectedCommands),
  `Rust command contract drifted: ${rustCommands.join(', ')}`
);

try {
  const samplePipeline = JSON.parse(
    readFileSync(file('sample-workspace/.agentboard/pipelines.json'), 'utf8')
  );
  check(Array.isArray(samplePipeline.pipelines), 'sample pipelines JSON has no pipelines array');
  check(
    samplePipeline.pipelines[0]?.nodes?.length >= 6,
    'sample pipeline should include at least 6 nodes'
  );
} catch (error) {
  failures.push(`sample pipelines JSON is invalid: ${error.message}`);
}

const cargoCommand = process.platform === 'win32' ? 'cargo.exe' : 'cargo';

runNpm(['run', 'type-check'], 'TypeScript compile');
runNpm(['run', 'build'], 'Frontend build');
runNpm(
  ['run', 'test:github-marketplace-rate-limit'],
  'GitHub marketplace rate-limit UX tests'
);
runNpm(['run', 'test:run-mode-propagation'], 'Run mode propagation tests');
runNpm(['run', 'test:environment-blocker'], 'Environment blocker UI/state tests');

try {
  execFileSync(cargoCommand, ['--version'], { stdio: 'pipe', shell: false });
} catch {
  warnings.push('Cargo is not available; Tauri Rust build was not verified on this machine.');
}

if (warnings.length) {
  console.log('Warnings:');
  for (const item of warnings) console.log(`- ${item}`);
}

if (failures.length) {
  console.error('Self review failed:');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Self review passed.');
