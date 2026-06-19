import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  FileCode,
  Folder,
  GitBranch,
  Layers3,
  Loader2,
  Plus,
  Shield,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  buildDeploymentDraft,
  deploymentDraftFingerprint,
  taskRequiresEditMode,
  type DeploymentDraft,
} from '../../lib/deploymentRunMode';
import type {
  AgentEffort,
  AgentIsolationMode,
  AgentProfile,
  AgentProvider,
  DeploymentPreflightResult,
  DeploymentRunMode,
  DeploymentTarget,
  SkillInfo,
} from '../../lib/types';

const providerLabels: Record<AgentProvider, string> = {
  codex: 'Codex',
  claude: 'Claude',
  gemini: 'Gemini',
  aider: 'Aider',
  powershell: 'PowerShell',
  cmd: 'CMD',
  custom: 'Custom',
};

const modelSuggestions: Record<AgentProvider, string[]> = {
  codex: ['GPT-5.5', 'GPT-5.4'],
  claude: ['Opus', 'Sonnet'],
  gemini: ['Gemini CLI'],
  aider: ['Aider default'],
  powershell: ['Command profile'],
  cmd: ['Command profile'],
  custom: [],
};

function nowTimestamp() {
  return String(Date.now());
}

function newProfile(provider: AgentProvider = 'codex'): AgentProfile {
  const timestamp = nowTimestamp();
  return {
    id: `profile-${timestamp}`,
    name: '',
    provider,
    model: modelSuggestions[provider][0] ?? '',
    effort: 'high',
    defaultSkills: [],
    permissions: {
      readFiles: true,
      writeFiles: true,
      runShell: true,
      network: false,
    },
    isolationMode: 'worktree_per_deployment',
    description: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function CreateAgentModal({
  open,
  initialProfile,
  skills,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  initialProfile?: AgentProfile | null;
  skills: SkillInfo[];
  busy: boolean;
  onClose: () => void;
  onSave: (profile: AgentProfile) => Promise<void>;
}) {
  const [profile, setProfile] = useState<AgentProfile>(() => newProfile());

  useEffect(() => {
    if (!open) return;
    setProfile(
      initialProfile
        ? { ...initialProfile, permissions: { ...initialProfile.permissions } }
        : newProfile()
    );
  }, [initialProfile, open]);

  if (!open) return null;

  const setProvider = (provider: AgentProvider) => {
    setProfile((current) => ({
      ...current,
      provider,
      model: modelSuggestions[provider][0] ?? current.model,
      updatedAt: nowTimestamp(),
    }));
  };

  const toggleSkill = (skillName: string) => {
    setProfile((current) => ({
      ...current,
      defaultSkills: current.defaultSkills.includes(skillName)
        ? current.defaultSkills.filter((name) => name !== skillName)
        : [...current.defaultSkills, skillName],
      updatedAt: nowTimestamp(),
    }));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="surface-card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden shadow-card">
        <header className="flex items-start justify-between border-b border-subtle px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {initialProfile ? 'Edit agent profile' : 'Create Agent'}
            </p>
            <p className="mt-1 text-2xs text-muted-foreground">
              Profiles configure deployments. Execution still requires the provider CLI locally.
            </p>
          </div>
          <button onClick={onClose} className="rocket-icon-button" aria-label="Close Create Agent">
            <X size={14} />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Agent name
            <input
              autoFocus
              value={profile.name}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  name: event.target.value,
                  updatedAt: nowTimestamp(),
                }))
              }
              placeholder="Calculator Builder Agent"
              className="mt-1 w-full rounded border border-subtle bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Provider
            <select
              value={profile.provider}
              onChange={(event) => setProvider(event.target.value as AgentProvider)}
              className="mt-1 w-full rounded border border-subtle bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            >
              {Object.entries(providerLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Model / profile string
            <input
              value={profile.model}
              list={`models-${profile.provider}`}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  model: event.target.value,
                  updatedAt: nowTimestamp(),
                }))
              }
              placeholder="Provider model or custom profile"
              className="mt-1 w-full rounded border border-subtle bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
            <datalist id={`models-${profile.provider}`}>
              {modelSuggestions[profile.provider].map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </label>
          <label className="text-xs text-muted-foreground">
            Effort
            <select
              value={profile.effort}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  effort: event.target.value as AgentEffort,
                  updatedAt: nowTimestamp(),
                }))
              }
              className="mt-1 w-full rounded border border-subtle bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            >
              {(['ultra', 'high', 'medium', 'low'] as AgentEffort[]).map((effort) => (
                <option key={effort} value={effort}>
                  {effort[0].toUpperCase()}
                  {effort.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground md:col-span-2">
            Description
            <textarea
              value={profile.description}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  description: event.target.value,
                  updatedAt: nowTimestamp(),
                }))
              }
              placeholder="What this agent profile is intended to handle."
              className="mt-1 h-20 w-full resize-none rounded border border-subtle bg-input p-3 text-sm text-foreground outline-none focus:border-ring"
            />
          </label>
          <section className="rounded border border-subtle bg-card/50 p-3">
            <div className="mb-3 flex items-center gap-2">
              <Shield size={13} className="text-primary" />
              <p className="text-xs font-semibold text-foreground">Permissions</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['readFiles', 'Read files'],
                  ['writeFiles', 'Write files'],
                  ['runShell', 'Run shell'],
                  ['network', 'Network'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={profile.permissions[key]}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        permissions: {
                          ...current.permissions,
                          [key]: event.target.checked,
                        },
                        updatedAt: nowTimestamp(),
                      }))
                    }
                    className="h-3.5 w-3.5 rounded border-subtle bg-input"
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>
          <section className="rounded border border-subtle bg-card/50 p-3">
            <p className="mb-3 text-xs font-semibold text-foreground">Isolation mode</p>
            {(
              [
                ['worktree_per_deployment', 'Unique worktree'],
                ['same_workspace', 'Same workspace'],
              ] as Array<[AgentIsolationMode, string]>
            ).map(([mode, label]) => (
              <label key={mode} className="mb-2 flex items-start gap-2 text-xs">
                <input
                  type="radio"
                  name="profile-isolation"
                  checked={profile.isolationMode === mode}
                  onChange={() =>
                    setProfile((current) => ({
                      ...current,
                      isolationMode: mode,
                      updatedAt: nowTimestamp(),
                    }))
                  }
                  className="mt-0.5 h-3.5 w-3.5"
                />
                <span>
                  <span className="block text-foreground">{label}</span>
                  <span className="text-2xs text-muted-foreground">
                    {mode === 'worktree_per_deployment'
                      ? 'Requires a Git workspace at deployment time.'
                      : 'Concurrent writing agents require an explicit warning.'}
                  </span>
                </span>
              </label>
            ))}
          </section>
          <section className="rounded border border-subtle bg-card/50 p-3 md:col-span-2">
            <p className="mb-2 text-xs font-semibold text-foreground">Default local skills</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {skills.map((skill) => {
                const compatible =
                  !skill.manifest.compatible_agents?.length ||
                  (profile.provider !== 'custom' &&
                    skill.manifest.compatible_agents.includes(profile.provider));
                const trustedForUse =
                  skill.manifest.source !== 'github' ||
                  skill.trustState === 'reviewed' ||
                  skill.trustState === 'trusted';
                const selectable = compatible && trustedForUse;
                return (
                  <label
                    key={skill.name}
                    className={`flex items-start gap-2 rounded border border-subtle p-2 text-xs ${
                      selectable ? 'text-foreground' : 'opacity-45'
                    }`}
                    title={
                      !compatible
                        ? 'Not compatible with this provider'
                        : !trustedForUse
                          ? 'Review this GitHub skill before enabling.'
                          : skill.description
                    }
                  >
                    <input
                      type="checkbox"
                      disabled={!selectable}
                      checked={profile.defaultSkills.includes(skill.name)}
                      onChange={() => toggleSkill(skill.name)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-subtle bg-input"
                    />
                    <span className="min-w-0">
                      <span className="block truncate">{skill.manifest.title}</span>
                      <span className="block truncate font-mono text-2xs text-muted-foreground">
                        {!trustedForUse
                          ? 'Review this GitHub skill before enabling.'
                          : `${skill.name} / ${skill.manifest.source} / ${skill.trustState}`}
                      </span>
                    </span>
                  </label>
                );
              })}
              {!skills.length && (
                <p className="text-xs text-muted-foreground">
                  No installed workspace skills are available.
                </p>
              )}
            </div>
          </section>
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-subtle px-5 py-3">
          <button onClick={onClose} className="btn-ghost text-xs">
            Cancel
          </button>
          <button
            onClick={() => void onSave({ ...profile, updatedAt: nowTimestamp() })}
            disabled={busy || !profile.name.trim()}
            className="btn-primary text-xs disabled:opacity-45"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Save agent
          </button>
        </footer>
      </div>
    </div>
  );
}

