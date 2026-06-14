import type {
  AgentProfile,
  DeploymentRunMode,
  DeploymentTarget,
  AgentId,
  Pipeline,
  PipelineNode,
  RealityIssue,
  SkillInfo,
  WorkspaceSummary,
} from './types';

interface PromptInput {
  workspace: WorkspaceSummary;
  pipeline: Pipeline;
  node: PipelineNode;
  agent: AgentId;
  skills: SkillInfo[];
  includeRealityScan: boolean;
  scanIssues: RealityIssue[];
}

function skillCanInject(skill: SkillInfo) {
  return (
    skill.manifest.source !== 'github' ||
    skill.trustState === 'reviewed' ||
    skill.trustState === 'trusted'
  );
}

function skillPromptText(skill: SkillInfo) {
  const sourceLine =
    skill.manifest.source === 'github' && skill.repoFullName
      ? `\nSkill source: GitHub import from ${skill.repoFullName}`
      : '\nSkill source: Local workspace skill';
  return `## Skill: ${skill.manifest.title}${sourceLine}\n${
    skill.markdown.trim() || skill.description
  }`;
}

export function generateAgentPrompt({
  workspace,
  pipeline,
  node,
  agent,
  skills,
  includeRealityScan,
  scanIssues,
}: PromptInput) {
  const enabledSkills = skills.filter(
    (skill) =>
      skill.enabled &&
      skillCanInject(skill) &&
      (!skill.manifest.compatible_agents?.length ||
        skill.manifest.compatible_agents.includes(agent))
  );
  const concernedFiles = node.files.length
    ? node.files
        .map((file) => {
          const lineRange =
            file.startLine && file.endLine ? ` lines ${file.startLine}-${file.endLine}` : '';
          return `- ${file.path}${lineRange}: ${file.reason || 'Relevant to this pipeline node'}`;
        })
        .join('\n')
    : '- No concerned files were declared. Inspect the codebase to discover the right files.';

  const issues = node.issues.length
    ? node.issues.map((issue) => `- ${issue}`).join('\n')
    : '- No explicit issues were listed. Verify behavior against the pipeline status.';

  const checks = node.checks.length
    ? node.checks.map((check) => `- [${check.status}] ${check.name}: ${check.message}`).join('\n')
    : '- No checks were listed.';

  const skillText = enabledSkills.length
    ? enabledSkills.map(skillPromptText).join('\n\n')
    : 'No local skills were enabled for this task.';

  const scanText =
    includeRealityScan && scanIssues.length
      ? scanIssues
          .slice(0, 40)
          .map(
            (issue) =>
              `- [${issue.severity}] ${issue.file}:${issue.line} ${issue.pattern}: ${issue.snippet}`
          )
          .join('\n')
      : 'No reality scanner results attached.';

  return `You are working in the local workspace below. Inspect the code before editing.

Workspace path:
${workspace.path}

Pipeline:
- Name: ${pipeline.name}
- Node: ${node.label}
- Node id: ${node.id}
- Status: ${node.status}

Concerned files:
${concernedFiles}

Known issues:
${issues}

Checks:
${checks}

Enabled local skills:
${skillText}

Reality scanner findings:
${scanText}

Expected behavior:
- Fix this pipeline node in real code, not just the UI presentation.
- Avoid fake/mock/demo-only fixes unless the pipeline explicitly asks for a visual-only prototype.
- Do not paper over errors with placeholders, hardcoded fake data, skipped tests, or silent fallbacks.
- Preserve existing architecture and project conventions.
- Keep edits scoped to the files needed for this node.
- If a concerned file is missing, inspect the workspace and explain what replacement file is relevant.
- Run the smallest meaningful verification available in this repo.

When finished, summarize:
1. Changed files.
2. What behavior changed.
3. Verification commands and results.
4. Any remaining risks or follow-up work.`;
}

interface DeploymentPromptInput {
  workspace: WorkspaceSummary;
  target: DeploymentTarget;
  profile: AgentProfile;
  task: string;
  runMode: DeploymentRunMode;
  selectedSkillNames: string[];
  installedSkills: SkillInfo[];
  pipeline?: Pipeline;
  node?: PipelineNode;
  scanIssues: RealityIssue[];
}

