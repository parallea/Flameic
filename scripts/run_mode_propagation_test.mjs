import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

function loadTypeScriptModule(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
    },
  }).outputText;
  const module = { exports: {} };
  const require = createRequire(import.meta.url);
  new Function('require', 'module', 'exports', output)(require, module, module.exports);
  return module.exports;
}

const {
  buildDeploymentDraft,
  deploymentDraftFingerprint,
  taskRequiresEditMode,
} = loadTypeScriptModule('../src/lib/deploymentRunMode.ts');
const { generateDeploymentPrompt } = loadTypeScriptModule('../src/lib/prompt.ts');

const profile = {
  id: 'profile-edit',
  name: 'Edit profile',
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
const workspace = {
  id: 'workspace-run-mode',
  name: 'Run Mode',
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

const editDraft = buildDeploymentDraft({
  profile,
  task: 'build calculator for windows',
  selectedSkills: [],
  isolationMode: 'same_workspace',
  runMode: 'edit',
  runNow: true,
});
if (editDraft.runMode !== 'edit') {
  throw new Error('Edit selection was not preserved in the deployment draft payload.');
}
if (
  deploymentDraftFingerprint(editDraft) ===
  deploymentDraftFingerprint({ ...editDraft, runMode: 'inspect_only' })
) {
  throw new Error('Preflight fingerprint does not distinguish edit and inspect-only modes.');
}
if (!taskRequiresEditMode(editDraft.task)) {
  throw new Error('Build task was not recognized as requiring edit mode.');
}

const editPrompt = generateDeploymentPrompt({
  workspace,
  target,
  profile,
  task: editDraft.task,
  runMode: editDraft.runMode,
  selectedSkillNames: [],
  installedSkills: [],
  scanIssues: [],
});
if (!editPrompt.includes('Run mode: edit.')) {
  throw new Error('Edit prompt does not declare edit mode.');
}
if (
  !editPrompt.includes(
    'You may create and edit files inside the declared target scope'
  )
) {
  throw new Error('Edit prompt does not explicitly permit scoped file creation/editing.');
}
if (editPrompt.includes('Do not create, edit, rename, or delete files.')) {
  throw new Error('Edit prompt contains inspect-only prohibition text.');
}

const inspectPrompt = generateDeploymentPrompt({
  workspace,
  target,
  profile,
  task: editDraft.task,
  runMode: 'inspect_only',
  selectedSkillNames: [],
  installedSkills: [],
  scanIssues: [],
});
if (!inspectPrompt.includes('Run mode: inspect only.')) {
  throw new Error('Inspect prompt does not declare inspect-only mode.');
}
if (!inspectPrompt.includes('Do not create, edit, rename, or delete files.')) {
  throw new Error('Inspect prompt does not prohibit file edits.');
}

const modalSource = readFileSync(
  new URL('../src/components/deployment/DeploymentModals.tsx', import.meta.url),
  'utf8'
);
for (const requiredText of [
  'This is an inspect-only run. It will not create or edit files.',
  'Switch to Edit mode',
  'Continue inspect-only',
  "['May create/edit files', runMode === 'edit' ? 'Yes' : 'No']",
  'preflight?.requestedRunMode === currentDraft.runMode',
  'Generated prompt preview',
]) {
  if (!modalSource.includes(requiredText)) {
    throw new Error(`Deployment modal run-mode guard is missing: ${requiredText}`);
  }
}

console.log('Run mode propagation tests passed.');
