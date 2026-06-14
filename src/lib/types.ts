export type AgentId = 'claude' | 'codex' | 'gemini' | 'aider' | 'git' | 'powershell' | 'cmd';
export type AgentProvider =
  | 'codex'
  | 'claude'
  | 'gemini'
  | 'aider'
  | 'powershell'
  | 'cmd'
  | 'custom';
export type AgentEffort = 'ultra' | 'high' | 'medium' | 'low';
export type AgentIsolationMode = 'same_workspace' | 'worktree_per_deployment';
export type DeploymentRunMode = 'inspect_only' | 'edit';
export type DeploymentTargetType = 'workspace' | 'folder' | 'file' | 'pipeline_node';

export type AgentStatus = 'available' | 'missing' | 'not_configured' | 'running';

export type SessionStatus =
  | 'idle'
  | 'staged'
  | 'running'
  | 'completed'
  | 'completed_inspection'
  | 'failed'
  | 'stopped'
  | 'external_blocked';

export type QueueStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'completed_inspection'
  | 'failed'
  | 'stopped'
  | 'external_blocked';

export type NodeStatus =
  | 'not_started'
  | 'visual_only'
  | 'mock'
  | 'coded'
  | 'partial'
  | 'broken'
  | 'tested'
  | 'production_ready';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'unknown';

export interface WorkspaceSummary {
  id: string;
  name: string;
  path: string;
  exists: boolean;
  hasAgentboard: boolean;
  pipelineCount: number;
  nodeCount: number;
  lastOpened?: string;
  error?: string;
}

