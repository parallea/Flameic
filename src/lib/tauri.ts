import type {
  AgentAvailability,
  AgentDeployment,
  AgentProfile,
  AgentReview,
  AppBootstrap,
  ClearSessionHistoryResult,
  DiagnosticsExportRequest,
  DiagnosticsExportResult,
  DeploymentPreflightRequest,
  DeploymentPreflightResult,
  DeploymentRunMode,
  FileReadResult,
  GitStatus,
  GithubMarketplaceInstallResult,
  GithubMarketplaceCandidate,
  GithubMarketplacePreview,
  GithubMarketplaceRepo,
  GithubMarketplaceSearchRequest,
  GithubMarketplaceSearchResult,
  GithubMarketplaceUninstallResult,
  GithubMarketplaceUpdateResult,
  GithubRateLimits,
  GithubTokenStatus,
  RealityIssue,
  ReviewActionResult,
  SessionInfo,
  SkillInfo,
  WorkspaceBundle,
  WorkspaceSummary,
} from './types';

type Handler<T> = (event: { payload: T }) => void;

export function isDesktopRuntime() {
  return Boolean(window.__TAURI__?.core?.invoke);
}

export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) {
    throw new Error(
      'AgentBoard desktop backend is unavailable. Close and reopen the AgentBoard desktop app.'
    );
  }
  return invoke<T>(command, args);
}

export async function listenEvent<T>(event: string, handler: Handler<T>): Promise<() => void> {
  const listen = window.__TAURI__?.event?.listen;
  if (!listen) {
    return () => undefined;
  }
  return listen<T>(event, handler);
}

