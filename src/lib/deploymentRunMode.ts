import type {
  AgentIsolationMode,
  AgentProfile,
  DeploymentRunMode,
} from './types';

export interface DeploymentDraft {
  profile: AgentProfile;
  task: string;
  selectedSkills: string[];
  isolationMode: AgentIsolationMode;
  runMode: DeploymentRunMode;
  runNow: boolean;
}

export function buildDeploymentDraft(input: DeploymentDraft): DeploymentDraft {
  return {
    profile: input.profile,
    task: input.task,
    selectedSkills: [...input.selectedSkills],
    isolationMode: input.isolationMode,
    runMode: input.runMode,
    runNow: input.runNow,
  };
}

export function taskRequiresEditMode(task: string) {
  return task
    .split(/[^a-zA-Z0-9_]+/)
    .filter(Boolean)
    .some((word) =>
      [
        'build',
        'create',
        'fix',
        'implement',
        'generate',
        'write',
        'add',
        'change',
        'update',
        'develop',
        'refactor',
      ].includes(word.toLowerCase())
    );
}

export function deploymentDraftFingerprint(draft: DeploymentDraft) {
  return JSON.stringify({
    profileId: draft.profile.id,
    provider: draft.profile.provider,
    writeFiles: draft.profile.permissions.writeFiles,
    task: draft.task,
    selectedSkills: [...draft.selectedSkills].sort(),
    isolationMode: draft.isolationMode,
    runMode: draft.runMode,
    runNow: draft.runNow,
  });
}