export interface WorkspaceConfig {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineFile {
  path: string;
  reason: string;
  startLine?: number;
  endLine?: number;
}

export interface PipelineCheck {
  name: string;
  status: CheckStatus;
  message: string;
}

export interface PipelineNode {
  id: string;
  label: string;
  status: NodeStatus;
  files: PipelineFile[];
  issues: string[];
  checks: PipelineCheck[];
}

export interface Pipeline {
  id: string;
  name: string;
  nodes: PipelineNode[];
  edges: [string, string][];
}

export interface PipelinesDocument {
  pipelines: Pipeline[];
}

export interface SkillManifest {
  name: string;
  title: string;
  description: string;
  categories: string[];
  compatible_agents?: AgentId[];
  version: string;
  source: string;
  trusted?: boolean;
  permissions: {
    filesystem: string;
    shell: boolean;
    network: boolean;
  };
}

export interface SkillInfo {
  name: string;
  title: string;
  description: string;
  path: string;
  manifest: SkillManifest;
  markdown: string;
  enabled: boolean;
  error?: string;
  trustState: 'local' | 'untrusted' | 'reviewed' | 'trusted' | 'disabled' | 'invalid';
  repoFullName?: string;
  sourceUrl?: string;
}

export interface GithubRateLimit {
  limit: number;
  remaining: number;
  resetAt?: string;
  resource: string;
}

export interface GithubRateLimits {
  core: GithubRateLimit;
  search: GithubRateLimit;
}

export interface GithubMarketplaceSearchRequest {
  workspacePath: string;
  query: string;
  sort: 'best_match' | 'stars' | 'updated';
  language?: string;
  minimumStars?: number;
  onlyDetectedSkillFiles: boolean;
  forceRefresh?: boolean;
}

export interface GithubMarketplaceRepo {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  description: string;
  htmlUrl: string;
  defaultBranch: string;
  stars: number;
  forks: number;
  language?: string;
  license?: string;
  updatedAt: string;
  topics: string[];
  detectedSkillStatus:
    | 'formal_skill'
    | 'readme_only'
    | 'no_skill_files'
    | 'detection_unavailable';
  detectedFiles: string[];
  qualityScore: number;
  qualityLabel: 'high' | 'medium' | 'low';
  installedSkillName?: string;
  installStatus: 'not_installed' | 'installed' | 'update_available' | 'disabled';
  latestCommitSha?: string;
  previewCached: boolean;
}

export interface GithubMarketplaceSearchResult {
  query: string;
  apiQuery: string;
  items: GithubMarketplaceRepo[];
  cached: boolean;
  fetchedAt: string;
  rateLimit: GithubRateLimit;
}

export interface GithubMarketplaceFile {
  path: string;
  kind: 'skill_markdown' | 'skill_json' | 'readme' | 'other';
  content: string;
  size: number;
  sha: string;
}

export interface GithubMarketplacePreview {
  repo: GithubMarketplaceRepo;
  files: GithubMarketplaceFile[];
  formalSkill: boolean;
  readmeOnly: boolean;
  installable: boolean;
  recommendedName: string;
  warning?: string;
  cached: boolean;
  rateLimit: GithubRateLimit;
}

export interface GithubMarketplaceInstallResult {
  status: 'installed' | 'conflict';
  skill?: SkillInfo;
  path?: string;
  suggestedName?: string;
  backupPath?: string;
  message: string;
}

export interface GithubMarketplaceUpdateResult {
  status: 'up_to_date' | 'confirmation_required' | 'updated';
  changedFiles: string[];
  previousCommitSha: string;
  latestCommitSha: string;
  backupPath?: string;
  skill?: SkillInfo;
  message: string;
}

export interface GithubMarketplaceUninstallResult {
  skillName: string;
  trashPath: string;
  message: string;
}

export interface GithubTokenStatus {
  stored: boolean;
  persistence: 'session_only';
  message: string;
  rateLimits?: GithubRateLimits;
}

export interface AgentAvailability {
  id: AgentId;
  label: string;
  command: string;
  status: AgentStatus;
  detail: string;
}

export interface AgentProfilePermissions {
  readFiles: boolean;
  writeFiles: boolean;
  runShell: boolean;
  network: boolean;
}

export interface AgentProfile {
  id: string;
  name: string;
  provider: AgentProvider;
  model: string;
  effort: AgentEffort;
  defaultSkills: string[];
  permissions: AgentProfilePermissions;
  isolationMode: AgentIsolationMode;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentTarget {
  targetType: DeploymentTargetType;
  workspacePath: string;
  targetPath: string;
  targetLabel: string;
  pipelineId?: string;
  pipelineName?: string;
  nodeId?: string;
  nodeName?: string;
}

export interface AgentDeployment extends DeploymentTarget {
  id: string;
  agentProfileId: string;
  agentName: string;
  selectedSkills: string[];
  prompt: string;
  runMode: DeploymentRunMode;
  isolationMode: AgentIsolationMode;
  status: Exclude<SessionStatus, 'idle'>;
  sessionId?: string;
  logPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitFileChange {
  path: string;
  status: string;
}

export interface GitStatus {
  isRepo: boolean;
  branch?: string;
  changedFiles: GitFileChange[];
  untrackedFiles: string[];
  diffStat: string;
  error?: string;
}

export interface RealityIssue {
  file: string;
  line: number;
  pattern: string;
  severity: 'low' | 'medium' | 'high';
  snippet: string;
}

export interface FileReadResult {
  path: string;
  exists: boolean;
  content: string;
  error?: string;
}

export interface SessionInfo {
  id: string;
  workspacePath: string;
  workspaceName: string;
  agent: AgentId;
  nodeId?: string;
  nodeName?: string;
  selectedSkills: string[];
  prompt: string;
  runMode: DeploymentRunMode;
  status: SessionStatus;
  startedAt: string;
  finishedAt?: string;
  logPath: string;
  exitCode?: number;
  executionPath: string;
  worktreePath?: string;
}

export interface AgentOutputEvent {
  sessionId: string;
  stream: 'stdout' | 'stderr' | 'system';
  line: string;
}

export interface AgentStatusEvent {
  sessionId: string;
  status: SessionStatus;
  exitCode?: number;
  message?: string;
}

export interface DeploymentPreflightRequest {
  targetType: DeploymentTargetType;
  workspacePath: string;
  targetPath: string;
  provider: AgentProvider;
  selectedSkills: string[];
  task: string;
  runMode: DeploymentRunMode;
  writeFilesPermission: boolean;
  concernedFiles: string[];
}

export interface DeploymentPreflightMessage {
  code: string;
  message: string;
}

export interface DeploymentPreflightResult {
  targetExists: boolean;
  sourceFileCount: number;
  hasSourceFiles: boolean;
  onlyAgentboard: boolean;
  providerAvailable: boolean;
  missingSkills: string[];
  logWritable: boolean;
  gitStatus: 'git_repo' | 'not_git_repo' | 'git_missing';
  gitMessage: string;
  pipelineConcernedFileCount: number;
  runModeSupported: boolean;
  effectiveSandbox: string;
  blockers: DeploymentPreflightMessage[];
  warnings: DeploymentPreflightMessage[];
}

export interface QueueItem {
  id: string;
  workspacePath: string;
  nodeId: string;
  nodeLabel: string;
  agent: AgentId;
  skills: string[];
  useWorktree: boolean;
  status: QueueStatus;
  prompt: string;
  createdAt: string;
  sessionId?: string;
  logPath?: string;
}

export interface WorkspaceBundle {
  workspace: WorkspaceSummary;
  pipelines: PipelinesDocument;
  skills: SkillInfo[];
  git: GitStatus;
  sessions: SessionInfo[];
  sessionLogs: Record<string, string[]>;
}

export interface AppBootstrap {
  appDataDir: string;
  workspaces: WorkspaceSummary[];
  agents: AgentAvailability[];
  sessions: SessionInfo[];
}

export interface ClearSessionHistoryResult {
  removed: number;
  retainedRunning: number;
}

export interface DiagnosticsExportRequest {
  recentErrors: string[];
  workspacePath?: string;
  issueNotes?: string;
}

export interface DiagnosticsExportResult {
  path: string;
  generatedAt: string;
}