export const agentboardApi = {
  bootstrap: () => invokeCommand<AppBootstrap>('bootstrap'),
  addWorkspace: (path: string, createStarter = false) =>
    invokeCommand<WorkspaceSummary>('add_workspace', { path, createStarter }),
  openSampleWorkspace: () => invokeCommand<WorkspaceSummary>('open_sample_workspace'),
  loadWorkspace: (workspaceId: string) =>
    invokeCommand<WorkspaceBundle>('load_workspace', { workspaceId }),
  refreshAgents: () => invokeCommand<AgentAvailability[]>('detect_agents'),
  readFile: (workspacePath: string, relativePath: string) =>
    invokeCommand<FileReadResult>('read_file', { workspacePath, relativePath }),
  scanWorkspace: (workspacePath: string) =>
    invokeCommand<RealityIssue[]>('scan_workspace', { workspacePath }),
  gitStatus: (workspacePath: string) => invokeCommand<GitStatus>('git_status', { workspacePath }),
  createWorktree: (workspacePath: string, nodeId: string) =>
    invokeCommand<string>('create_worktree', { workspacePath, nodeId }),
  runAgent: (
    workspacePath: string,
    workspaceName: string,
    agent: string,
    prompt: string,
    runMode: DeploymentRunMode,
    nodeId?: string,
    skills?: string[],
    nodeName?: string,
    useWorktree = false,
    allowSharedWorkspace = false,
    metadata?: {
      model?: string;
      targetType?: string;
      targetPath?: string;
      targetLabel?: string;
      deploymentId?: string;
    }
  ) =>
    invokeCommand<SessionInfo>('run_agent', {
      request: {
        workspacePath,
        workspaceName,
        agent,
        prompt,
        runMode,
        nodeId,
        nodeName,
        skills: skills ?? [],
        useWorktree,
        allowSharedWorkspace,
        model: metadata?.model,
        targetType: metadata?.targetType,
        targetPath: metadata?.targetPath,
        targetLabel: metadata?.targetLabel,
        deploymentId: metadata?.deploymentId,
      },
    }),
  runMultiAgentSmokeTest: (workspacePath: string, workspaceName: string) =>
    invokeCommand<SessionInfo[]>('run_multi_agent_smoke_test', {
      workspacePath,
      workspaceName,
    }),
  stopSession: (sessionId: string) => invokeCommand<boolean>('stop_session', { sessionId }),
  listSessions: () => invokeCommand<SessionInfo[]>('list_sessions'),
  listAgentProfiles: () => invokeCommand<AgentProfile[]>('list_agent_profiles'),
  saveAgentProfile: (profile: AgentProfile) =>
    invokeCommand<AgentProfile>('save_agent_profile', { profile }),
  deleteAgentProfile: (id: string) => invokeCommand<boolean>('delete_agent_profile', { id }),
  listDeployments: () => invokeCommand<AgentDeployment[]>('list_deployments'),
  saveDeployment: (deployment: AgentDeployment) =>
    invokeCommand<AgentDeployment>('save_deployment', { deployment }),
  updateDeployment: (deployment: AgentDeployment) =>
    invokeCommand<AgentDeployment>('update_deployment', { deployment }),
  deleteDeployment: (id: string) => invokeCommand<boolean>('delete_deployment', { id }),
  deploymentPreflight: (request: DeploymentPreflightRequest) =>
    invokeCommand<DeploymentPreflightResult>('deployment_preflight', { request }),
  githubMarketplaceSearch: (request: GithubMarketplaceSearchRequest) =>
    invokeCommand<GithubMarketplaceSearchResult>('github_marketplace_search', { request }),
  githubMarketplacePreview: (
    workspacePath: string,
    repoFullName: GithubMarketplaceRepo['fullName'],
    candidate?: Pick<GithubMarketplaceCandidate, 'id' | 'candidatePath'>,
    forceRefresh = false
  ) =>
    invokeCommand<GithubMarketplacePreview>('github_marketplace_preview', {
      request: {
        workspacePath,
        repoFullName,
        candidateId: candidate?.id,
        candidatePath: candidate?.candidatePath,
        forceRefresh,
      },
    }),
  githubMarketplaceInstall: (request: {
    workspacePath: string;
    repoFullName: string;
    candidateId?: string;
    candidatePath?: string;
    previewCommitSha?: string;
    skillMarkdownPath?: string;
    skillJsonPath?: string;
    readmePath?: string;
    installName?: string;
    allowReadmeDraft: boolean;
    duplicateAction: 'cancel' | 'rename' | 'overwrite';
  }) => invokeCommand<GithubMarketplaceInstallResult>('github_marketplace_install', { request }),
  githubMarketplaceUpdate: (workspacePath: string, skillName: string, confirm: boolean) =>
    invokeCommand<GithubMarketplaceUpdateResult>('github_marketplace_update', {
      request: { workspacePath, skillName, confirm },
    }),
  githubMarketplaceUninstall: (workspacePath: string, skillName: string) =>
    invokeCommand<GithubMarketplaceUninstallResult>('github_marketplace_uninstall', {
      request: { workspacePath, skillName },
    }),
  githubMarketplaceSetTrust: (
    workspacePath: string,
    skillName: string,
    trustState: 'untrusted' | 'reviewed' | 'trusted' | 'disabled'
  ) =>
    invokeCommand<SkillInfo>('github_marketplace_set_trust', {
      request: { workspacePath, skillName, trustState },
    }),
  githubMarketplaceRateLimit: () =>
    invokeCommand<GithubRateLimits>('github_marketplace_rate_limit'),
  saveGithubToken: (token: string) =>
    invokeCommand<GithubTokenStatus>('save_github_token', { request: { token } }),
  clearGithubToken: () => invokeCommand<GithubTokenStatus>('clear_github_token'),
  clearSessionHistory: (workspacePath: string) =>
    invokeCommand<ClearSessionHistoryResult>('clear_session_history', { workspacePath }),
  openLogsFolder: (workspacePath: string) =>
    invokeCommand<string>('open_logs_folder', { workspacePath }),
  getAgentReview: (sessionId: string) =>
    invokeCommand<AgentReview | null>('get_agent_review', { sessionId }),
  listAgentReviews: (workspacePath: string) =>
    invokeCommand<AgentReview[]>('list_agent_reviews', { workspacePath }),
  acceptAgentReview: (reviewId: string) =>
    invokeCommand<ReviewActionResult>('accept_agent_review', { reviewId }),
  revertAgentReview: (reviewId: string) =>
    invokeCommand<ReviewActionResult>('revert_agent_review', { reviewId }),
  openReviewFile: (reviewId: string, relativePath: string) =>
    invokeCommand<string>('open_review_file', { reviewId, relativePath }),
  revealReviewFile: (reviewId: string, relativePath: string) =>
    invokeCommand<string>('reveal_review_file', { reviewId, relativePath }),
  openReviewFolder: (reviewId: string) =>
    invokeCommand<string>('open_review_folder', { reviewId }),
  openSkillFolder: (workspacePath: string, skillName: string) =>
    invokeCommand<string>('open_skill_folder', {
      request: { workspacePath, skillName },
    }),
  exportDiagnostics: (request: DiagnosticsExportRequest) =>
    invokeCommand<DiagnosticsExportResult>('export_diagnostics', { request }),
};
