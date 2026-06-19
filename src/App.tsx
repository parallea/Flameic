import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Bug,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clipboard,
  Code2,
  Copy,
  Download,
  Eye,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  Gauge,
  GitBranch,
  GitCompare,
  GitPullRequest,
  History,
  Info,
  Keyboard,
  LayoutDashboard,
  Layers3,
  List,
  Loader2,
  Maximize2,
  MoreHorizontal,
  PanelBottomClose,
  PanelBottomOpen,
  PanelRightClose,
  Pencil,
  Play,
  Plus,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CreateAgentModal, DeployAgentModal } from './components/deployment/DeploymentModals';
import { GithubSkillsMarketplace } from './components/skills/GithubMarketplace';
import type { DeploymentDraft } from './lib/deploymentRunMode';
import { generateAgentPrompt, generateDeploymentPrompt } from './lib/prompt';
import { agentboardApi, isDesktopRuntime, listenEvent } from './lib/tauri';
import type {
  AgentAvailability,
  AgentDeployment,
  AgentId,
  AgentOutputEvent,
  AgentProfile,
  AgentReview,
  AgentStatusEvent,
  AppBootstrap,
  DeploymentPreflightResult,
  DeploymentRunMode,
  DeploymentTarget,
  EnvironmentBlocker,
  FileReadResult,
  NodeStatus,
  Pipeline,
  PipelineNode,
  QueueItem,
  QueueStatus,
  RealityIssue,
  ReviewChangedFile,
  SessionInfo,
  SessionStatus,
  SkillInfo,
  WorkspaceBundle,
  WorkspaceSummary,
} from './lib/types';

type CenterTab =
  | 'overview'
  | 'graph'
  | 'timeline'
  | 'files'
  | 'reality'
  | 'git'
  | 'skills'
  | 'logs';
type InspectorSelection =
  | { kind: 'workspace'; id: string }
  | { kind: 'agent'; id: AgentId }
  | { kind: 'profile'; id: string }
  | { kind: 'deployment'; id: string }
  | { kind: 'node'; id: string }
  | { kind: 'session'; id: string }
  | { kind: 'skill'; id: string }
  | { kind: 'file'; id: string };
type InspectorTab = 'summary' | 'files' | 'scanner' | 'git' | 'prompt';
type ContextMenuItem = {
  label: string;
  icon?: React.FC<{ size?: number; className?: string }>;
  action?: () => void | Promise<void>;
  disabled?: boolean;
  danger?: boolean;
  hint?: string;
  separatorBefore?: boolean;
};
type ContextMenuState = {
  x: number;
  y: number;
  title: string;
  items: ContextMenuItem[];
} | null;
type RuntimeNotice = {
  kind: 'success' | 'error' | 'warning' | 'info';
  title: string;
  detail?: string;
  timestamp: string;
};

const statusMeta: Record<
  NodeStatus,
  { label: string; color: string; bg: string; border: string; weight: number }
> = {
  production_ready: {
    label: 'PRODUCTION READY',
    color: 'text-running',
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.28)',
    weight: 8,
  },
  tested: {
    label: 'TESTED',
    color: 'text-accent',
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.24)',
    weight: 7,
  },
  coded: {
    label: 'CODED',
    color: 'text-coded',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.24)',
    weight: 6,
  },
  partial: {
    label: 'PARTIAL',
    color: 'text-coded',
    bg: 'rgba(245,158,11,0.05)',
    border: 'rgba(245,158,11,0.18)',
    weight: 5,
  },
  broken: {
    label: 'BROKEN',
    color: 'text-error',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.3)',
    weight: 4,
  },
  mock: {
    label: 'MOCK',
    color: 'text-purple-300',
    bg: 'rgba(168,85,247,0.08)',
    border: 'rgba(168,85,247,0.24)',
    weight: 3,
  },
  visual_only: {
    label: 'VISUAL ONLY',
    color: 'text-muted-foreground',
    bg: 'rgba(136,136,136,0.06)',
    border: 'rgba(136,136,136,0.16)',
    weight: 2,
  },
  not_started: {
    label: 'NOT STARTED',
    color: 'text-muted-foreground',
    bg: 'transparent',
    border: 'var(--border)',
    weight: 1,
  },
};

const agentLabels: Record<AgentId, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini CLI',
  aider: 'Aider',
  git: 'Git',
  powershell: 'PowerShell',
  cmd: 'CMD',
};

const runnableAgents: AgentId[] = ['claude', 'codex', 'gemini', 'aider', 'powershell', 'cmd'];
const APP_VERSION = '0.1.0-alpha';

const tabItems: { id: CenterTab; label: string; icon: React.FC<{ size?: number }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'graph', label: 'Pipeline', icon: GitBranch },
  { id: 'timeline', label: 'History', icon: History },
  { id: 'reality', label: 'Scanner', icon: ShieldAlert },
  { id: 'git', label: 'Git', icon: GitCompare },
  { id: 'skills', label: 'Skills', icon: Puzzle },
];

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function RocketRail({
  collapsed,
  setCollapsed,
  activeTab,
  setActiveTab,
  workspaces,
  selectedWorkspaceId,
  selectWorkspace,
  agents,
  agentProfiles,
  deployments,
  workspaceSessions,
  workspaceSearch,
  setWorkspaceSearch,
  openFolder,
  onWorkspaceContext,
  onAgentContext,
  onProfileContext,
  onDeploymentContext,
  openAgent,
  inspectProfile,
  inspectDeployment,
  createAgent,
  openReleaseSupport,
}: {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  activeTab: CenterTab;
  setActiveTab: (value: CenterTab) => void;
  workspaces: WorkspaceSummary[];
  selectedWorkspaceId: string | null;
  selectWorkspace: (id: string) => void;
  agents: AgentAvailability[];
  agentProfiles: AgentProfile[];
  deployments: AgentDeployment[];
  workspaceSessions: SessionInfo[];
  workspaceSearch: string;
  setWorkspaceSearch: (value: string) => void;
  openFolder: () => void;
  onWorkspaceContext: (event: React.MouseEvent, workspace: WorkspaceSummary) => void;
  onAgentContext: (event: React.MouseEvent, agent: AgentAvailability) => void;
  onProfileContext: (event: React.MouseEvent, profile: AgentProfile) => void;
  onDeploymentContext: (event: React.MouseEvent, deployment: AgentDeployment) => void;
  openAgent: (agent: AgentAvailability) => void;
  inspectProfile: (profile: AgentProfile) => void;
  inspectDeployment: (deployment: AgentDeployment) => void;
  createAgent: () => void;
  openReleaseSupport: () => void;
}) {
  const running = workspaceSessions.filter((session) => sessionIsActive(session.status)).length;
  const nav = [
    { id: 'overview' as const, label: 'Workspaces', icon: LayoutDashboard },
    { id: 'agents' as const, label: 'Agents', icon: Bot },
    { id: 'timeline' as const, label: 'History', icon: History },
    { id: 'skills' as const, label: 'Skills', icon: Puzzle },
  ];

  return (
    <aside
      className="rocket-rail relative flex h-full shrink-0 flex-col border-r border-subtle bg-sidebar transition-[width] duration-200"
      style={{ width: collapsed ? 52 : 220 }}
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-subtle px-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10">
          <Bot size={14} className="text-primary" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold tracking-tight">AgentBoard</p>
              <span className="rounded border border-coded/30 bg-coded/10 px-1 font-mono text-[8px] uppercase tracking-wider text-coded">
                Alpha
              </span>
            </div>
            <p className="truncate font-mono text-2xs text-muted-foreground">plan · run · review</p>
          </div>
        )}
      </div>

      <nav className="space-y-0.5 p-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const selected =
            item.id === 'agents'
              ? false
              : item.id === 'overview'
                ? activeTab === 'overview'
                : activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'agents') {
                  const first = agents[0];
                  if (first) openAgent(first);
                  setActiveTab('overview');
                } else {
                  setActiveTab(item.id);
                }
              }}
              className={cn(
                'rocket-nav-item group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs',
                selected
                  ? 'bg-primary/[0.09] text-primary'
                  : 'text-muted-foreground hover:bg-hover hover:text-foreground'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={14} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.id === 'agents' && running > 0 && (
                <span className="ml-auto rounded bg-primary/10 px-1.5 font-mono text-2xs text-primary">
                  {running}
                </span>
              )}
            </button>
          );
        })}
        <button
          disabled
          className="rocket-nav-item flex w-full cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs text-muted-foreground/40"
          title="Settings coming soon"
        >
          <Settings size={14} />
          {!collapsed && <span>Settings · soon</span>}
        </button>
      </nav>

      <div className="mx-2 border-t border-subtle" />

      {!collapsed && (
        <div className="px-2 pt-2">
          <div className="flex items-center gap-2 rounded-md border border-subtle bg-input px-2 py-1.5">
            <Search size={11} className="text-muted-foreground" />
            <input
              value={workspaceSearch}
              onChange={(event) => setWorkspaceSearch(event.target.value)}
              placeholder="Filter workspaces"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/70"
            />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
        {!collapsed && (
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="section-label">Workspaces</span>
            <button
              onClick={openFolder}
              className="rounded p-1 text-muted-foreground hover:bg-hover hover:text-foreground"
              title="Open Folder"
            >
              <Plus size={12} />
            </button>
          </div>
        )}
        {workspaces.length === 0 && !collapsed && (
          <button
            onClick={openFolder}
            className="mx-1 mt-2 w-[calc(100%-8px)] rounded-md border border-dashed border-subtle px-3 py-4 text-center text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground"
          >
            <FolderOpen size={15} className="mx-auto mb-2" />
            Open a folder
          </button>
        )}
        {workspaces.map((workspace) => {
          const selected = workspace.id === selectedWorkspaceId;
          const workspaceDeployments = deployments.filter(
            (deployment) =>
              normalizedPath(deployment.workspacePath) === normalizedPath(workspace.path)
          );
          const directDeployments = workspaceDeployments.filter(
            (deployment) => deployment.targetType === 'workspace'
          );
          const targetGroups = [
            ...new Map(
              workspaceDeployments
                .filter((deployment) => deployment.targetType !== 'workspace')
                .map((deployment) => [
                  `${deployment.targetType}:${normalizedPath(deployment.targetPath)}`,
                  {
                    label:
                      deployment.targetType === 'pipeline_node'
                        ? `Pipeline / ${deployment.nodeName ?? deployment.targetLabel}`
                        : deployment.targetLabel,
                    type: deployment.targetType,
                    items: workspaceDeployments.filter(
                      (item) =>
                        item.targetType === deployment.targetType &&
                        normalizedPath(item.targetPath) === normalizedPath(deployment.targetPath)
                    ),
                  },
                ])
            ).values(),
          ];
          return (
            <React.Fragment key={workspace.id}>
              <button
                onClick={() => selectWorkspace(workspace.id)}
                onContextMenu={(event) => onWorkspaceContext(event, workspace)}
                className={cn(
                  'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                  selected
                    ? 'bg-hover text-foreground'
                    : 'text-muted-foreground hover:bg-hover/70 hover:text-foreground'
                )}
                title={`${workspace.path}\nRight-click for workspace actions`}
              >
                <Folder size={13} className={cn('shrink-0', selected && 'text-coded')} />
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">
                      {workspace.name}
                    </span>
                    <span className="font-mono text-2xs text-muted-foreground">
                      {workspace.nodeCount}
                    </span>
                    <MoreHorizontal
                      size={12}
                      className="shrink-0 text-muted-foreground/45 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </>
                )}
              </button>
              {!collapsed &&
                selected &&
                directDeployments.map((deployment) => (
                  <button
                    key={deployment.id}
                    onClick={() => inspectDeployment(deployment)}
                    onContextMenu={(event) => onDeploymentContext(event, deployment)}
                    className="group ml-5 flex w-[calc(100%-20px)] items-center gap-2 rounded px-2 py-1 text-left hover:bg-hover"
                    title={`${deployment.agentName} / ${deployment.status}`}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        deploymentStatusClass(deployment.status)
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-2xs text-foreground">
                      {deployment.agentName}
                    </span>
                  </button>
                ))}
              {!collapsed &&
                selected &&
                targetGroups.map((group) => (
                  <div key={`${workspace.id}-${group.type}-${group.label}`} className="ml-4">
                    <div className="flex items-center gap-1.5 px-2 py-1 text-2xs text-muted-foreground">
                      {group.type === 'folder' ? (
                        <Folder size={10} />
                      ) : group.type === 'file' ? (
                        <FileCode size={10} />
                      ) : (
                        <GitBranch size={10} />
                      )}
                      <span className="min-w-0 truncate">{group.label}</span>
                    </div>
                    {group.items.map((deployment) => (
                      <button
                        key={deployment.id}
                        onClick={() => inspectDeployment(deployment)}
                        onContextMenu={(event) => onDeploymentContext(event, deployment)}
                        className="group ml-3 flex w-[calc(100%-12px)] items-center gap-2 rounded px-2 py-1 text-left hover:bg-hover"
                        title={`${deployment.agentName} / ${deployment.status}`}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            deploymentStatusClass(deployment.status)
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-2xs text-foreground">
                          {deployment.agentName}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
            </React.Fragment>
          );
        })}

        {!collapsed && (agentProfiles.length > 0 || agents.length > 0) && (
          <>
            <div className="mx-2 my-3 border-t border-subtle" />
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="section-label">Agent profiles</span>
              <button
                onClick={createAgent}
                className="rounded p-1 text-muted-foreground hover:bg-hover hover:text-foreground"
                title="Create Agent"
              >
                <Plus size={11} />
              </button>
            </div>
            {agentProfiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => inspectProfile(profile)}
                onContextMenu={(event) => onProfileContext(event, profile)}
                className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-hover hover:text-foreground"
                title={`${profile.description || profile.model}\nRight-click for profile actions`}
              >
                <Bot size={12} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{profile.name}</span>
                <span className="font-mono text-2xs opacity-60">{profile.provider}</span>
              </button>
            ))}
            <div className="mb-1 mt-3 px-2 section-label">CLI availability</div>
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => openAgent(agent)}
                onContextMenu={(event) => onAgentContext(event, agent)}
                className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-hover hover:text-foreground"
                title={`${agent.detail}\nRight-click for agent actions`}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    agent.status === 'available' || agent.status === 'running'
                      ? 'status-dot-running'
                      : agent.status === 'missing'
                        ? 'status-dot-error'
                        : 'status-dot-idle'
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{agent.label}</span>
                <span className="font-mono text-2xs opacity-60">
                  {agent.status === 'missing'
                    ? 'install'
                    : agent.status === 'available'
                      ? 'ready'
                      : agent.status}
                </span>
                <MoreHorizontal
                  size={12}
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              </button>
            ))}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-subtle p-2">
        <button
          onClick={openReleaseSupport}
          className="mb-1 flex w-full items-center justify-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-hover hover:text-foreground"
          title={`About AgentBoard ${APP_VERSION}, report an issue, or export diagnostics`}
        >
          <Bug size={12} />
          {!collapsed && 'Report issue'}
        </button>
        {!collapsed && (
          <p className="mb-1 text-center font-mono text-[9px] text-muted-foreground/65">
            v{APP_VERSION} / trusted tester build
          </p>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-hover hover:text-foreground"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  );
}

function RocketTopbar({
  boot,
  bootError,
  workspace,
  activeTab,
  runtimeNotice,
  refresh,
  openFolder,
  toggleLogs,
  logsOpen,
}: {
  boot: AppBootstrap | null;
  bootError: string | null;
  workspace: WorkspaceSummary | null;
  activeTab: CenterTab;
  runtimeNotice: RuntimeNotice;
  refresh: () => Promise<void>;
  openFolder: () => void;
  toggleLogs: () => void;
  logsOpen: boolean;
}) {
  const activeLabel = tabItems.find((item) => item.id === activeTab)?.label ?? 'Overview';
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-subtle bg-[var(--topbar-bg)] px-4">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="text-xs text-muted-foreground">AgentBoard</span>
        <span className="rounded border border-coded/30 bg-coded/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-coded">
          Alpha build
        </span>
        <span className="text-muted-foreground/40">/</span>
        <span className="truncate text-xs font-medium">{workspace?.name ?? 'No workspace'}</span>
        {workspace && (
          <>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-xs text-muted-foreground">{activeLabel}</span>
          </>
        )}
      </div>
      <div
        className={cn(
          'ml-auto hidden min-w-0 items-center gap-2 rounded-md px-2 py-1 font-mono text-2xs xl:flex',
          runtimeNotice.kind === 'error'
            ? 'bg-error/10 text-error'
            : runtimeNotice.kind === 'warning'
              ? 'bg-coded/10 text-coded'
              : 'text-muted-foreground'
        )}
        title={runtimeNotice.detail}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            runtimeNotice.kind === 'error'
              ? 'bg-error'
              : runtimeNotice.kind === 'warning'
                ? 'bg-coded'
                : 'bg-primary'
          )}
        />
        <span className="max-w-56 truncate">{runtimeNotice.title}</span>
      </div>
      {bootError ? (
        <span className="rounded bg-error/10 px-2 py-1 font-mono text-2xs text-error">
          backend unavailable
        </span>
      ) : (
        <span
          className="hidden max-w-56 truncate font-mono text-2xs text-muted-foreground/60 2xl:block"
          title={boot?.appDataDir}
        >
          {boot?.appDataDir}
        </span>
      )}
      <button
        onClick={toggleLogs}
        className={cn('rocket-icon-button', logsOpen && 'text-primary')}
        title={logsOpen ? 'Collapse session logs' : 'Open session logs'}
        aria-label={logsOpen ? 'Collapse session logs' : 'Open session logs'}
        data-tooltip={logsOpen ? 'Close logs' : 'Open logs'}
      >
        <Terminal size={14} />
      </button>
      <button
        onClick={openFolder}
        className="rocket-icon-button"
        title="Open workspace folder (Ctrl+O)"
        aria-label="Open workspace folder"
        data-tooltip="Open workspace"
      >
        <FolderOpen size={14} />
      </button>
      <button
        onClick={() => void refresh()}
        className="rocket-icon-button"
        title="Refresh workspaces and agent availability"
        aria-label="Refresh workspaces and agent availability"
        data-tooltip="Refresh"
      >
        <RefreshCw size={14} />
      </button>
    </header>
  );
}