export function generateDeploymentPrompt({
  workspace,
  target,
  profile,
  task,
  runMode,
  selectedSkillNames,
  installedSkills,
  pipeline,
  node,
  scanIssues,
}: DeploymentPromptInput) {
  if (profile.provider === 'powershell') {
    return task.trim() || 'Get-ChildItem -Force | Select-Object Name, Mode, Length';
  }
  if (profile.provider === 'cmd') {
    return task.trim() || 'dir /a';
  }

  const compatibleSkills = installedSkills.filter(
    (skill) =>
      selectedSkillNames.includes(skill.name) &&
      skillCanInject(skill) &&
      (!skill.manifest.compatible_agents?.length ||
        (profile.provider !== 'custom' &&
          skill.manifest.compatible_agents.includes(profile.provider)))
  );
  const skillText = compatibleSkills.length
    ? compatibleSkills.map(skillPromptText).join('\n\n')
    : 'No compatible local skills selected.';

  const targetScope =
    target.targetType === 'workspace'
      ? `Scope: the entire workspace at ${workspace.path}.`
      : target.targetType === 'folder'
        ? `Scope: only the folder ${target.targetPath}. Do not edit outside this folder unless the user explicitly expands scope.`
        : target.targetType === 'file'
          ? `Scope: only the file ${target.targetPath}. Do not edit other files unless the user explicitly expands scope.`
          : `Scope: only the concerned files declared for pipeline node ${target.nodeName ?? target.targetLabel}. Do not expand beyond those files unless the user explicitly approves it.`;

  const nodeContext =
    target.targetType === 'pipeline_node' && pipeline && node
      ? `
Pipeline:
- Name: ${pipeline.name}
- Node: ${node.label}
- Node id: ${node.id}
- Status: ${node.status}

Concerned files:
${
  node.files.length
    ? node.files
        .map((file) => `- ${file.path}: ${file.reason || 'Relevant to this pipeline node'}`)
        .join('\n')
    : '- No concerned files declared. Stop and report that the node scope is incomplete before editing.'
}

Known issues:
${
  node.issues.length
    ? node.issues.map((issue) => `- ${issue}`).join('\n')
    : '- No explicit issues listed.'
}

Checks:
${
  node.checks.length
    ? node.checks.map((check) => `- [${check.status}] ${check.name}: ${check.message}`).join('\n')
    : '- No checks listed.'
}

Scanner findings for concerned files:
${
  scanIssues.length
    ? scanIssues
        .slice(0, 40)
        .map(
          (issue) =>
            `- [${issue.severity}] ${issue.file}:${issue.line} ${issue.pattern}: ${issue.snippet}`
        )
        .join('\n')
    : '- No matching scanner findings attached.'
}`
      : '';

  const modeInstructions =
    runMode === 'inspect_only'
      ? `Run mode: inspect only.
- Inspect the declared target and report findings.
- Do not create, edit, rename, or delete files.
- Do not wait for an additional task; the inspection itself is the task.`
      : `Run mode: edit.
- Inspect the declared target before editing.
- Implement the concrete user task within scope.
- You may edit files allowed by the profile and sandbox.`;

  return `You are deployed by AgentBoard.

${modeInstructions}

Agent profile:
- Name: ${profile.name}
- Provider: ${profile.provider}
- Model/profile: ${profile.model || 'default CLI configuration'}
- Effort: ${profile.effort}

Workspace path:
${workspace.path}

Deployment target:
- Type: ${target.targetType}
- Label: ${target.targetLabel}
- Path: ${target.targetPath}

${targetScope}
${nodeContext}

User task:
${task.trim() || 'Inspect the target and report its current state without editing.'}

Enabled compatible skills:
${skillText}

Required behavior:
- Inspect the relevant code and metadata before taking action.
- Stay inside the declared deployment scope.
- Avoid fake, mock, placeholder, or UI-only fixes unless explicitly requested.
- Preserve existing architecture and project conventions.
- Do not hide backend errors or claim verification that was not performed.
- Respect the profile permissions: readFiles=${profile.permissions.readFiles}, writeFiles=${profile.permissions.writeFiles}, runShell=${profile.permissions.runShell}, network=${profile.permissions.network}.
- If the task requires a disallowed permission, stop and report the requirement.
- Run the smallest meaningful verification allowed by the profile and run mode.

When finished, report:
1. Files changed.
2. Behavior changed.
3. Verification commands and results.
4. Remaining limitations or risks.`;
}