function TargetIcon({ target }: { target: DeploymentTarget }) {
  if (target.targetType === 'workspace') return <Layers3 size={14} />;
  if (target.targetType === 'folder') return <Folder size={14} />;
  if (target.targetType === 'file') return <FileCode size={14} />;
  return <GitBranch size={14} />;
}

export function DeployAgentModal({
  open,
  target,
  profiles,
  skills,
  busy,
  onClose,
  onCreateAgent,
  onPreflight,
  onPromptPreview,
  onDeploy,
}: {
  open: boolean;
  target: DeploymentTarget | null;
  profiles: AgentProfile[];
  skills: SkillInfo[];
  busy: boolean;
  onClose: () => void;
  onCreateAgent: () => void;
  onPreflight: (draft: DeploymentDraft) => Promise<DeploymentPreflightResult>;
  onPromptPreview: (draft: DeploymentDraft) => string;
  onDeploy: (draft: DeploymentDraft) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [profileId, setProfileId] = useState('');
  const [task, setTask] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [isolationMode, setIsolationMode] = useState<AgentIsolationMode>('worktree_per_deployment');
  const [runMode, setRunMode] = useState<DeploymentRunMode>('edit');
  const [runNow, setRunNow] = useState(true);
  const [preflight, setPreflight] = useState<DeploymentPreflightResult | null>(null);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [preflightError, setPreflightError] = useState('');
  const [emptyInspectConfirmed, setEmptyInspectConfirmed] = useState(false);
  const [nonGitConfirmed, setNonGitConfirmed] = useState(false);
  const [inspectBuildConfirmed, setInspectBuildConfirmed] = useState(false);
  const [preflightDraft, setPreflightDraft] = useState<DeploymentDraft | null>(null);

  const profile = profiles.find((item) => item.id === profileId) ?? null;

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setTask('');
    const first = profiles[0];
    setProfileId(first?.id ?? '');
    setSelectedSkills(first?.defaultSkills ?? []);
    setIsolationMode(first?.isolationMode ?? 'worktree_per_deployment');
    setRunMode('edit');
    setRunNow(true);
    setPreflight(null);
    setPreflightError('');
    setEmptyInspectConfirmed(false);
    setNonGitConfirmed(false);
    setInspectBuildConfirmed(false);
    setPreflightDraft(null);
  }, [open, target?.targetPath]);

  useEffect(() => {
    if (!profile) return;
    setSelectedSkills(profile.defaultSkills);
    setIsolationMode(profile.isolationMode);
    setPreflight(null);
    setPreflightDraft(null);
    setInspectBuildConfirmed(false);
  }, [profileId]);

  useEffect(() => {
    if (!open || profile || !profiles.length) return;
    setProfileId(profiles[0].id);
  }, [open, profile, profiles]);

  const compatibleSkills = useMemo(
    () =>
      skills.map((skill) => ({
        skill,
        compatible:
          !skill.manifest.compatible_agents?.length ||
          Boolean(
            profile &&
            profile.provider !== 'custom' &&
            skill.manifest.compatible_agents.includes(profile.provider)
          ),
        trustedForUse:
          skill.manifest.source !== 'github' ||
          skill.trustState === 'reviewed' ||
          skill.trustState === 'trusted',
      })),
    [profile, skills]
  );

  if (!open || !target) return null;

  const canContinue =
    step === 1
      ? Boolean(target.targetPath)
      : step === 2
        ? Boolean(profile)
        : step === 3
          ? runMode === 'inspect_only' || Boolean(task.trim())
          : Boolean(profile);
  const customRunBlocked = runNow && profile?.provider === 'custom';
  const emptyTarget =
    preflight &&
    !preflight.hasSourceFiles &&
    (target.targetType === 'workspace' || target.targetType === 'folder');
  const nonGit = Boolean(preflight && preflight.gitStatus !== 'git_repo');
  const inspectBuildMismatch = runMode === 'inspect_only' && taskRequiresEditMode(task);
  const currentDraft = profile
    ? buildDeploymentDraft({
        profile,
        task,
        selectedSkills,
        isolationMode,
        runMode,
        runNow,
      })
    : null;
  const preflightMatchesCurrentDraft = Boolean(
    currentDraft &&
      preflightDraft &&
      deploymentDraftFingerprint(currentDraft) === deploymentDraftFingerprint(preflightDraft) &&
      preflight?.requestedRunMode === currentDraft.runMode
  );
  const promptPreview = preflightDraft ? onPromptPreview(preflightDraft) : '';
  const launchBlocked =
    !preflightMatchesCurrentDraft ||
    (runNow &&
      Boolean(
        preflight?.blockers.length ||
          (emptyTarget && runMode === 'inspect_only' && !emptyInspectConfirmed) ||
          (nonGit && !nonGitConfirmed) ||
          (inspectBuildMismatch && !inspectBuildConfirmed)
      ));

  const draftFor = (mode = runMode): DeploymentDraft | null =>
    profile
      ? buildDeploymentDraft({
          profile,
          task,
          selectedSkills,
          isolationMode,
          runMode: mode,
          runNow,
        })
      : null;

  const runPreflight = async (mode = runMode) => {
    const draft = draftFor(mode);
    if (!draft) return;
    setPreflightBusy(true);
    setPreflightError('');
    try {
      const result = await onPreflight(draft);
      if (result.requestedRunMode !== draft.runMode) {
        throw new Error(
          `Preflight run mode mismatch: requested ${draft.runMode}, received ${result.requestedRunMode}.`
        );
      }
      setPreflight(result);
      setNonGitConfirmed(false);
      if (result.gitStatus !== 'git_repo') {
        setIsolationMode('same_workspace');
        setPreflightDraft(
          buildDeploymentDraft({
            ...draft,
            isolationMode: 'same_workspace',
          })
        );
      } else {
        setPreflightDraft(draft);
      }
      if (result.hasSourceFiles) setEmptyInspectConfirmed(false);
      return result;
    } catch (error) {
      setPreflight(null);
      setPreflightDraft(null);
      setPreflightError(error instanceof Error ? error.message : String(error));
    } finally {
      setPreflightBusy(false);
    }
  };

  const continueFromTask = async () => {
    const result = await runPreflight();
    if (result) setStep(4);
  };

  const switchToEmptyInspection = async () => {
    setRunMode('inspect_only');
    setEmptyInspectConfirmed(true);
    setInspectBuildConfirmed(false);
    await runPreflight('inspect_only');
  };

  const changeRunMode = (mode: DeploymentRunMode) => {
    setRunMode(mode);
    setPreflight(null);
    setPreflightDraft(null);
    setEmptyInspectConfirmed(false);
    setInspectBuildConfirmed(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="surface-card flex h-[680px] w-full max-w-4xl flex-col overflow-hidden shadow-card">
        <header className="flex items-start justify-between border-b border-subtle px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Deploy agent</p>
            <p className="mt-1 text-2xs text-muted-foreground">
              Choose the target first, then the agent, task, and execution mode.
            </p>
          </div>
          <button onClick={onClose} className="rocket-icon-button" aria-label="Close deployment">
            <X size={14} />
          </button>
        </header>
        <div className="grid grid-cols-4 border-b border-subtle bg-sidebar/50">
          {['Target', 'Agent', 'Task', 'Confirm'].map((label, index) => {
            const number = index + 1;
            return (
              <button
                key={label}
                onClick={() => number < step && setStep(number)}
                className={`flex items-center justify-center gap-2 px-3 py-3 text-xs ${
                  number === step
                    ? 'border-b-2 border-primary text-primary'
                    : number < step
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                }`}
              >
                <span className="font-mono text-2xs">{number}</span>
                {label}
              </button>
            );
          })}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="mx-auto max-w-2xl">
              <p className="section-label">Deployment target</p>
              <div className="mt-3 rounded-lg border border-primary/25 bg-primary/[0.05] p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded border border-primary/25 bg-primary/10 text-primary">
                    <TargetIcon target={target} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {target.targetLabel}
                    </p>
                    <p className="mt-1 break-all font-mono text-2xs text-muted-foreground">
                      {target.targetPath}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-2xs text-muted-foreground">Target type</p>
                    <p className="mt-1 text-foreground">{target.targetType.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-2xs text-muted-foreground">Workspace</p>
                    <p className="mt-1 truncate text-foreground">{target.workspacePath}</p>
                  </div>
                  {target.nodeName && (
                    <div className="col-span-2">
                      <p className="text-2xs text-muted-foreground">Pipeline node</p>
                      <p className="mt-1 text-foreground">
                        {target.pipelineName} / {target.nodeName}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="mx-auto max-w-2xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="section-label">Agent profile</p>
                <button onClick={onCreateAgent} className="btn-ghost text-xs">
                  <Plus size={12} />
                  Create new agent
                </button>
              </div>
              <div className="space-y-2">
                {profiles.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setProfileId(item.id)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left ${
                      item.id === profileId
                        ? 'border-primary/35 bg-primary/[0.07]'
                        : 'border-subtle bg-card/50 hover:bg-hover'
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-subtle bg-sidebar">
                      <Bot size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">
                        {item.name}
                      </span>
                      <span className="mt-1 block text-2xs text-muted-foreground">
                        {providerLabels[item.provider]} / {item.model || 'default'} / {item.effort}
                      </span>
                      {item.description && (
                        <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </span>
                    {item.id === profileId && <Check size={14} className="text-primary" />}
                  </button>
                ))}
                {!profiles.length && (
                  <div className="rounded-lg border border-dashed border-subtle p-8 text-center">
                    <Bot size={20} className="mx-auto text-muted-foreground" />
                    <p className="mt-3 text-sm font-semibold text-foreground">
                      Create an agent profile first
                    </p>
                    <button onClick={onCreateAgent} className="btn-primary mt-4 text-xs">
                      <Plus size={12} />
                      Create Agent
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {step === 3 && profile && (
            <div className="mx-auto max-w-2xl space-y-5">
              <label className="block text-xs text-muted-foreground">
                Task
                <textarea
                  autoFocus
                  value={task}
                  onChange={(event) => {
                    setTask(event.target.value);
                    setPreflight(null);
                    setPreflightDraft(null);
                    setInspectBuildConfirmed(false);
                  }}
                  placeholder="Describe the result you want at this deployment target."
                  className="mt-1 h-32 w-full resize-none rounded border border-subtle bg-input p-3 text-sm leading-relaxed text-foreground outline-none focus:border-ring"
                />
                <span className="mt-1 block text-2xs text-muted-foreground">
                  {runMode === 'edit'
                    ? 'Tell the agent what to build, fix, inspect, or verify.'
                    : 'Optional. The agent will inspect the target and report without editing.'}
                </span>
              </label>
              <section>
                <p className="section-label">Run mode</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => changeRunMode('inspect_only')}
                    className={`rounded border p-3 text-left ${
                      runMode === 'inspect_only'
                        ? 'border-primary/35 bg-primary/[0.07]'
                        : 'border-subtle bg-card/50'
                    }`}
                  >
                    <span className="block text-xs font-semibold text-foreground">
                      Inspect target only
                    </span>
                    <span className="mt-1 block text-2xs text-muted-foreground">
                      Report findings without editing. Codex uses a read-only sandbox.
                    </span>
                  </button>
                  <button
                    onClick={() => changeRunMode('edit')}
                    className={`rounded border p-3 text-left ${
                      runMode === 'edit'
                        ? 'border-primary/35 bg-primary/[0.07]'
                        : 'border-subtle bg-card/50'
                    }`}
                    title={
                      profile.permissions.writeFiles
                        ? 'Allow scoped edits'
                        : 'Enable Write files in this agent profile'
                    }
                  >
                    <span className="block text-xs font-semibold text-foreground">Edit target</span>
                    <span className="mt-1 block text-2xs text-muted-foreground">
                      Requires a concrete task and profile write permission.
                    </span>
                  </button>
                </div>
                {runMode === 'edit' && !profile.permissions.writeFiles && (
                  <p className="mt-2 rounded border border-error/30 bg-error/[0.06] p-3 text-xs text-error">
                    Edit mode cannot run because this agent profile does not allow Write files.
                    Enable Write files in the profile or choose Inspect target only.
                  </p>
                )}
                {inspectBuildMismatch && (
                  <div className="mt-3 rounded border border-coded/40 bg-coded/[0.08] p-4">
                    <p className="text-sm font-semibold text-foreground">
                      This is an inspect-only run. It will not create or edit files.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This task appears to request a build or code change.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => changeRunMode('edit')}
                        className="btn-primary text-xs"
                      >
                        Switch to Edit mode
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectBuildConfirmed(true)}
                        className="btn-ghost text-xs"
                      >
                        Continue inspect-only
                      </button>
                    </div>
                    {inspectBuildConfirmed && (
                      <p className="mt-2 text-xs text-coded">
                        Inspect-only continuation confirmed. No files may be changed.
                      </p>
                    )}
                  </div>
                )}
              </section>
              <section>
                <p className="section-label">Installed local skills</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {compatibleSkills.map(({ skill, compatible, trustedForUse }) => (
                    <label
                      key={skill.name}
                      className={`flex items-start gap-2 rounded border border-subtle p-2 text-xs ${
                        compatible && trustedForUse ? '' : 'opacity-45'
                      }`}
                      title={
                        !compatible
                          ? 'Not compatible with selected provider'
                          : !trustedForUse
                            ? 'Review this GitHub skill before enabling.'
                            : skill.description
                      }
                    >
                      <input
                        type="checkbox"
                        disabled={!compatible || !trustedForUse}
                        checked={selectedSkills.includes(skill.name)}
                        onChange={() => {
                          setSelectedSkills((current) =>
                            current.includes(skill.name)
                              ? current.filter((name) => name !== skill.name)
                              : [...current, skill.name]
                          );
                          setPreflight(null);
                          setPreflightDraft(null);
                        }}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-subtle bg-input"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-foreground">
                          {skill.manifest.title}
                        </span>
                        <span className="block truncate font-mono text-2xs text-muted-foreground">
                          {!compatible
                            ? 'incompatible'
                            : !trustedForUse
                              ? 'Review this GitHub skill before enabling.'
                              : `${skill.manifest.source} / ${skill.trustState}`}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>
              <section className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="section-label">Isolation</p>
                  <select
                    value={isolationMode}
                    onChange={(event) => {
                      setIsolationMode(event.target.value as AgentIsolationMode);
                      setPreflight(null);
                      setPreflightDraft(null);
                    }}
                    className="mt-2 w-full rounded border border-subtle bg-input px-3 py-2 text-sm text-foreground"
                  >
                    <option value="worktree_per_deployment">Worktree per deployment</option>
                    <option value="same_workspace">Same workspace</option>
                  </select>
                </div>
                <div>
                  <p className="section-label">Launch</p>
                  <div className="mt-2 flex rounded border border-subtle bg-input p-1">
                    <button
                      onClick={() => {
                        setRunNow(true);
                        setPreflight(null);
                        setPreflightDraft(null);
                      }}
                      className={`flex-1 rounded px-2 py-1.5 text-xs ${
                        runNow ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      Run now
                    </button>
                    <button
                      onClick={() => {
                        setRunNow(false);
                        setPreflight(null);
                        setPreflightDraft(null);
                      }}
                      className={`flex-1 rounded px-2 py-1.5 text-xs ${
                        !runNow ? 'bg-coded/15 text-coded' : 'text-muted-foreground'
                      }`}
                    >
                      Stage only
                    </button>
                  </div>
                </div>
              </section>
              {customRunBlocked && (
                <p className="rounded border border-coded/25 bg-coded/[0.06] p-3 text-xs text-coded">
                  Custom profiles can be staged, but Run now is unavailable until a custom
                  executable contract is implemented.
                </p>
              )}
            </div>
          )}
          {step === 4 && profile && (
            <div className="mx-auto max-w-2xl">
              <p className="section-label">Deployment summary</p>
              <div className="mt-3 divide-y divide-subtle rounded-lg border border-subtle bg-card/50">
                {[
                  ['Target', `${target.targetType.replace('_', ' ')} / ${target.targetLabel}`],
                  ['Agent', `${profile.name} / ${providerLabels[profile.provider]}`],
                  ['Model', profile.model || 'Default CLI configuration'],
                  ['Skills', selectedSkills.length ? selectedSkills.join(', ') : 'None'],
                  ['Run mode', runMode === 'inspect_only' ? 'Inspect only' : 'Edit'],
                  ['Sandbox', preflight?.effectiveSandbox ?? 'Preflight unavailable'],
                  ['May create/edit files', runMode === 'edit' ? 'Yes' : 'No'],
                  [
                    'Isolation',
                    isolationMode === 'worktree_per_deployment'
                      ? 'Unique worktree'
                      : 'Same workspace',
                  ],
                  ['Action', runNow ? 'Run now' : 'Stage only'],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[120px_1fr] gap-3 px-4 py-3 text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="break-words text-foreground">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded border border-subtle bg-[#0b0d10] p-3">
                <p className="section-label">Task</p>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {task}
                </p>
              </div>
              <div className="mt-4 rounded border border-subtle bg-[#0b0d10] p-3">
                <p className="section-label">Generated prompt preview</p>
                <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap font-mono text-2xs leading-relaxed text-muted-foreground">
                  {promptPreview || 'Run preflight to generate the exact runtime prompt.'}
                </pre>
              </div>
              {preflight && (
                <div className="mt-4 space-y-3">
                  <div className="rounded border border-subtle bg-card/50 p-3">
                    <p className="section-label">Preflight</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <span className="text-muted-foreground">Source files</span>
                      <span className="text-right text-foreground">
                        {preflight.sourceFileCount}
                      </span>
                      <span className="text-muted-foreground">Git</span>
                      <span className="text-right text-foreground">
                        {preflight.gitStatus.replaceAll('_', ' ')}
                      </span>
                      <span className="text-muted-foreground">Log folder</span>
                      <span className="text-right text-foreground">
                        {preflight.logWritable ? 'Writable' : 'Blocked'}
                      </span>
                    </div>
                  </div>
                  {preflight.blockers.map((item) => (
                    <p
                      key={item.code}
                      className="rounded border border-error/30 bg-error/[0.06] p-3 text-xs text-error"
                    >
                      {item.message}
                    </p>
                  ))}
                  {preflight.warnings.map((item) => (
                    <p
                      key={item.code}
                      className="rounded border border-coded/25 bg-coded/[0.06] p-3 text-xs text-coded"
                    >
                      {item.message}
                    </p>
                  ))}
                  {emptyTarget && runMode === 'inspect_only' && (
                    <div className="rounded border border-coded/30 bg-coded/[0.06] p-3">
                      <p className="text-xs font-semibold text-foreground">
                        This target has no source files. Deploying an agent may do nothing.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={onClose} className="btn-ghost text-xs">
                          Cancel
                        </button>
                        <button
                          onClick={() => void switchToEmptyInspection()}
                          className="btn-primary text-xs"
                          disabled={preflightBusy}
                        >
                          Continue inspect-only without source files
                        </button>
                        <button
                          disabled
                          className="btn-ghost cursor-not-allowed text-xs opacity-45"
                          title="Starter source file creation is coming soon"
                        >
                          Create starter files · coming soon
                        </button>
                      </div>
                    </div>
                  )}
                  {emptyTarget && runMode === 'edit' && (
                    <p className="rounded border border-primary/30 bg-primary/[0.06] p-3 text-xs text-foreground">
                      This target has no source files. Edit mode may create files inside the
                      declared target scope.
                    </p>
                  )}
                  {nonGit && (
                    <label className="flex items-start gap-2 rounded border border-coded/25 bg-coded/[0.04] p-3 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={nonGitConfirmed}
                        onChange={(event) => setNonGitConfirmed(event.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5"
                      />
                      <span>
                        <span className="block text-foreground">Continue without Git</span>
                        <span className="mt-1 block">{preflight.gitMessage}</span>
                      </span>
                    </label>
                  )}
                </div>
              )}
              {preflightError && (
                <p className="mt-4 rounded border border-error/30 bg-error/[0.06] p-3 text-xs text-error">
                  Preflight failed: {preflightError}
                </p>
              )}
            </div>
          )}
        </div>
        <footer className="flex items-center justify-between border-t border-subtle px-5 py-3">
          <button
            onClick={() => (step === 1 ? onClose() : setStep((current) => current - 1))}
            className="btn-ghost text-xs"
          >
            <ChevronLeft size={12} />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 4 ? (
            <button
              onClick={() =>
                step === 3 ? void continueFromTask() : setStep((current) => current + 1)
              }
              disabled={
                !canContinue ||
                customRunBlocked ||
                preflightBusy ||
                (inspectBuildMismatch && !inspectBuildConfirmed)
              }
              className="btn-primary text-xs disabled:opacity-45"
            >
              {preflightBusy ? <Loader2 size={12} className="animate-spin" /> : null}
              {step === 3 ? 'Run preflight' : 'Continue'}
              <ChevronRight size={12} />
            </button>
          ) : (
            <button
              onClick={() =>
                preflightDraft && void onDeploy(buildDeploymentDraft(preflightDraft))
              }
              disabled={
                busy ||
                customRunBlocked ||
                preflightBusy ||
                launchBlocked ||
                !preflight ||
                !preflightDraft
              }
              className="btn-primary text-xs disabled:opacity-45"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
              {runNow ? 'Deploy and run' : 'Stage deployment'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
