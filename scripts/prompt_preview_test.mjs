import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/prompt.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2021,
  },
}).outputText;

const module = { exports: {} };
const require = createRequire(import.meta.url);
new Function('require', 'module', 'exports', output)(require, module, module.exports);

const { generateDeploymentPrompt } = module.exports;
const workspace = {
  id: 'workspace-test',
  name: 'Prompt Preview',
  path: 'C:\\workspace',
  exists: true,
  hasAgentboard: true,
  pipelineCount: 0,
  nodeCount: 0,
};
const target = {
  targetType: 'workspace',
  workspacePath: workspace.path,
  targetPath: workspace.path,
  targetLabel: workspace.name,
};
const profile = {
  id: 'profile-test',
  name: 'Preview Codex',
  provider: 'codex',
  model: 'default',
  effort: 'medium',
  defaultSkills: [],
  permissions: {
    readFiles: true,
    writeFiles: true,
    runShell: true,
    network: false,
  },
  isolationMode: 'same_workspace',
  description: '',
  createdAt: '0',
  updatedAt: '0',
};
const baseSkill = {
  name: 'github-review-skill',
  title: 'GitHub Review Skill',
  description: 'Review instructions',
  path: 'C:\\workspace\\.agentboard\\skills\\github-review-skill',
  manifest: {
    name: 'github-review-skill',
    title: 'GitHub Review Skill',
    description: 'Review instructions',
    categories: ['github', 'imported'],
    compatible_agents: ['codex'],
    version: '0.1.0',
    source: 'github',
    permissions: { filesystem: 'read', shell: false, network: false },
  },
  markdown: 'Inspect changed files and report verification.',
  enabled: true,
  repoFullName: 'example/github-review-skill',
  sourceUrl: 'https://github.com/example/github-review-skill',
  sourceContentKind: 'formal_skill',
};

const trustedPrompt = generateDeploymentPrompt({
  workspace,
  target,
  profile,
  task: 'Review the workspace.',
  runMode: 'inspect_only',
  selectedSkillNames: [baseSkill.name],
  installedSkills: [{ ...baseSkill, trustState: 'reviewed' }],
  scanIssues: [],
});
if (!trustedPrompt.includes('Inspect changed files and report verification.')) {
  throw new Error('Reviewed GitHub skill content was not injected.');
}
if (
  !trustedPrompt.includes(
    'Skill source: GitHub import from example/github-review-skill'
  )
) {
  throw new Error('GitHub source provenance line was not injected.');
}
if (!trustedPrompt.includes('sourceContentKind: formal_skill')) {
  throw new Error('GitHub source content kind was not injected.');
}
if (!trustedPrompt.includes('Installed skill name: github-review-skill')) {
  throw new Error('Installed skill provenance was not included.');
}

const largeSkillContent = `LARGE_SKILL_MARKER\n${'Follow the imported workflow exactly.\n'.repeat(900)}`;
const largeSkill = {
  ...baseSkill,
  name: 'superpowers',
  manifest: {
    ...baseSkill.manifest,
    name: 'superpowers',
    title: 'superpowers',
  },
  repoFullName: 'example/superpowers',
  sourceCandidatePath: 'skills/superpowers',
  markdown: largeSkillContent,
  trustState: 'reviewed',
};
const largeGithubPrompt = generateDeploymentPrompt({
  workspace,
  target,
  profile,
  task: 'Inspect the workspace.',
  runMode: 'inspect_only',
  selectedSkillNames: [largeSkill.name],
  installedSkills: [largeSkill, { ...largeSkill }],
  scanIssues: [],
});
if ((largeGithubPrompt.match(/LARGE_SKILL_MARKER/g) ?? []).length !== 1) {
  throw new Error('Duplicate GitHub skill content was injected more than once.');
}
if (!largeGithubPrompt.includes('Duplicate selected skill sources were not injected twice')) {
  throw new Error('Duplicate skill omission warning was not included.');
}
if (
  !largeGithubPrompt.includes(
    'Skill source: GitHub import from example/superpowers at skills/superpowers'
  )
) {
  throw new Error('Duplicate display-name provenance was not clear.');
}

const inspectBuildPrompt = generateDeploymentPrompt({
  workspace,
  target,
  profile,
  task: 'Build a calculator application for Windows.',
  runMode: 'inspect_only',
  selectedSkillNames: [],
  installedSkills: [],
  scanIssues: [],
});
if (!inspectBuildPrompt.includes('Treat any request to build, create, fix, or implement')) {
  throw new Error('Inspect-only build mismatch instructions were not included.');
}
if (inspectBuildPrompt.includes('Implement the concrete user task within scope.')) {
  throw new Error('Inspect-only prompt still asks the agent to implement the task.');
}

const untrustedPrompt = generateDeploymentPrompt({
  workspace,
  target,
  profile,
  task: 'Review the workspace.',
  runMode: 'inspect_only',
  selectedSkillNames: [baseSkill.name],
  installedSkills: [{ ...baseSkill, trustState: 'untrusted' }],
  scanIssues: [],
});
if (untrustedPrompt.includes('Inspect changed files and report verification.')) {
  throw new Error('Untrusted GitHub skill content entered the prompt.');
}

console.log(
  'Prompt preview passed: provenance, duplicate large-skill guard, inspect-only consistency, and trust gating verified.'
);