function RocketCanvas({
  bundle,
  selectedWorkspace,
  activeTab,
  setActiveTab,
  selectedPipeline,
  selectedPipelineId,
  setSelectedPipelineId,
  selectedNode,
  selectNode,
  selectedAgent,
  setSelectedAgent,
  agents,
  nodeStats,
  sessions,
  deployments,
  activeWorkspaceCount,
  queue,
  scanResults,
  scanRunning,
  fileResult,
  selectedFilePath,
  setSelectedFilePath,
  commandRef,
  command,
  setCommand,
  unavailableAgent,
  enabledSkills,
  useWorktreeIsolation,
  setUseWorktreeIsolation,
  runSelectedNode,
  runMultiAgentSmokeTest,
  stopSession,
  generatePrompt,
  enqueueNode,
  runRealityScan,
  runQueueItem,
  rerunSession,
  openSessionLog,
  openFolder,
  openSampleWorkspace,
  busyAction,
  toggleSkill,
  refreshSkills,
  openChangedFile,
  onNodeContext,
  onSessionContext,
  onDeploymentContext,
  onSkillContext,
  onFileContext,
  onFolderContext,
  inspectSession,
  inspectDeployment,
  inspectSkill,
  inspectFile,
  showGettingStarted,
  dismissGettingStarted,
}: {
  bundle: WorkspaceBundle | null;
  selectedWorkspace: WorkspaceSummary | null;
  activeTab: CenterTab;
  setActiveTab: (tab: CenterTab) => void;
  selectedPipeline: Pipeline | null;
  selectedPipelineId: string | null;
  setSelectedPipelineId: (id: string) => void;
  selectedNode: PipelineNode | null;
  selectNode: (node: PipelineNode) => void;
  selectedAgent: AgentId;
  setSelectedAgent: (agent: AgentId) => void;
  agents: AgentAvailability[];
  nodeStats: ReturnType<typeof countNodes>;
  sessions: SessionInfo[];
  deployments: AgentDeployment[];
  activeWorkspaceCount: number;
  queue: QueueItem[];
  scanResults: RealityIssue[];
  scanRunning: boolean;
  fileResult: FileReadResult | null;
  selectedFilePath: string | null;
  setSelectedFilePath: (path: string) => void;
  commandRef: React.RefObject<HTMLTextAreaElement | null>;
  command: string;
  setCommand: (value: string) => void;
  unavailableAgent: boolean;
  enabledSkills: SkillInfo[];
  useWorktreeIsolation: boolean;
  setUseWorktreeIsolation: (value: boolean) => void;
  runSelectedNode: () => Promise<void>;
  runMultiAgentSmokeTest: () => Promise<void>;
  stopSession: (sessionId: string) => Promise<void>;
  generatePrompt: () => void;
  enqueueNode: () => void;
  runRealityScan: () => Promise<void>;
  runQueueItem: (item: QueueItem) => Promise<void>;
  rerunSession: (session: SessionInfo) => Promise<void>;
  openSessionLog: (session: SessionInfo) => void;
  openFolder: () => void;
  openSampleWorkspace: () => Promise<void>;
  busyAction: string | null;
  toggleSkill: (name: string) => void;
  refreshSkills: () => Promise<void>;
  openChangedFile: (path: string) => void;
  onNodeContext: (event: React.MouseEvent, node: PipelineNode) => void;
  onSessionContext: (event: React.MouseEvent, session: SessionInfo) => void;
  onDeploymentContext: (event: React.MouseEvent, deployment: AgentDeployment) => void;
  onSkillContext: (event: React.MouseEvent, skill: SkillInfo) => void;
  onFileContext: (event: React.MouseEvent, path: string) => void;
  onFolderContext: (event: React.MouseEvent, path: string) => void;
  inspectSession: (session: SessionInfo) => void;
  inspectDeployment: (deployment: AgentDeployment) => void;
  inspectSkill: (skill: SkillInfo) => void;
  inspectFile: (path: string) => void;
  showGettingStarted: boolean;
  dismissGettingStarted: () => void;
}) {
  const [runtimeNow, setRuntimeNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setRuntimeNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!bundle) {
    return (
      <WorkspaceOnboarding
        openFolder={openFolder}
        openSampleWorkspace={openSampleWorkspace}
        busyAction={busyAction}
      />
    );
  }

  if (activeTab === 'overview') {
    const runningSessions = sessions.filter((session) => sessionIsActive(session.status));
    const finishedSessions = sessions.filter((session) => !sessionIsActive(session.status));
    const attention = nodeStats.broken + nodeStats.mock + nodeStats.partial;
    const activeDeployments = deployments.filter((deployment) => deployment.status === 'running');
    const today = new Date().toDateString();
    const tasksToday = deployments.filter(
      (deployment) => new Date(Number(deployment.createdAt)).toDateString() === today
    ).length;
    const selectedAgentAvailability = agents.find((agent) => agent.id === selectedAgent);
    const unavailableReason =
      selectedAgentAvailability?.status === 'missing'
        ? `${agentLabels[selectedAgent]} is not installed or not on PATH. Install it, then use Refresh.`
        : selectedAgentAvailability?.status === 'not_configured'
          ? `${agentLabels[selectedAgent]} is not configured. Configure it, then use Refresh.`
          : `${agentLabels[selectedAgent]} is currently unavailable. Use Refresh to check again.`;
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {bundle.workspace.name}
              </h1>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {bundle.pipelines.pipelines.length} pipeline
                {bundle.pipelines.pipelines.length === 1 ? '' : 's'} · {nodeStats.total} nodes
                {bundle.git.isRepo ? ` · ${bundle.git.branch ?? 'Git repository'}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-md bg-card/70 p-1">
              {tabItems.slice(1).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-2xs text-muted-foreground hover:bg-hover hover:text-foreground"
                  >
                    <Icon size={11} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {showGettingStarted && (
            <section className="getting-started-card mb-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Zap size={13} className="text-primary" />
                  <p className="text-xs font-semibold text-foreground">Getting started</p>
                </div>
                <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
                  AgentBoard turns pipeline nodes into reviewed prompts, runs local agents in this
                  workspace, and keeps their logs.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setActiveTab('graph')} className="getting-started-step">
                  <span>1</span>
                  Select a node
                </button>
                <button onClick={generatePrompt} className="getting-started-step">
                  <span>2</span>
                  Generate a prompt
                </button>
                <button
                  onClick={() => commandRef.current?.focus()}
                  className="getting-started-step"
                >
                  <span>3</span>
                  Review and run
                </button>
                <span className="context-discovery-hint">
                  <MoreHorizontal size={12} />
                  Right-click items for more actions
                </span>
              </div>
              <button
                onClick={dismissGettingStarted}
                className="rocket-icon-button"
                title="Dismiss getting started"
                aria-label="Dismiss getting started"
                data-tooltip="Dismiss"
              >
                <X size={12} />
              </button>
            </section>
          )}

          <div className="mb-6 grid grid-cols-5 gap-3">
            {[
              {
                label: 'Active agents',
                value: activeDeployments.length,
                tone: 'text-primary',
                icon: Bot,
                hint: 'Agent deployments currently running',
              },
              {
                label: 'Errors',
                value: attention,
                tone: 'text-coded',
                icon: AlertTriangle,
                hint: 'Broken, mock, or partial nodes',
              },
              {
                label: 'Tasks today',
                value: tasksToday,
                tone: 'text-accent',
                icon: Activity,
                hint: 'Deployments created today',
              },
              {
                label: 'Pipelines',
                value: bundle.pipelines.pipelines.length,
                tone: 'text-foreground',
                icon: GitBranch,
                hint: 'Pipelines in this workspace',
              },
              {
                label: 'Workspaces',
                value: activeWorkspaceCount,
                tone: 'text-foreground',
                icon: FolderOpen,
                hint: 'Registered active workspaces',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() =>
                    item.label === 'Active agents'
                      ? setActiveTab('overview')
                      : item.label === 'Errors'
                        ? setActiveTab('graph')
                        : item.label === 'Pipelines'
                          ? setActiveTab('graph')
                          : undefined
                  }
                  className="rocket-metric group text-left"
                  title={item.hint}
                >
                  <Icon size={13} className={item.tone} />
                  <span className={cn('font-mono text-lg font-semibold tabular-nums', item.tone)}>
                    {item.value}
                  </span>
                  <span className="text-2xs text-muted-foreground">{item.label}</span>
                </button>
              );
            })}
          </div>

          <section className="rocket-command-card mb-6">
            <div className="flex items-center gap-2 border-b border-subtle/70 px-4 py-3">
              <Sparkles size={13} className="text-primary" />
              <span className="text-xs font-medium">Ask an agent to…</span>
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={selectedAgent}
                  onChange={(event) => setSelectedAgent(event.target.value as AgentId)}
                  className="rounded-md border border-subtle bg-input px-2 py-1 font-mono text-2xs outline-none focus:border-ring"
                >
                  {agents
                    .filter((agent) => runnableAgents.includes(agent.id))
                    .map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.label} · {formatAgentStatus(agent)}
                      </option>
                    ))}
                </select>
                <span className="hidden text-2xs text-muted-foreground lg:block">
                  {selectedNode ? selectedNode.label : 'Select a pipeline node'}
                </span>
              </div>
            </div>
            <div className="agent-safety-hint">
              <Info size={12} className="shrink-0" />
              <span className="min-w-0 flex-1">
                {unavailableAgent
                  ? unavailableReason
                  : selectedAgent === 'powershell'
                    ? 'PowerShell runs this field as a local command in the workspace. Review it before Run.'
                    : selectedAgent === 'cmd'
                      ? 'CMD runs this field as a local command in the workspace. Review it before Run.'
                      : `${agentLabels[selectedAgent]} receives this as a task inside the workspace. Review the generated prompt before Run.`}
              </span>
              {selectedAgent === 'powershell' && (
                <span className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={() => setCommand('Write-Output AgentBoardSmokeTest')}
                    className="text-primary hover:text-primary/80"
                    title="Fill in a harmless PowerShell smoke command"
                  >
                    Use safe smoke command
                  </button>
                  <button
                    onClick={() => void runMultiAgentSmokeTest()}
                    className="text-accent hover:text-accent/80 disabled:opacity-45"
                    disabled={busyAction === 'multi-agent-smoke'}
                    title="Start the built-in Agent A and Agent B overlap test"
                  >
                    {busyAction === 'multi-agent-smoke'
                      ? 'Starting smoke test...'
                      : 'Run multi-agent smoke'}
                  </button>
                </span>
              )}
            </div>
            <textarea
              ref={commandRef}
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="Describe the result you want, or generate a node-aware prompt…"
              className="h-28 w-full resize-none bg-transparent px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60"
            />
            <div className="flex items-center justify-between gap-3 border-t border-subtle/70 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2 text-2xs text-muted-foreground">
                <kbd>Ctrl+K</kbd>
                <span className="hidden sm:inline">focus</span>
                <span className="text-muted-foreground/30">·</span>
                <span>{enabledSkills.length} skills</span>
                <label
                  className="flex items-center gap-1.5"
                  title={
                    bundle.git.isRepo
                      ? 'Create a unique Git worktree for this pipeline-node session'
                      : 'Worktree isolation requires a Git repository'
                  }
                >
                  <input
                    type="checkbox"
                    checked={useWorktreeIsolation && bundle.git.isRepo}
                    disabled={!bundle.git.isRepo}
                    onChange={(event) => setUseWorktreeIsolation(event.target.checked)}
                    className="h-3 w-3 rounded border-subtle bg-input"
                  />
                  {bundle.git.isRepo ? 'isolated worktree' : 'shared workspace'}
                </label>
                {unavailableAgent && <span className="text-error">agent unavailable</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={enqueueNode} className="btn-ghost text-xs">
                  <Plus size={12} />
                  Queue
                </button>
                <button onClick={generatePrompt} className="btn-ghost text-xs">
                  <Sparkles size={12} />
                  Generate
                </button>
                <button
                  onClick={() => void runSelectedNode()}
                  disabled={busyAction === 'run-agent' || unavailableAgent}
                  className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-45"
                  title={
                    busyAction === 'run-agent'
                      ? 'An agent session is starting'
                      : unavailableAgent
                        ? unavailableReason
                        : 'Run the reviewed prompt in the selected workspace'
                  }
                >
                  {busyAction === 'run-agent' ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Play size={12} />
                  )}
                  Run
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold">Running agents / sessions</h2>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className="text-2xs text-muted-foreground hover:text-foreground"
                >
                  View all
                </button>
              </div>
              <div className="rocket-list">
                {runningSessions.length === 0 && (
                  <EmptyList
                    icon={Activity}
                    title="No running sessions"
                    body="Start an agent or run the PowerShell multi-agent smoke test. Each process receives its own session and log."
                  />
                )}
                {runningSessions.map((session) => (
                  <div
                    key={session.id}
                    onContextMenu={(event) => onSessionContext(event, session)}
                    className="rocket-list-row"
                  >
                    <SessionStatusDot status={session.status} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {agentLabels[session.agent]}{' '}
                        <span className="text-muted-foreground">
                          in {basename(session.workspacePath)}
                        </span>
                      </p>
                      <p className="truncate text-2xs text-muted-foreground">
                        {session.nodeName ?? session.prompt.split(/\r?\n/, 1)[0]}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-2xs text-primary">
                      {sessionStatusLabel(session)} / {sessionRuntime(session, runtimeNow)}
                    </span>
                    <button
                      onClick={() => {
                        inspectSession(session);
                        openSessionLog(session);
                      }}
                      className="rocket-icon-button"
                      title="Open separate session log"
                    >
                      <Terminal size={12} />
                    </button>
                    <button
                      onClick={() => void stopSession(session.id)}
                      className="rocket-icon-button text-error"
                      title={`Stop only ${agentLabels[session.agent]} session`}
                    >
                      <Square size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mb-2 mt-4 flex items-center justify-between">
                <h2 className="text-xs font-semibold">Recent activity</h2>
                <span className="font-mono text-2xs text-muted-foreground">
                  {deployments.length}
                </span>
              </div>
              <div className="rocket-list">
                {deployments.slice(0, 4).map((deployment) => (
                  <button
                    key={deployment.id}
                    onClick={() => inspectDeployment(deployment)}
                    onContextMenu={(event) => onDeploymentContext(event, deployment)}
                    className="rocket-list-row"
                  >
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        deploymentStatusClass(deployment.status)
                      )}
                    />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-xs font-medium">{deployment.agentName}</p>
                      <p className="truncate text-2xs text-muted-foreground">
                        {deployment.targetType.replace('_', ' ')} / {deployment.targetLabel}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                      {deploymentStatusLabel(deployment.status)} /{' '}
                      {sessionTimestamp(deployment.createdAt)}
                    </span>
                  </button>
                ))}
                {!deployments.length &&
                  finishedSessions.slice(0, 4).map((session) => (
                    <button
                      key={session.id}
                      onClick={() => {
                        inspectSession(session);
                        openSessionLog(session);
                      }}
                      onContextMenu={(event) => onSessionContext(event, session)}
                      className="rocket-list-row"
                    >
                      <SessionStatusDot status={session.status} />
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate text-xs font-medium">{agentLabels[session.agent]}</p>
                        <p className="truncate text-2xs text-muted-foreground">
                          {session.nodeName ?? session.prompt}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                        {sessionStatusLabel(session)} / {sessionTimestamp(session.startedAt)}
                      </span>
                    </button>
                  ))}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-xs font-semibold">Active agents</h2>
              <div className="rocket-soft-card p-3">
                <div className="flex flex-wrap gap-2">
                  {agents
                    .filter((agent) => runnableAgents.includes(agent.id))
                    .map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => setSelectedAgent(agent.id)}
                        className={cn(
                          'agent-pill',
                          selectedAgent === agent.id &&
                            'border-primary/35 bg-primary/[0.08] text-foreground'
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            agent.status === 'available' || agent.status === 'running'
                              ? 'bg-primary'
                              : 'bg-error'
                          )}
                        />
                        {agentLabels[agent.id]}
                      </button>
                    ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-subtle/70 pt-3">
                  <button onClick={() => setActiveTab('reality')} className="overview-link">
                    <ShieldAlert size={12} />
                    <span>Scanner</span>
                    <strong>{scanResults.length}</strong>
                  </button>
                  <button onClick={() => setActiveTab('git')} className="overview-link">
                    <GitCompare size={12} />
                    <span>Changes</span>
                    <strong>
                      {bundle.git.changedFiles.length + bundle.git.untrackedFiles.length}
                    </strong>
                  </button>
                  <button onClick={() => setActiveTab('skills')} className="overview-link">
                    <Puzzle size={12} />
                    <span>Skills</span>
                    <strong>{bundle.skills.length}</strong>
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'graph') {
    return (
      <RocketPipelineView
        bundle={bundle}
        pipeline={selectedPipeline}
        selectedPipelineId={selectedPipelineId}
        setSelectedPipelineId={setSelectedPipelineId}
        selectedNode={selectedNode}
        selectNode={selectNode}
        onNodeContext={onNodeContext}
      />
    );
  }

  if (activeTab === 'timeline') {
    return (
      <RocketHistoryView
        sessions={sessions}
        queue={queue}
        openSessionLog={openSessionLog}
        inspectSession={inspectSession}
        rerunSession={rerunSession}
        runQueueItem={runQueueItem}
        onSessionContext={onSessionContext}
      />
    );
  }

  if (activeTab === 'reality') {
    return (
      <RocketScannerView
        results={scanResults}
        running={scanRunning}
        runScan={runRealityScan}
        openFile={openChangedFile}
        inspectFile={inspectFile}
        onFileContext={onFileContext}
      />
    );
  }

  if (activeTab === 'git') {
    return (
      <RocketGitView
        bundle={bundle}
        openFile={openChangedFile}
        inspectFile={inspectFile}
        onFileContext={onFileContext}
      />
    );
  }

  if (activeTab === 'skills') {
    return (
      <RocketSkillsView
        skills={bundle.skills}
        workspacePath={bundle.workspace.path}
        selectedAgent={selectedAgent}
        toggleSkill={toggleSkill}
        inspectSkill={inspectSkill}
        onSkillContext={onSkillContext}
        refreshSkills={refreshSkills}
      />
    );
  }

  return (
    <RocketFilesView
      node={selectedNode}
      fileResult={fileResult}
      selectedFilePath={selectedFilePath}
      setSelectedFilePath={setSelectedFilePath}
      inspectFile={inspectFile}
      onFileContext={onFileContext}
      onFolderContext={onFolderContext}
    />
  );
}

function RocketPipelineView({
  bundle,
  pipeline,
  selectedPipelineId,
  setSelectedPipelineId,
  selectedNode,
  selectNode,
  onNodeContext,
}: {
  bundle: WorkspaceBundle;
  pipeline: Pipeline | null;
  selectedPipelineId: string | null;
  setSelectedPipelineId: (id: string) => void;
  selectedNode: PipelineNode | null;
  selectNode: (node: PipelineNode) => void;
  onNodeContext: (event: React.MouseEvent, node: PipelineNode) => void;
}) {
  if (!pipeline) {
    return (
      <EmptyState
        icon={GitBranch}
        title="No pipeline configured"
        body=".agentboard/pipelines.json exists but contains no pipeline definitions. Add a pipeline, then use Refresh in the top-right corner."
      />
    );
  }
  const counts = countNodes([pipeline]);
  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Pipeline</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Select a node to inspect. Right-click for actions.
            </p>
          </div>
          <select
            value={selectedPipelineId ?? ''}
            onChange={(event) => setSelectedPipelineId(event.target.value)}
            className="rounded-md border border-subtle bg-input px-3 py-1.5 font-mono text-xs outline-none focus:border-ring"
          >
            {bundle.pipelines.pipelines.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-5 flex items-center gap-5 border-y border-subtle/70 py-2.5">
          {[
            ['Total', counts.total, 'text-foreground'],
            ['Ready', counts.production_ready + counts.tested, 'text-primary'],
            ['In progress', counts.coded + counts.partial, 'text-coded'],
            ['Attention', counts.broken + counts.mock, 'text-error'],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="flex items-baseline gap-2">
              <span className={cn('font-mono text-sm font-semibold', String(tone))}>
                {String(value)}
              </span>
              <span className="text-2xs text-muted-foreground">{String(label)}</span>
            </div>
          ))}
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {pipeline.nodes.map((node) => {
            const meta = statusMeta[node.status];
            const selected = selectedNode?.id === node.id;
            return (
              <button
                key={node.id}
                onClick={() => selectNode(node)}
                onContextMenu={(event) => onNodeContext(event, node)}
                className={cn(
                  'pipeline-node-card group',
                  selected &&
                    'border-primary/45 bg-primary/[0.045] shadow-[0_0_0_1px_rgba(74,222,128,0.12)]'
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: meta.color.includes('error')
                        ? '#ef4444'
                        : meta.color.includes('coded')
                          ? '#f59e0b'
                          : meta.color.includes('running')
                            ? '#4ade80'
                            : '#737b88',
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-left text-xs font-medium">
                    {node.label}
                  </span>
                  <span className={cn('font-mono text-[9px]', meta.color)}>{meta.label}</span>
                  <MoreHorizontal
                    size={13}
                    className="text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </div>
                <div className="mt-2 flex gap-3 font-mono text-2xs text-muted-foreground">
                  <span>{node.files.length} files</span>
                  <span>{node.issues.length} issues</span>
                  <span>{node.checks.length} checks</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RocketHistoryView({
  sessions,
  queue,
  openSessionLog,
  inspectSession,
  rerunSession,
  runQueueItem,
  onSessionContext,
}: {
  sessions: SessionInfo[];
  queue: QueueItem[];
  openSessionLog: (session: SessionInfo) => void;
  inspectSession: (session: SessionInfo) => void;
  rerunSession: (session: SessionInfo) => Promise<void>;
  runQueueItem: (item: QueueItem) => Promise<void>;
  onSessionContext: (event: React.MouseEvent, session: SessionInfo) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<AgentId, SessionInfo[]>();
    sessions.forEach((session) =>
      map.set(session.agent, [...(map.get(session.agent) ?? []), session])
    );
    return [...map.entries()];
  }, [sessions]);
  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5">
          <h1 className="text-lg font-semibold">History</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Click a session to inspect it, use the log button to open output, or right-click for
            more actions.
          </p>
        </div>
        {queue.length > 0 && (
          <section className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="section-label">Run queue</h2>
              <span className="font-mono text-2xs text-muted-foreground">{queue.length}</span>
            </div>
            <div className="rocket-list">
              {queue.map((item) => (
                <div key={item.id} className="rocket-list-row">
                  <span
                    className={cn(
                      'rounded border px-1.5 py-0.5 font-mono text-2xs',
                      queueStatusTone(item.status)
                    )}
                  >
                    {item.status.replace('_', ' ')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{item.nodeLabel}</p>
                    <p className="truncate text-2xs text-muted-foreground">
                      {agentLabels[item.agent]} · {sessionTimestamp(item.createdAt)}
                    </p>
                  </div>
                  {item.status === 'queued' && (
                    <button
                      onClick={() => void runQueueItem(item)}
                      className="btn-primary px-2 py-1 text-2xs"
                    >
                      <Play size={10} /> Run
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
        {groups.length === 0 && (
          <EmptyState
            icon={History}
            title="No session history"
            body="Agent runs appear here with their status, prompt, timestamp, and durable log. Start from a pipeline node on the Overview screen."
          />
        )}
        <div className="space-y-5">
          {groups.map(([agent, agentSessions]) => (
            <section key={agent}>
              <div className="mb-2 flex items-center gap-2">
                <span className="section-label">{agentLabels[agent]}</span>
                <span className="font-mono text-2xs text-muted-foreground">
                  {agentSessions.length}
                </span>
              </div>
              <div className="rocket-list">
                {agentSessions.map((session) => {
                  const rerunnable = !session.prompt.startsWith('Restored from ');
                  return (
                    <div
                      key={session.id}
                      onContextMenu={(event) => onSessionContext(event, session)}
                      className="rocket-list-row"
                    >
                      <SessionStatusDot status={session.status} />
                      <button
                        onClick={() => inspectSession(session)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-xs font-medium">{session.prompt}</p>
                        <p className="mt-0.5 font-mono text-2xs text-muted-foreground">
                          {sessionStatusLabel(session)} · {sessionTimestamp(session.startedAt)}
                        </p>
                      </button>
                      <button
                        onClick={() => openSessionLog(session)}
                        className="rocket-icon-button"
                        title="Open session log"
                        aria-label="Open session log"
                        data-tooltip="Open log"
                      >
                        <Terminal size={12} />
                      </button>
                      <button
                        onClick={() => void rerunSession(session)}
                        disabled={!rerunnable}
                        className="rocket-icon-button disabled:cursor-not-allowed disabled:opacity-30"
                        title={rerunnable ? 'Rerun prompt' : 'Legacy prompt unavailable'}
                        aria-label={
                          rerunnable
                            ? 'Rerun session prompt'
                            : 'Rerun unavailable because prompt metadata is missing'
                        }
                        data-tooltip={rerunnable ? 'Rerun prompt' : 'Prompt unavailable'}
                      >
                        <RotateCcw size={12} />
                      </button>
                      <MoreHorizontal
                        size={12}
                        className="shrink-0 text-muted-foreground/45"
                        aria-hidden="true"
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function RocketScannerView({
  results,
  running,
  runScan,
  openFile,
  inspectFile,
  onFileContext,
}: {
  results: RealityIssue[];
  running: boolean;
  runScan: () => Promise<void>;
  openFile: (path: string) => void;
  inspectFile: (path: string) => void;
  onFileContext: (event: React.MouseEvent, path: string) => void;
}) {
  const counts = {
    high: results.filter((result) => result.severity === 'high').length,
    medium: results.filter((result) => result.severity === 'medium').length,
    low: results.filter((result) => result.severity === 'low').length,
  };
  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Reality scanner</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Verified code findings, grouped by severity.
            </p>
          </div>
          <button onClick={() => void runScan()} className="btn-primary text-xs" disabled={running}>
            {running ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
            Run scan
          </button>
        </div>
        <div className="mb-4 flex gap-3">
          {(['high', 'medium', 'low'] as const).map((severity) => (
            <div key={severity} className="rocket-metric max-w-36">
              <span
                className={cn(
                  'font-mono text-lg font-semibold',
                  severity === 'high'
                    ? 'text-error'
                    : severity === 'medium'
                      ? 'text-coded'
                      : 'text-muted-foreground'
                )}
              >
                {counts[severity]}
              </span>
              <span className="text-2xs capitalize text-muted-foreground">{severity}</span>
            </div>
          ))}
        </div>
        <div className="rocket-list">
          {results.length === 0 && (
            <EmptyList
              icon={ShieldAlert}
              title="No scan has run yet"
              body="Run scan to read the workspace for common mock, placeholder, and not-implemented patterns. The scanner does not edit files."
            />
          )}
          {results.map((result, index) => (
            <div
              key={`${result.file}-${result.line}-${index}`}
              onContextMenu={(event) => onFileContext(event, result.file)}
              className="rocket-list-row"
            >
              <span
                className={cn(
                  'w-14 shrink-0 font-mono text-2xs',
                  result.severity === 'high'
                    ? 'text-error'
                    : result.severity === 'medium'
                      ? 'text-coded'
                      : 'text-muted-foreground'
                )}
              >
                {result.severity}
              </span>
              <button onClick={() => inspectFile(result.file)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-mono text-xs">
                  {result.file}:{result.line}
                </p>
                <p className="truncate text-2xs text-muted-foreground">
                  {result.pattern} · {result.snippet}
                </p>
              </button>
              <button
                onClick={() => openFile(result.file)}
                className="rocket-icon-button"
                title="Open finding file"
                aria-label="Open finding file"
                data-tooltip="Open file"
              >
                <FileCode size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RocketGitView({
  bundle,
  openFile,
  inspectFile,
  onFileContext,
}: {
  bundle: WorkspaceBundle;
  openFile: (path: string) => void;
  inspectFile: (path: string) => void;
  onFileContext: (event: React.MouseEvent, path: string) => void;
}) {
  const files = [
    ...bundle.git.changedFiles.map((file) => ({ path: file.path, status: file.status || 'M' })),
    ...bundle.git.untrackedFiles.map((path) => ({ path, status: '??' })),
  ];
  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5">
          <h1 className="text-lg font-semibold">Git review</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {bundle.git.isRepo
              ? `Branch ${bundle.git.branch ?? 'unknown'}`
              : 'Workspace is not a Git repository.'}
          </p>
        </div>
        {bundle.git.error && (
          <div className="mb-4 rounded-md border border-coded/20 bg-coded/[0.06] px-3 py-2 text-xs text-coded">
            {bundle.git.error}
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rocket-list">
            {files.length === 0 && (
              <EmptyList
                icon={GitCompare}
                title={bundle.git.isRepo ? 'Working tree is clean' : 'Git is not available here'}
                body={
                  bundle.git.isRepo
                    ? 'No tracked or untracked file changes were reported. AgentBoard has not modified the repository.'
                    : 'Initialize Git in this workspace to review changed files and create worktrees.'
                }
              />
            )}
            {files.map((file) => (
              <div
                key={`${file.status}-${file.path}`}
                onContextMenu={(event) => onFileContext(event, file.path)}
                className="rocket-list-row"
              >
                <span className="w-7 font-mono text-2xs text-coded">{file.status}</span>
                <button
                  onClick={() => inspectFile(file.path)}
                  className="min-w-0 flex-1 truncate text-left font-mono text-xs"
                >
                  {file.path}
                </button>
                <button
                  onClick={() => openFile(file.path)}
                  className="rocket-icon-button"
                  title="Open changed file"
                  aria-label="Open changed file"
                  data-tooltip="Open file"
                >
                  <FileCode size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="rocket-soft-card p-3">
            <p className="section-label">Diff stat</p>
            <pre className="mt-3 whitespace-pre-wrap font-mono text-2xs leading-relaxed text-muted-foreground">
              {bundle.git.diffStat || 'No diff stat available.'}
            </pre>
            <p className="mt-4 border-t border-subtle/70 pt-3 text-2xs leading-relaxed text-muted-foreground">
              Full patch hunks are not exposed by the current backend contract.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RocketSkillsView({
  skills,
  workspacePath,
  selectedAgent,
  toggleSkill,
  inspectSkill,
  onSkillContext,
  refreshSkills,
}: {
  skills: SkillInfo[];
  workspacePath: string;
  selectedAgent: AgentId;
  toggleSkill: (name: string) => void;
  inspectSkill: (skill: SkillInfo) => void;
  onSkillContext: (event: React.MouseEvent, skill: SkillInfo) => void;
  refreshSkills: () => Promise<void>;
}) {
  const [section, setSection] = useState<'installed' | 'marketplace'>('installed');
  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold">Skills</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Instruction and context files for {agentLabels[selectedAgent]}. Remote repository code
              is never executed.
            </p>
          </div>
          <div className="flex rounded border border-subtle bg-sidebar p-1">
            <button
              onClick={() => setSection('installed')}
              className={cn(
                'rounded px-3 py-1.5 text-xs',
                section === 'installed' ? 'bg-hover text-foreground' : 'text-muted-foreground'
              )}
            >
              Installed
            </button>
            <button
              onClick={() => setSection('marketplace')}
              className={cn(
                'rounded px-3 py-1.5 text-xs',
                section === 'marketplace' ? 'bg-hover text-foreground' : 'text-muted-foreground'
              )}
            >
              Marketplace
            </button>
          </div>
        </div>
        {section === 'marketplace' ? (
          <GithubSkillsMarketplace
            workspacePath={workspacePath}
            skills={skills}
            onRefresh={refreshSkills}
          />
        ) : (
          <div className="rocket-list">
            {skills.length === 0 && (
              <EmptyList
                icon={Puzzle}
                title="No workspace skills installed"
                body="Install a reviewed GitHub skill from Marketplace or add a local skill under .agentboard/skills."
              />
            )}
            {skills.map((skill) => {
              const compatible =
                !skill.manifest.compatible_agents?.length ||
                skill.manifest.compatible_agents.includes(selectedAgent);
              const trustedForUse =
                skill.manifest.source !== 'github' ||
                skill.trustState === 'reviewed' ||
                skill.trustState === 'trusted';
              return (
                <div
                  key={skill.name}
                  onContextMenu={(event) => onSkillContext(event, skill)}
                  className="rocket-list-row"
                >
                  <button onClick={() => inspectSkill(skill)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xs font-medium">{skill.manifest.title}</p>
                    <p className="truncate text-2xs text-muted-foreground">{skill.description}</p>
                  </button>
                  {!compatible && (
                    <span className="font-mono text-2xs text-muted-foreground">incompatible</span>
                  )}
                  <span className="font-mono text-2xs text-muted-foreground">
                    {skill.manifest.source} / {skill.trustState}
                  </span>
                  <button
                    onClick={() => compatible && trustedForUse && toggleSkill(skill.name)}
                    disabled={!compatible || !trustedForUse}
                    className={cn(
                      'skill-toggle',
                      skill.enabled && compatible && trustedForUse && 'skill-toggle-on'
                    )}
                    title={
                      !compatible
                        ? 'Not compatible with selected agent'
                        : !trustedForUse
                          ? 'Review or trust this GitHub skill in Marketplace before enabling it'
                          : skill.enabled
                            ? 'Disable skill'
                            : 'Enable skill'
                    }
                  >
                    <span />
                  </button>
                  <MoreHorizontal
                    size={12}
                    className="shrink-0 text-muted-foreground/45"
                    aria-hidden="true"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function RocketFilesView({
  node,
  fileResult,
  selectedFilePath,
  setSelectedFilePath,
  inspectFile,
  onFileContext,
  onFolderContext,
}: {
  node: PipelineNode | null;
  fileResult: FileReadResult | null;
  selectedFilePath: string | null;
  setSelectedFilePath: (path: string) => void;
  inspectFile: (path: string) => void;
  onFileContext: (event: React.MouseEvent, path: string) => void;
  onFolderContext: (event: React.MouseEvent, path: string) => void;
}) {
  if (!node) {
    return (
      <EmptyState
        icon={FileCode}
        title="No node selected"
        body="Open Pipeline and select a node. Its declared concerned files will appear here without editing them."
      />
    );
  }
  const lines = fileResult?.content.split(/\r?\n/) ?? [];
  const folders = [
    ...new Set(node.files.map((file) => dirname(file.path)).filter((path) => path !== '.')),
  ];
  return (
    <div className="grid h-full grid-cols-[220px_minmax(0,1fr)] overflow-hidden">
      <aside className="border-r border-subtle bg-sidebar/50 p-3">
        <p className="mb-2 section-label">Concerned files</p>
        <p className="mb-3 text-2xs leading-relaxed text-muted-foreground">
          Click to inspect. Right-click a folder or file to deploy an agent at that target.
        </p>
        {folders.length > 0 && (
          <div className="mb-3 space-y-1">
            <p className="px-2 section-label">Folders</p>
            {folders.map((folder) => (
              <button
                key={folder}
                onContextMenu={(event) => onFolderContext(event, folder)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-hover hover:text-foreground"
                title={`${folder}\nRight-click for folder actions`}
              >
                <Folder size={11} />
                <span className="min-w-0 truncate font-mono">{folder}</span>
              </button>
            ))}
          </div>
        )}
        <div className="space-y-1">
          {node.files.map((file) => (
            <button
              key={file.path}
              onClick={() => {
                setSelectedFilePath(file.path);
                inspectFile(file.path);
              }}
              onContextMenu={(event) => onFileContext(event, file.path)}
              className={cn(
                'w-full rounded-md px-2 py-2 text-left',
                selectedFilePath === file.path
                  ? 'bg-primary/[0.08] text-foreground'
                  : 'text-muted-foreground hover:bg-hover hover:text-foreground'
              )}
            >
              <span className="block truncate font-mono text-xs">{file.path}</span>
            </button>
          ))}
        </div>
      </aside>
      <div className="min-w-0 overflow-auto bg-[#0b0d10]">
        {!fileResult ? (
          <EmptyState icon={FileCode} title="Loading file" body="Reading concerned file content." />
        ) : !fileResult.exists ? (
          <EmptyState
            icon={AlertTriangle}
            title="File unavailable"
            body={fileResult.error ?? fileResult.path}
          />
        ) : (
          <pre className="code-block min-w-max p-5 text-foreground/90">
            {lines.map((line, index) => (
              <div key={`${fileResult.path}-${index}`}>
                <span className="mr-4 inline-block w-9 select-none text-right text-2xs text-muted-foreground/35">
                  {index + 1}
                </span>
                <span>{line || ' '}</span>
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}

function SessionStatusDot({ status }: { status: SessionStatus }) {
  return (
    <span
      className={cn(
        'h-2 w-2 shrink-0 rounded-full',
        sessionIsActive(status)
          ? 'status-dot-running pulse-green'
          : status === 'failed' || status === 'external_blocked'
            ? 'status-dot-error'
            : status === 'blocked_environment'
              ? 'bg-coded'
            : status === 'completed' || status === 'completed_inspection'
              ? 'bg-accent'
              : status === 'stopped'
                ? 'bg-coded'
                : 'status-dot-idle'
      )}
    />
  );
}

function StatusBadge({ status }: { status: NodeStatus }) {
  const meta = statusMeta[status];
  return (
    <span
      className={cn('rounded-md border px-2 py-1 font-mono text-2xs font-medium', meta.color)}
      style={{ backgroundColor: meta.bg, borderColor: meta.border }}
    >
      {meta.label}
    </span>
  );
}

function RocketInspector({
  selection,
  tab,
  setTab,
  close,
  bundle,
  workspaces,
  agents,
  agentProfiles,
  deployments,
  sessions,
  selectedNode,
  scanResults,
  selectedAgent,
  command,
  prDraft,
  includeScanInPrompt,
  setIncludeScanInPrompt,
  toggleSkill,
  generatePrompt,
  generatePrDraft,
  openChangedFile,
  openSessionLog,
  stopSession,
  editAgentProfile,
  rerunSession,
  runSelectedNode,
  createWorktree,
  copyText,
  onFileContext,
}: {
  selection: InspectorSelection;
  tab: InspectorTab;
  setTab: (tab: InspectorTab) => void;
  close: () => void;
  bundle: WorkspaceBundle | null;
  workspaces: WorkspaceSummary[];
  agents: AgentAvailability[];
  agentProfiles: AgentProfile[];
  deployments: AgentDeployment[];
  sessions: SessionInfo[];
  selectedNode: PipelineNode | null;
  scanResults: RealityIssue[];
  selectedAgent: AgentId;
  command: string;
  prDraft: string;
  includeScanInPrompt: boolean;
  setIncludeScanInPrompt: (value: boolean) => void;
  toggleSkill: (name: string) => void;
  generatePrompt: () => void;
  generatePrDraft: () => void;
  openChangedFile: (path: string) => void;
  openSessionLog: (session: SessionInfo) => void;
  stopSession: (sessionId: string) => Promise<void>;
  editAgentProfile: (profile: AgentProfile) => void;
  rerunSession: (session: SessionInfo) => Promise<void>;
  runSelectedNode: () => Promise<void>;
  createWorktree: () => Promise<void>;
  copyText: (label: string, value: string) => Promise<void>;
  onFileContext: (event: React.MouseEvent, path: string) => void;
}) {
  const allNodes = bundle?.pipelines.pipelines.flatMap((pipeline) => pipeline.nodes) ?? [];
  const node =
    selection.kind === 'node'
      ? (allNodes.find((item) => item.id === selection.id) ?? selectedNode)
      : null;
  const workspace =
    selection.kind === 'workspace'
      ? (workspaces.find((item) => item.id === selection.id) ?? null)
      : null;
  const agent =
    selection.kind === 'agent' ? (agents.find((item) => item.id === selection.id) ?? null) : null;
  const profile =
    selection.kind === 'profile'
      ? (agentProfiles.find((item) => item.id === selection.id) ?? null)
      : null;
  const deployment =
    selection.kind === 'deployment'
      ? (deployments.find((item) => item.id === selection.id) ?? null)
      : null;
  const session =
    selection.kind === 'session'
      ? (sessions.find((item) => item.id === selection.id) ?? null)
      : null;
  const deploymentSession = deployment?.sessionId
    ? (sessions.find((item) => item.id === deployment.sessionId) ?? null)
    : null;
  const skill =
    selection.kind === 'skill'
      ? (bundle?.skills.find((item) => item.name === selection.id) ?? null)
      : null;
  const file =
    selection.kind === 'file'
      ? (allNodes
          .flatMap((item) => item.files)
          .find((item) => normalizedPath(item.path) === normalizedPath(selection.id)) ?? null)
      : null;
  const nodePaths = new Set(node?.files.map((item) => normalizedPath(item.path)) ?? []);
  const nodeFindings = scanResults.filter((finding) => nodePaths.has(normalizedPath(finding.file)));
  const diffEntries = parseDiffStat(bundle?.git.diffStat ?? '');
  const promptAvailable = session ? !session.prompt.startsWith('Restored from ') : false;

  const title =
    node?.label ??
    workspace?.name ??
    agent?.label ??
    profile?.name ??
    deployment?.agentName ??
    (session ? `${agentLabels[session.agent]} session` : null) ??
    skill?.manifest.title ??
    (selection.kind === 'file' ? basename(selection.id) : 'Inspector');
  const subtitle =
    selection.kind === 'node'
      ? 'Pipeline node'
      : selection.kind === 'workspace'
        ? 'Workspace'
        : selection.kind === 'agent'
          ? 'Local command'
          : selection.kind === 'profile'
            ? 'Agent profile'
            : selection.kind === 'deployment'
              ? 'Agent deployment'
              : selection.kind === 'session'
                ? 'Durable session'
                : selection.kind === 'skill'
                  ? 'Local skill'
                  : 'Concerned file';

  return (
    <aside className="rocket-inspector slide-in-right" aria-label={`${subtitle} inspector`}>
      <div className="rocket-inspector-header">
        <div className="min-w-0">
          <p className="section-label">{subtitle}</p>
          <h2 className="mt-1 truncate text-sm font-semibold text-foreground">{title}</h2>
        </div>
        <button
          className="rocket-icon-button"
          onClick={close}
          title="Close inspector"
          aria-label="Close inspector"
          data-tooltip="Close"
        >
          <PanelRightClose size={15} />
        </button>
      </div>

      {node && (
        <div className="rocket-inspector-tabs" role="tablist" aria-label="Review sections">
          {(
            [
              ['summary', 'Summary'],
              ['files', 'Files'],
              ['scanner', 'Scanner'],
              ['git', 'Git'],
              ['prompt', 'Prompt'],
            ] as Array<[InspectorTab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn('rocket-inspector-tab', tab === id && 'is-active')}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="rocket-inspector-body">
        {node && tab === 'summary' && (
          <div className="space-y-4">
            <InspectorSection label="Status">
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={node.status} />
                <span className="font-mono text-2xs text-muted-foreground">
                  {node.checks.filter((check) => check.status === 'pass').length}/
                  {node.checks.length} checks pass
                </span>
              </div>
            </InspectorSection>
            <InspectorSection label="Issues">
              {node.issues.length ? (
                <div className="space-y-2">
                  {node.issues.map((issue) => (
                    <p
                      key={issue}
                      className="rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground"
                    >
                      {issue}
                    </p>
                  ))}
                </div>
              ) : (
                <InspectorEmpty>No issues recorded for this node.</InspectorEmpty>
              )}
            </InspectorSection>
            <InspectorSection label="Checks">
              <div className="space-y-1">
                {node.checks.map((check) => (
                  <div key={check.name} className="rocket-property-row">
                    <span className="truncate text-xs text-foreground">{check.name}</span>
                    <span
                      className={cn(
                        'font-mono text-2xs',
                        check.status === 'pass'
                          ? 'text-primary'
                          : check.status === 'fail'
                            ? 'text-error'
                            : 'text-coded'
                      )}
                    >
                      {check.status}
                    </span>
                  </div>
                ))}
                {!node.checks.length && <InspectorEmpty>No checks declared.</InspectorEmpty>}
              </div>
            </InspectorSection>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primary justify-center" onClick={() => void runSelectedNode()}>
                <Play size={12} />
                Run
              </button>
              <button className="btn-ghost justify-center" onClick={() => void createWorktree()}>
                <GitBranch size={12} />
                Worktree
              </button>
            </div>
          </div>
        )}

        {node && tab === 'files' && (
          <InspectorSection label={`${node.files.length} concerned files`}>
            <div className="space-y-1">
              {node.files.map((item) => (
                <button
                  key={item.path}
                  className="rocket-property-card w-full text-left"
                  onClick={() => openChangedFile(item.path)}
                  onContextMenu={(event) => onFileContext(event, item.path)}
                >
                  <span className="block truncate font-mono text-xs text-foreground">
                    {item.path}
                  </span>
                  <span className="mt-1 block text-2xs leading-relaxed text-muted-foreground">
                    {item.reason}
                  </span>
                </button>
              ))}
              {!node.files.length && <InspectorEmpty>No concerned files declared.</InspectorEmpty>}
            </div>
          </InspectorSection>
        )}

        {node && tab === 'scanner' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-foreground">
                  {nodeFindings.length} attached findings
                </p>
                <p className="mt-1 text-2xs text-muted-foreground">
                  Matched to this node&apos;s concerned files.
                </p>
              </div>
              <label className="flex items-center gap-2 text-2xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={includeScanInPrompt}
                  onChange={(event) => setIncludeScanInPrompt(event.target.checked)}
                  className="rounded border-subtle bg-input text-primary"
                />
                Include
              </label>
            </div>
            <div className="space-y-2">
              {nodeFindings.map((finding) => (
                <div
                  key={`${finding.file}-${finding.line}-${finding.pattern}`}
                  className="rocket-property-card"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-2xs text-muted-foreground">
                      {finding.file}:{finding.line}
                    </span>
                    <span className={cn('tag-chip', finding.severity === 'high' && 'text-error')}>
                      {finding.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-foreground">{finding.pattern}</p>
                  <p className="mt-1 line-clamp-2 font-mono text-2xs text-muted-foreground">
                    {finding.snippet}
                  </p>
                </div>
              ))}
              {!nodeFindings.length && (
                <InspectorEmpty>No scanner findings are attached to this node.</InspectorEmpty>
              )}
            </div>
          </div>
        )}

        {node && tab === 'git' && (
          <div className="space-y-4">
            <InspectorSection label="Repository">
              <div className="rocket-property-row">
                <span className="text-xs text-muted-foreground">Branch</span>
                <span className="font-mono text-xs text-foreground">
                  {bundle?.git.branch ?? 'Unavailable'}
                </span>
              </div>
              <div className="rocket-property-row">
                <span className="text-xs text-muted-foreground">Changed files</span>
                <span className="font-mono text-xs text-foreground">
                  {(bundle?.git.changedFiles.length ?? 0) +
                    (bundle?.git.untrackedFiles.length ?? 0)}
                </span>
              </div>
            </InspectorSection>
            <InspectorSection label="Diff stat">
              <div className="space-y-1">
                {diffEntries.map((entry) => (
                  <button
                    key={entry.path}
                    className="rocket-property-row w-full text-left"
                    onClick={() => openChangedFile(entry.path)}
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-2xs text-foreground">
                      {entry.path}
                    </span>
                    <span className="font-mono text-2xs text-muted-foreground">
                      {entry.changed} <span className="text-primary">+{entry.insertions}</span>{' '}
                      <span className="text-error">-{entry.deletions}</span>
                    </span>
                  </button>
                ))}
                {!diffEntries.length && (
                  <InspectorEmpty>
                    {bundle?.git.error ?? 'No diff stat is available for the working tree.'}
                  </InspectorEmpty>
                )}
              </div>
            </InspectorSection>
          </div>
        )}

        {node && tab === 'prompt' && (
          <div className="space-y-4">
            <InspectorSection label="Agent prompt">
              <div className="rounded-md bg-[#0d0e10] p-3">
                <pre className="max-h-48 whitespace-pre-wrap font-mono text-2xs leading-relaxed text-muted-foreground">
                  {command ||
                    'Generate a prompt to preview the exact task sent to the selected agent.'}
                </pre>
              </div>
              <div className="mt-2 flex gap-2">
                <button className="btn-primary flex-1 justify-center" onClick={generatePrompt}>
                  <Sparkles size={12} />
                  Generate
                </button>
                <button
                  className="btn-ghost"
                  disabled={!command}
                  onClick={() => void copyText('Prompt', command)}
                >
                  <Copy size={12} />
                </button>
              </div>
            </InspectorSection>
            <InspectorSection label="Pull request draft">
              {prDraft ? (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-[#0d0e10] p-3 font-mono text-2xs leading-relaxed text-muted-foreground">
                  {prDraft}
                </pre>
              ) : (
                <InspectorEmpty>
                  Generate a review draft from the real node, scanner, and Git state.
                </InspectorEmpty>
              )}
              <button className="btn-ghost mt-2 w-full justify-center" onClick={generatePrDraft}>
                <GitPullRequest size={12} />
                {prDraft ? 'Regenerate draft' : 'Generate draft'}
              </button>
              <button
                className="btn-ghost mt-2 w-full cursor-not-allowed justify-center opacity-45"
                disabled
                title="GitHub integration is not configured"
              >
                Create pull request · Coming soon
              </button>
            </InspectorSection>
          </div>
        )}

        {workspace && (
          <div className="space-y-4">
            <InspectorSection label="Workspace properties">
              <InspectorProperty label="Path" value={workspace.path} mono />
              <InspectorProperty label="Pipelines" value={String(workspace.pipelineCount)} />
              <InspectorProperty label="Nodes" value={String(workspace.nodeCount)} />
              <InspectorProperty
                label="AgentBoard"
                value={workspace.hasAgentboard ? 'Configured' : 'Missing'}
              />
            </InspectorSection>
            <button
              className="btn-ghost w-full justify-center"
              onClick={() => void copyText('Workspace path', workspace.path)}
            >
              <Copy size={12} />
              Copy path
            </button>
          </div>
        )}

        {agent && (
          <div className="space-y-4">
            <InspectorSection label="Availability">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    agent.status === 'available' || agent.status === 'running'
                      ? 'status-dot-running'
                      : 'status-dot-error'
                  )}
                />
                <span className="text-xs font-medium text-foreground">
                  {formatAgentStatus(agent)}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{agent.detail}</p>
            </InspectorSection>
            <InspectorSection label="Command">
              <InspectorProperty label="Executable" value={agent.command} mono />
              <InspectorProperty
                label="Selected"
                value={selectedAgent === agent.id ? 'Yes' : 'No'}
              />
            </InspectorSection>
          </div>
        )}

        {profile && (
          <div className="space-y-4">
            <InspectorSection label="Profile">
              <InspectorProperty label="Provider" value={profile.provider} />
              <InspectorProperty label="Model" value={profile.model || 'CLI default'} />
              <InspectorProperty label="Effort" value={profile.effort} />
              <InspectorProperty
                label="Isolation"
                value={
                  profile.isolationMode === 'worktree_per_deployment'
                    ? 'Worktree per deployment'
                    : 'Same workspace'
                }
              />
              <InspectorProperty
                label="Default skills"
                value={profile.defaultSkills.length ? profile.defaultSkills.join(', ') : 'None'}
              />
            </InspectorSection>
            <InspectorSection label="Permissions">
              <InspectorProperty
                label="Read files"
                value={profile.permissions.readFiles ? 'Allowed' : 'Denied'}
              />
              <InspectorProperty
                label="Write files"
                value={profile.permissions.writeFiles ? 'Allowed' : 'Denied'}
              />
              <InspectorProperty
                label="Run shell"
                value={profile.permissions.runShell ? 'Allowed' : 'Denied'}
              />
              <InspectorProperty
                label="Network"
                value={profile.permissions.network ? 'Allowed' : 'Denied'}
              />
            </InspectorSection>
            {profile.description && (
              <InspectorSection label="Description">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {profile.description}
                </p>
              </InspectorSection>
            )}
            <button
              className="btn-primary w-full justify-center"
              onClick={() => editAgentProfile(profile)}
            >
              <Pencil size={12} />
              Edit agent
            </button>
          </div>
        )}

        {deployment && (
          <div className="space-y-4">
            <InspectorSection label="Deployment status">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={cn('h-2 w-2 rounded-full', deploymentStatusClass(deployment.status))}
                />
                <span className="text-xs font-medium text-foreground">
                  {deploymentStatusLabel(deployment.status)}
                </span>
              </div>
              <InspectorProperty
                label="Target"
                value={`${deployment.targetType.replace('_', ' ')} / ${deployment.targetLabel}`}
              />
              <InspectorProperty label="Path" value={deployment.targetPath} mono />
              {deployment.nodeName && (
                <InspectorProperty
                  label="Pipeline node"
                  value={`${deployment.pipelineName ?? 'Pipeline'} / ${deployment.nodeName}`}
                />
              )}
              <InspectorProperty
                label="Isolation"
                value={
                  deployment.isolationMode === 'worktree_per_deployment'
                    ? 'Worktree per deployment'
                    : 'Same workspace'
                }
              />
              <InspectorProperty
                label="Run mode"
                value={deployment.runMode === 'inspect_only' ? 'Inspect only' : 'Edit'}
              />
              <InspectorProperty
                label="Skills"
                value={
                  deployment.selectedSkills.length ? deployment.selectedSkills.join(', ') : 'None'
                }
              />
              <InspectorProperty label="Created" value={sessionTimestamp(deployment.createdAt)} />
              <InspectorProperty
                label="Current session"
                value={
                  deploymentSession
                    ? `${deploymentSession.id} / ${deploymentSession.runMode === 'edit' ? 'Edit' : 'Inspect only'}`
                    : deployment.sessionId
                      ? `${deployment.sessionId} / not loaded`
                      : 'No session started'
                }
                mono
              />
            </InspectorSection>
            {deploymentSession?.status === 'blocked_environment' &&
              deploymentSession.environmentBlocker && (
                <InspectorSection label="Environment blocker">
                  <EnvironmentBlockerCard
                    blocker={deploymentSession.environmentBlocker}
                    provider={agentLabels[deploymentSession.agent]}
                  />
                </InspectorSection>
              )}
            {deploymentSession && (
              <AgentResultReview
                session={deploymentSession}
                deploymentId={deployment.id}
                openRawLog={() => openSessionLog(deploymentSession)}
              />
            )}
            <InspectorSection label="Task and generated prompt">
              <p className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                {deployment.prompt}
              </p>
            </InspectorSection>
            {deployment.sessionId && (
              <InspectorSection label="Runtime">
                <InspectorProperty label="Session" value={deployment.sessionId} mono />
                <InspectorProperty
                  label="Log"
                  value={deployment.logPath ?? 'Pending runtime response'}
                  mono
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    className="btn-primary justify-center"
                    disabled={!deployment.logPath}
                    onClick={() => {
                      const linkedSession = sessions.find(
                        (item) => item.id === deployment.sessionId
                      );
                      if (linkedSession) openSessionLog(linkedSession);
                    }}
                  >
                    <Terminal size={12} />
                    Open log
                  </button>
                  <button
                    className="btn-ghost justify-center"
                    disabled={deployment.status !== 'running'}
                    onClick={() => deployment.sessionId && void stopSession(deployment.sessionId)}
                  >
                    <Square size={12} />
                    Stop
                  </button>
                </div>
              </InspectorSection>
            )}
          </div>
        )}

        {session && (
          <div className="space-y-4">
            <InspectorSection label="Session status">
              <div className="flex items-center gap-2">
                <SessionStatusDot status={session.status} />
                <span className="text-xs font-medium text-foreground">
                  {sessionStatusLabel(session)}
                </span>
              </div>
              <InspectorProperty label="Started" value={sessionTimestamp(session.startedAt)} />
              <InspectorProperty label="Session ID" value={session.id} mono />
              <InspectorProperty
                label="Finished"
                value={session.finishedAt ? sessionTimestamp(session.finishedAt) : 'In progress'}
              />
              {session.exitCode !== undefined && (
                <InspectorProperty label="Exit code" value={String(session.exitCode)} />
              )}
              <InspectorProperty
                label="Pipeline node"
                value={session.nodeName ?? session.nodeId ?? 'Not attached'}
              />
              <InspectorProperty
                label="Execution path"
                value={session.executionPath || session.workspacePath}
                mono
              />
              <InspectorProperty
                label="Isolation"
                value={session.worktreePath ? 'Unique Git worktree' : 'Workspace folder'}
              />
              <InspectorProperty
                label="Run mode"
                value={session.runMode === 'inspect_only' ? 'Inspect only' : 'Edit'}
              />
              <InspectorProperty
                label="Skills"
                value={
                  session.selectedSkills.length
                    ? session.selectedSkills.join(', ')
                    : 'None selected'
                }
              />
              {session.promptFilePath && (
                <InspectorProperty label="Prompt file" value={session.promptFilePath} mono />
              )}
              {session.promptCharacterCount !== undefined && (
                <InspectorProperty
                  label="Prompt size"
                  value={`${session.promptCharacterCount.toLocaleString()} characters`}
                />
              )}
            </InspectorSection>
            {session.status === 'blocked_environment' && session.environmentBlocker && (
              <InspectorSection label="Environment blocker">
                <EnvironmentBlockerCard
                  blocker={session.environmentBlocker}
                  provider={agentLabels[session.agent]}
                />
              </InspectorSection>
            )}
            <AgentResultReview session={session} openRawLog={() => openSessionLog(session)} />
            <InspectorSection label="Prompt">
              <p className="max-h-44 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                {session.prompt}
              </p>
            </InspectorSection>
            <InspectorSection label="Log">
              <InspectorProperty label="File" value={session.logPath} mono />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  className="btn-primary justify-center"
                  onClick={() => openSessionLog(session)}
                >
                  <Terminal size={12} />
                  Open log
                </button>
                <button
                  className="btn-ghost justify-center"
                  disabled={!promptAvailable}
                  title={promptAvailable ? 'Run this prompt again' : 'Prompt metadata unavailable'}
                  onClick={() => void rerunSession(session)}
                >
                  <RotateCcw size={12} />
                  Rerun
                </button>
              </div>
            </InspectorSection>
          </div>
        )}

        {skill && (
          <div className="space-y-4">
            <InspectorSection label="Local skill">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {skill.manifest.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {skill.manifest.categories.map((category) => (
                  <span key={category} className="tag-chip">
                    {category}
                  </span>
                ))}
              </div>
            </InspectorSection>
            <InspectorSection label="Properties">
              <InspectorProperty label="Version" value={skill.manifest.version} />
              <InspectorProperty label="Source" value={skill.manifest.source} />
              <InspectorProperty label="Path" value={skill.path} mono />
            </InspectorSection>
            <button
              className={cn(
                'btn-ghost w-full justify-center',
                skill.enabled && 'border-primary/30 text-primary'
              )}
              onClick={() => toggleSkill(skill.name)}
            >
              {skill.enabled ? <Check size={12} /> : <Circle size={12} />}
              {skill.enabled ? 'Enabled for runs' : 'Enable for runs'}
            </button>
            <details className="rocket-details">
              <summary>Skill manifest</summary>
              <pre>{JSON.stringify(skill.manifest, null, 2)}</pre>
            </details>
          </div>
        )}

        {selection.kind === 'file' && (
          <div className="space-y-4">
            <InspectorSection label="File properties">
              <InspectorProperty label="Name" value={basename(selection.id)} />
              <InspectorProperty label="Path" value={selection.id} mono />
              {file && (
                <>
                  <InspectorProperty label="Reason" value={file.reason} />
                  <InspectorProperty
                    label="Lines"
                    value={
                      file.startLine && file.endLine
                        ? `${file.startLine}-${file.endLine}`
                        : 'Whole file'
                    }
                  />
                </>
              )}
            </InspectorSection>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="btn-primary justify-center"
                onClick={() => openChangedFile(selection.id)}
              >
                <Eye size={12} />
                Open
              </button>
              <button
                className="btn-ghost justify-center"
                onClick={() => void copyText('File path', selection.id)}
              >
                <Copy size={12} />
                Copy path
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function InspectorSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 section-label">{label}</p>
      {children}
    </section>
  );
}

function InspectorProperty({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rocket-property-row">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'min-w-0 break-all text-right text-xs text-foreground',
          mono && 'font-mono text-2xs'
        )}
      >
        {value}
      </span>
    </div>
  );
}

function EnvironmentBlockerCard({
  blocker,
  provider,
}: {
  blocker: EnvironmentBlocker;
  provider: string;
}) {
  return (
    <div className="rounded border border-coded/35 bg-coded/[0.07] p-3 text-xs">
      <p className="font-semibold text-foreground">Environment setup blocked the run</p>
      <div className="mt-2 space-y-1 text-muted-foreground">
        <p>
          <span className="text-foreground">Provider:</span> {provider}
        </p>
        <p>
          <span className="text-foreground">Missing tool/template:</span> {blocker.tool}
        </p>
        <p>
          <span className="text-foreground">Cause:</span> {blocker.cause}
        </p>
        <p>
          <span className="text-foreground">Next action:</span> {blocker.suggestedAction}
        </p>
      </div>
      <p className="mt-3 font-semibold text-foreground">Choose a next step</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
        {blocker.fallbackOptions.map((option) => (
          <li key={option}>{option}</li>
        ))}
      </ul>
      <p className="mt-2 text-2xs text-coded">
        AgentBoard will not switch frameworks automatically.
      </p>
    </div>
  );
}

function AgentResultReview({
  session,
  deploymentId,
  openRawLog,
}: {
  session: SessionInfo;
  deploymentId?: string;
  openRawLog: () => void;
}) {
  const [review, setReview] = useState<AgentReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [busy, setBusy] = useState<'accept' | 'revert' | null>(null);
  const [confirmRevert, setConfirmRevert] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReview(null);
    setSelectedPath(null);
    setLoadError(null);
    if (session.runMode !== 'edit' || sessionIsActive(session.status)) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    void agentboardApi
      .getAgentReview(session.id)
      .then((nextReview) => {
        if (cancelled) return;
        setReview(nextReview);
        setSelectedPath(nextReview?.changedFiles[0]?.relativePath ?? null);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(humanizeError(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.id, session.runMode, session.status]);

  if (session.runMode !== 'edit') {
    return (
      <InspectorSection label="Result review">
        <InspectorEmpty>Inspect-only sessions do not create edit reviews.</InspectorEmpty>
      </InspectorSection>
    );
  }

  if (sessionIsActive(session.status)) {
    return (
      <InspectorSection label="Result review">
        <InspectorEmpty>
          The review will be generated when this edit session finishes.
        </InspectorEmpty>
      </InspectorSection>
    );
  }

  if (loading) {
    return (
      <InspectorSection label="Result review">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={13} className="animate-spin" />
          Loading persisted review
        </div>
      </InspectorSection>
    );
  }

  if (loadError || !review) {
    return (
      <InspectorSection label="Result review">
        <InspectorEmpty>
          {loadError ?? 'No edit review was found for this completed session.'}
        </InspectorEmpty>
      </InspectorSection>
    );
  }

  const selected =
    review.changedFiles.find((file) => file.relativePath === selectedPath) ??
    review.changedFiles[0] ??
    null;
  const revertable = review.changedFiles.filter((file) => file.canRevert);
  const unavailable = review.changedFiles.filter((file) => !file.canRevert);

  const accept = async () => {
    try {
      setBusy('accept');
      const result = await agentboardApi.acceptAgentReview(review.reviewId);
      setReview(result.review);
      toast.success('Changes accepted', {
        description: `${result.affectedFiles.length} reviewed file(s) retained.`,
      });
    } catch (error) {
      toast.error('Accept failed', { description: humanizeError(error) });
    } finally {
      setBusy(null);
    }
  };

  const revert = async () => {
    try {
      setBusy('revert');
      setConfirmRevert(false);
      const result = await agentboardApi.revertAgentReview(review.reviewId);
      setReview(result.review);
      if (result.conflicts.length) {
        toast.warning('Revert completed with conflicts', {
          description: result.conflicts
            .map((conflict) => `${conflict.relativePath}: ${conflict.reason}`)
            .join('\n'),
        });
      } else {
        toast.success('Tracked changes reverted', {
          description: `${result.affectedFiles.length} file(s) restored or removed.`,
        });
      }
    } catch (error) {
      toast.error('Revert failed', { description: humanizeError(error) });
    } finally {
      setBusy(null);
    }
  };

  const fileStateLabel = (file: ReviewChangedFile) => {
    if (file.sensitive) return 'diff hidden';
    if (file.binary) return 'binary';
    if (file.largeFile) return 'large';
    if (file.diffPreview) return 'diff available';
    return 'no inline diff';
  };

  return (
    <>
      <InspectorSection label="Result review">
        <div className="space-y-3">
          <div className="rocket-soft-card space-y-2 p-3">
            <p className="text-xs font-medium text-foreground">{review.resultSummary}</p>
            <InspectorProperty label="Provider" value={review.provider} />
            <InspectorProperty
              label="Run mode"
              value={review.runMode === 'edit' ? 'Edit' : 'Inspect only'}
            />
            <InspectorProperty label="Session status" value={sessionStatusLabel(session)} />
            <InspectorProperty label="Review status" value={review.reviewStatus} />
            <InspectorProperty label="Changed files" value={String(review.changedFiles.length)} />
            {deploymentId && (
              <InspectorProperty
                label="Deployment"
                value={review.deploymentId ?? deploymentId}
                mono
              />
            )}
            <div className="border-t border-subtle/70 pt-2">
              <p className="truncate font-mono text-2xs text-muted-foreground">
                {review.rawLogPath}
              </p>
              <button className="btn-ghost mt-2 w-full justify-center" onClick={openRawLog}>
                <Terminal size={12} />
                Open raw log
              </button>
            </div>
          </div>

          {review.changedFiles.length === 0 ? (
            <InspectorEmpty>No user file changes detected.</InspectorEmpty>
          ) : (
            <div className="space-y-1">
              {review.changedFiles.map((file) => (
                <div
                  key={file.relativePath}
                  className={cn(
                    'rounded-md border p-2',
                    selected?.relativePath === file.relativePath
                      ? 'border-primary/40 bg-primary/[0.06]'
                      : 'border-subtle bg-card'
                  )}
                >
                  <button
                    className="w-full min-w-0 text-left"
                    onClick={() => setSelectedPath(file.relativePath)}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'tag-chip',
                          file.changeType === 'created'
                            ? 'text-primary'
                            : file.changeType === 'deleted'
                              ? 'text-error'
                              : 'text-coded'
                        )}
                      >
                        {file.changeType}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                        {file.relativePath}
                      </span>
                    </div>
                    <p className="mt-1 text-2xs text-muted-foreground">
                      {fileStateLabel(file)}
                      {!file.canRevert ? ' / revert unavailable' : ''}
                    </p>
                  </button>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      className="btn-ghost justify-center"
                      disabled={file.changeType === 'deleted'}
                      onClick={() =>
                        void agentboardApi
                          .openReviewFile(review.reviewId, file.relativePath)
                          .catch((error) =>
                            toast.error('Open file failed', {
                              description: humanizeError(error),
                            })
                          )
                      }
                    >
                      <FileCode size={11} />
                      Open
                    </button>
                    <button
                      className="btn-ghost justify-center"
                      onClick={() =>
                        void agentboardApi
                          .revealReviewFile(review.reviewId, file.relativePath)
                          .catch((error) =>
                            toast.error('Reveal file failed', {
                              description: humanizeError(error),
                            })
                          )
                      }
                    >
                      <FolderOpen size={11} />
                      Reveal
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selected && (
            <div className="overflow-hidden rounded-md border border-subtle bg-[#0b0d10]">
              <div className="border-b border-subtle px-3 py-2">
                <p className="truncate font-mono text-2xs text-muted-foreground">
                  {selected.relativePath}
                </p>
              </div>
              {selected.sensitive ? (
                <p className="p-3 text-xs leading-relaxed text-coded">
                  Inline diff hidden because this file may contain secrets.
                </p>
              ) : selected.binary ? (
                <p className="p-3 text-xs text-muted-foreground">
                  Binary file changed. Inline diff is unavailable.
                </p>
              ) : selected.largeFile ? (
                <p className="p-3 text-xs text-muted-foreground">
                  Large file changed. Inline diff is unavailable.
                </p>
              ) : selected.diffPreview ? (
                <pre className="max-h-80 overflow-auto whitespace-pre font-mono text-2xs leading-relaxed text-foreground/85">
                  <code className="block min-w-max p-3">{selected.diffPreview}</code>
                </pre>
              ) : (
                <p className="p-3 text-xs text-muted-foreground">
                  No inline diff is available for this file.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn-primary justify-center"
              disabled={review.reviewStatus !== 'pending' || busy !== null}
              onClick={() => void accept()}
            >
              {busy === 'accept' ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
              Accept changes
            </button>
            <button
              className="btn-ghost justify-center text-error"
              disabled={
                review.reviewStatus !== 'pending' ||
                review.changedFiles.length === 0 ||
                busy !== null
              }
              onClick={() => setConfirmRevert(true)}
            >
              {busy === 'revert' ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RotateCcw size={12} />
              )}
              Revert changes
            </button>
          </div>
          <button
            className="btn-ghost w-full justify-center"
            onClick={() =>
              void agentboardApi
                .openReviewFolder(review.reviewId)
                .catch((error) =>
                  toast.error('Open review folder failed', {
                    description: humanizeError(error),
                  })
                )
            }
          >
            <FolderOpen size={12} />
            Open review folder
          </button>
        </div>
      </InspectorSection>

      {confirmRevert && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-subtle bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Revert tracked changes?</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  AgentBoard will only change files whose current content still matches this review.
                </p>
              </div>
              <button
                className="rocket-icon-button"
                onClick={() => setConfirmRevert(false)}
                aria-label="Cancel revert"
              >
                <X size={14} />
              </button>
            </div>
            <div className="mt-4 max-h-56 overflow-auto rounded-md border border-subtle bg-muted/40 p-3">
              {revertable.map((file) => (
                <p key={file.relativePath} className="font-mono text-2xs text-foreground">
                  {file.changeType}: {file.relativePath}
                </p>
              ))}
              {unavailable.map((file) => (
                <p key={file.relativePath} className="font-mono text-2xs text-coded">
                  unavailable: {file.relativePath}
                </p>
              ))}
            </div>
            {unavailable.length > 0 && (
              <p className="mt-3 text-2xs leading-relaxed text-coded">
                {unavailable.length} file(s) cannot be safely reverted because a bounded snapshot or
                expected hash is unavailable.
              </p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button className="btn-ghost justify-center" onClick={() => setConfirmRevert(false)}>
                Cancel
              </button>
              <button
                className="btn-primary justify-center"
                disabled={revertable.length === 0}
                onClick={() => void revert()}
              >
                <RotateCcw size={12} />
                Confirm revert
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InspectorEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-subtle px-3 py-4 text-center text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

function RocketLogDrawer({
  open,
  expanded,
  setExpanded,
  openDrawer,
  close,
  sessions,
  activeSession,
  activeLogs,
  selectSession,
  stopSession,
  clearHistory,
  openLogsFolder,
  onSessionContext,
}: {
  open: boolean;
  expanded: boolean;
  setExpanded: (value: boolean) => void;
  openDrawer: () => void;
  close: () => void;
  sessions: SessionInfo[];
  activeSession?: SessionInfo;
  activeLogs: string[];
  selectSession: (session: SessionInfo) => void;
  stopSession: (sessionId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  openLogsFolder: () => Promise<void>;
  onSessionContext: (event: React.MouseEvent, session: SessionInfo) => void;
}) {
  if (!open) {
    return (
      <button
        className="rocket-log-collapsed"
        onClick={() => {
          setExpanded(false);
          openDrawer();
        }}
      >
        <span className="flex items-center gap-2">
          <Terminal size={12} />
          Terminal
          {activeSession && (
            <>
              <SessionStatusDot status={activeSession.status} />
              <span className="text-muted-foreground">
                {agentLabels[activeSession.agent]} · {sessionStatusLabel(activeSession)}
              </span>
            </>
          )}
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          {sessions.length} sessions
          <PanelBottomOpen size={13} />
        </span>
      </button>
    );
  }

  return (
    <section className={cn('rocket-log-drawer', expanded && 'is-expanded')}>
      <header className="rocket-log-header">
        <div className="flex min-w-0 items-center gap-2">
          <Terminal size={13} className="text-primary" />
          <span className="text-xs font-medium text-foreground">Terminal</span>
          {activeSession && (
            <span className="flex min-w-0 items-center gap-2 text-2xs text-muted-foreground">
              <SessionStatusDot status={activeSession.status} />
              <span className="truncate">
                {agentLabels[activeSession.agent]} · {sessionStatusLabel(activeSession)}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeSession && sessionIsActive(activeSession.status) && (
            <button
              className="rocket-icon-button"
              title="Stop running session"
              aria-label="Stop running session"
              data-tooltip="Stop session"
              onClick={() => void stopSession(activeSession.id)}
            >
              <Square size={12} />
            </button>
          )}
          <button
            className="rocket-icon-button"
            title="Open logs folder"
            aria-label="Open logs folder"
            data-tooltip="Open folder"
            onClick={() => void openLogsFolder()}
          >
            <FolderOpen size={13} />
          </button>
          <button
            className="rocket-icon-button"
            title="Clear completed session history (confirmation required)"
            aria-label="Clear completed session history"
            data-tooltip="Clear history"
            onClick={() => void clearHistory()}
          >
            <Trash2 size={13} />
          </button>
          <button
            className="rocket-icon-button"
            title={expanded ? 'Restore panel height' : 'Expand panel'}
            aria-label={expanded ? 'Restore terminal panel height' : 'Expand terminal panel'}
            data-tooltip={expanded ? 'Restore height' : 'Expand'}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <PanelBottomClose size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            className="rocket-icon-button"
            title="Collapse terminal"
            aria-label="Collapse terminal"
            data-tooltip="Collapse"
            onClick={close}
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[210px_minmax(0,1fr)]">
        <aside className="overflow-auto border-r border-subtle bg-sidebar/60 p-1.5">
          {sessions.map((session) => (
            <button
              key={session.id}
              className={cn('rocket-log-session', activeSession?.id === session.id && 'is-active')}
              onClick={() => selectSession(session)}
              onContextMenu={(event) => onSessionContext(event, session)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <SessionStatusDot status={session.status} />
                <span className="truncate text-xs text-foreground">
                  {agentLabels[session.agent]}
                </span>
              </span>
              <span className="font-mono text-2xs text-muted-foreground">
                {sessionTimestamp(session.startedAt)}
              </span>
            </button>
          ))}
          {!sessions.length && (
            <p className="p-4 text-center text-xs text-muted-foreground">No saved sessions.</p>
          )}
        </aside>
        <div className="min-w-0 overflow-auto bg-[#090a0c] p-3">
          {!activeSession ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Select a session to view its durable log.
            </div>
          ) : activeLogs.length ? (
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-[#b8bec8]">
              {activeLogs.join('\n')}
            </pre>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No output has been recorded for this session.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DesktopContextMenu({
  menu,
  close,
}: {
  menu: NonNullable<ContextMenuState>;
  close: () => void;
}) {
  return (
    <div
      className="desktop-context-menu context-menu-in"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      aria-label={`${menu.title} actions`}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <p className="desktop-context-title">{menu.title}</p>
      <div className="py-1">
        {menu.items.map((item, index) => {
          const Icon = item.icon;
          return (
            <React.Fragment key={`${item.label}-${index}`}>
              {item.separatorBefore && <div className="desktop-context-separator" />}
              <button
                role="menuitem"
                disabled={item.disabled}
                title={item.disabled ? (item.hint ?? 'Unavailable') : item.hint}
                className={cn('desktop-context-item', item.danger && 'is-danger')}
                onClick={() => {
                  if (item.disabled) return;
                  close();
                  void item.action?.();
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {Icon ? <Icon size={13} /> : <span className="w-[13px]" />}
                  <span className="truncate">{item.label}</span>
                </span>
                {item.disabled && item.hint && (
                  <span className="ml-3 truncate text-[9px] text-muted-foreground/55">
                    {item.hint}
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function basename(path: string) {
  const pieces = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return pieces[pieces.length - 1] ?? path;
}

function dirname(path: string) {
  const normalized = path.replace(/\\/g, '/');
  const separator = normalized.lastIndexOf('/');
  return separator > 0 ? normalized.slice(0, separator) : '.';
}

function joinWorkspacePath(workspacePath: string, relativePath: string) {
  if (!relativePath || relativePath === '.') return workspacePath;
  return `${workspacePath.replace(/[\\/]+$/, '')}\\${relativePath.replace(/\//g, '\\').replace(/^[\\/]+/, '')}`;
}

function nowId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function humanizeError(error: unknown) {
  const raw = cleanWindowsOutput(errorMessage(error)).trim();
  const lower = raw.toLowerCase();
  let guidance = raw;

  if (
    lower.includes('workspace path does not exist') ||
    lower.includes('workspace does not exist')
  ) {
    guidance = 'That workspace folder could not be found. Check the full path and try again.';
  } else if (lower.includes('unknown workspace id')) {
    guidance =
      'This workspace is no longer registered. Refresh AgentBoard, then open the folder again.';
  } else if (
    lower.includes('is not available on path') ||
    lower.includes('was not found on path')
  ) {
    guidance =
      'The selected local command is not installed or is not available on PATH. Install it, then refresh agent availability.';
  } else if (lower.includes('access is denied') || lower.includes('permission denied')) {
    guidance =
      'Windows denied access to that file or folder. Check permissions and whether another process is using it.';
  } else if (
    lower.includes('only workspace-relative file paths') ||
    lower.includes('parent directory segments')
  ) {
    guidance = 'AgentBoard blocked a file path outside the open workspace.';
  } else if (lower.includes('invalid ') && lower.includes('.json')) {
    guidance =
      'AgentBoard could not read the workspace metadata. Check the referenced JSON file for syntax errors.';
  } else if (lower.includes('session state lock poisoned')) {
    guidance = 'The local session service needs an AgentBoard restart.';
  } else if (
    lower.includes('failed to spawn') ||
    lower.includes('the system cannot find the file')
  ) {
    guidance =
      'Windows could not start the selected command. Check that it is installed and available on PATH.';
  }

  return guidance === raw || !raw ? raw : `${guidance}\n\nTechnical detail: ${raw}`;
}

function cleanWindowsOutput(value: string) {
  return value
    .replace(/\u00c3\u201a\u00c2\u00b7/g, '\u00b7')
    .replace(/\u00c2\u00b7/g, '\u00b7')
    .replace(/\u00c2\u00a0/g, ' ')
    .replace(/\u00e2\u20ac\u0153/g, '\u201c')
    .replace(/\u00e2\u20ac\u009d/g, '\u201d')
    .replace(/\u00e2\u20ac\u2122/g, '\u2019')
    .replace(/\u00e2\u20ac\u201c/g, '\u2013')
    .replace(/\u00e2\u20ac\u201d/g, '\u2014');
}

function countNodes(pipelines: Pipeline[]) {
  const counts = {
    total: 0,
    production_ready: 0,
    tested: 0,
    coded: 0,
    partial: 0,
    broken: 0,
    mock: 0,
    visual_only: 0,
    not_started: 0,
  };
  for (const pipeline of pipelines) {
    for (const node of pipeline.nodes) {
      counts.total += 1;
      counts[node.status] += 1;
    }
  }
  return counts;
}

function sortNodes(nodes: PipelineNode[]) {
  return [...nodes].sort((a, b) => statusMeta[a.status].weight - statusMeta[b.status].weight);
}

function formatAgentStatus(agent: AgentAvailability) {
  if (agent.status === 'not_configured') return 'not configured';
  if (agent.status === 'missing') return 'install needed';
  return agent.status;
}

function normalizedPath(path: string) {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function sessionTimestamp(value: string) {
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function sessionStatusLabel(session: SessionInfo) {
  if (session.status === 'external_blocked' && session.agent === 'claude') {
    return 'Claude access blocked';
  }
  if (session.status === 'blocked_environment') {
    return 'Blocked by environment';
  }
  return session.status.replaceAll('_', ' ');
}

function queueStatusFromSession(status: SessionStatus): QueueStatus {
  return status === 'idle' || status === 'staged' ? 'queued' : status;
}

function sessionIsActive(status: SessionStatus) {
  return status === 'staged' || status === 'running';
}

function deploymentStatusClass(status: AgentDeployment['status']) {
  if (status === 'running') return 'bg-primary';
  if (status === 'staged') return 'bg-coded';
  if (status === 'completed' || status === 'completed_inspection') return 'bg-accent';
  if (status === 'failed' || status === 'external_blocked') return 'bg-error';
  if (status === 'blocked_environment') return 'bg-coded';
  return 'bg-muted-foreground';
}

function deploymentStatusLabel(status: AgentDeployment['status']) {
  if (status === 'blocked_environment') return 'Blocked by environment';
  if (status === 'external_blocked') return 'External access blocked';
  return status.replaceAll('_', ' ');
}

function deploymentStatusFromSession(status: SessionStatus): AgentDeployment['status'] {
  return status === 'idle' ? 'staged' : status;
}

function sessionRuntime(session: SessionInfo, now = Date.now()) {
  const started = Number(session.startedAt);
  const finished = session.finishedAt ? Number(session.finishedAt) : Number.NaN;
  const startedMs = Number.isFinite(started)
    ? started > 10_000_000_000
      ? started
      : started * 1000
    : new Date(session.startedAt).getTime();
  const finishedMs = Number.isFinite(finished)
    ? finished > 10_000_000_000
      ? finished
      : finished * 1000
    : session.finishedAt
      ? new Date(session.finishedAt).getTime()
      : now;
  const end = session.finishedAt ? finishedMs : now;
  const seconds = Math.max(0, Math.floor((end - startedMs) / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

function queueStatusTone(status: QueueStatus) {
  if (status === 'running') return 'border-primary/30 bg-primary/10 text-primary';
  if (status === 'completed' || status === 'completed_inspection') {
    return 'border-accent/30 bg-accent/10 text-accent';
  }
  if (status === 'failed' || status === 'external_blocked') {
    return 'border-error/30 bg-error/10 text-error';
  }
  if (status === 'blocked_environment') {
    return 'border-coded/30 bg-coded/10 text-coded';
  }
  if (status === 'stopped') return 'border-coded/30 bg-coded/10 text-coded';
  return 'border-subtle bg-card text-muted-foreground';
}

function statusMatchesRunMode(runMode: DeploymentRunMode, status: SessionInfo['status']) {
  if (status === 'completed_inspection') return runMode === 'inspect_only';
  if (status === 'completed') return runMode === 'edit';
  return true;
}

function nodeIdFromPrompt(prompt: string) {
  return prompt.match(/^- Node id:\s*(.+)$/m)?.[1]?.trim();
}

function parseDiffStat(diffStat: string) {
  return diffStat
    .split(/\r?\n/)
    .map((line) => {
      const separator = line.lastIndexOf('|');
      if (separator < 0) return null;
      const path = line.slice(0, separator).trim();
      const summary = line.slice(separator + 1).trim();
      const changed = Number(summary.match(/^(\d+)/)?.[1] ?? 0);
      const insertions = (summary.match(/\+/g) ?? []).length;
      const deletions = (summary.match(/-/g) ?? []).length;
      return { path, changed, insertions, deletions };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

export default function App() {
  const [boot, setBoot] = useState<AppBootstrap | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [agents, setAgents] = useState<AgentAvailability[]>([]);
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>([]);
  const [deployments, setDeployments] = useState<AgentDeployment[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [bundle, setBundle] = useState<WorkspaceBundle | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentId>('codex');
  const [activeTab, setActiveTab] = useState<CenterTab>('overview');
  const [command, setCommand] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [useWorktreeIsolation, setUseWorktreeIsolation] = useState(false);
  const [includeScanInPrompt, setIncludeScanInPrompt] = useState(true);
  const [scanResults, setScanResults] = useState<RealityIssue[]>([]);
  const [scanRunning, setScanRunning] = useState(false);
  const [fileResult, setFileResult] = useState<FileReadResult | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [sessionLogs, setSessionLogs] = useState<Record<string, string[]>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);
  const [workspacePathInput, setWorkspacePathInput] = useState('');
  const [releaseSupportOpen, setReleaseSupportOpen] = useState(false);
  const [createAgentOpen, setCreateAgentOpen] = useState(false);
  const [editingAgentProfile, setEditingAgentProfile] = useState<AgentProfile | null>(null);
  const [deployAgentOpen, setDeployAgentOpen] = useState(false);
  const [deploymentTarget, setDeploymentTarget] = useState<DeploymentTarget | null>(null);
  const [issueNotes, setIssueNotes] = useState('');
  const [diagnosticsPath, setDiagnosticsPath] = useState<string | null>(null);
  const [prDraft, setPrDraft] = useState('');
  const [inspectorSelection, setInspectorSelection] = useState<InspectorSelection | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('summary');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);
  const [logDrawerExpanded, setLogDrawerExpanded] = useState(false);
  const [gettingStartedDismissed, setGettingStartedDismissed] = useState(() => {
    try {
      return window.localStorage.getItem('agentboard:getting-started-dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [runtimeNotice, setRuntimeNotice] = useState<RuntimeNotice>({
    kind: 'info',
    title: 'Connecting to desktop backend',
    timestamp: new Date().toISOString(),
  });
  const commandRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingSessionStatusRef = useRef<Record<string, AgentStatusEvent>>({});
  const recentErrorsRef = useRef<string[]>([]);
  const deploymentsRef = useRef<AgentDeployment[]>([]);

  const showContextMenu = useCallback(
    (event: React.MouseEvent, title: string, items: ContextMenuItem[]) => {
      event.preventDefault();
      event.stopPropagation();
      const width = 244;
      const height = Math.min(420, items.length * 34 + 42);
      setContextMenu({
        x: Math.min(event.clientX, window.innerWidth - width - 8),
        y: Math.min(event.clientY, window.innerHeight - height - 8),
        title,
        items,
      });
    },
    []
  );

  const openInspector = useCallback(
    (selection: InspectorSelection, tab: InspectorTab = 'summary') => {
      setInspectorSelection(selection);
      setInspectorTab(tab);
    },
    []
  );

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces]
  );

  const pipelines = bundle?.pipelines.pipelines ?? [];
  const selectedPipeline = useMemo(() => {
    if (!pipelines.length) return null;
    return pipelines.find((pipeline) => pipeline.id === selectedPipelineId) ?? pipelines[0];
  }, [pipelines, selectedPipelineId]);

  const selectedNode = useMemo(() => {
    if (!selectedPipeline) return null;
    return (
      selectedPipeline.nodes.find((node) => node.id === selectedNodeId) ??
      sortNodes(selectedPipeline.nodes)[0] ??
      null
    );
  }, [selectedNodeId, selectedPipeline]);

  const workspaceSessions = useMemo(() => {
    if (!bundle) return [];
    const workspacePath = normalizedPath(bundle.workspace.path);
    return sessions.filter((session) => normalizedPath(session.workspacePath) === workspacePath);
  }, [bundle, sessions]);
  const workspaceDeployments = useMemo(() => {
    if (!bundle) return [];
    const workspacePath = normalizedPath(bundle.workspace.path);
    return deployments.filter(
      (deployment) => normalizedPath(deployment.workspacePath) === workspacePath
    );
  }, [bundle, deployments]);
  const activeSession =
    workspaceSessions.find((session) => session.id === activeSessionId) ?? workspaceSessions[0];
  const activeLogs = activeSession ? (sessionLogs[activeSession.id] ?? []) : [];

  const enabledSkills = useMemo(
    () =>
      bundle?.skills.filter(
        (skill) =>
          skill.enabled &&
          (!skill.manifest.compatible_agents?.length ||
            skill.manifest.compatible_agents.includes(selectedAgent))
      ) ?? [],
    [bundle, selectedAgent]
  );
  const selectedAgentInfo = agents.find((agent) => agent.id === selectedAgent);
  const unavailableAgent =
    selectedAgentInfo &&
    selectedAgentInfo.status !== 'available' &&
    selectedAgentInfo.status !== 'running';

  const nodeStats = useMemo(() => countNodes(pipelines), [pipelines]);
  const filteredWorkspaces = useMemo(() => {
    const needle = workspaceSearch.trim().toLowerCase();
    if (!needle) return workspaces;
    return workspaces.filter(
      (workspace) =>
        workspace.name.toLowerCase().includes(needle) ||
        workspace.path.toLowerCase().includes(needle)
    );
  }, [workspaceSearch, workspaces]);

  useEffect(() => {
    deploymentsRef.current = deployments;
  }, [deployments]);

  const reportSuccess = useCallback((title: string, detail?: string, showToast = false) => {
    setRuntimeNotice({ kind: 'success', title, detail, timestamp: new Date().toISOString() });
    if (showToast) {
      toast.success(title, { description: detail });
    }
  }, []);

  const reportError = useCallback((title: string, error: unknown) => {
    const detail = humanizeError(error);
    recentErrorsRef.current = [
      ...recentErrorsRef.current,
      `${new Date().toISOString()} | ${title} | ${detail}`,
    ].slice(-20);
    setRuntimeNotice({ kind: 'error', title, detail, timestamp: new Date().toISOString() });
    toast.error(title, { description: detail });
  }, []);

  const reportWarning = useCallback((title: string, detail?: string) => {
    setRuntimeNotice({ kind: 'warning', title, detail, timestamp: new Date().toISOString() });
    toast.warning(title, { description: detail });
  }, []);

  useEffect(() => {
    const restored = deployments.flatMap((deployment): AgentDeployment[] => {
      if (!deployment.sessionId) return [];
      const session = sessions.find((item) => item.id === deployment.sessionId);
      if (!session) return [];
      if (
        deployment.runMode !== session.runMode ||
        !statusMatchesRunMode(session.runMode, session.status)
      ) {
        return [];
      }
      const status = deploymentStatusFromSession(session.status);
      const logPath = session.logPath || deployment.logPath;
      if (deployment.status === status && deployment.logPath === logPath) return [];
      return [
        {
          ...deployment,
          status,
          ...(logPath ? { logPath } : {}),
          updatedAt: String(Date.now()),
        },
      ];
    });
    if (!restored.length) return;

    const restoredById = new Map(restored.map((deployment) => [deployment.id, deployment]));
    setDeployments((current) =>
      current.map((deployment) => restoredById.get(deployment.id) ?? deployment)
    );
    for (const deployment of restored) {
      void agentboardApi.updateDeployment(deployment).catch((error) => {
        reportError('Deployment restoration failed', error);
      });
    }
  }, [deployments, reportError, sessions]);

  const persistDeploymentUpdate = useCallback(
    async (deployment: AgentDeployment) => {
      setDeployments((current) =>
        current.map((item) => (item.id === deployment.id ? deployment : item))
      );
      deploymentsRef.current = deploymentsRef.current.map((item) =>
        item.id === deployment.id ? deployment : item
      );
      try {
        await agentboardApi.updateDeployment(deployment);
      } catch (error) {
        reportError('Deployment update failed', error);
      }
    },
    [reportError]
  );

  const loadBootstrap = useCallback(
    async (showToast = false) => {
      if (!isDesktopRuntime()) {
        const message = 'AgentBoard is running outside Tauri. Desktop commands are unavailable.';
        setBootError(message);
        setAgents([
          {
            id: 'codex',
            label: 'Codex',
            command: 'codex',
            status: 'not_configured',
            detail: 'Run with Tauri to detect local CLIs',
          },
        ]);
        reportError('Desktop backend unavailable', message);
        return;
      }
      try {
        setBootError(null);
        const [nextBoot, nextProfiles, nextDeployments] = await Promise.all([
          agentboardApi.bootstrap(),
          agentboardApi.listAgentProfiles(),
          agentboardApi.listDeployments(),
        ]);
        setBoot(nextBoot);
        setWorkspaces(nextBoot.workspaces);
        setAgents(nextBoot.agents);
        setAgentProfiles(nextProfiles);
        setDeployments(nextDeployments);
        setSessions(nextBoot.sessions);
        setSelectedWorkspaceId((current) => current ?? nextBoot.workspaces[0]?.id ?? null);
        reportSuccess(
          'Desktop backend ready',
          `${nextBoot.agents.filter((agent) => agent.status === 'available').length} commands available`,
          showToast
        );
      } catch (error) {
        const message = errorMessage(error);
        setBootError(message);
        reportError('Desktop bootstrap failed', error);
      }
    },
    [reportError, reportSuccess]
  );

  const loadWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        setBusyAction('load-workspace');
        const nextBundle = await agentboardApi.loadWorkspace(workspaceId);
        setBundle(nextBundle);
        setUseWorktreeIsolation(nextBundle.git.isRepo);
        setSessions((current) => [
          ...nextBundle.sessions,
          ...current.filter(
            (session) =>
              normalizedPath(session.workspacePath) !== normalizedPath(nextBundle.workspace.path)
          ),
        ]);
        setSessionLogs((current) => ({ ...current, ...nextBundle.sessionLogs }));
        setActiveSessionId((current) =>
          nextBundle.sessions.some((session) => session.id === current)
            ? current
            : (nextBundle.sessions[0]?.id ?? null)
        );
        setScanResults([]);
        setSelectedPipelineId(nextBundle.pipelines.pipelines[0]?.id ?? null);
        setSelectedNodeId(nextBundle.pipelines.pipelines[0]?.nodes[0]?.id ?? null);
        setSelectedFilePath(nextBundle.pipelines.pipelines[0]?.nodes[0]?.files[0]?.path ?? null);
        if (!nextBundle.git.isRepo) {
          reportWarning(
            'Workspace opened without Git',
            'Not a Git repository. Worktree isolation and Git diff review are unavailable.'
          );
        } else if (nextBundle.git.error) {
          reportWarning(
            'Workspace opened; Git is unavailable',
            humanizeError(nextBundle.git.error)
          );
        } else {
          reportSuccess(
            'Workspace loaded',
            `${nextBundle.pipelines.pipelines.length} pipelines / ${nextBundle.workspace.nodeCount} nodes`
          );
        }
      } catch (error) {
        reportError('Workspace load failed', error);
        setBundle(null);
      } finally {
        setBusyAction(null);
      }
    },
    [reportError, reportSuccess, reportWarning]
  );

  useEffect(() => {
    void loadBootstrap(false);
  }, [loadBootstrap]);

  useEffect(() => {
    if (selectedWorkspaceId) {
      void loadWorkspace(selectedWorkspaceId);
    } else {
      setBundle(null);
    }
  }, [loadWorkspace, selectedWorkspaceId]);

  useEffect(() => {
    const setup = async () => {
      const unlistenOutput = await listenEvent<AgentOutputEvent>('agent-output', ({ payload }) => {
        const line = cleanWindowsOutput(payload.line);
        setSessionLogs((prev) => ({
          ...prev,
          [payload.sessionId]: [
            ...(prev[payload.sessionId] ?? []),
            `[${payload.stream}] ${line}`,
          ].slice(-1200),
        }));
      });
      const unlistenStatus = await listenEvent<AgentStatusEvent>('agent-status', ({ payload }) => {
        if (!statusMatchesRunMode(payload.runMode, payload.status)) {
          reportError(
            'Session run mode mismatch',
            `Session ${payload.sessionId} reported ${payload.status} for ${payload.runMode} mode.`
          );
          return;
        }
        setSessions((prev) => {
          const found = prev.some((session) => session.id === payload.sessionId);
          if (!found) {
            pendingSessionStatusRef.current[payload.sessionId] = payload;
            return prev;
          }
          delete pendingSessionStatusRef.current[payload.sessionId];
          return prev.map((session) =>
            session.id === payload.sessionId
              ? {
                  ...session,
                  status: payload.status,
                  exitCode: payload.exitCode,
                  environmentBlocker: payload.environmentBlocker,
                  finishedAt: sessionIsActive(payload.status)
                    ? session.finishedAt
                    : new Date().toISOString(),
                }
              : session
          );
        });
        setQueue((current) =>
          current.map((item) =>
            item.sessionId === payload.sessionId
              ? { ...item, status: queueStatusFromSession(payload.status) }
              : item
          )
        );
        const deployment = deploymentsRef.current.find(
          (item) => item.sessionId === payload.sessionId
        );
        if (deployment) {
          if (deployment.runMode !== payload.runMode) {
            reportError(
              'Deployment run mode mismatch',
              `Deployment ${deployment.id} is ${deployment.runMode}, but session ${payload.sessionId} is ${payload.runMode}.`
            );
            return;
          }
          void persistDeploymentUpdate({
            ...deployment,
            status: payload.status === 'idle' ? 'staged' : payload.status,
            updatedAt: String(Date.now()),
          });
        }
        if (payload.status === 'completed') {
          reportSuccess('Agent session completed', `Session ${payload.sessionId}`, true);
        }
        if (payload.status === 'completed_inspection') {
          reportSuccess(
            'Agent inspection completed',
            'Agent inspected the target without editing.',
            true
          );
        }
        if (payload.status === 'failed') {
          reportError(
            'Agent session failed',
            payload.message ?? `Session ${payload.sessionId} failed`
          );
        }
        if (payload.status === 'external_blocked') {
          reportWarning(
            'Claude access blocked',
            payload.message ?? 'Claude subscription or organization access is unavailable.'
          );
        }
        if (payload.status === 'blocked_environment') {
          reportWarning(
            'Agent blocked by local environment',
            payload.environmentBlocker
              ? `${payload.environmentBlocker.cause} ${payload.environmentBlocker.suggestedAction}`
              : payload.message ?? 'Required local development tooling is unavailable.'
          );
        }
        if (payload.status === 'stopped') {
          reportSuccess('Agent session stopped', `Session ${payload.sessionId}`, true);
        }
      });
      return () => {
        unlistenOutput();
        unlistenStatus();
      };
    };
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void setup()
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          cleanup = fn;
        }
      })
      .catch((error) => reportError('Backend event listener setup failed', error));
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [persistDeploymentUpdate, reportError, reportSuccess, reportWarning]);

  useEffect(() => {
    if (!bundle || !selectedNode) return;
    const nextFile = selectedFilePath ?? selectedNode.files[0]?.path;
    if (!nextFile) {
      setFileResult(null);
      return;
    }
    let active = true;
    void agentboardApi
      .readFile(bundle.workspace.path, nextFile)
      .then((result) => {
        if (!active) return;
        setFileResult(result);
        if (!result.exists || result.error) {
          reportError('File read failed', result.error ?? `File does not exist: ${nextFile}`);
        } else {
          reportSuccess('Concerned file loaded', nextFile);
        }
      })
      .catch((error) => {
        if (!active) return;
        setFileResult({
          path: nextFile,
          exists: false,
          content: '',
          error: humanizeError(error),
        });
        reportError('File read failed', error);
      });
    return () => {
      active = false;
    };
  }, [bundle, reportError, reportSuccess, selectedFilePath, selectedNode]);

  const generatePromptForNode = useCallback(
    (node: PipelineNode) => {
      if (!selectedWorkspace || !bundle) {
        toast.error('Open a workspace first', {
          description: 'A generated prompt needs a workspace, pipeline, and selected node.',
        });
        return;
      }
      const pipeline =
        pipelines.find((item) => item.nodes.some((candidate) => candidate.id === node.id)) ??
        selectedPipeline;
      if (!pipeline) {
        toast.error('No pipeline is available', {
          description: 'Add at least one pipeline to .agentboard/pipelines.json, then refresh.',
        });
        return;
      }
      const prompt = generateAgentPrompt({
        workspace: selectedWorkspace,
        pipeline,
        node,
        agent: selectedAgent,
        skills: bundle.skills,
        includeRealityScan: includeScanInPrompt,
        scanIssues: scanResults.filter((finding) =>
          node.files.some((file) => normalizedPath(file.path) === normalizedPath(finding.file))
        ),
      });
      setGeneratedPrompt(prompt);
      setCommand(prompt);
      commandRef.current?.focus();
      toast.success('Prompt generated');
    },
    [
      bundle,
      includeScanInPrompt,
      scanResults,
      selectedAgent,
      selectedPipeline,
      selectedWorkspace,
      pipelines,
    ]
  );

  const generatePrompt = useCallback(() => {
    if (!selectedNode) {
      toast.error('Select a pipeline node first', {
        description: 'Open Pipeline, choose a node, then generate its reviewed prompt.',
      });
      return;
    }
    generatePromptForNode(selectedNode);
  }, [generatePromptForNode, selectedNode]);

  const startAgentSession = useCallback(
    async ({
      agent,
      prompt,
      nodeId,
      nodeLabel,
      queueItemId,
      useWorktree = false,
      allowSharedWorkspace = false,
      selectedSkillNames,
      runMode = 'edit',
      launchMetadata,
    }: {
      agent: AgentId;
      prompt: string;
      nodeId?: string;
      nodeLabel: string;
      queueItemId?: string;
      useWorktree?: boolean;
      allowSharedWorkspace?: boolean;
      selectedSkillNames?: string[];
      runMode?: DeploymentRunMode;
      launchMetadata?: {
        model?: string;
        targetType?: string;
        targetPath?: string;
        targetLabel?: string;
        deploymentId?: string;
      };
    }) => {
      if (!bundle || !selectedWorkspace) {
        toast.error('Open a workspace first', {
          description: 'Use Open workspace in the top-right corner or press Ctrl+O.',
        });
        return;
      }
      const agentInfo = agents.find((item) => item.id === agent);
      if (!agentInfo || (agentInfo.status !== 'available' && agentInfo.status !== 'running')) {
        toast.error(`${agentLabels[agent]} cannot run yet`, {
          description: agentInfo
            ? `${agentLabels[agent]} is ${formatAgentStatus(agentInfo)}. Install or configure it, then use Refresh.`
            : 'AgentBoard could not find this local command. Refresh agent availability.',
        });
        return;
      }
      if (!prompt.trim()) {
        toast.error('Review a prompt before running', {
          description: 'Generate a node-aware prompt or enter a command in the task box.',
        });
        return;
      }
      const runSkills = bundle.skills.filter(
        (skill) =>
          (selectedSkillNames ? selectedSkillNames.includes(skill.name) : skill.enabled) &&
          (!skill.manifest.compatible_agents?.length ||
            skill.manifest.compatible_agents.includes(agent))
      );

      try {
        setBusyAction('run-agent');
        const launch = (isolated: boolean, sharedConfirmed: boolean) =>
          agentboardApi.runAgent(
            bundle.workspace.path,
            selectedWorkspace.name,
            agent,
            prompt,
            runMode,
            nodeId,
            runSkills.map((skill) => skill.name),
            nodeLabel,
            isolated,
            sharedConfirmed,
            launchMetadata
          );
        const launchWithFallback = async () => {
          try {
            return await launch(useWorktree, allowSharedWorkspace);
          } catch (firstError) {
            let currentError = firstError;
            if (useWorktree && errorMessage(firstError).includes('WORKTREE_FAILED:')) {
              const confirmed = window.confirm(
                `Worktree isolation failed:\n\n${humanizeError(firstError)}\n\nRun this session in the original workspace instead? If another writing agent is active there, AgentBoard will require another confirmation.`
              );
              if (!confirmed) {
                reportWarning(
                  'Agent session not started',
                  'Worktree isolation failed and shared-workspace fallback was declined.'
                );
                return null;
              }
              try {
                return await launch(false, false);
              } catch (fallbackError) {
                currentError = fallbackError;
              }
            }
            if (
              !allowSharedWorkspace &&
              errorMessage(currentError).includes('SHARED_WORKSPACE_CONFIRMATION_REQUIRED:')
            ) {
              const confirmed = window.confirm(
                'Another agent session is already active in this folder.\n\nRunning two writing agents in the same workspace can cause conflicting edits. Continue without worktree isolation?'
              );
              if (!confirmed) {
                reportWarning(
                  'Agent session not started',
                  'Shared-workspace concurrency was declined.'
                );
                return null;
              }
              return launch(false, true);
            }
            throw currentError;
          }
        };
        const session = await launchWithFallback();
        if (!session) return;
        const pendingStatus = pendingSessionStatusRef.current[session.id];
        delete pendingSessionStatusRef.current[session.id];
        const nextSession = pendingStatus
          ? {
              ...session,
              status: pendingStatus.status,
              exitCode: pendingStatus.exitCode,
              environmentBlocker: pendingStatus.environmentBlocker,
              finishedAt: sessionIsActive(pendingStatus.status)
                ? session.finishedAt
                : new Date().toISOString(),
            }
          : session;
        setSessions((prev) => [nextSession, ...prev.filter((item) => item.id !== session.id)]);
        setQueue((current) => {
          const nextItem: QueueItem = {
            id: queueItemId ?? nowId('run'),
            workspacePath: bundle.workspace.path,
            nodeId: nodeId ?? 'rerun',
            nodeLabel,
            agent,
            skills: runSkills.map((skill) => skill.name),
            useWorktree: Boolean(session.worktreePath),
            status: queueStatusFromSession(nextSession.status),
            prompt,
            createdAt: new Date().toISOString(),
            sessionId: session.id,
            logPath: session.logPath,
          };
          if (queueItemId && current.some((item) => item.id === queueItemId)) {
            return current.map((item) =>
              item.id === queueItemId ? { ...nextItem, createdAt: item.createdAt } : item
            );
          }
          return [nextItem, ...current];
        });
        setActiveSessionId(session.id);
        setLogDrawerOpen(true);
        setLogDrawerExpanded(false);
        openInspector({ kind: 'session', id: session.id });
        if (session.promptTransport === 'file') {
          reportWarning(
            'Prompt stored locally',
            'Prompt was stored in a local prompt file to avoid Windows command-line length limits.'
          );
        }
        reportSuccess('Agent session started', session.logPath, true);
        return nextSession;
      } catch (error) {
        if (queueItemId) {
          setQueue((current) =>
            current.map((item) => (item.id === queueItemId ? { ...item, status: 'failed' } : item))
          );
        }
        reportError('Agent launch failed', error);
      } finally {
        setBusyAction(null);
      }
    },
    [agents, bundle, openInspector, reportError, reportSuccess, reportWarning, selectedWorkspace]
  );

  const runMultiAgentSmokeTest = useCallback(async () => {
    if (!bundle || !selectedWorkspace) {
      reportError('Multi-agent smoke test failed', 'Open a workspace first');
      return;
    }
    const powershell = agents.find((agent) => agent.id === 'powershell');
    if (!powershell || powershell.status === 'missing' || powershell.status === 'not_configured') {
      reportError('Multi-agent smoke test failed', 'PowerShell is not available');
      return;
    }
    try {
      setBusyAction('multi-agent-smoke');
      const started = await agentboardApi.runMultiAgentSmokeTest(
        bundle.workspace.path,
        selectedWorkspace.name
      );
      const nextSessions = started.map((session) => {
        const pending = pendingSessionStatusRef.current[session.id];
        delete pendingSessionStatusRef.current[session.id];
        return pending
          ? {
              ...session,
              status: pending.status,
              exitCode: pending.exitCode,
              environmentBlocker: pending.environmentBlocker,
              finishedAt: sessionIsActive(pending.status)
                ? session.finishedAt
                : new Date().toISOString(),
            }
          : session;
      });
      setSessions((current) => [
        ...nextSessions,
        ...current.filter(
          (session) => !nextSessions.some((startedSession) => startedSession.id === session.id)
        ),
      ]);
      setQueue((current) => [
        ...nextSessions.map(
          (session): QueueItem => ({
            id: nowId('smoke'),
            workspacePath: session.workspacePath,
            nodeId: 'multi-agent-smoke',
            nodeLabel: session.nodeName ?? 'Multi-agent smoke',
            agent: session.agent,
            skills: session.selectedSkills,
            useWorktree: false,
            status: queueStatusFromSession(session.status),
            prompt: session.prompt,
            createdAt: new Date().toISOString(),
            sessionId: session.id,
            logPath: session.logPath,
          })
        ),
        ...current,
      ]);
      setActiveSessionId(nextSessions[0]?.id ?? null);
      setLogDrawerOpen(true);
      setLogDrawerExpanded(false);
      if (nextSessions[0]) {
        openInspector({ kind: 'session', id: nextSessions[0].id });
      }
      reportSuccess(
        'Multi-agent smoke test started',
        `${nextSessions.length} independent PowerShell sessions are running`,
        true
      );
    } catch (error) {
      reportError('Multi-agent smoke test failed', error);
    } finally {
      setBusyAction(null);
    }
  }, [agents, bundle, openInspector, reportError, reportSuccess, selectedWorkspace]);

  const runSelectedNode = useCallback(async () => {
    if (!selectedNode) {
      toast.error('Select a pipeline node first', {
        description: 'Open Pipeline and choose the work item you want the agent to handle.',
      });
      return;
    }
    const prompt = command.trim() || generatedPrompt.trim();
    await startAgentSession({
      agent: selectedAgent,
      prompt,
      nodeId: selectedNode.id,
      nodeLabel: selectedNode.label,
      useWorktree: useWorktreeIsolation && Boolean(bundle?.git.isRepo),
    });
  }, [
    bundle?.git.isRepo,
    command,
    generatedPrompt,
    selectedAgent,
    selectedNode,
    startAgentSession,
    useWorktreeIsolation,
  ]);

  const runQueueItem = useCallback(
    async (item: QueueItem) => {
      await startAgentSession({
        agent: item.agent,
        prompt: item.prompt,
        nodeId: item.nodeId,
        nodeLabel: item.nodeLabel,
        queueItemId: item.id,
        useWorktree: item.useWorktree,
      });
    },
    [startAgentSession]
  );

  const rerunSession = useCallback(
    async (session: SessionInfo) => {
      const nodeId = session.nodeId ?? nodeIdFromPrompt(session.prompt);
      const node = pipelines
        .flatMap((pipeline) => pipeline.nodes)
        .find((item) => item.id === nodeId);
      await startAgentSession({
        agent: session.agent,
        prompt: session.prompt,
        nodeId,
        nodeLabel: session.nodeName ?? node?.label ?? 'Previous session',
        useWorktree: Boolean(session.worktreePath),
      });
    },
    [pipelines, startAgentSession]
  );

  const runRealityScan = useCallback(async () => {
    if (!bundle) {
      toast.error('Open a workspace before scanning', {
        description: 'The scanner only reads files inside the current workspace.',
      });
      return;
    }
    try {
      setScanRunning(true);
      const results = await agentboardApi.scanWorkspace(bundle.workspace.path);
      setScanResults(results);
      setActiveTab('reality');
      reportSuccess('Reality scan complete', `${results.length} findings`, true);
    } catch (error) {
      reportError('Reality scan failed', error);
    } finally {
      setScanRunning(false);
    }
  }, [bundle, reportError, reportSuccess]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.ctrlKey && key === 'k') {
        event.preventDefault();
        setActiveTab('overview');
        window.setTimeout(() => commandRef.current?.focus(), 0);
      }
      if (event.ctrlKey && key === 'g') {
        event.preventDefault();
        generatePrompt();
      }
      if (event.ctrlKey && key === 'r') {
        event.preventDefault();
        void runSelectedNode();
      }
      if (event.ctrlKey && event.shiftKey && key === 's') {
        event.preventDefault();
        void runRealityScan();
      }
      if (event.ctrlKey && key === 'o') {
        event.preventDefault();
        setAddWorkspaceOpen(true);
      }
      if (event.key === 'Escape') {
        setContextMenu(null);
        if (!addWorkspaceOpen) setInspectorSelection(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [addWorkspaceOpen, generatePrompt, runRealityScan, runSelectedNode]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [contextMenu]);

  const addWorkspace = async () => {
    const path = workspacePathInput.trim();
    if (!path) {
      toast.error('Enter an existing folder path', {
        description: 'Use the full Windows path, for example C:\\Users\\you\\Projects\\my-app.',
      });
      return;
    }
    try {
      setBusyAction('add-workspace');
      let workspace: WorkspaceSummary;
      try {
        workspace = await agentboardApi.addWorkspace(path);
      } catch (error) {
        const detail = errorMessage(error);
        if (!detail.includes('STARTER_REQUIRED:')) throw error;
        const createStarter = window.confirm(
          'This existing folder does not contain .agentboard/pipelines.json.\n\nInitialize it for AgentBoard by creating starter metadata under .agentboard/? Your source files will not be changed.'
        );
        if (!createStarter) {
          reportWarning(
            'Workspace not opened',
            'AgentBoard requires .agentboard/pipelines.json. No files were created.'
          );
          return;
        }
        workspace = await agentboardApi.addWorkspace(path, true);
      }
      setWorkspaces((prev) => [workspace, ...prev.filter((item) => item.id !== workspace.id)]);
      setSelectedWorkspaceId(workspace.id);
      setAddWorkspaceOpen(false);
      setWorkspacePathInput('');
      reportSuccess('Workspace opened', workspace.path, true);
    } catch (error) {
      reportError('Could not open workspace', error);
    } finally {
      setBusyAction(null);
    }
  };

  const openSampleWorkspace = async () => {
    try {
      setBusyAction('sample-workspace');
      const workspace = await agentboardApi.openSampleWorkspace();
      setWorkspaces((prev) => [workspace, ...prev.filter((item) => item.id !== workspace.id)]);
      setSelectedWorkspaceId(workspace.id);
      reportSuccess('Sample workspace opened', workspace.path, true);
    } catch (error) {
      reportError('Sample workspace failed', error);
    } finally {
      setBusyAction(null);
    }
  };

  const toggleSkill = (skillName: string) => {
    setBundle((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        skills: prev.skills.map((skill) =>
          skill.name === skillName ? { ...skill, enabled: !skill.enabled } : skill
        ),
      };
    });
  };

  const openCreateAgent = useCallback((profile?: AgentProfile | null) => {
    setEditingAgentProfile(profile ?? null);
    setCreateAgentOpen(true);
  }, []);

  const saveAgentProfile = useCallback(
    async (profile: AgentProfile) => {
      try {
        setBusyAction('save-agent-profile');
        const saved = await agentboardApi.saveAgentProfile(profile);
        setAgentProfiles((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        setCreateAgentOpen(false);
        setEditingAgentProfile(null);
        reportSuccess(
          editingAgentProfile ? 'Agent profile updated' : 'Agent profile created',
          saved.name,
          true
        );
      } catch (error) {
        reportError('Agent profile save failed', error);
      } finally {
        setBusyAction(null);
      }
    },
    [editingAgentProfile, reportError, reportSuccess]
  );

  const openDeployAgent = useCallback((target: DeploymentTarget) => {
    setDeploymentTarget(target);
    setDeployAgentOpen(true);
  }, []);

  const preflightDeployment = useCallback(
    async (draft: DeploymentDraft): Promise<DeploymentPreflightResult> => {
      if (!bundle || !deploymentTarget) {
        throw new Error('Open a workspace and choose a deployment target.');
      }
      const pipeline = deploymentTarget.pipelineId
        ? pipelines.find((item) => item.id === deploymentTarget.pipelineId)
        : undefined;
      const node = deploymentTarget.nodeId
        ? pipeline?.nodes.find((item) => item.id === deploymentTarget.nodeId)
        : undefined;
      return agentboardApi.deploymentPreflight({
        targetType: deploymentTarget.targetType,
        workspacePath: deploymentTarget.workspacePath,
        targetPath: deploymentTarget.targetPath,
        provider: draft.profile.provider,
        selectedSkills: draft.selectedSkills,
        task: draft.task,
        runMode: draft.runMode,
        writeFilesPermission: draft.profile.permissions.writeFiles,
        concernedFiles: node?.files.map((file) => file.path) ?? [],
      });
    },
    [bundle, deploymentTarget, pipelines]
  );

  const previewDeploymentPrompt = useCallback(
    (draft: DeploymentDraft) => {
      if (!bundle || !deploymentTarget) return '';
      const pipeline = deploymentTarget.pipelineId
        ? pipelines.find((item) => item.id === deploymentTarget.pipelineId)
        : undefined;
      const node = deploymentTarget.nodeId
        ? pipeline?.nodes.find((item) => item.id === deploymentTarget.nodeId)
        : undefined;
      const nodePaths = new Set(node?.files.map((file) => normalizedPath(file.path)) ?? []);
      return generateDeploymentPrompt({
        workspace: bundle.workspace,
        target: deploymentTarget,
        profile: draft.profile,
        task: draft.task,
        runMode: draft.runMode,
        selectedSkillNames: draft.selectedSkills,
        installedSkills: bundle.skills,
        pipeline,
        node,
        scanIssues: scanResults.filter((issue) => nodePaths.has(normalizedPath(issue.file))),
      });
    },
    [bundle, deploymentTarget, pipelines, scanResults]
  );

  const deployAgent = useCallback(
    async (draft: DeploymentDraft) => {
      if (!bundle || !deploymentTarget) {
        reportError('Deployment failed', 'Open a workspace and choose a deployment target.');
        return;
      }
      try {
        setBusyAction('deploy-agent');
        const finalPreflight = await preflightDeployment(draft);
        if (finalPreflight.requestedRunMode !== draft.runMode) {
          throw new Error(
            `Run mode changed during preflight: expected ${draft.runMode}, received ${finalPreflight.requestedRunMode}.`
          );
        }
        if (draft.runNow && finalPreflight.blockers.length) {
          throw new Error(
            finalPreflight.blockers.map((blocker) => blocker.message).join(' ')
          );
        }
        const prompt = previewDeploymentPrompt(draft);
        const timestamp = String(Date.now());
        const deployment: AgentDeployment = {
          id: nowId('deployment'),
          agentProfileId: draft.profile.id,
          agentName: draft.profile.name,
          ...deploymentTarget,
          selectedSkills: draft.selectedSkills,
          prompt,
          runMode: draft.runMode,
          isolationMode: draft.isolationMode,
          status: 'staged',
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        const saved = await agentboardApi.saveDeployment(deployment);
        if (saved.runMode !== draft.runMode) {
          throw new Error(
            `Saved deployment run mode mismatch: expected ${draft.runMode}, received ${saved.runMode}.`
          );
        }
        setDeployments((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        deploymentsRef.current = [
          saved,
          ...deploymentsRef.current.filter((item) => item.id !== saved.id),
        ];

        if (!draft.runNow) {
          setDeployAgentOpen(false);
          reportSuccess('Deployment staged', saved.targetLabel, true);
          return;
        }
        if (draft.profile.provider === 'custom') {
          reportWarning(
            'Deployment staged',
            'Custom profiles do not have a verified executable contract for Run now.'
          );
          setDeployAgentOpen(false);
          return;
        }

        const session = await startAgentSession({
          agent: draft.profile.provider,
          prompt,
          nodeId: deploymentTarget.nodeId ?? saved.id,
          nodeLabel: deploymentTarget.nodeName ?? deploymentTarget.targetLabel,
          useWorktree: draft.isolationMode === 'worktree_per_deployment',
          selectedSkillNames: draft.selectedSkills,
          runMode: saved.runMode,
          launchMetadata: {
            model: draft.profile.model,
            targetType: deploymentTarget.targetType,
            targetPath: deploymentTarget.targetPath,
            targetLabel: deploymentTarget.targetLabel,
            deploymentId: saved.id,
          },
        });
        if (!session) {
          reportWarning(
            'Deployment remains staged',
            'The backend session did not start. Review the reported launch error.'
          );
          return;
        }
        if (session.runMode !== saved.runMode) {
          if (sessionIsActive(session.status)) {
            await agentboardApi.stopSession(session.id).catch(() => undefined);
          }
          throw new Error(
            `Started session run mode mismatch: deployment is ${saved.runMode}, session is ${session.runMode}.`
          );
        }
        const runningDeployment: AgentDeployment = {
          ...saved,
          status: session.status === 'idle' ? 'staged' : session.status,
          sessionId: session.id,
          logPath: session.logPath,
          updatedAt: String(Date.now()),
        };
        await persistDeploymentUpdate(runningDeployment);
        setDeployAgentOpen(false);
        openInspector({ kind: 'deployment', id: saved.id });
        reportSuccess('Agent deployed', saved.targetLabel, true);
      } catch (error) {
        reportError('Deployment failed', error);
      } finally {
        setBusyAction(null);
      }
    },
    [
      bundle,
      deploymentTarget,
      openInspector,
      persistDeploymentUpdate,
      preflightDeployment,
      previewDeploymentPrompt,
      reportError,
      reportSuccess,
      reportWarning,
      startAgentSession,
    ]
  );

  const deleteDeployment = useCallback(
    async (deployment: AgentDeployment) => {
      if (deployment.status === 'running') {
        reportWarning('Deployment not deleted', 'Stop the running deployment first.');
        return;
      }
      if (!window.confirm(`Delete deployment "${deployment.agentName}"?`)) return;
      try {
        await agentboardApi.deleteDeployment(deployment.id);
        setDeployments((current) => current.filter((item) => item.id !== deployment.id));
        deploymentsRef.current = deploymentsRef.current.filter((item) => item.id !== deployment.id);
        reportSuccess('Deployment deleted', deployment.agentName, true);
      } catch (error) {
        reportError('Deployment delete failed', error);
      }
    },
    [reportError, reportSuccess, reportWarning]
  );

  const enqueueNode = () => {
    if (!bundle || !selectedNode) {
      toast.error('Select a pipeline node first', {
        description: 'Queued runs must remain attached to a specific pipeline node.',
      });
      return;
    }
    const prompt = command.trim() || generatedPrompt.trim();
    if (!prompt) {
      toast.error('Add a prompt before queueing', {
        description: 'Generate the selected node prompt or enter a reviewed task first.',
      });
      return;
    }
    const item: QueueItem = {
      id: nowId('queue'),
      workspacePath: bundle.workspace.path,
      nodeId: selectedNode.id,
      nodeLabel: selectedNode.label,
      agent: selectedAgent,
      skills: enabledSkills.map((skill) => skill.name),
      useWorktree: useWorktreeIsolation && bundle.git.isRepo,
      status: 'queued',
      prompt,
      createdAt: new Date().toISOString(),
    };
    setQueue((prev) => [item, ...prev]);
    toast.success('Run staged', { description: 'Open Timeline to start it when ready.' });
  };

  const createWorktree = async () => {
    if (!bundle || !selectedNode) {
      reportError('Worktree creation failed', 'Select a workspace and pipeline node first');
      return;
    }
    try {
      setBusyAction('worktree');
      const worktreePath = await agentboardApi.createWorktree(
        bundle.workspace.path,
        selectedNode.id
      );
      reportSuccess('Worktree created', worktreePath, true);
    } catch (error) {
      reportError('Worktree creation failed', error);
    } finally {
      setBusyAction(null);
    }
  };

  const generatePrDraft = () => {
    if (!bundle || !selectedNode || !selectedPipeline) return;
    const nodePaths = new Set(selectedNode.files.map((file) => normalizedPath(file.path)));
    const nodeFindings = scanResults.filter((finding) =>
      nodePaths.has(normalizedPath(finding.file))
    );
    const gitFiles = [
      ...bundle.git.changedFiles.map((change) => `${change.status.trim() || 'M'} ${change.path}`),
      ...bundle.git.untrackedFiles.map((path) => `?? ${path}`),
    ];
    const title = `Fix ${selectedNode.label} in ${selectedPipeline.name}`;
    const body = [
      `## Summary`,
      `- Address pipeline node: ${selectedNode.label}`,
      `- Status before work: ${selectedNode.status}`,
      '',
      `## Concerned Files`,
      ...(selectedNode.files.length
        ? selectedNode.files.map((file) => `- ${file.path}: ${file.reason}`)
        : ['- No files declared']),
      '',
      `## Scanner Findings`,
      ...(nodeFindings.length
        ? nodeFindings.map(
            (finding) =>
              `- [${finding.severity}] ${finding.file}:${finding.line} ${finding.pattern}`
          )
        : ['- No scanner findings attached to this node.']),
      '',
      `## Git Changes`,
      ...(gitFiles.length ? gitFiles.map((file) => `- ${file}`) : ['- Working tree is clean.']),
      ...(bundle.git.diffStat ? ['', '```text', bundle.git.diffStat, '```'] : []),
      '',
      `## Verification`,
      `- Not recorded yet. Add real command output before publishing.`,
    ].join('\n');
    setPrDraft(`${title}\n\n${body}`);
    toast.success('PR draft generated');
  };

  const openChangedFile = (path: string) => {
    setSelectedFilePath(path);
    setActiveTab('files');
  };

  const clearSessionHistory = useCallback(async () => {
    if (!bundle) {
      reportError('Clear session history failed', 'Open a workspace first');
      return;
    }
    const confirmed = window.confirm(
      `Permanently delete completed session logs for ${bundle.workspace.name}?\n\nThis cannot be undone. Running sessions and their logs will be retained.`
    );
    if (!confirmed) return;

    try {
      setBusyAction('clear-session-history');
      const result = await agentboardApi.clearSessionHistory(bundle.workspace.path);
      const removedIds = new Set(
        workspaceSessions
          .filter((session) => !sessionIsActive(session.status))
          .map((session) => session.id)
      );
      const retainedSessions = workspaceSessions.filter((session) =>
        sessionIsActive(session.status)
      );
      setSessions((current) => current.filter((session) => !removedIds.has(session.id)));
      setSessionLogs((current) => {
        const next = { ...current };
        for (const id of removedIds) delete next[id];
        return next;
      });
      setActiveSessionId(retainedSessions[0]?.id ?? null);
      reportSuccess(
        'Session history cleared',
        `${result.removed} logs removed${
          result.retainedRunning ? ` / ${result.retainedRunning} running retained` : ''
        }`,
        true
      );
    } catch (error) {
      reportError('Clear session history failed', error);
    } finally {
      setBusyAction(null);
    }
  }, [bundle, reportError, reportSuccess, workspaceSessions]);

  const openLogsFolder = useCallback(async () => {
    if (!bundle) {
      reportError('Open logs folder failed', 'Open a workspace first');
      return;
    }
    try {
      setBusyAction('open-logs-folder');
      const path = await agentboardApi.openLogsFolder(bundle.workspace.path);
      reportSuccess('Logs folder opened', path, true);
    } catch (error) {
      reportError('Open logs folder failed', error);
    } finally {
      setBusyAction(null);
    }
  }, [bundle, reportError, reportSuccess]);

  const refreshAgentAvailability = useCallback(async () => {
    try {
      setBusyAction('refresh-agents');
      const refreshed = await agentboardApi.refreshAgents();
      setAgents(refreshed);
      reportSuccess(
        'Agent availability refreshed',
        `${refreshed.filter((agent) => agent.status === 'available').length} commands available`,
        true
      );
    } catch (error) {
      reportError('Agent availability refresh failed', error);
    } finally {
      setBusyAction(null);
    }
  }, [reportError, reportSuccess]);

  const stopSession = useCallback(
    async (sessionId: string) => {
      try {
        await agentboardApi.stopSession(sessionId);
        reportSuccess('Stop requested', `Session ${sessionId}`, true);
      } catch (error) {
        reportError('Stop failed', error);
      }
    },
    [reportError, reportSuccess]
  );

  const createWorktreeForNode = useCallback(
    async (node: PipelineNode) => {
      if (!bundle) {
        reportError('Worktree creation failed', 'Open a workspace first');
        return;
      }
      try {
        setBusyAction('worktree');
        const path = await agentboardApi.createWorktree(bundle.workspace.path, node.id);
        reportSuccess('Worktree created', path, true);
      } catch (error) {
        reportError('Worktree creation failed', error);
      } finally {
        setBusyAction(null);
      }
    },
    [bundle, reportError, reportSuccess]
  );

  const openSessionLog = useCallback(
    (session: SessionInfo) => {
      setActiveSessionId(session.id);
      setLogDrawerOpen(true);
      openInspector({ kind: 'session', id: session.id });
    },
    [openInspector]
  );

  const copyText = useCallback(
    async (label: string, value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        reportSuccess(`${label} copied`, undefined, true);
      } catch (error) {
        reportError(`Could not copy ${label.toLowerCase()}`, error);
      }
    },
    [reportError, reportSuccess]
  );

  const exportDiagnostics = useCallback(
    async (includeIssueNotes: boolean) => {
      try {
        setBusyAction('export-diagnostics');
        const result = await agentboardApi.exportDiagnostics({
          recentErrors: recentErrorsRef.current,
          workspacePath: bundle?.workspace.path,
          issueNotes: includeIssueNotes ? issueNotes : undefined,
        });
        setDiagnosticsPath(result.path);
        reportSuccess(
          includeIssueNotes ? 'Issue report exported' : 'Diagnostics exported',
          result.path,
          true
        );
      } catch (error) {
        reportError('Diagnostics export failed', error);
      } finally {
        setBusyAction(null);
      }
    },
    [bundle?.workspace.path, issueNotes, reportError, reportSuccess]
  );

  const runningSessionForAgent = useCallback(
    (agent: AgentId) =>
      workspaceSessions.find(
        (session) => session.agent === agent && sessionIsActive(session.status)
      ),
    [workspaceSessions]
  );

  const workspaceContextItems = (workspace: WorkspaceSummary): ContextMenuItem[] => {
    const isCurrent = workspace.id === selectedWorkspaceId;
    return [
      {
        label: 'Deploy agent',
        icon: Bot,
        action: () => {
          setSelectedWorkspaceId(workspace.id);
          setActiveTab('overview');
          openDeployAgent({
            targetType: 'workspace',
            workspacePath: workspace.path,
            targetPath: workspace.path,
            targetLabel: workspace.name,
          });
        },
      },
      {
        label: 'Create new agent',
        icon: Plus,
        action: () => openCreateAgent(),
      },
      {
        label: 'View deployed agents',
        icon: Bot,
        disabled: !deployments.some(
          (deployment) =>
            normalizedPath(deployment.workspacePath) === normalizedPath(workspace.path)
        ),
        hint: deployments.some(
          (deployment) =>
            normalizedPath(deployment.workspacePath) === normalizedPath(workspace.path)
        )
          ? undefined
          : 'No deployments in this workspace',
        action: () => {
          setSelectedWorkspaceId(workspace.id);
          setActiveTab('overview');
        },
      },
      {
        label: 'Scan reality',
        icon: ShieldAlert,
        disabled: !isCurrent || !bundle,
        hint: !isCurrent ? 'Open this workspace first' : undefined,
        action: () => void runRealityScan(),
        separatorBefore: true,
      },
      {
        label: 'Git status',
        icon: GitCompare,
        disabled: !isCurrent || !bundle,
        hint: !isCurrent ? 'Open this workspace first' : undefined,
        action: () => setActiveTab('git'),
      },
      {
        label: 'Properties',
        icon: Info,
        action: () => openInspector({ kind: 'workspace', id: workspace.id }),
        separatorBefore: true,
      },
      {
        label: 'Remove from AgentBoard',
        icon: Trash2,
        disabled: true,
        danger: true,
        hint: 'Coming soon; removal will require confirmation',
        separatorBefore: true,
      },
    ];
  };

  const agentContextItems = (agent: AgentAvailability): ContextMenuItem[] => {
    const running = runningSessionForAgent(agent.id);
    const runnable = runnableAgents.includes(agent.id);
    return [
      {
        label: 'Run in workspace',
        icon: Play,
        disabled: !bundle || !runnable || agent.status === 'missing',
        hint: agent.status === 'missing' ? 'Install needed' : undefined,
        action: () => {
          setSelectedAgent(agent.id);
          setActiveTab('overview');
          window.setTimeout(() => commandRef.current?.focus(), 0);
        },
      },
      {
        label: 'View details',
        icon: Eye,
        action: () => openInspector({ kind: 'agent', id: agent.id }),
      },
      {
        label: 'Check availability',
        icon: RefreshCw,
        action: () => void refreshAgentAvailability(),
      },
      {
        label: 'Open logs',
        icon: Terminal,
        disabled: !bundle,
        action: () => {
          setLogDrawerOpen(true);
          if (running) setActiveSessionId(running.id);
        },
        separatorBefore: true,
      },
      {
        label: 'Stop session',
        icon: Square,
        disabled: !running,
        hint: running ? undefined : 'No running session',
        action: () => running && void stopSession(running.id),
      },
      {
        label: 'Properties',
        icon: Info,
        action: () => openInspector({ kind: 'agent', id: agent.id }),
        separatorBefore: true,
      },
    ];
  };

  const nodeContextItems = (node: PipelineNode): ContextMenuItem[] => {
    return [
      {
        label: 'Deploy agent to this pipeline node',
        icon: Bot,
        action: () => {
          if (!bundle || !selectedPipeline) return;
          setSelectedNodeId(node.id);
          openDeployAgent({
            targetType: 'pipeline_node',
            workspacePath: bundle.workspace.path,
            targetPath: `pipeline:${selectedPipeline.id}/${node.id}`,
            targetLabel: node.label,
            pipelineId: selectedPipeline.id,
            pipelineName: selectedPipeline.name,
            nodeId: node.id,
            nodeName: node.label,
          });
        },
      },
      {
        label: 'Generate prompt',
        icon: Sparkles,
        action: () => {
          setSelectedNodeId(node.id);
          setSelectedFilePath(node.files[0]?.path ?? null);
          generatePromptForNode(node);
          setActiveTab('overview');
          window.setTimeout(() => commandRef.current?.focus(), 0);
        },
      },
      {
        label: 'View concerned files',
        icon: FileCode,
        disabled: node.files.length === 0,
        action: () => {
          setSelectedNodeId(node.id);
          setSelectedFilePath(node.files[0]?.path ?? null);
          setActiveTab('files');
          openInspector({ kind: 'node', id: node.id }, 'files');
        },
        separatorBefore: true,
      },
      {
        label: 'Create worktree',
        icon: GitBranch,
        action: () => void createWorktreeForNode(node),
      },
      {
        label: 'Properties',
        icon: Info,
        action: () => openInspector({ kind: 'node', id: node.id }),
        separatorBefore: true,
      },
    ];
  };

  const skillContextItems = (skill: SkillInfo): ContextMenuItem[] => [
    {
      label: skill.enabled ? 'Disable' : 'Enable',
      icon: skill.enabled ? Square : Check,
      action: () => toggleSkill(skill.name),
      disabled:
        skill.manifest.source === 'github' &&
        skill.trustState !== 'reviewed' &&
        skill.trustState !== 'trusted',
      hint:
        skill.manifest.source === 'github' &&
        skill.trustState !== 'reviewed' &&
        skill.trustState !== 'trusted'
          ? 'Review or trust this skill in Marketplace before enabling it'
          : undefined,
    },
    {
      label: 'View skill',
      icon: Eye,
      action: () => openInspector({ kind: 'skill', id: skill.name }),
    },
    { label: 'Edit skill', icon: Wrench, disabled: true, hint: 'Coming soon' },
    {
      label: 'Reveal in File Explorer',
      icon: FolderOpen,
      disabled: true,
      hint: 'Skill reveal requires native shell support',
      separatorBefore: true,
    },
    {
      label: skill.manifest.source === 'github' ? 'Uninstall to trash' : 'Delete',
      icon: Trash2,
      disabled: skill.manifest.source !== 'github',
      danger: true,
      hint:
        skill.manifest.source === 'github'
          ? 'Moves the imported skill to .agentboard/skills/.trash'
          : 'Local skill deletion is not supported in this build',
      action:
        skill.manifest.source === 'github'
          ? async () => {
              if (!bundle) return;
              if (
                !window.confirm(
                  `Uninstall ${skill.title}? The folder will be moved to .agentboard/skills/.trash.`
                )
              ) {
                return;
              }
              try {
                const result = await agentboardApi.githubMarketplaceUninstall(
                  bundle.workspace.path,
                  skill.name
                );
                await loadWorkspace(bundle.workspace.id);
                reportSuccess('GitHub skill moved to trash', result.trashPath, true);
              } catch (error) {
                reportError('GitHub skill uninstall failed', error);
              }
            }
          : undefined,
    },
    {
      label: 'Properties',
      icon: Info,
      action: () => openInspector({ kind: 'skill', id: skill.name }),
    },
  ];

  const sessionContextItems = (session: SessionInfo): ContextMenuItem[] => {
    const promptAvailable = !session.prompt.startsWith('Restored from ');
    return [
      {
        label: 'Open log',
        icon: Terminal,
        action: () => openSessionLog(session),
      },
      {
        label: 'Stop session',
        icon: Square,
        disabled: !sessionIsActive(session.status),
        hint: sessionIsActive(session.status) ? undefined : 'Session is not running',
        action: () => void stopSession(session.id),
      },
      {
        label: 'Rerun prompt',
        icon: RotateCcw,
        disabled: !promptAvailable,
        hint: promptAvailable ? undefined : 'Legacy log has no original prompt metadata',
        action: () => void rerunSession(session),
      },
      {
        label: 'Copy summary',
        icon: Copy,
        action: () =>
          void copyText(
            'Session summary',
            `${agentLabels[session.agent]} · ${sessionStatusLabel(session)} · ${sessionTimestamp(session.startedAt)}\n${session.prompt}`
          ),
      },
      {
        label: 'Open logs folder',
        icon: FolderOpen,
        action: () => void openLogsFolder(),
        separatorBefore: true,
      },
      {
        label: 'Reveal log file',
        icon: FileText,
        disabled: true,
        hint: 'Direct file reveal requires native shell support',
      },
      {
        label: 'Delete log',
        icon: Trash2,
        disabled: true,
        danger: true,
        hint: 'Use confirmed Clear history for completed logs',
      },
      {
        label: 'Properties',
        icon: Info,
        action: () => openInspector({ kind: 'session', id: session.id }),
      },
    ];
  };

  const profileContextItems = (profile: AgentProfile): ContextMenuItem[] => [
    {
      label: 'View details',
      icon: Eye,
      action: () => openInspector({ kind: 'profile', id: profile.id }),
    },
    {
      label: 'Edit agent',
      icon: Wrench,
      action: () => openCreateAgent(profile),
    },
    {
      label: 'Duplicate agent',
      icon: Copy,
      action: () =>
        openCreateAgent({
          ...profile,
          id: nowId('profile'),
          name: `${profile.name} Copy`,
          createdAt: String(Date.now()),
          updatedAt: String(Date.now()),
        }),
    },
    {
      label: 'Properties',
      icon: Info,
      action: () => openInspector({ kind: 'profile', id: profile.id }),
      separatorBefore: true,
    },
  ];

  const deploymentContextItems = (deployment: AgentDeployment): ContextMenuItem[] => {
    const session = deployment.sessionId
      ? sessions.find((item) => item.id === deployment.sessionId)
      : undefined;
    return [
      {
        label: 'View details',
        icon: Eye,
        action: () => openInspector({ kind: 'deployment', id: deployment.id }),
      },
      {
        label: 'Edit agent',
        icon: Wrench,
        disabled: !agentProfiles.some((profile) => profile.id === deployment.agentProfileId),
        hint: agentProfiles.some((profile) => profile.id === deployment.agentProfileId)
          ? undefined
          : 'Agent profile is unavailable',
        action: () => {
          const profile = agentProfiles.find((item) => item.id === deployment.agentProfileId);
          if (profile) openCreateAgent(profile);
        },
      },
      {
        label: 'Duplicate agent',
        icon: Copy,
        disabled: !agentProfiles.some((profile) => profile.id === deployment.agentProfileId),
        hint: agentProfiles.some((profile) => profile.id === deployment.agentProfileId)
          ? undefined
          : 'Agent profile is unavailable',
        action: () => {
          const profile = agentProfiles.find((item) => item.id === deployment.agentProfileId);
          if (profile) {
            openCreateAgent({
              ...profile,
              id: nowId('profile'),
              name: `${profile.name} Copy`,
              createdAt: String(Date.now()),
              updatedAt: String(Date.now()),
            });
          }
        },
      },
      {
        label: 'Stop',
        icon: Square,
        disabled: deployment.status !== 'running' || !deployment.sessionId,
        hint: deployment.status === 'running' ? undefined : 'Deployment is not running',
        action: () => {
          if (deployment.sessionId) void stopSession(deployment.sessionId);
        },
        separatorBefore: true,
      },
      {
        label: 'Open log',
        icon: Terminal,
        disabled: !session,
        hint: session ? undefined : 'No session log is linked',
        action: () => session && openSessionLog(session),
      },
      {
        label: 'Delete deployment',
        icon: Trash2,
        danger: true,
        disabled: deployment.status === 'running',
        hint:
          deployment.status === 'running' ? 'Stop the deployment before deleting it' : undefined,
        action: () => void deleteDeployment(deployment),
        separatorBefore: true,
      },
      {
        label: 'Properties',
        icon: Info,
        action: () => openInspector({ kind: 'deployment', id: deployment.id }),
      },
    ];
  };

  const fileContextItems = (path: string): ContextMenuItem[] => [
    {
      label: 'Deploy agent to this file',
      icon: Bot,
      disabled: !bundle,
      action: () => {
        if (!bundle) return;
        openDeployAgent({
          targetType: 'file',
          workspacePath: bundle.workspace.path,
          targetPath: joinWorkspacePath(bundle.workspace.path, path),
          targetLabel: path,
        });
      },
    },
    {
      label: 'Deploy agent to containing folder',
      icon: Folder,
      disabled: !bundle,
      action: () => {
        if (!bundle) return;
        const folder = dirname(path);
        openDeployAgent({
          targetType: 'folder',
          workspacePath: bundle.workspace.path,
          targetPath: joinWorkspacePath(bundle.workspace.path, folder),
          targetLabel: folder,
        });
      },
    },
    {
      label: 'Open file',
      icon: FileCode,
      action: () => {
        setSelectedFilePath(path);
        setActiveTab('files');
      },
      separatorBefore: true,
    },
    {
      label: 'Reveal in File Explorer',
      icon: FolderOpen,
      disabled: true,
      hint: 'File reveal requires native shell support',
    },
    { label: 'Copy path', icon: Copy, action: () => void copyText('Path', path) },
    {
      label: 'Properties',
      icon: Info,
      action: () => openInspector({ kind: 'file', id: path }),
    },
  ];

  const folderContextItems = (path: string): ContextMenuItem[] => {
    const target = bundle
      ? {
          targetType: 'folder' as const,
          workspacePath: bundle.workspace.path,
          targetPath: joinWorkspacePath(bundle.workspace.path, path),
          targetLabel: path,
        }
      : null;
    return [
      {
        label: 'Deploy agent here',
        icon: Bot,
        disabled: !target,
        action: () => {
          if (target) openDeployAgent(target);
        },
      },
      {
        label: 'Create new agent here',
        icon: Plus,
        disabled: !target,
        action: () => {
          if (!target) return;
          openDeployAgent(target);
          openCreateAgent();
        },
      },
      {
        label: 'Reveal in File Explorer',
        icon: FolderOpen,
        disabled: true,
        hint: 'Folder reveal requires native shell support',
        separatorBefore: true,
      },
      {
        label: 'Copy path',
        icon: Copy,
        action: () => void copyText('Folder path', target?.targetPath ?? path),
      },
      {
        label: 'Properties',
        icon: Info,
        disabled: true,
        hint: 'Folder inspector is not available yet',
      },
    ];
  };

  return (
    <div
      className="rocket-shell flex h-screen overflow-hidden bg-background text-foreground"
      onClick={() => setContextMenu(null)}
    >
      <RocketRail
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        workspaces={filteredWorkspaces}
        selectedWorkspaceId={selectedWorkspaceId}
        selectWorkspace={(id) => {
          setSelectedWorkspaceId(id);
          setActiveTab('overview');
        }}
        agents={agents}
        agentProfiles={agentProfiles}
        deployments={deployments}
        workspaceSessions={workspaceSessions}
        workspaceSearch={workspaceSearch}
        setWorkspaceSearch={setWorkspaceSearch}
        openFolder={() => setAddWorkspaceOpen(true)}
        onWorkspaceContext={(event, workspace) =>
          showContextMenu(event, workspace.name, workspaceContextItems(workspace))
        }
        onAgentContext={(event, agent) =>
          showContextMenu(event, agent.label, agentContextItems(agent))
        }
        onProfileContext={(event, profile) =>
          showContextMenu(event, profile.name, profileContextItems(profile))
        }
        onDeploymentContext={(event, deployment) =>
          showContextMenu(event, deployment.agentName, deploymentContextItems(deployment))
        }
        openAgent={(agent) => openInspector({ kind: 'agent', id: agent.id })}
        inspectProfile={(profile) => openInspector({ kind: 'profile', id: profile.id })}
        inspectDeployment={(deployment) => openInspector({ kind: 'deployment', id: deployment.id })}
        createAgent={() => openCreateAgent()}
        openReleaseSupport={() => setReleaseSupportOpen(true)}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <RocketTopbar
          boot={boot}
          bootError={bootError}
          workspace={selectedWorkspace}
          activeTab={activeTab}
          runtimeNotice={runtimeNotice}
          refresh={() => loadBootstrap(true)}
          openFolder={() => setAddWorkspaceOpen(true)}
          toggleLogs={() => setLogDrawerOpen((open) => !open)}
          logsOpen={logDrawerOpen}
        />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <section className="min-w-0 flex-1 overflow-hidden panel-shell">
            <RocketCanvas
              bundle={bundle}
              selectedWorkspace={selectedWorkspace}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              selectedPipeline={selectedPipeline}
              selectedPipelineId={selectedPipelineId}
              setSelectedPipelineId={setSelectedPipelineId}
              selectedNode={selectedNode}
              selectNode={(node) => {
                setSelectedNodeId(node.id);
                setSelectedFilePath(node.files[0]?.path ?? null);
                openInspector({ kind: 'node', id: node.id });
              }}
              selectedAgent={selectedAgent}
              setSelectedAgent={setSelectedAgent}
              agents={agents}
              nodeStats={nodeStats}
              sessions={workspaceSessions}
              deployments={workspaceDeployments}
              activeWorkspaceCount={workspaces.filter((workspace) => workspace.exists).length}
              queue={queue.filter(
                (item) =>
                  !bundle ||
                  normalizedPath(item.workspacePath) === normalizedPath(bundle.workspace.path)
              )}
              scanResults={scanResults}
              scanRunning={scanRunning}
              fileResult={fileResult}
              selectedFilePath={selectedFilePath}
              setSelectedFilePath={setSelectedFilePath}
              commandRef={commandRef}
              command={command}
              setCommand={setCommand}
              unavailableAgent={Boolean(unavailableAgent)}
              enabledSkills={enabledSkills}
              useWorktreeIsolation={useWorktreeIsolation}
              setUseWorktreeIsolation={setUseWorktreeIsolation}
              runSelectedNode={runSelectedNode}
              runMultiAgentSmokeTest={runMultiAgentSmokeTest}
              stopSession={stopSession}
              generatePrompt={generatePrompt}
              enqueueNode={enqueueNode}
              runRealityScan={runRealityScan}
              runQueueItem={runQueueItem}
              rerunSession={rerunSession}
              openSessionLog={openSessionLog}
              openFolder={() => setAddWorkspaceOpen(true)}
              openSampleWorkspace={openSampleWorkspace}
              busyAction={busyAction}
              toggleSkill={toggleSkill}
              refreshSkills={async () => {
                if (selectedWorkspaceId) {
                  await loadWorkspace(selectedWorkspaceId);
                }
              }}
              openChangedFile={openChangedFile}
              onNodeContext={(event, node) => {
                setSelectedNodeId(node.id);
                setSelectedFilePath(node.files[0]?.path ?? null);
                showContextMenu(event, node.label, nodeContextItems(node));
              }}
              onSessionContext={(event, session) =>
                showContextMenu(event, agentLabels[session.agent], sessionContextItems(session))
              }
              onDeploymentContext={(event, deployment) =>
                showContextMenu(event, deployment.agentName, deploymentContextItems(deployment))
              }
              onSkillContext={(event, skill) =>
                showContextMenu(event, skill.manifest.title, skillContextItems(skill))
              }
              onFileContext={(event, path) =>
                showContextMenu(event, basename(path), fileContextItems(path))
              }
              onFolderContext={(event, path) =>
                showContextMenu(event, basename(path), folderContextItems(path))
              }
              inspectSession={(session) => openInspector({ kind: 'session', id: session.id })}
              inspectDeployment={(deployment) =>
                openInspector({ kind: 'deployment', id: deployment.id })
              }
              inspectSkill={(skill) => openInspector({ kind: 'skill', id: skill.name })}
              inspectFile={(path) => openInspector({ kind: 'file', id: path })}
              showGettingStarted={!gettingStartedDismissed}
              dismissGettingStarted={() => {
                setGettingStartedDismissed(true);
                try {
                  window.localStorage.setItem('agentboard:getting-started-dismissed', 'true');
                } catch {
                  // The hint still dismisses for the current app session.
                }
              }}
            />
          </section>
          {inspectorSelection && (
            <RocketInspector
              selection={inspectorSelection}
              tab={inspectorTab}
              setTab={setInspectorTab}
              close={() => setInspectorSelection(null)}
              bundle={bundle}
              workspaces={workspaces}
              agents={agents}
              agentProfiles={agentProfiles}
              deployments={workspaceDeployments}
              sessions={workspaceSessions}
              selectedNode={selectedNode}
              scanResults={scanResults}
              selectedAgent={selectedAgent}
              command={command}
              prDraft={prDraft}
              includeScanInPrompt={includeScanInPrompt}
              setIncludeScanInPrompt={setIncludeScanInPrompt}
              toggleSkill={toggleSkill}
              generatePrompt={generatePrompt}
              generatePrDraft={generatePrDraft}
              openChangedFile={openChangedFile}
              openSessionLog={openSessionLog}
              stopSession={stopSession}
              editAgentProfile={(profile) => openCreateAgent(profile)}
              rerunSession={rerunSession}
              runSelectedNode={runSelectedNode}
              createWorktree={createWorktree}
              copyText={copyText}
              onFileContext={(event, path) =>
                showContextMenu(event, basename(path), fileContextItems(path))
              }
            />
          )}
        </div>
        <RocketLogDrawer
          open={logDrawerOpen}
          expanded={logDrawerExpanded}
          setExpanded={setLogDrawerExpanded}
          openDrawer={() => setLogDrawerOpen(true)}
          close={() => setLogDrawerOpen(false)}
          sessions={workspaceSessions}
          activeSession={activeSession}
          activeLogs={activeLogs}
          selectSession={(session) => {
            setActiveSessionId(session.id);
            openInspector({ kind: 'session', id: session.id });
          }}
          stopSession={stopSession}
          clearHistory={clearSessionHistory}
          openLogsFolder={openLogsFolder}
          onSessionContext={(event, session) =>
            showContextMenu(event, agentLabels[session.agent], sessionContextItems(session))
          }
        />
      </main>
      {contextMenu && <DesktopContextMenu menu={contextMenu} close={() => setContextMenu(null)} />}
      {addWorkspaceOpen && (
        <AddWorkspaceModal
          value={workspacePathInput}
          setValue={setWorkspacePathInput}
          onClose={() => setAddWorkspaceOpen(false)}
          onSubmit={addWorkspace}
          openSampleWorkspace={openSampleWorkspace}
          busyAction={busyAction}
        />
      )}
      <DeployAgentModal
        open={deployAgentOpen}
        target={deploymentTarget}
        profiles={agentProfiles}
        skills={bundle?.skills ?? []}
        busy={busyAction === 'deploy-agent'}
        onClose={() => setDeployAgentOpen(false)}
        onCreateAgent={() => openCreateAgent()}
        onPreflight={preflightDeployment}
        onPromptPreview={previewDeploymentPrompt}
        onDeploy={deployAgent}
      />
      <CreateAgentModal
        open={createAgentOpen}
        initialProfile={editingAgentProfile}
        skills={bundle?.skills ?? []}
        busy={busyAction === 'save-agent-profile'}
        onClose={() => {
          setCreateAgentOpen(false);
          setEditingAgentProfile(null);
        }}
        onSave={saveAgentProfile}
      />
      {releaseSupportOpen && (
        <ReleaseSupportModal
          issueNotes={issueNotes}
          setIssueNotes={setIssueNotes}
          diagnosticsPath={diagnosticsPath}
          busy={busyAction === 'export-diagnostics'}
          onClose={() => setReleaseSupportOpen(false)}
          onExportDiagnostics={() => exportDiagnostics(false)}
          onExportIssue={() => exportDiagnostics(true)}
        />
      )}
    </div>
  );
}

function Sidebar({
  collapsed,
  setCollapsed,
  workspaces,
  workspaceSearch,
  setWorkspaceSearch,
  selectedWorkspaceId,
  setSelectedWorkspaceId,
  agents,
  sessions,
  activeTab,
  setActiveTab,
  openSkills,
  openAddWorkspace,
  openSampleWorkspace,
  busyAction,
}: {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  workspaces: WorkspaceSummary[];
  workspaceSearch: string;
  setWorkspaceSearch: (value: string) => void;
  selectedWorkspaceId: string | null;
  setSelectedWorkspaceId: (value: string) => void;
  agents: AgentAvailability[];
  sessions: SessionInfo[];
  activeTab: CenterTab;
  setActiveTab: (tab: CenterTab) => void;
  openSkills: () => void;
  openAddWorkspace: () => void;
  openSampleWorkspace: () => void;
  busyAction: string | null;
}) {
  const runningCount = sessions.filter((session) => sessionIsActive(session.status)).length;
  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-r border-subtle transition-all duration-300"
      style={{ width: collapsed ? 54 : 264, background: 'var(--sidebar-bg)' }}
    >
      <div className="flex h-12 items-center gap-2 border-b border-subtle px-3">
        <div className="flex h-7 w-7 items-center justify-center rounded border border-primary/30 bg-primary/10">
          <Bot size={15} className="text-primary" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              AgentBoard
            </p>
            <p className="font-mono text-2xs text-muted-foreground">local agent control plane</p>
          </div>
        )}
      </div>

      <nav className="flex shrink-0 flex-col gap-1 p-2">
        {[
          {
            label: 'Dashboard',
            icon: Layers3,
            enabled: true,
            selected: activeTab !== 'timeline',
            onClick: () => setActiveTab('graph'),
          },
          {
            label: 'History',
            icon: History,
            enabled: true,
            selected: activeTab === 'timeline',
            onClick: () => setActiveTab('timeline'),
          },
          { label: 'Skills', icon: Puzzle, enabled: true, selected: false, onClick: openSkills },
          { label: 'Settings', icon: Wrench, enabled: false, selected: false, onClick: undefined },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              disabled={!item.enabled}
              onClick={item.onClick}
              className={cn(
                'group relative flex items-center gap-2.5 rounded px-2.5 py-2 text-sm transition-all duration-150',
                item.selected && 'nav-active font-medium',
                item.enabled &&
                  !item.selected &&
                  'text-muted-foreground hover:bg-hover hover:text-foreground',
                !item.enabled && 'cursor-not-allowed text-muted-foreground/50'
              )}
              title={!item.enabled ? `${item.label} coming soon` : item.label}
            >
              <Icon size={15} className="shrink-0" />
              {!collapsed && (
                <span>{item.enabled ? item.label : `${item.label} - coming soon`}</span>
              )}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-y border-subtle p-2">
          <div className="command-input flex items-center gap-2 rounded border border-subtle bg-input px-2 py-1.5">
            <Search size={12} className="text-muted-foreground" />
            <input
              value={workspaceSearch}
              onChange={(event) => setWorkspaceSearch(event.target.value)}
              placeholder="Search workspace"
              className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!collapsed && (
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
              Workspaces
            </span>
            <button
              onClick={openAddWorkspace}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
              title="Open folder"
            >
              <Plus size={13} />
            </button>
          </div>
        )}
        <div className="px-1 pb-3">
          {workspaces.length === 0 && !collapsed && (
            <div className="mx-2 rounded border border-subtle bg-card/40 p-3 text-xs text-muted-foreground">
              No workspaces yet.
              <button
                onClick={openAddWorkspace}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-green-500"
              >
                <FolderOpen size={12} />
                Open Folder
              </button>
              <button
                onClick={openSampleWorkspace}
                className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded border border-subtle px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
              >
                {busyAction === 'sample-workspace' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <FolderOpen size={12} />
                )}
                Open sample
              </button>
            </div>
          )}
          {workspaces.map((workspace) => {
            const selected = workspace.id === selectedWorkspaceId;
            return (
              <button
                key={workspace.id}
                onClick={() => setSelectedWorkspaceId(workspace.id)}
                className={cn(
                  'group flex w-full items-center gap-2 rounded px-2 py-2 text-left transition-all duration-150',
                  selected
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-hover hover:text-foreground'
                )}
                title={workspace.path}
              >
                {workspace.exists ? (
                  <FolderOpen size={14} className="shrink-0 text-coded" />
                ) : (
                  <AlertTriangle size={14} className="shrink-0 text-error" />
                )}
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">
                      {workspace.name}
                    </span>
                    <span className="rounded bg-hover px-1 py-0.5 font-mono text-2xs text-muted-foreground">
                      {workspace.nodeCount}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-subtle p-2">
        {!collapsed && (
          <div className="mb-2">
            <div className="mb-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Running Agents
                </span>
                <span className="font-mono text-2xs text-primary">{runningCount}</span>
              </div>
              <div className="flex max-h-24 flex-col gap-1 overflow-y-auto">
                {sessions.filter((session) => sessionIsActive(session.status)).length === 0 && (
                  <p className="rounded border border-subtle bg-card/40 px-2 py-1.5 text-2xs text-muted-foreground">
                    No running sessions
                  </p>
                )}
                {sessions
                  .filter((session) => sessionIsActive(session.status))
                  .slice(0, 4)
                  .map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center gap-2 rounded border border-primary/20 bg-primary/5 px-2 py-1.5"
                    >
                      <span className="h-1.5 w-1.5 rounded-full status-dot-running pulse-green" />
                      <span className="min-w-0 flex-1 truncate font-mono text-2xs text-foreground">
                        {agentLabels[session.agent]}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                Agent Availability
              </span>
              <span className="font-mono text-2xs text-primary">{runningCount} running</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-1.5 rounded border border-subtle bg-card/50 px-2 py-1"
                  title={agent.detail}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      agent.status === 'available' && 'status-dot-running',
                      agent.status === 'running' && 'status-dot-running pulse-green',
                      agent.status === 'missing' && 'status-dot-error',
                      agent.status === 'not_configured' && 'status-dot-idle'
                    )}
                  />
                  <span className="truncate font-mono text-2xs text-muted-foreground">
                    {agent.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center gap-2 rounded border border-subtle px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
        >
          <Maximize2 size={12} />
          {!collapsed && 'Toggle sidebar'}
        </button>
      </div>
    </aside>
  );
}

function Topbar({
  boot,
  bootError,
  selectedWorkspace,
  refresh,
  openAddWorkspace,
  openSkills,
}: {
  boot: AppBootstrap | null;
  bootError: string | null;
  selectedWorkspace: WorkspaceSummary | null;
  refresh: () => Promise<void>;
  openAddWorkspace: () => void;
  openSkills: () => void;
}) {
  return (
    <header
      className="flex h-12 shrink-0 items-center gap-4 border-b border-subtle px-4"
      style={{ background: 'var(--topbar-bg)' }}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="text-sm text-muted-foreground">AgentBoard</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="truncate text-sm font-medium text-foreground">
          {selectedWorkspace?.name ?? 'No workspace selected'}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {bootError ? (
          <span className="rounded border border-error/30 bg-error/10 px-2 py-1 font-mono text-2xs text-error">
            desktop backend unavailable
          </span>
        ) : (
          <span className="hidden rounded border border-subtle bg-card px-2 py-1 font-mono text-2xs text-muted-foreground md:inline">
            app data: {boot?.appDataDir ?? 'loading'}
          </span>
        )}
        <button onClick={openSkills} className="btn-ghost text-xs">
          <Puzzle size={12} />
          Skills
        </button>
        <button onClick={openAddWorkspace} className="btn-ghost text-xs">
          <FolderOpen size={12} />
          Open Folder
          <kbd>Ctrl+O</kbd>
        </button>
        <button onClick={() => void refresh()} className="btn-ghost text-xs">
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>
    </header>
  );
}

function RuntimeStatusBar({ notice }: { notice: RuntimeNotice }) {
  const tone = {
    success: 'border-running/20 bg-running/5 text-running',
    error: 'border-error/30 bg-error/10 text-error',
    warning: 'border-coded/30 bg-coded/10 text-coded',
    info: 'border-accent/20 bg-accent/5 text-accent',
  }[notice.kind];

  return (
    <div
      role={notice.kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex min-h-8 shrink-0 items-center gap-2 border-b px-4 font-mono text-2xs',
        tone
      )}
      data-testid="runtime-status"
    >
      <span className="font-semibold">{notice.title}</span>
      {notice.detail && <span className="min-w-0 flex-1 truncate opacity-80">{notice.detail}</span>}
      <time className="ml-auto shrink-0 opacity-60">
        {new Date(notice.timestamp).toLocaleTimeString()}
      </time>
    </div>
  );
}

function StatsBar({
  stats,
  sessions,
  agents,
}: {
  stats: ReturnType<typeof countNodes>;
  sessions: SessionInfo[];
  agents: AgentAvailability[];
}) {
  const runningSessions = sessions.filter((session) => sessionIsActive(session.status)).length;
  const availableAgents = agents.filter((agent) => agent.status === 'available').length;
  const cards = [
    { label: 'Total Nodes', value: stats.total, icon: Layers3, color: 'text-muted-foreground' },
    {
      label: 'Production Ready',
      value: stats.production_ready,
      icon: CheckCircle2,
      color: 'text-running',
    },
    { label: 'Tested', value: stats.tested, icon: ShieldAlert, color: 'text-accent' },
    { label: 'Coded', value: stats.coded, icon: Code2, color: 'text-coded' },
    { label: 'Partial', value: stats.partial, icon: Circle, color: 'text-coded' },
    { label: 'Broken', value: stats.broken, icon: AlertTriangle, color: 'text-error' },
    { label: 'Mock', value: stats.mock, icon: Sparkles, color: 'text-purple-300' },
    {
      label: 'Visual Only',
      value: stats.visual_only,
      icon: Clipboard,
      color: 'text-muted-foreground',
    },
    {
      label: 'Not Started',
      value: stats.not_started,
      icon: Circle,
      color: 'text-muted-foreground',
    },
    { label: 'Running', value: runningSessions, icon: Zap, color: 'text-running' },
    { label: 'Agents Found', value: availableAgents, icon: Bot, color: 'text-accent' },
  ];
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-subtle px-4 py-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-11">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="card-hover flex items-center gap-2 rounded-lg border border-subtle bg-card/60 px-2.5 py-2"
          >
            <Icon size={14} className={card.color} />
            <div className="min-w-0">
              <p
                className={cn('font-mono text-lg font-bold leading-none tabular-nums', card.color)}
              >
                {card.value}
              </p>
              <p className="truncate text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                {card.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WorkspaceStrip({
  bundle,
  selectedPipeline,
  selectedPipelineId,
  setSelectedPipelineId,
  selectedAgent,
  setSelectedAgent,
  agents,
  runSelectedNode,
  generatePrompt,
  scanRunning,
  runRealityScan,
  busyAction,
  openAddWorkspace,
}: {
  bundle: WorkspaceBundle | null;
  selectedPipeline: Pipeline | null;
  selectedPipelineId: string | null;
  setSelectedPipelineId: (value: string) => void;
  selectedAgent: AgentId;
  setSelectedAgent: (value: AgentId) => void;
  agents: AgentAvailability[];
  runSelectedNode: () => Promise<void>;
  generatePrompt: () => void;
  scanRunning: boolean;
  runRealityScan: () => Promise<void>;
  busyAction: string | null;
  openAddWorkspace: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-subtle px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-md font-semibold text-foreground">
          {bundle?.workspace.name ?? 'Workspace Dashboard'}
        </h1>
        <p className="mt-0.5 truncate font-mono text-2xs text-muted-foreground">
          {bundle?.workspace.path ?? 'Open a local folder to start supervising agents.'}
          {bundle?.git.isRepo
            ? ` / ${bundle.git.branch ?? 'git'}`
            : bundle
              ? ' / not a git repo'
              : ''}
        </p>
      </div>
      {bundle ? (
        <>
          <div className="relative">
            <select
              value={selectedPipelineId ?? ''}
              onChange={(event) => setSelectedPipelineId(event.target.value)}
              className="w-44 appearance-none rounded border border-subtle bg-input px-2.5 py-1.5 pr-7 font-mono text-xs text-foreground outline-none transition-colors focus:border-ring"
            >
              {bundle.pipelines.pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={11}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          <div className="relative">
            <select
              value={selectedAgent}
              onChange={(event) => setSelectedAgent(event.target.value as AgentId)}
              className="w-40 appearance-none rounded border border-subtle bg-input px-2.5 py-1.5 pr-7 font-mono text-xs text-foreground outline-none transition-colors focus:border-ring"
            >
              {agents
                .filter((agent) => runnableAgents.includes(agent.id))
                .map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.label} - {formatAgentStatus(agent)}
                  </option>
                ))}
            </select>
            <ChevronDown
              size={11}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          <button onClick={generatePrompt} className="btn-ghost text-xs">
            <Sparkles size={12} />
            Generate
          </button>
          <button
            onClick={() => void runRealityScan()}
            className="btn-ghost text-xs"
            disabled={scanRunning}
          >
            {scanRunning ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <ShieldAlert size={12} />
            )}
            Scan
          </button>
          <button
            onClick={() => void runSelectedNode()}
            className="btn-primary text-xs"
            disabled={busyAction === 'run-agent'}
          >
            {busyAction === 'run-agent' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            Run
          </button>
        </>
      ) : (
        <button onClick={openAddWorkspace} className="btn-primary text-xs">
          <FolderOpen size={12} />
          Open Folder
        </button>
      )}
      {selectedPipeline && (
        <span className="hidden font-mono text-2xs text-muted-foreground 2xl:inline">
          {selectedPipeline.nodes.length} nodes / {selectedPipeline.edges.length} edges
        </span>
      )}
    </div>
  );
}

function TabBar({
  activeTab,
  setActiveTab,
}: {
  activeTab: CenterTab;
  setActiveTab: (value: CenterTab) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-subtle px-4 py-1.5">
      {tabItems.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition-all duration-150',
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-panel'
                : 'text-muted-foreground hover:bg-hover hover:text-foreground'
            )}
          >
            <Icon size={12} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function GraphView({
  pipeline,
  selectedNodeId,
  onSelectNode,
}: {
  pipeline: Pipeline | null;
  selectedNodeId: string | null;
  onSelectNode: (node: PipelineNode) => void;
}) {
  if (!pipeline) {
    return (
      <EmptyState
        icon={Layers3}
        title="No pipeline configured"
        body=".agentboard/pipelines.json exists but contains no pipelines. Add a real pipeline definition to begin review."
      />
    );
  }
  const nodes = pipeline.nodes;
  const positionById = new Map<string, { x: number; y: number }>();
  nodes.forEach((node, index) => {
    const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(nodes.length))));
    const row = Math.floor(index / columns);
    const col = index % columns;
    const rows = Math.max(1, Math.ceil(nodes.length / columns));
    positionById.set(node.id, {
      x: 14 + col * (72 / Math.max(1, columns - 1 || 1)),
      y: 16 + row * (66 / Math.max(1, rows - 1 || 1)),
    });
  });
  return (
    <div className="h-full overflow-auto p-4">
      <div className="relative min-h-[520px] overflow-hidden rounded border border-subtle bg-[#101010]">
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage: 'radial-gradient(#2a2a2a 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />
        <svg className="absolute inset-0 h-full w-full">
          {pipeline.edges.map(([from, to]) => {
            const a = positionById.get(from);
            const b = positionById.get(to);
            if (!a || !b) return null;
            return (
              <line
                key={`${from}-${to}`}
                x1={`${a.x}%`}
                y1={`${a.y}%`}
                x2={`${b.x}%`}
                y2={`${b.y}%`}
                stroke="rgba(136,136,136,0.32)"
                strokeWidth="1.25"
              />
            );
          })}
        </svg>
        {nodes.map((node) => {
          const pos = positionById.get(node.id) ?? { x: 50, y: 50 };
          const meta = statusMeta[node.status];
          const selected = node.id === selectedNodeId;
          return (
            <button
              key={node.id}
              onClick={() => onSelectNode(node)}
              className={cn(
                'absolute w-56 -translate-x-1/2 -translate-y-1/2 rounded border p-3 text-left transition-all duration-200 hover:-translate-y-[calc(50%+2px)] hover:border-primary/30',
                selected && 'selected-node-pulse'
              )}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                background: meta.bg,
                borderColor: selected ? 'var(--primary)' : meta.border,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-sm font-semibold text-foreground">
                  {node.label}
                </span>
                <span
                  className={cn('rounded border px-1.5 py-0.5 font-mono text-2xs', meta.color)}
                  style={{ borderColor: meta.border }}
                >
                  {meta.label}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3 font-mono text-2xs text-muted-foreground">
                <span>{node.files.length} files</span>
                <span>{node.issues.length} issues</span>
                <span>{node.checks.length} checks</span>
              </div>
              {node.issues[0] && (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{node.issues[0]}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilesView({
  selectedNode,
  selectedFilePath,
  setSelectedFilePath,
  fileResult,
}: {
  selectedNode: PipelineNode | null;
  selectedFilePath: string | null;
  setSelectedFilePath: (value: string) => void;
  fileResult: FileReadResult | null;
}) {
  if (!selectedNode) {
    return (
      <EmptyState
        icon={FileCode}
        title="No node selected"
        body="Select a pipeline node to inspect concerned files."
      />
    );
  }
  const selectedFile = selectedNode.files.find((file) => file.path === selectedFilePath);
  const startLine = selectedFile?.startLine;
  const endLine = selectedFile?.endLine;
  const lines = fileResult?.content.split(/\r?\n/) ?? [];
  return (
    <div className="grid h-full grid-cols-[260px_minmax(0,1fr)] overflow-hidden">
      <div className="border-r border-subtle bg-sidebar/60 p-3">
        <p className="mb-2 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
          Concerned Files
        </p>
        <div className="flex flex-col gap-1">
          {selectedNode.files.length === 0 && (
            <p className="rounded border border-subtle bg-card p-3 text-xs text-muted-foreground">
              No files declared for this node.
            </p>
          )}
          {selectedNode.files.map((file) => (
            <button
              key={file.path}
              onClick={() => setSelectedFilePath(file.path)}
              className={cn(
                'rounded border px-2 py-2 text-left transition-all duration-150',
                selectedFilePath === file.path
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-transparent hover:border-subtle hover:bg-hover'
              )}
            >
              <span className="block truncate font-mono text-xs text-foreground">{file.path}</span>
              <span className="mt-1 line-clamp-2 block text-2xs text-muted-foreground">
                {file.reason}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 overflow-hidden p-3">
        <div className="mb-2 flex items-center justify-between rounded border border-subtle bg-card px-3 py-2">
          <span className="truncate font-mono text-xs text-muted-foreground">
            {fileResult?.path ?? selectedFilePath ?? 'No file'}
          </span>
          {startLine && endLine && (
            <span className="tag-chip">
              lines {startLine}-{endLine}
            </span>
          )}
        </div>
        <div className="h-[calc(100%-46px)] overflow-auto rounded border border-subtle bg-[#0d0d0d]">
          {!fileResult ? (
            <div className="p-4 text-xs text-muted-foreground">Loading file...</div>
          ) : !fileResult.exists ? (
            <div className="p-4 text-xs text-error">
              Missing file: {fileResult.path}
              <p className="mt-2 text-muted-foreground">
                {fileResult.error ?? 'The file does not exist in this workspace.'}
              </p>
            </div>
          ) : (
            <pre className="code-block p-3 text-foreground/90">
              {lines.map((line, index) => {
                const lineNumber = index + 1;
                const highlighted = Boolean(
                  startLine && endLine && lineNumber >= startLine && lineNumber <= endLine
                );
                return (
                  <div
                    key={`${fileResult.path}-${lineNumber}`}
                    className={highlighted ? 'highlight-line' : ''}
                  >
                    <span className="mr-3 inline-block w-8 select-none text-right text-2xs text-muted-foreground/45 tabular-nums">
                      {lineNumber}
                    </span>
                    <span>{line || ' '}</span>
                  </div>
                );
              })}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineView({
  selectedWorkspace,
  selectedNode,
  sessions,
  queue,
  setActiveSessionId,
  setActiveTab,
  runQueueItem,
  rerunSession,
}: {
  selectedWorkspace: WorkspaceSummary | null;
  selectedNode: PipelineNode | null;
  sessions: SessionInfo[];
  queue: QueueItem[];
  setActiveSessionId: (id: string) => void;
  setActiveTab: (tab: CenterTab) => void;
  runQueueItem: (item: QueueItem) => Promise<void>;
  rerunSession: (session: SessionInfo) => Promise<void>;
}) {
  return (
    <div className="h-full overflow-auto p-5">
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <section className="surface-card overflow-hidden">
          <div className="border-b border-subtle px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Session History</p>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              {selectedWorkspace?.name ?? 'No workspace'} / {selectedNode?.label ?? 'No node'}
            </p>
          </div>
          <div className="divide-y divide-subtle">
            {sessions.length === 0 && (
              <EmptyList
                icon={History}
                title="No previous sessions"
                body="Run the selected node to create a durable session log."
              />
            )}
            {sessions.slice(0, 12).map((session) => {
              const promptAvailable = !session.prompt.startsWith('Restored from ');
              return (
                <div key={session.id} className="interactive-row flex items-start gap-3 px-4 py-3">
                  <span
                    className={cn(
                      'mt-1 h-2 w-2 rounded-full',
                      sessionIsActive(session.status)
                        ? 'status-dot-running pulse-green'
                        : session.status === 'failed' || session.status === 'external_blocked'
                          ? 'status-dot-error'
                          : session.status === 'blocked_environment'
                            ? 'bg-coded'
                          : 'status-dot-idle'
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs font-medium text-foreground">
                        {agentLabels[session.agent]} in {basename(session.workspacePath)}
                      </p>
                      <span className="font-mono text-2xs text-muted-foreground">
                        {sessionTimestamp(session.startedAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-2xs text-muted-foreground">
                      {session.prompt}
                    </p>
                    <p className="mt-1 font-mono text-2xs text-muted-foreground">
                      {sessionStatusLabel(session)} / {basename(session.logPath)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => {
                        setActiveSessionId(session.id);
                        setActiveTab('logs');
                      }}
                      className="btn-ghost px-2 text-2xs"
                    >
                      <Terminal size={11} />
                      Log
                    </button>
                    <button
                      onClick={() => void rerunSession(session)}
                      disabled={!promptAvailable}
                      className="btn-ghost px-2 text-2xs disabled:cursor-not-allowed disabled:opacity-40"
                      title={
                        promptAvailable
                          ? 'Run this prompt again'
                          : 'Legacy logs do not contain the original prompt'
                      }
                    >
                      <RotateCcw size={11} />
                      Rerun
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="surface-card overflow-hidden">
          <div className="border-b border-subtle px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Run Queue</p>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              Staged runs start only when you click Run. Automatic sequencing is coming soon.
            </p>
          </div>
          <div className="divide-y divide-subtle">
            {queue.length === 0 && (
              <EmptyList
                icon={Layers3}
                title="Nothing staged"
                body="Generate a prompt, then use Queue to stage a reviewed run."
              />
            )}
            {queue.map((item, index) => (
              <div key={item.id} className="interactive-row flex items-start gap-3 px-4 py-3">
                <span className="font-mono text-2xs text-muted-foreground">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs font-medium text-foreground">{item.nodeLabel}</p>
                    <span
                      className={cn(
                        'rounded border px-1.5 py-0.5 font-mono text-2xs',
                        queueStatusTone(item.status)
                      )}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-2xs text-muted-foreground">
                    {agentLabels[item.agent]} / {item.skills.length} skills /{' '}
                    {sessionTimestamp(item.createdAt)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-2xs text-muted-foreground">{item.prompt}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {item.sessionId && (
                    <button
                      onClick={() => {
                        setActiveSessionId(item.sessionId!);
                        setActiveTab('logs');
                      }}
                      className="btn-ghost px-2 text-2xs"
                      title={item.logPath}
                    >
                      <Terminal size={11} />
                      Log
                    </button>
                  )}
                  {item.status === 'queued' && (
                    <button
                      onClick={() => void runQueueItem(item)}
                      className="btn-primary px-2 text-2xs"
                    >
                      <Play size={11} />
                      Run
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function LogsView({
  sessions,
  activeSessionId,
  setActiveSessionId,
  activeLogs,
  stopSession,
  clearSessionHistory,
  openLogsFolder,
  busyAction,
}: {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string) => void;
  activeLogs: string[];
  stopSession: (sessionId: string) => Promise<void>;
  clearSessionHistory: () => Promise<void>;
  openLogsFolder: () => Promise<void>;
  busyAction: string | null;
}) {
  const active = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
  const groupedSessions = useMemo(() => {
    const groups = new Map<AgentId, SessionInfo[]>();
    for (const session of sessions) {
      const current = groups.get(session.agent) ?? [];
      current.push(session);
      groups.set(session.agent, current);
    }
    return [...groups.entries()]
      .map(([agent, agentSessions]) => ({
        agent,
        sessions: agentSessions.sort(
          (left, right) => Number(right.startedAt || 0) - Number(left.startedAt || 0)
        ),
      }))
      .sort((left, right) => agentLabels[left.agent].localeCompare(agentLabels[right.agent]));
  }, [sessions]);

  return (
    <div className="grid h-full grid-cols-[280px_minmax(0,1fr)] overflow-hidden">
      <div className="flex min-h-0 flex-col border-r border-subtle bg-sidebar/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sessions
          </p>
          <span className="font-mono text-2xs text-muted-foreground">{sessions.length}</span>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-1">
          <button
            onClick={() => void openLogsFolder()}
            disabled={busyAction === 'open-logs-folder'}
            className="btn-ghost justify-center text-2xs disabled:opacity-40"
            title="Open .agentboard/logs"
          >
            <FolderOpen size={12} />
            Open folder
          </button>
          <button
            onClick={() => void clearSessionHistory()}
            disabled={busyAction === 'clear-session-history' || sessions.length === 0}
            className="btn-ghost justify-center text-2xs text-error disabled:opacity-40"
            title="Delete completed session logs"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-auto">
          {sessions.length === 0 && (
            <p className="rounded border border-subtle bg-card p-3 text-xs text-muted-foreground">
              No logs yet.
            </p>
          )}
          {groupedSessions.map((group) => (
            <section key={group.agent}>
              <div className="mb-1 flex items-center justify-between px-1">
                <span className="text-2xs font-medium text-foreground">
                  {agentLabels[group.agent]}
                </span>
                <span className="font-mono text-2xs text-muted-foreground">
                  {group.sessions.length}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {group.sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => setActiveSessionId(session.id)}
                    className={cn(
                      'rounded border px-2 py-2 text-left transition-colors',
                      active?.id === session.id
                        ? 'border-primary/40 bg-primary/10'
                        : 'border-transparent hover:border-subtle hover:bg-hover'
                    )}
                  >
                    <span className="block truncate font-mono text-2xs text-foreground">
                      {sessionTimestamp(session.startedAt)}
                    </span>
                    <span
                      className={cn(
                        'block truncate font-mono text-2xs',
                        session.status === 'failed' || session.status === 'external_blocked'
                          ? 'text-error'
                          : session.status === 'blocked_environment'
                            ? 'text-coded'
                          : 'text-muted-foreground'
                      )}
                    >
                      {sessionStatusLabel(session)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <div className="min-w-0 overflow-hidden p-3">
        <div className="mb-2 flex items-center justify-between rounded border border-subtle bg-card px-3 py-2">
          <div className="min-w-0">
            <span className="block truncate font-mono text-xs text-muted-foreground">
              {active?.logPath ?? 'No active session'}
            </span>
            {active && (
              <span
                className={cn(
                  'block font-mono text-2xs',
                  active.status === 'failed' || active.status === 'external_blocked'
                    ? 'text-error'
                    : active.status === 'blocked_environment'
                      ? 'text-coded'
                    : 'text-muted-foreground'
                )}
              >
                {sessionStatusLabel(active)} / {sessionTimestamp(active.startedAt)}
              </span>
            )}
          </div>
          <button
            disabled={!active || !sessionIsActive(active.status)}
            onClick={() => active && void stopSession(active.id)}
            className="btn-ghost text-xs disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Square size={12} />
            Stop
          </button>
        </div>
        <div className="h-[calc(100%-46px)] overflow-auto rounded border border-subtle bg-[#080808] p-3 font-mono text-xs leading-relaxed text-foreground/90">
          {activeLogs.length === 0 ? (
            <p className="text-muted-foreground">No output for this session yet.</p>
          ) : (
            activeLogs.map((line, index) => (
              <div
                key={`${active?.id}-${index}`}
                className={cn(
                  line.includes('[stderr]') && 'text-error/90',
                  line.includes('[system]') && 'text-accent'
                )}
              >
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function RealityView({
  results,
  scanRunning,
  runRealityScan,
}: {
  results: RealityIssue[];
  scanRunning: boolean;
  runRealityScan: () => Promise<void>;
}) {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Reality Check</p>
          <p className="text-2xs text-muted-foreground">
            Suspicious fake, placeholder, skipped-test, and not-implemented patterns.
          </p>
        </div>
        <button
          onClick={() => void runRealityScan()}
          className="btn-primary text-xs"
          disabled={scanRunning}
        >
          {scanRunning ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
          Run scan
        </button>
      </div>
      <div className="overflow-hidden rounded border border-subtle">
        <table className="w-full">
          <thead className="bg-sidebar">
            <tr className="border-b border-subtle">
              {['Severity', 'File', 'Line', 'Pattern', 'Snippet'].map((header) => (
                <th
                  key={header}
                  className="px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No scanner results yet.
                </td>
              </tr>
            )}
            {results.map((result, index) => (
              <tr
                key={`${result.file}-${result.line}-${index}`}
                className="border-b border-subtle hover:bg-hover"
              >
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      'rounded border px-2 py-0.5 font-mono text-2xs',
                      result.severity === 'high'
                        ? 'border-error/30 bg-error/10 text-error'
                        : result.severity === 'medium'
                          ? 'border-coded/30 bg-coded/10 text-coded'
                          : 'border-subtle text-muted-foreground'
                    )}
                  >
                    {result.severity}
                  </span>
                </td>
                <td className="max-w-[260px] truncate px-3 py-2 font-mono text-xs text-foreground">
                  {result.file}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{result.line}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {result.pattern}
                </td>
                <td className="max-w-[360px] truncate px-3 py-2 font-mono text-xs text-muted-foreground">
                  {result.snippet}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CommandDock({
  commandRef,
  command,
  setCommand,
  selectedAgent,
  selectedNode,
  unavailableAgent,
  generatePrompt,
  runSelectedNode,
  enqueueNode,
  busyAction,
}: {
  commandRef: React.RefObject<HTMLTextAreaElement | null>;
  command: string;
  setCommand: (value: string) => void;
  selectedAgent: AgentId;
  selectedNode: PipelineNode | null;
  unavailableAgent: boolean;
  generatePrompt: () => void;
  runSelectedNode: () => Promise<void>;
  enqueueNode: () => void;
  busyAction: string | null;
}) {
  return (
    <div className="shrink-0 border-t border-subtle bg-sidebar/85 p-3">
      <div className="command-input overflow-hidden rounded-lg border border-subtle bg-input">
        <div className="flex items-center gap-2 border-b border-subtle px-3 py-2">
          <span className="tag-chip">{agentLabels[selectedAgent]}</span>
          <span className="truncate text-xs text-muted-foreground">
            {selectedNode
              ? `Task target: ${selectedNode.label}`
              : 'Select a node before running an agent'}
          </span>
          {unavailableAgent && (
            <span className="ml-auto text-2xs text-error">agent unavailable</span>
          )}
        </div>
        <textarea
          ref={commandRef}
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder="Describe the task, or press Ctrl+G to generate a node-aware prompt..."
          className="h-24 w-full resize-none bg-transparent px-3 py-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between gap-3 border-t border-subtle px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
            <Keyboard size={12} className="text-muted-foreground/70" />
            <span>
              <kbd>Ctrl+K</kbd> input
            </span>
            <span>
              <kbd>Ctrl+G</kbd> generate
            </span>
            <span>
              <kbd>Ctrl+R</kbd> run
            </span>
            <span>
              <kbd>Ctrl+Shift+S</kbd> scan
            </span>
            <span>
              <kbd>Ctrl+O</kbd> open
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={enqueueNode} className="btn-ghost text-xs">
              <Plus size={12} />
              Queue
            </button>
            <button onClick={generatePrompt} className="btn-ghost text-xs">
              <Sparkles size={12} />
              Generate
            </button>
            <button
              onClick={() => void runSelectedNode()}
              className="btn-primary text-xs"
              disabled={busyAction === 'run-agent' || unavailableAgent}
            >
              {busyAction === 'run-agent' ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Play size={12} />
              )}
              Run
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RightPanel({
  bundle,
  selectedPipeline,
  selectedNode,
  selectedAgent,
  enabledSkills,
  toggleSkill,
  generatePrompt,
  runSelectedNode,
  enqueueNode,
  createWorktree,
  generatePrDraft,
  openChangedFile,
  includeScanInPrompt,
  setIncludeScanInPrompt,
  scanResults,
  prDraft,
  busyAction,
}: {
  bundle: WorkspaceBundle | null;
  selectedPipeline: Pipeline | null;
  selectedNode: PipelineNode | null;
  selectedAgent: AgentId;
  enabledSkills: SkillInfo[];
  toggleSkill: (skillName: string) => void;
  generatePrompt: () => void;
  runSelectedNode: () => Promise<void>;
  enqueueNode: () => void;
  createWorktree: () => Promise<void>;
  generatePrDraft: () => void;
  openChangedFile: (path: string) => void;
  includeScanInPrompt: boolean;
  setIncludeScanInPrompt: (value: boolean) => void;
  scanResults: RealityIssue[];
  prDraft: string;
  busyAction: string | null;
}) {
  const meta = selectedNode ? statusMeta[selectedNode.status] : null;
  const nodeScanResults = useMemo(() => {
    if (!selectedNode) return [];
    const paths = new Set(selectedNode.files.map((file) => normalizedPath(file.path)));
    return scanResults.filter((finding) => paths.has(normalizedPath(finding.file)));
  }, [scanResults, selectedNode]);
  const diffEntries = useMemo(
    () => parseDiffStat(bundle?.git.diffStat ?? ''),
    [bundle?.git.diffStat]
  );
  const changedFiles = useMemo(() => {
    if (!bundle) return [];
    return [
      ...bundle.git.changedFiles.map((change) => ({
        path: change.path,
        status: change.status.trim() || 'M',
      })),
      ...bundle.git.untrackedFiles.map((path) => ({ path, status: '??' })),
    ];
  }, [bundle]);
  const [prTitle = '', ...prBodyParts] = prDraft.split('\n');
  const prBody = prBodyParts.join('\n').trim();

  return (
    <aside className="flex min-w-0 flex-col overflow-hidden border-l border-subtle bg-sidebar">
      <div className="shrink-0 border-b border-subtle px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">Review Panel</p>
            <p className="truncate font-mono text-2xs text-muted-foreground">
              {selectedPipeline?.name ?? 'No pipeline'}
            </p>
          </div>
          {meta && (
            <span
              className={cn('rounded border px-2 py-0.5 font-mono text-2xs', meta.color)}
              style={{ borderColor: meta.border }}
            >
              {meta.label}
            </span>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!bundle || !selectedNode ? (
          <EmptyState
            icon={Clipboard}
            title="Nothing selected"
            body="Open a workspace and select a pipeline node."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <PanelCard title="Selected Node">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedNode.label}</p>
                  <p className="mt-1 font-mono text-2xs text-muted-foreground">{selectedNode.id}</p>
                </div>
                <span
                  className={cn('rounded border px-2 py-1 font-mono text-2xs', meta?.color)}
                  style={{ borderColor: meta?.border, background: meta?.bg }}
                >
                  {meta?.label}
                </span>
              </div>
              {selectedNode.issues.length > 0 && (
                <div className="mt-2 rounded border border-error/20 bg-error/5 p-2">
                  {selectedNode.issues.map((issue) => (
                    <p key={issue} className="mb-1 text-xs text-error/90 last:mb-0">
                      {issue}
                    </p>
                  ))}
                </div>
              )}
            </PanelCard>

            <PanelCard title="Concerned Files">
              <div className="flex flex-col gap-1">
                {selectedNode.files.length === 0 && (
                  <p className="text-xs text-muted-foreground">No files declared.</p>
                )}
                {selectedNode.files.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => openChangedFile(file.path)}
                    className="interactive-row w-full rounded border border-subtle bg-card/50 p-2 text-left"
                  >
                    <p className="truncate font-mono text-xs text-foreground">{file.path}</p>
                    <p className="mt-1 line-clamp-2 text-2xs text-muted-foreground">
                      {file.reason}
                    </p>
                  </button>
                ))}
              </div>
            </PanelCard>

            <PanelCard title={`Node Scanner Findings · ${nodeScanResults.length}`}>
              {scanResults.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Run Reality Check to attach verified findings to this review.
                </p>
              ) : nodeScanResults.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No scanner findings match this node's concerned files.
                </p>
              ) : (
                <div className="flex max-h-40 flex-col gap-1 overflow-auto">
                  {nodeScanResults.map((finding, index) => (
                    <button
                      key={`${finding.file}-${finding.line}-${index}`}
                      onClick={() => openChangedFile(finding.file)}
                      className="interactive-row rounded border border-subtle bg-card/50 p-2 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'rounded border px-1.5 py-0.5 font-mono text-2xs',
                            finding.severity === 'high'
                              ? 'border-error/30 text-error'
                              : finding.severity === 'medium'
                                ? 'border-coded/30 text-coded'
                                : 'border-subtle text-muted-foreground'
                          )}
                        >
                          {finding.severity}
                        </span>
                        <span className="truncate font-mono text-2xs text-foreground">
                          {finding.file}:{finding.line}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-2xs text-muted-foreground">
                        {finding.pattern}: {finding.snippet}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </PanelCard>

            <PanelCard title="Checks">
              <div className="flex flex-col gap-1">
                {selectedNode.checks.length === 0 && (
                  <p className="text-xs text-muted-foreground">No checks declared.</p>
                )}
                {selectedNode.checks.map((check) => (
                  <div
                    key={`${check.name}-${check.status}`}
                    className="flex gap-2 rounded border border-subtle bg-card/50 p-2"
                  >
                    <span
                      className={cn(
                        'mt-0.5 h-1.5 w-1.5 rounded-full',
                        check.status === 'pass'
                          ? 'status-dot-running'
                          : check.status === 'fail'
                            ? 'status-dot-error'
                            : check.status === 'warn'
                              ? 'status-dot-coded'
                              : 'status-dot-idle'
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs text-foreground">{check.name}</p>
                      <p className="text-2xs text-muted-foreground">{check.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </PanelCard>

            <PanelCard title="Skills Selected">
              <div className="flex flex-col gap-1">
                {bundle.skills.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No local skills in this workspace.
                  </p>
                )}
                {bundle.skills.map((skill) => {
                  const compatible =
                    !skill.manifest.compatible_agents?.length ||
                    skill.manifest.compatible_agents.includes(selectedAgent);
                  return (
                    <button
                      key={skill.name}
                      onClick={() => compatible && toggleSkill(skill.name)}
                      disabled={!compatible}
                      className={cn(
                        'flex items-center gap-2 rounded border px-2 py-2 text-left transition-colors',
                        skill.enabled && compatible
                          ? 'border-primary/30 bg-primary/10'
                          : 'border-subtle bg-card/50 hover:bg-hover',
                        !compatible && 'cursor-not-allowed opacity-45'
                      )}
                      title={
                        compatible
                          ? 'Toggle this skill for the next run'
                          : `Not compatible with ${agentLabels[selectedAgent]}`
                      }
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          skill.enabled && compatible ? 'bg-primary' : 'bg-muted-foreground'
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                        {skill.manifest.title}
                      </span>
                      <span className="font-mono text-2xs text-muted-foreground">
                        {compatible ? (skill.enabled ? 'on' : 'off') : 'incompatible'}
                      </span>
                    </button>
                  );
                })}
                <p className="mt-1 font-mono text-2xs text-muted-foreground">
                  {enabledSkills.length} enabled for {agentLabels[selectedAgent]}
                </p>
              </div>
            </PanelCard>

            <PanelCard title="Git Review">
              {bundle.git.isRepo ? (
                <div className="flex flex-col gap-2">
                  {bundle.git.error && (
                    <p className="rounded border border-error/20 bg-error/5 p-2 text-xs text-error">
                      {bundle.git.error}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs text-muted-foreground">
                      branch: {bundle.git.branch ?? 'unknown'}
                    </p>
                    <span className="font-mono text-2xs text-muted-foreground">
                      {changedFiles.length} changed
                    </span>
                  </div>
                  <div className="max-h-44 space-y-1 overflow-auto">
                    {changedFiles.length === 0 && (
                      <p className="rounded border border-subtle bg-card/50 p-3 text-xs text-muted-foreground">
                        Working tree is clean.
                      </p>
                    )}
                    {changedFiles.map((file) => {
                      const stat = diffEntries.find(
                        (entry) =>
                          normalizedPath(entry.path) === normalizedPath(file.path) ||
                          normalizedPath(entry.path).endsWith(normalizedPath(file.path))
                      );
                      return (
                        <button
                          key={`${file.status}-${file.path}`}
                          onClick={() => openChangedFile(file.path)}
                          className="interactive-row flex w-full items-center gap-2 rounded border border-subtle bg-card/50 px-2 py-2 text-left"
                        >
                          <span className="w-6 shrink-0 font-mono text-2xs text-coded">
                            {file.status}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                            {file.path}
                          </span>
                          {stat && (
                            <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                              {stat.changed} lines
                              {stat.insertions ? ` +${stat.insertions}` : ''}
                              {stat.deletions ? ` -${stat.deletions}` : ''}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="max-h-28 overflow-auto rounded border border-subtle bg-[#0d0d0d] p-2 font-mono text-2xs text-muted-foreground">
                    {bundle.git.diffStat || 'No diff stat.'}
                  </div>
                  <p className="text-2xs leading-relaxed text-muted-foreground">
                    Side-by-side patch preview is unavailable because the current backend contract
                    exposes file status and diff stat, not patch hunks.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={generatePrDraft} className="btn-ghost justify-center text-xs">
                      <GitPullRequest size={12} />
                      Generate PR draft
                    </button>
                    <button
                      disabled
                      className="btn-ghost justify-center text-xs opacity-45"
                      title="GitHub integration is required before AgentBoard can create a PR"
                    >
                      <ArrowRight size={12} />
                      Create PR · coming soon
                    </button>
                  </div>
                  <button
                    onClick={() => void createWorktree()}
                    className="btn-ghost w-full justify-center text-xs"
                    disabled={busyAction === 'worktree'}
                  >
                    {busyAction === 'worktree' ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <GitBranch size={12} />
                    )}
                    Create worktree
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {bundle.git.error ?? 'This workspace is not a Git repository.'}
                  </p>
                  <button
                    onClick={generatePrDraft}
                    className="btn-ghost w-full justify-center text-xs"
                  >
                    <GitPullRequest size={12} />
                    Generate draft without Git changes
                  </button>
                  <button
                    disabled
                    className="btn-ghost w-full justify-center text-xs opacity-45"
                    title="A Git repository and GitHub integration are required"
                  >
                    <ArrowRight size={12} />
                    Create PR · unavailable
                  </button>
                </div>
              )}
            </PanelCard>

            <PanelCard title="Reality Scan Attachments">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={includeScanInPrompt}
                  onChange={(event) => setIncludeScanInPrompt(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-subtle bg-input"
                />
                Attach scanner results to generated prompt
              </label>
              <p className="mt-2 font-mono text-2xs text-muted-foreground">
                {nodeScanResults.length} node findings / {scanResults.length} workspace findings
              </p>
            </PanelCard>

            <PanelCard title="Actions">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={generatePrompt} className="btn-ghost justify-center text-xs">
                  <Sparkles size={12} />
                  Prompt
                </button>
                <button
                  onClick={() => void runSelectedNode()}
                  className="btn-primary justify-center text-xs"
                >
                  <Play size={12} />
                  Run
                </button>
                <button onClick={enqueueNode} className="btn-ghost justify-center text-xs">
                  <Plus size={12} />
                  Queue
                </button>
                <button
                  disabled
                  className="btn-ghost justify-center text-xs opacity-45"
                  title="Interactive ConPTY terminal coming soon"
                >
                  <Terminal size={12} />
                  PTY soon
                </button>
              </div>
            </PanelCard>

            {prDraft && (
              <PanelCard title="Generated PR Preview">
                <label className="section-label">Title</label>
                <div className="mt-1 rounded border border-subtle bg-input px-3 py-2 text-xs text-foreground">
                  {prTitle}
                </div>
                <label className="section-label mt-3 block">Body</label>
                <textarea
                  readOnly
                  value={prBody}
                  className="mt-1 h-48 w-full resize-none rounded border border-subtle bg-input p-3 font-mono text-xs leading-relaxed text-foreground outline-none"
                />
                <button
                  disabled
                  className="mt-2 w-full btn-ghost justify-center text-xs opacity-45"
                  title="GitHub integration is not configured"
                >
                  <GitPullRequest size={12} />
                  Publish PR · GitHub integration required
                </button>
              </PanelCard>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function PanelCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-subtle px-3 py-2">
        <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function WorkspaceOnboarding({
  openFolder,
  openSampleWorkspace,
  busyAction,
}: {
  openFolder: () => void;
  openSampleWorkspace: () => Promise<void>;
  busyAction: string | null;
}) {
  return (
    <div className="flex h-full items-center justify-center overflow-auto p-8">
      <div className="w-full max-w-3xl fade-in">
        <div className="surface-card overflow-hidden">
          <div className="border-b border-subtle bg-gradient-to-br from-primary/[0.08] via-transparent to-accent/[0.04] px-8 py-8">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 shadow-green">
              <FolderOpen size={20} className="text-primary" />
            </div>
            <p className="text-lg font-semibold tracking-tight text-foreground">
              Plan, run, and review local coding agents
            </p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Open an existing project folder. AgentBoard reads its pipeline plan, concerned files,
              Git state, scanner findings, and durable agent logs so you can send reviewed work to
              local agents without losing context.
            </p>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
              Your source files are not changed when a workspace is opened. If AgentBoard metadata
              is missing, you will be asked before starter files are created.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={openFolder} className="btn-primary">
                <FolderOpen size={13} />
                Open existing folder
                <kbd>Ctrl+O</kbd>
              </button>
              <button
                onClick={() => void openSampleWorkspace()}
                className="btn-ghost"
                disabled={busyAction === 'sample-workspace'}
              >
                {busyAction === 'sample-workspace' ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Layers3 size={13} />
                )}
                Open sample workspace
              </button>
            </div>
          </div>
          <div className="grid gap-px bg-border md:grid-cols-3">
            {[
              ['1', 'Choose an existing project', 'Paste the full Windows folder path.'],
              [
                '2',
                'Validate pipeline metadata',
                'AgentBoard checks for .agentboard/pipelines.json.',
              ],
              ['3', 'Initialize if needed', 'Starter .agentboard files require your confirmation.'],
            ].map(([number, title, body]) => (
              <div key={number} className="bg-card px-5 py-4">
                <span className="font-mono text-2xs text-primary">0{number}</span>
                <p className="mt-2 text-xs font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddWorkspaceModal({
  value,
  setValue,
  onClose,
  onSubmit,
  openSampleWorkspace,
  busyAction,
}: {
  value: string;
  setValue: (value: string) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  openSampleWorkspace: () => Promise<void>;
  busyAction: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="surface-card w-full max-w-xl overflow-hidden shadow-card">
        <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Open a workspace folder</p>
            <p className="text-2xs text-muted-foreground">
              Choose an existing folder. AgentBoard does not create a new project directory.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-hover hover:text-foreground"
            title="Close workspace dialog"
            aria-label="Close workspace dialog"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-4">
          <label className="section-label">Local folder path</label>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && value.trim() && busyAction !== 'add-workspace') {
                void onSubmit();
              }
            }}
            placeholder="C:\\Users\\you\\Projects\\my-app"
            className="mt-1 w-full rounded border border-subtle bg-input px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors focus:border-ring"
          />
          <p className="mt-2 text-2xs leading-relaxed text-muted-foreground">
            The folder must already exist. If `.agentboard/pipelines.json` is missing, AgentBoard
            will offer to create an empty starter structure after you confirm.
          </p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              onClick={() => void openSampleWorkspace()}
              className="btn-ghost text-xs"
              disabled={busyAction === 'sample-workspace'}
            >
              {busyAction === 'sample-workspace' ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <FolderOpen size={12} />
              )}
              Open sample workspace
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-ghost text-xs">
                Cancel
              </button>
              <button
                onClick={() => void onSubmit()}
                className="btn-primary text-xs"
                disabled={busyAction === 'add-workspace' || !value.trim()}
                title={
                  !value.trim()
                    ? 'Enter the full path to an existing folder'
                    : 'Open this workspace'
                }
              >
                {busyAction === 'add-workspace' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Plus size={12} />
                )}
                Open workspace
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReleaseSupportModal({
  issueNotes,
  setIssueNotes,
  diagnosticsPath,
  busy,
  onClose,
  onExportDiagnostics,
  onExportIssue,
}: {
  issueNotes: string;
  setIssueNotes: (value: string) => void;
  diagnosticsPath: string | null;
  busy: boolean;
  onClose: () => void;
  onExportDiagnostics: () => Promise<void>;
  onExportIssue: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="surface-card w-full max-w-2xl overflow-hidden shadow-card">
        <div className="flex items-start justify-between border-b border-subtle px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">AgentBoard v{APP_VERSION}</p>
              <span className="rounded border border-coded/30 bg-coded/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-coded">
                Alpha build
              </span>
            </div>
            <p className="mt-1 text-2xs text-muted-foreground">
              Trusted tester build. Reports are exported locally and are never uploaded.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-hover hover:text-foreground"
            title="Close"
            aria-label="Close release support"
          >
            <X size={14} />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <div className="rounded-md border border-coded/20 bg-coded/[0.06] p-3">
            <p className="text-xs font-medium text-foreground">Before sharing a report</p>
            <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
              The export includes app and OS versions, agent availability, workspace registry
              summaries, recent UI errors, and the active log folder path. It excludes source
              contents, prompts, and log contents.
            </p>
          </div>
          <div>
            <label className="section-label">Issue notes</label>
            <textarea
              value={issueNotes}
              onChange={(event) => setIssueNotes(event.target.value)}
              placeholder="What happened, what you expected, and the steps to reproduce it."
              className="mt-1 h-28 w-full resize-none rounded border border-subtle bg-input p-3 text-xs leading-relaxed text-foreground outline-none focus:border-ring"
              maxLength={4000}
            />
            <p className="mt-1 text-right font-mono text-[9px] text-muted-foreground">
              {issueNotes.length}/4000
            </p>
          </div>
          {diagnosticsPath && (
            <div className="rounded border border-primary/20 bg-primary/[0.05] p-3">
              <p className="text-2xs font-medium text-primary">Latest local export</p>
              <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                {diagnosticsPath}
              </p>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={onClose} className="btn-ghost text-xs">
              Close
            </button>
            <button
              onClick={() => void onExportDiagnostics()}
              disabled={busy}
              className="btn-ghost text-xs"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Export diagnostics
            </button>
            <button
              onClick={() => void onExportIssue()}
              disabled={busy}
              className="btn-primary text-xs"
              title="Create a local JSON issue report for manual sharing"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Bug size={12} />}
              Report issue locally
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: React.FC<{ size?: number; className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-sm rounded-lg border border-dashed border-subtle bg-card/40 px-8 py-10 text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-subtle bg-sidebar">
          <Icon size={18} className="text-muted-foreground/70" />
        </div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function EmptyList({
  icon: Icon,
  title,
  body,
}: {
  icon: React.FC<{ size?: number; className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="px-5 py-8 text-center">
      <Icon size={17} className="mx-auto text-muted-foreground/50" />
      <p className="mt-2 text-xs font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-2xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
