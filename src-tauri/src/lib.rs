use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    env,
    fs::{self, File, OpenOptions},
    io::{BufRead, BufReader, Write},
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{Emitter, State};

struct AppState {
    sessions: Arc<Mutex<HashMap<String, SessionControl>>>,
    github_token: Arc<Mutex<Option<String>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            github_token: Arc::new(Mutex::new(None)),
        }
    }
}

struct SessionControl {
    info: SessionInfo,
    pid: Option<u32>,
    stop_requested: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WorkspaceSummary {
    id: String,
    name: String,
    path: String,
    exists: bool,
    has_agentboard: bool,
    pipeline_count: usize,
    node_count: usize,
    last_opened: Option<String>,
    error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WorkspaceConfig {
    id: String,
    name: String,
    path: String,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize, Deserialize, Default)]
struct WorkspacesFile {
    workspaces: Vec<WorkspaceConfig>,
}

#[derive(Serialize, Deserialize, Clone)]
struct PipelinesDocument {
    pipelines: Vec<Pipeline>,
}

#[derive(Serialize, Deserialize, Clone)]
struct Pipeline {
    id: String,
    name: String,
    nodes: Vec<PipelineNode>,
    edges: Vec<[String; 2]>,
}

#[derive(Serialize, Deserialize, Clone)]
struct PipelineNode {
    id: String,
    label: String,
    status: String,
    files: Vec<PipelineFile>,
    issues: Vec<String>,
    checks: Vec<PipelineCheck>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PipelineFile {
    path: String,
    reason: String,
    start_line: Option<u32>,
    end_line: Option<u32>,
}

#[derive(Serialize, Deserialize, Clone)]
struct PipelineCheck {
    name: String,
    status: String,
    message: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SkillManifest {
    name: String,
    title: String,
    description: String,
    categories: Vec<String>,
    #[serde(rename = "compatible_agents", alias = "compatibleAgents")]
    compatible_agents: Vec<String>,
    version: String,
    source: String,
    #[serde(default)]
    trusted: bool,
    permissions: SkillPermissions,
}

#[derive(Serialize, Deserialize, Clone)]
struct SkillPermissions {
    filesystem: String,
    shell: bool,
    network: bool,
}

#[derive(Serialize, Deserialize, Clone)]
struct SkillInfo {
    name: String,
    title: String,
    description: String,
    path: String,
    manifest: SkillManifest,
    markdown: String,
    enabled: bool,
    error: Option<String>,
    #[serde(rename = "trustState")]
    trust_state: String,
    #[serde(rename = "repoFullName")]
    repo_full_name: Option<String>,
    #[serde(rename = "sourceUrl")]
    source_url: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GithubRateLimit {
    limit: u64,
    remaining: u64,
    reset_at: Option<String>,
    resource: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GithubRateLimits {
    core: GithubRateLimit,
    search: GithubRateLimit,
}

impl Default for GithubRateLimit {
    fn default() -> Self {
        Self {
            limit: 0,
            remaining: 0,
            reset_at: None,
            resource: "unknown".to_string(),
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GithubMarketplaceSearchRequest {
    workspace_path: String,
    query: String,
    sort: String,
    language: Option<String>,
    minimum_stars: Option<u64>,
    only_detected_skill_files: bool,
    #[serde(default)]
    force_refresh: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GithubMarketplaceRepo {
    id: u64,
    full_name: String,
    name: String,
    owner: String,
    description: String,
    html_url: String,
    default_branch: String,
    stars: u64,
    forks: u64,
    language: Option<String>,
    license: Option<String>,
    updated_at: String,
    topics: Vec<String>,
    detected_skill_status: String,
    detected_files: Vec<String>,
    quality_score: u8,
    quality_label: String,
    installed_skill_name: Option<String>,
    install_status: String,
    latest_commit_sha: Option<String>,
    #[serde(default)]
    preview_cached: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GithubMarketplaceSearchResult {
    query: String,
    api_query: String,
    items: Vec<GithubMarketplaceRepo>,
    cached: bool,
    fetched_at: String,
    rate_limit: GithubRateLimit,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GithubMarketplaceFile {
    path: String,
    kind: String,
    content: String,
    size: u64,
    sha: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GithubMarketplacePreviewRequest {
    workspace_path: String,
    repo_full_name: String,
    #[serde(default)]
    force_refresh: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GithubMarketplacePreview {
    repo: GithubMarketplaceRepo,
    files: Vec<GithubMarketplaceFile>,
    formal_skill: bool,
    readme_only: bool,
    installable: bool,
    recommended_name: String,
    warning: Option<String>,
    cached: bool,
    rate_limit: GithubRateLimit,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GithubMarketplaceInstallRequest {
    workspace_path: String,
    repo_full_name: String,
    install_name: Option<String>,
    allow_readme_draft: bool,
    duplicate_action: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GithubMarketplaceInstallResult {
    status: String,
    skill: Option<SkillInfo>,
    path: Option<String>,
    suggested_name: Option<String>,
    backup_path: Option<String>,
    message: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GithubMarketplaceSkillRequest {
    workspace_path: String,
    skill_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GithubMarketplaceUpdateRequest {
    workspace_path: String,
    skill_name: String,
    confirm: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GithubMarketplaceUpdateResult {
    status: String,
    changed_files: Vec<String>,
    previous_commit_sha: String,
    latest_commit_sha: String,
    backup_path: Option<String>,
    skill: Option<SkillInfo>,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GithubMarketplaceUninstallResult {
    skill_name: String,
    trash_path: String,
    message: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GithubMarketplaceTrustRequest {
    workspace_path: String,
    skill_name: String,
    trust_state: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GithubTokenRequest {
    token: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GithubTokenStatus {
    stored: bool,
    persistence: String,
    message: String,
    rate_limits: Option<GithubRateLimits>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct GithubMarketplaceCache {
    searches: HashMap<String, GithubMarketplaceSearchResult>,
    previews: HashMap<String, GithubMarketplacePreview>,
    updated_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GithubSkillSource {
    source: String,
    repo_full_name: String,
    repo_url: String,
    default_branch: String,
    commit_sha: String,
    installed_at: String,
    updated_at: String,
    stars_at_install: u64,
    forks_at_install: u64,
    license: Option<String>,
    fetched_files: Vec<String>,
    trusted: bool,
    trust_state: String,
    warning: String,
    original_skill_json: Option<Value>,
}

#[derive(Deserialize)]
struct GithubSearchApiResponse {
    items: Vec<GithubRepoApi>,
}

#[derive(Deserialize)]
struct GithubRepoApi {
    id: u64,
    name: String,
    full_name: String,
    owner: GithubOwnerApi,
    description: Option<String>,
    html_url: String,
    default_branch: String,
    stargazers_count: u64,
    forks_count: u64,
    language: Option<String>,
    license: Option<GithubLicenseApi>,
    updated_at: String,
    #[serde(default)]
    topics: Vec<String>,
}

#[derive(Deserialize)]
struct GithubOwnerApi {
    login: String,
}

#[derive(Deserialize)]
struct GithubLicenseApi {
    spdx_id: Option<String>,
    name: Option<String>,
}

#[derive(Deserialize)]
struct GithubTreeApi {
    sha: String,
    #[serde(default)]
    tree: Vec<GithubTreeItemApi>,
}

#[derive(Deserialize)]
struct GithubTreeItemApi {
    path: String,
    #[serde(rename = "type")]
    item_type: String,
    sha: String,
    size: Option<u64>,
}

#[derive(Deserialize)]
struct GithubCommitApi {
    sha: String,
}

#[derive(Deserialize)]
struct GithubRateApiResponse {
    resources: GithubRateResourcesApi,
}

#[derive(Deserialize)]
struct GithubRateResourcesApi {
    core: GithubRateResourceApi,
    search: GithubRateResourceApi,
}

#[derive(Deserialize)]
struct GithubRateResourceApi {
    limit: u64,
    remaining: u64,
    reset: u64,
}

#[derive(Serialize, Deserialize, Clone)]
struct AgentAvailability {
    id: String,
    label: String,
    command: String,
    status: String,
    detail: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GitFileChange {
    path: String,
    status: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GitStatus {
    is_repo: bool,
    branch: Option<String>,
    changed_files: Vec<GitFileChange>,
    untracked_files: Vec<String>,
    diff_stat: String,
    error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct RealityIssue {
    file: String,
    line: usize,
    pattern: String,
    severity: String,
    snippet: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct FileReadResult {
    path: String,
    exists: bool,
    content: String,
    error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SessionInfo {
    id: String,
    workspace_path: String,
    workspace_name: String,
    agent: String,
    #[serde(default)]
    node_id: Option<String>,
    #[serde(default)]
    node_name: Option<String>,
    #[serde(default)]
    selected_skills: Vec<String>,
    prompt: String,
    #[serde(default = "default_edit_run_mode")]
    run_mode: String,
    status: String,
    started_at: String,
    finished_at: Option<String>,
    log_path: String,
    exit_code: Option<i32>,
    #[serde(default)]
    execution_path: String,
    #[serde(default)]
    worktree_path: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AgentOutputEvent {
    session_id: String,
    stream: String,
    line: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AgentStatusEvent {
    session_id: String,
    status: String,
    exit_code: Option<i32>,
    message: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceBundle {
    workspace: WorkspaceSummary,
    pipelines: PipelinesDocument,
    skills: Vec<SkillInfo>,
    git: GitStatus,
    sessions: Vec<SessionInfo>,
    session_logs: HashMap<String, Vec<String>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ClearSessionHistoryResult {
    removed: usize,
    retained_running: usize,
}

struct SessionHistory {
    sessions: Vec<SessionInfo>,
    logs: HashMap<String, Vec<String>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppBootstrap {
    app_data_dir: String,
    workspaces: Vec<WorkspaceSummary>,
    agents: Vec<AgentAvailability>,
    sessions: Vec<SessionInfo>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticsExportRequest {
    recent_errors: Vec<String>,
    workspace_path: Option<String>,
    issue_notes: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticsExportResult {
    path: String,
    generated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticsReport {
    app_name: String,
    app_version: String,
    generated_at: String,
    os: DiagnosticsOsInfo,
    app_data_dir: String,
    log_folder_path: Option<String>,
    agents: Vec<AgentAvailability>,
    workspace_registry: Vec<WorkspaceSummary>,
    recent_errors: Vec<String>,
    issue_notes: Option<String>,
    privacy_note: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticsOsInfo {
    family: String,
    architecture: String,
    version: String,
    computer_name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AgentProfilePermissions {
    read_files: bool,
    write_files: bool,
    run_shell: bool,
    network: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AgentProfile {
    id: String,
    name: String,
    provider: String,
    model: String,
    effort: String,
    default_skills: Vec<String>,
    permissions: AgentProfilePermissions,
    isolation_mode: String,
    description: String,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AgentProfilesFile {
    profiles: Vec<AgentProfile>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AgentDeployment {
    id: String,
    agent_profile_id: String,
    agent_name: String,
    target_type: String,
    workspace_path: String,
    target_path: String,
    target_label: String,
    pipeline_id: Option<String>,
    pipeline_name: Option<String>,
    node_id: Option<String>,
    node_name: Option<String>,
    selected_skills: Vec<String>,
    prompt: String,
    #[serde(default = "default_edit_run_mode")]
    run_mode: String,
    isolation_mode: String,
    status: String,
    session_id: Option<String>,
    log_path: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AgentDeploymentsFile {
    deployments: Vec<AgentDeployment>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunAgentRequest {
    workspace_path: String,
    workspace_name: String,
    agent: String,
    prompt: String,
    #[serde(default = "default_edit_run_mode")]
    run_mode: String,
    #[serde(default)]
    node_id: Option<String>,
    #[serde(default)]
    node_name: Option<String>,
    #[serde(default)]
    skills: Vec<String>,
    #[serde(default)]
    use_worktree: bool,
    #[serde(default)]
    allow_shared_workspace: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeploymentPreflightRequest {
    target_type: String,
    workspace_path: String,
    target_path: String,
    provider: String,
    selected_skills: Vec<String>,
    task: String,
    run_mode: String,
    write_files_permission: bool,
    #[serde(default)]
    concerned_files: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DeploymentPreflightMessage {
    code: String,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeploymentPreflightResult {
    target_exists: bool,
    source_file_count: usize,
    has_source_files: bool,
    only_agentboard: bool,
    provider_available: bool,
    missing_skills: Vec<String>,
    log_writable: bool,
    git_status: String,
    git_message: String,
    pipeline_concerned_file_count: usize,
    run_mode_supported: bool,
    effective_sandbox: String,
    blockers: Vec<DeploymentPreflightMessage>,
    warnings: Vec<DeploymentPreflightMessage>,
}

type OutputSink = Arc<dyn Fn(&str, &str, &str) + Send + Sync>;
type StatusSink = Arc<dyn Fn(AgentStatusEvent) + Send + Sync>;

static SESSION_SEQUENCE: AtomicU64 = AtomicU64::new(0);

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            add_workspace,
            open_sample_workspace,
            load_workspace,
            detect_agents,
            read_file,
            scan_workspace,
            git_status,
            create_worktree,
            run_agent,
            run_multi_agent_smoke_test,
            stop_session,
            list_sessions,
            list_agent_profiles,
            save_agent_profile,
            delete_agent_profile,
            list_deployments,
            save_deployment,
            update_deployment,
            delete_deployment,
            deployment_preflight,
            github_marketplace_search,
            github_marketplace_preview,
            github_marketplace_install,
            github_marketplace_update,
            github_marketplace_uninstall,
            github_marketplace_set_trust,
            github_marketplace_rate_limit,
            save_github_token,
            clear_github_token,
            clear_session_history,
            open_logs_folder,
            export_diagnostics
        ])
        .run(tauri::generate_context!())
        .expect("error while running AgentBoard");
}

#[tauri::command]
fn bootstrap(state: State<AppState>) -> Result<AppBootstrap, String> {
    let app_data = app_data_dir()?;
    fs::create_dir_all(&app_data).map_err(to_error)?;
    ensure_global_files(&app_data)?;
    let workspaces = load_workspace_summaries(&app_data)?;
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| "session state lock poisoned".to_string())?
        .values()
        .map(|session| session.info.clone())
        .collect();
    Ok(AppBootstrap {
        app_data_dir: app_data.to_string_lossy().to_string(),
        workspaces,
        agents: detect_agents()?,
        sessions,
    })
}

#[tauri::command]
fn detect_agents() -> Result<Vec<AgentAvailability>, String> {
    let agents = [
        ("claude", "Claude Code", "claude"),
        ("codex", "Codex", "codex"),
        ("gemini", "Gemini CLI", "gemini"),
        ("aider", "Aider", "aider"),
        ("git", "Git", "git"),
        ("powershell", "PowerShell", "powershell"),
        ("cmd", "CMD", "cmd"),
    ];
    Ok(agents
        .iter()
        .map(|(id, label, command)| {
            let found = command_exists(command);
            AgentAvailability {
                id: id.to_string(),
                label: label.to_string(),
                command: command.to_string(),
                status: if found { "available" } else { "missing" }.to_string(),
                detail: if found {
                    format!("`{command}` was found on PATH.")
                } else if *id == "gemini" || *id == "aider" {
                    format!("Install needed: `{command}` was not found on PATH.")
                } else {
                    format!("`{command}` was not found on PATH.")
                },
            }
        })
        .collect())
}

#[tauri::command]
fn add_workspace(path: String, create_starter: Option<bool>) -> Result<WorkspaceSummary, String> {
    let workspace_path = PathBuf::from(path.trim());
    if !workspace_path.exists() {
        return Err(format!(
            "Workspace path does not exist: {}",
            workspace_path.display()
        ));
    }
    if !workspace_path.is_dir() {
        return Err(format!(
            "Workspace path is not a directory: {}",
            workspace_path.display()
        ));
    }
    prepare_workspace(&workspace_path, create_starter.unwrap_or(false))?;
    let app_data = app_data_dir()?;
    let mut file = read_workspaces_file(&app_data)?;
    let canonical = canonical_string(&workspace_path)?;
    let now = now_iso();
    let name = workspace_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("workspace")
        .to_string();
    let id = stable_id(&canonical);
    if let Some(existing) = file
        .workspaces
        .iter_mut()
        .find(|workspace| workspace.id == id)
    {
        existing.name = name;
        existing.path = canonical.clone();
        existing.updated_at = now.clone();
    } else {
        file.workspaces.push(WorkspaceConfig {
            id: id.clone(),
            name,
            path: canonical.clone(),
            created_at: now.clone(),
            updated_at: now,
        });
    }
    write_workspaces_file(&app_data, &file)?;
    workspace_summary(&WorkspaceConfig {
        id,
        name: workspace_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("workspace")
            .to_string(),
        path: canonical,
        created_at: now_iso(),
        updated_at: now_iso(),
    })
}

fn prepare_workspace(workspace_path: &Path, create_starter: bool) -> Result<(), String> {
    let pipelines_path = workspace_path.join(".agentboard").join("pipelines.json");
    if !pipelines_path.is_file() && !create_starter {
        return Err(format!(
            "STARTER_REQUIRED: {} does not contain .agentboard/pipelines.json",
            workspace_path.display()
        ));
    }
    initialize_workspace(workspace_path)
}

#[tauri::command]
fn open_sample_workspace() -> Result<WorkspaceSummary, String> {
    let source = sample_workspace_resource()?;
    let sample = app_data_dir()?.join("sample-workspace");
    copy_directory(&source, &sample)?;
    add_workspace(sample.to_string_lossy().to_string(), Some(false))
}

fn sample_workspace_resource() -> Result<PathBuf, String> {
    let bundled = env::current_exe()
        .map_err(to_error)?
        .parent()
        .ok_or_else(|| "Could not locate the AgentBoard executable directory".to_string())?
        .join("sample-workspace");
    if bundled.join(".agentboard").join("pipelines.json").is_file() {
        return Ok(bundled);
    }

    #[cfg(debug_assertions)]
    {
        let development = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .ok_or_else(|| "Could not locate the AgentBoard project root".to_string())?
            .join("sample-workspace");
        if development
            .join(".agentboard")
            .join("pipelines.json")
            .is_file()
        {
            return Ok(development);
        }
    }

    Err(format!(
        "Bundled sample workspace resource is missing: {}",
        bundled.display()
    ))
}

fn copy_directory(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(to_error)?;
    for entry in fs::read_dir(source).map_err(to_error)? {
        let entry = entry.map_err(to_error)?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        if source_path.is_dir() {
            copy_directory(&source_path, &destination_path)?;
        } else {
            if let Some(parent) = destination_path.parent() {
                fs::create_dir_all(parent).map_err(to_error)?;
            }
            fs::copy(&source_path, &destination_path).map_err(to_error)?;
        }
    }
    Ok(())
}

#[tauri::command]
fn load_workspace(state: State<AppState>, workspace_id: String) -> Result<WorkspaceBundle, String> {
    let active_sessions = state
        .sessions
        .lock()
        .map_err(|_| "session state lock poisoned".to_string())?
        .values()
        .map(|control| control.info.clone())
        .collect();
    load_workspace_impl(workspace_id, active_sessions)
}

fn load_workspace_impl(
    workspace_id: String,
    active_sessions: Vec<SessionInfo>,
) -> Result<WorkspaceBundle, String> {
    let app_data = app_data_dir()?;
    let file = read_workspaces_file(&app_data)?;
    let workspace = file
        .workspaces
        .iter()
        .find(|workspace| workspace.id == workspace_id)
        .ok_or_else(|| format!("Unknown workspace id: {workspace_id}"))?;
    let path = PathBuf::from(&workspace.path);
    initialize_workspace(&path)?;
    let summary = workspace_summary(workspace)?;
    let history = load_session_history(&path, &summary.name, active_sessions)?;
    Ok(WorkspaceBundle {
        workspace: summary,
        pipelines: load_pipelines(&path),
        skills: load_skills(&path),
        git: git_status(workspace.path.clone())?,
        sessions: history.sessions,
        session_logs: history.logs,
    })
}

#[tauri::command]
fn read_file(workspace_path: String, relative_path: String) -> Result<FileReadResult, String> {
    let base = PathBuf::from(workspace_path);
    let target = safe_workspace_join(&base, &relative_path)?;
    if !target.exists() {
        return Ok(FileReadResult {
            path: relative_path,
            exists: false,
            content: String::new(),
            error: Some("File does not exist".to_string()),
        });
    }
    let content = fs::read_to_string(&target).map_err(|error| {
        format!(
            "Could not read {} as UTF-8 text: {}",
            target.display(),
            error
        )
    })?;
    Ok(FileReadResult {
        path: relative_path,
        exists: true,
        content,
        error: None,
    })
}

#[tauri::command]
fn git_status(workspace_path: String) -> Result<GitStatus, String> {
    if !command_exists("git") {
        return Ok(GitStatus {
            is_repo: false,
            branch: None,
            changed_files: vec![],
            untracked_files: vec![],
            diff_stat: String::new(),
            error: Some("Git is not installed or not on PATH.".to_string()),
        });
    }
    let workspace = PathBuf::from(workspace_path);
    let repo_check =
        match run_command_capture(&workspace, "git", &["rev-parse", "--is-inside-work-tree"]) {
            Ok(value) => value,
            Err(error) => {
                return Ok(GitStatus {
                    is_repo: false,
                    branch: None,
                    changed_files: vec![],
                    untracked_files: vec![],
                    diff_stat: String::new(),
                    error: Some(format!("Git repository check failed: {error}")),
                });
            }
        };
    if repo_check.trim() != "true" {
        return Ok(GitStatus {
            is_repo: false,
            branch: None,
            changed_files: vec![],
            untracked_files: vec![],
            diff_stat: String::new(),
            error: Some("Workspace is not a Git repository.".to_string()),
        });
    }
    let branch = run_command_capture(&workspace, "git", &["branch", "--show-current"])
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let status_text = match run_command_capture(&workspace, "git", &["status", "--porcelain"]) {
        Ok(value) => value,
        Err(error) => {
            return Ok(GitStatus {
                is_repo: true,
                branch,
                changed_files: vec![],
                untracked_files: vec![],
                diff_stat: String::new(),
                error: Some(format!("Git status failed: {error}")),
            });
        }
    };
    let diff_stat = match run_command_capture(&workspace, "git", &["diff", "--stat"]) {
        Ok(value) => value,
        Err(error) => {
            return Ok(GitStatus {
                is_repo: true,
                branch,
                changed_files: vec![],
                untracked_files: vec![],
                diff_stat: String::new(),
                error: Some(format!("Git diff failed: {error}")),
            });
        }
    };
    let mut changed_files = Vec::new();
    let mut untracked_files = Vec::new();
    for line in status_text.lines() {
        if line.len() < 4 {
            continue;
        }
        let status = line[..2].trim().to_string();
        let path = line[3..].trim().to_string();
        if status == "??" {
            untracked_files.push(path);
        } else {
            changed_files.push(GitFileChange { path, status });
        }
    }
    Ok(GitStatus {
        is_repo: true,
        branch,
        changed_files,
        untracked_files,
        diff_stat,
        error: None,
    })
}

#[tauri::command]
fn create_worktree(workspace_path: String, node_id: String) -> Result<String, String> {
    create_worktree_for_session(&workspace_path, &node_id, &new_session_id("worktree"))
}

fn create_worktree_for_session(
    workspace_path: &str,
    node_id: &str,
    session_id: &str,
) -> Result<String, String> {
    let workspace = PathBuf::from(&workspace_path);
    let status = git_status(workspace_path.to_string())?;
    if !status.is_repo {
        return Err(status
            .error
            .unwrap_or_else(|| "Workspace is not a Git repository.".to_string()));
    }
    let workspace_name = workspace
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("workspace");
    let parent = workspace
        .parent()
        .ok_or_else(|| "Workspace has no parent directory".to_string())?;
    let worktrees_root = parent.join(".agentboard-worktrees");
    fs::create_dir_all(&worktrees_root).map_err(to_error)?;
    let clean_node = sanitize_slug(&node_id);
    let clean_session = sanitize_slug(session_id);
    let target = worktrees_root.join(format!("{workspace_name}-{clean_node}-{clean_session}"));
    let target_arg = target.to_string_lossy().to_string();
    let branch = format!("agentboard/{clean_node}-{clean_session}");
    let output = Command::new("git")
        .current_dir(&workspace)
        .args(["worktree", "add", &target_arg, "-b", &branch])
        .output()
        .map_err(to_error)?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn scan_workspace(workspace_path: String) -> Result<Vec<RealityIssue>, String> {
    let workspace = PathBuf::from(workspace_path);
    let mut issues = Vec::new();
    scan_dir(&workspace, &workspace, &mut issues)?;
    Ok(issues)
}

#[tauri::command]
fn run_agent(
    app: tauri::AppHandle,
    state: State<AppState>,
    request: RunAgentRequest,
) -> Result<SessionInfo, String> {
    run_agent_impl(app, &state, request)
}

fn run_agent_impl<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    state: &AppState,
    request: RunAgentRequest,
) -> Result<SessionInfo, String> {
    let output_app = app.clone();
    let output_sink: OutputSink = Arc::new(move |session_id, stream, line| {
        emit_output(&output_app, session_id, stream, line);
    });
    let status_sink: StatusSink = Arc::new(move |event| {
        let _ = app.emit("agent-status", event);
    });
    run_agent_core(state.sessions.clone(), request, output_sink, status_sink)
}

fn run_agent_core(
    sessions: Arc<Mutex<HashMap<String, SessionControl>>>,
    request: RunAgentRequest,
    output_sink: OutputSink,
    status_sink: StatusSink,
) -> Result<SessionInfo, String> {
    let workspace = PathBuf::from(&request.workspace_path);
    if !workspace.exists() || !workspace.is_dir() {
        return Err(format!("Workspace does not exist: {}", workspace.display()));
    }
    let session_id = new_session_id("session");
    let worktree_path = if request.use_worktree {
        let node_id = request
            .node_id
            .as_deref()
            .ok_or_else(|| "Worktree isolation requires a pipeline node id.".to_string())?;
        Some(
            create_worktree_for_session(&request.workspace_path, node_id, &session_id)
                .map_err(|error| format!("WORKTREE_FAILED:{error}"))?,
        )
    } else {
        None
    };
    let execution_workspace = worktree_path
        .as_deref()
        .map(PathBuf::from)
        .unwrap_or_else(|| workspace.clone());
    if !request.allow_shared_workspace {
        let controls = sessions
            .lock()
            .map_err(|_| "session state lock poisoned".to_string())?;
        if let Some(conflict) = controls.values().find(|control| {
            session_is_active(&control.info.status)
                && paths_match(
                    Path::new(&control.info.execution_path),
                    &execution_workspace,
                )
        }) {
            return Err(format!(
                "SHARED_WORKSPACE_CONFIRMATION_REQUIRED:{}:{}",
                conflict.info.id, conflict.info.agent
            ));
        }
    }
    if !matches!(request.run_mode.as_str(), "inspect_only" | "edit") {
        return Err(format!("Unsupported run mode: {}", request.run_mode));
    }
    let (program, args) = agent_invocation(&request.agent, &request.prompt, &request.run_mode)?;
    let resolved_program = resolve_command(&program)
        .ok_or_else(|| format!("Command `{program}` is not available on PATH."))?;
    let logs_dir = workspace.join(".agentboard").join("logs");
    fs::create_dir_all(&logs_dir).map_err(to_error)?;
    let log_path = logs_dir.join(format!("{}-{}.log", request.agent, session_id));
    let log_file = Arc::new(Mutex::new(
        OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .map_err(to_error)?,
    ));
    let started_at = now_iso();
    let mut info = SessionInfo {
        id: session_id.clone(),
        workspace_path: workspace.to_string_lossy().to_string(),
        workspace_name: request.workspace_name,
        agent: request.agent.clone(),
        node_id: request.node_id.clone(),
        node_name: request.node_name.clone(),
        selected_skills: request.skills.clone(),
        prompt: request.prompt.clone(),
        run_mode: request.run_mode.clone(),
        status: "staged".to_string(),
        started_at,
        finished_at: None,
        log_path: log_path.to_string_lossy().to_string(),
        exit_code: None,
        execution_path: execution_workspace.to_string_lossy().to_string(),
        worktree_path,
    };
    persist_session_metadata(&log_file, &info);
    {
        let mut controls = sessions
            .lock()
            .map_err(|_| "session state lock poisoned".to_string())?;
        controls.insert(
            session_id.clone(),
            SessionControl {
                info: info.clone(),
                pid: None,
                stop_requested: false,
            },
        );
    }
    let mut command = command_for_program(&resolved_program, &args);
    command
        .current_dir(&execution_workspace)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            let message = format!(
                "Failed to spawn `{}` in {}: {}",
                program,
                execution_workspace.display(),
                error
            );
            finish_session(
                &sessions,
                &session_id,
                "failed",
                None,
                Some(message.clone()),
                &log_file,
                &status_sink,
            );
            return Err(message);
        }
    };
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let pid = child.id();
    {
        let mut controls = sessions
            .lock()
            .map_err(|_| "session state lock poisoned".to_string())?;
        if let Some(control) = controls.get_mut(&session_id) {
            control.pid = Some(pid);
            control.info.status = "running".to_string();
            info = control.info.clone();
        }
    }
    persist_session_metadata(&log_file, &info);
    let spawn_line = format!("Spawned `{}` with pid {pid}", resolved_program.display());
    write_log(
        &log_file,
        &format!(
            "[system] program={} args={:?} run_mode={} node={:?} node_name={:?} skills={:?} execution_path={}",
            resolved_program.display(),
            args,
            request.run_mode,
            request.node_id,
            request.node_name,
            request.skills,
            execution_workspace.display()
        ),
    );
    write_log(&log_file, &format!("[system] {spawn_line}"));
    output_sink(&session_id, "system", &spawn_line);
    let mut reader_threads = Vec::new();
    if let Some(stdout) = stdout {
        reader_threads.push(spawn_reader(
            session_id.clone(),
            "stdout",
            stdout,
            log_file.clone(),
            output_sink.clone(),
        ));
    }
    if let Some(stderr) = stderr {
        reader_threads.push(spawn_reader(
            session_id.clone(),
            "stderr",
            stderr,
            log_file.clone(),
            output_sink.clone(),
        ));
    }
    let session_for_wait = session_id.clone();
    let agent_for_wait = request.agent.clone();
    let run_mode_for_wait = request.run_mode.clone();
    let log_path_for_wait = log_path.clone();
    let log_for_wait = log_file.clone();
    let sessions_for_wait = sessions.clone();
    let status_for_wait = status_sink.clone();
    std::thread::spawn(move || {
        let result = child.wait();
        for reader_thread in reader_threads {
            let _ = reader_thread.join();
        }
        let (mut status, exit_code, mut message) = match result {
            Ok(exit) if exit.success() => (
                if run_mode_for_wait == "inspect_only" {
                    "completed_inspection".to_string()
                } else {
                    "completed".to_string()
                },
                exit.code(),
                None,
            ),
            Ok(exit) => (
                "failed".to_string(),
                exit.code(),
                Some(format!("Process exited with status {exit}")),
            ),
            Err(error) => ("failed".to_string(), None, Some(error.to_string())),
        };
        if agent_for_wait == "claude" {
            let log_text = fs::read_to_string(&log_path_for_wait).unwrap_or_default();
            if is_claude_access_blocked(&log_text) {
                status = "external_blocked".to_string();
                message = Some(
                    "Claude access blocked: subscription or organization access is unavailable."
                        .to_string(),
                );
            }
        }
        finish_session(
            &sessions_for_wait,
            &session_for_wait,
            &status,
            exit_code,
            message,
            &log_for_wait,
            &status_for_wait,
        );
    });
    Ok(info)
}

#[tauri::command]
fn stop_session(state: State<AppState>, session_id: String) -> Result<bool, String> {
    stop_session_impl(&state, &session_id)
}

fn stop_session_impl(state: &AppState, session_id: &str) -> Result<bool, String> {
    let pid = {
        let mut sessions = state
            .sessions
            .lock()
            .map_err(|_| "session state lock poisoned".to_string())?;
        let control = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Unknown session id: {session_id}"))?;
        if !session_is_active(&control.info.status) {
            return Err(format!(
                "Session {session_id} is already {}.",
                control.info.status
            ));
        }
        control.stop_requested = true;
        control
            .pid
            .ok_or_else(|| format!("Session {session_id} is still staging."))?
    };
    #[cfg(windows)]
    let output = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .output()
        .map_err(to_error)?;
    #[cfg(not(windows))]
    let output = Command::new("kill")
        .args(["-TERM", &pid.to_string()])
        .output()
        .map_err(to_error)?;
    if !output.status.success() {
        if let Ok(mut sessions) = state.sessions.lock() {
            if let Some(control) = sessions.get_mut(session_id) {
                control.stop_requested = false;
            }
        }
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(true)
}

#[tauri::command]
fn run_multi_agent_smoke_test(
    app: tauri::AppHandle,
    state: State<AppState>,
    workspace_path: String,
    workspace_name: String,
) -> Result<Vec<SessionInfo>, String> {
    let smoke_requests = [
        (
            "Multi-agent smoke A",
            "Write-Output AgentA-Start; Start-Sleep -Seconds 5; Write-Output AgentA-Done",
        ),
        (
            "Multi-agent smoke B",
            "Write-Output AgentB-Start; Start-Sleep -Seconds 3; Write-Output AgentB-Done",
        ),
    ];
    let mut sessions = Vec::new();
    for (node_name, prompt) in smoke_requests {
        sessions.push(run_agent_impl(
            app.clone(),
            &state,
            RunAgentRequest {
                workspace_path: workspace_path.clone(),
                workspace_name: workspace_name.clone(),
                agent: "powershell".to_string(),
                prompt: prompt.to_string(),
                run_mode: "edit".to_string(),
                node_id: None,
                node_name: Some(node_name.to_string()),
                skills: Vec::new(),
                use_worktree: false,
                allow_shared_workspace: true,
            },
        )?);
    }
    Ok(sessions)
}

#[tauri::command]
fn list_sessions(state: State<AppState>) -> Result<Vec<SessionInfo>, String> {
    Ok(state
        .sessions
        .lock()
        .map_err(|_| "session state lock poisoned".to_string())?
        .values()
        .map(|control| control.info.clone())
        .collect())
}

#[tauri::command]
fn list_agent_profiles() -> Result<Vec<AgentProfile>, String> {
    let app_data = app_data_dir()?;
    read_agent_profiles_file(&app_data).map(|file| file.profiles)
}

#[tauri::command]
fn save_agent_profile(profile: AgentProfile) -> Result<AgentProfile, String> {
    let app_data = app_data_dir()?;
    save_agent_profile_impl(&app_data, profile)
}

#[tauri::command]
fn delete_agent_profile(id: String) -> Result<bool, String> {
    let app_data = app_data_dir()?;
    delete_agent_profile_impl(&app_data, &id)
}

#[tauri::command]
fn list_deployments() -> Result<Vec<AgentDeployment>, String> {
    let app_data = app_data_dir()?;
    read_deployments_file(&app_data).map(|file| file.deployments)
}

#[tauri::command]
fn save_deployment(deployment: AgentDeployment) -> Result<AgentDeployment, String> {
    let app_data = app_data_dir()?;
    save_deployment_impl(&app_data, deployment, false)
}

#[tauri::command]
fn update_deployment(deployment: AgentDeployment) -> Result<AgentDeployment, String> {
    let app_data = app_data_dir()?;
    save_deployment_impl(&app_data, deployment, true)
}

#[tauri::command]
fn delete_deployment(id: String) -> Result<bool, String> {
    let app_data = app_data_dir()?;
    delete_deployment_impl(&app_data, &id)
}

#[tauri::command]
fn deployment_preflight(
    request: DeploymentPreflightRequest,
) -> Result<DeploymentPreflightResult, String> {
    deployment_preflight_impl(request)
}

#[tauri::command]
fn github_marketplace_search(
    state: State<AppState>,
    request: GithubMarketplaceSearchRequest,
) -> Result<GithubMarketplaceSearchResult, String> {
    let app_data = app_data_dir()?;
    github_marketplace_search_impl(&state, &app_data, request)
}

#[tauri::command]
fn github_marketplace_preview(
    state: State<AppState>,
    request: GithubMarketplacePreviewRequest,
) -> Result<GithubMarketplacePreview, String> {
    let app_data = app_data_dir()?;
    github_marketplace_preview_impl(&state, &app_data, request)
}

#[tauri::command]
fn github_marketplace_install(
    state: State<AppState>,
    request: GithubMarketplaceInstallRequest,
) -> Result<GithubMarketplaceInstallResult, String> {
    let app_data = app_data_dir()?;
    github_marketplace_install_impl(&state, &app_data, request)
}

#[tauri::command]
fn github_marketplace_update(
    state: State<AppState>,
    request: GithubMarketplaceUpdateRequest,
) -> Result<GithubMarketplaceUpdateResult, String> {
    let app_data = app_data_dir()?;
    github_marketplace_update_impl(&state, &app_data, request)
}

#[tauri::command]
fn github_marketplace_uninstall(
    request: GithubMarketplaceSkillRequest,
) -> Result<GithubMarketplaceUninstallResult, String> {
    github_marketplace_uninstall_impl(request)
}

#[tauri::command]
fn github_marketplace_set_trust(
    request: GithubMarketplaceTrustRequest,
) -> Result<SkillInfo, String> {
    github_marketplace_set_trust_impl(request)
}

#[tauri::command]
fn github_marketplace_rate_limit(state: State<AppState>) -> Result<GithubRateLimits, String> {
    github_marketplace_rate_limit_impl(&state)
}

#[tauri::command]
fn save_github_token(
    state: State<AppState>,
    request: GithubTokenRequest,
) -> Result<GithubTokenStatus, String> {
    let token = request.token.trim();
    if token.is_empty() {
        return Err("Enter a GitHub personal access token.".to_string());
    }
    {
        let mut stored = state
            .github_token
            .lock()
            .map_err(|_| "GitHub token state lock poisoned".to_string())?;
        *stored = Some(token.to_string());
    }
    match github_marketplace_rate_limit_impl(&state) {
        Ok(rate_limits) => Ok(GithubTokenStatus {
            stored: true,
            persistence: "session_only".to_string(),
            message:
                "GitHub token saved for this AgentBoard process only. It will be cleared on exit."
                    .to_string(),
            rate_limits: Some(rate_limits),
        }),
        Err(error) => {
            if let Ok(mut stored) = state.github_token.lock() {
                *stored = None;
            }
            Err(error)
        }
    }
}

#[tauri::command]
fn clear_github_token(state: State<AppState>) -> Result<GithubTokenStatus, String> {
    let mut stored = state
        .github_token
        .lock()
        .map_err(|_| "GitHub token state lock poisoned".to_string())?;
    *stored = None;
    Ok(GithubTokenStatus {
        stored: false,
        persistence: "session_only".to_string(),
        message: "GitHub token cleared from memory.".to_string(),
        rate_limits: None,
    })
}

#[tauri::command]
fn clear_session_history(
    state: State<AppState>,
    workspace_path: String,
) -> Result<ClearSessionHistoryResult, String> {
    clear_session_history_impl(&state, workspace_path)
}

fn clear_session_history_impl(
    state: &AppState,
    workspace_path: String,
) -> Result<ClearSessionHistoryResult, String> {
    let workspace = PathBuf::from(&workspace_path);
    let logs_dir = workspace.join(".agentboard").join("logs");
    fs::create_dir_all(&logs_dir).map_err(to_error)?;

    let protected_logs: HashSet<PathBuf> = {
        let mut sessions = state
            .sessions
            .lock()
            .map_err(|_| "session state lock poisoned".to_string())?;
        let protected = sessions
            .values()
            .filter(|control| {
                control.info.workspace_path == workspace_path
                    && session_is_active(&control.info.status)
            })
            .map(|control| PathBuf::from(&control.info.log_path))
            .collect();
        sessions.retain(|_, control| {
            control.info.workspace_path != workspace_path || session_is_active(&control.info.status)
        });
        protected
    };

    let mut removed = 0;
    let mut retained_running = 0;
    for entry in fs::read_dir(&logs_dir).map_err(to_error)? {
        let path = entry.map_err(to_error)?.path();
        if path.extension().and_then(|value| value.to_str()) != Some("log") {
            continue;
        }
        if protected_logs.contains(&path) {
            retained_running += 1;
            continue;
        }
        fs::remove_file(&path)
            .map_err(|error| format!("Could not remove session log {}: {error}", path.display()))?;
        removed += 1;
    }
    Ok(ClearSessionHistoryResult {
        removed,
        retained_running,
    })
}

#[tauri::command]
fn open_logs_folder(workspace_path: String) -> Result<String, String> {
    let workspace = PathBuf::from(workspace_path);
    if !workspace.is_dir() {
        return Err(format!("Workspace does not exist: {}", workspace.display()));
    }
    let logs_dir = workspace.join(".agentboard").join("logs");
    fs::create_dir_all(&logs_dir).map_err(to_error)?;

    #[cfg(windows)]
    Command::new("explorer.exe")
        .arg(&logs_dir)
        .spawn()
        .map_err(to_error)?;
    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(&logs_dir)
        .spawn()
        .map_err(to_error)?;
    #[cfg(all(unix, not(target_os = "macos")))]
    Command::new("xdg-open")
        .arg(&logs_dir)
        .spawn()
        .map_err(to_error)?;

    Ok(logs_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn export_diagnostics(
    request: DiagnosticsExportRequest,
) -> Result<DiagnosticsExportResult, String> {
    export_diagnostics_impl(request)
}

fn export_diagnostics_impl(
    request: DiagnosticsExportRequest,
) -> Result<DiagnosticsExportResult, String> {
    let app_data = app_data_dir()?;
    ensure_global_files(&app_data)?;
    let generated_at = now_iso();
    let diagnostics_dir = app_data.join("diagnostics");
    fs::create_dir_all(&diagnostics_dir).map_err(to_error)?;
    let path = diagnostics_dir.join(format!("agentboard-diagnostics-{}.json", now_compact()));
    let log_folder_path = request.workspace_path.as_deref().and_then(|workspace| {
        let workspace = PathBuf::from(workspace);
        workspace
            .is_dir()
            .then(|| workspace.join(".agentboard").join("logs"))
            .map(|logs| logs.to_string_lossy().to_string())
    });
    let recent_errors = request
        .recent_errors
        .into_iter()
        .rev()
        .take(20)
        .map(|error| truncate_text(error.trim(), 2_000))
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    let issue_notes = request
        .issue_notes
        .map(|notes| truncate_text(notes.trim(), 4_000))
        .filter(|notes| !notes.is_empty());
    let report = DiagnosticsReport {
        app_name: "AgentBoard".to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        generated_at: generated_at.clone(),
        os: diagnostics_os_info(),
        app_data_dir: app_data.to_string_lossy().to_string(),
        log_folder_path,
        agents: detect_agents()?,
        workspace_registry: load_workspace_summaries(&app_data)?,
        recent_errors,
        issue_notes,
        privacy_note: "Contains environment and registry summaries only. Source contents, prompts, and log contents are excluded.".to_string(),
    };
    fs::write(&path, format!("{}\n", pretty_json(&report)?)).map_err(to_error)?;
    Ok(DiagnosticsExportResult {
        path: path.to_string_lossy().to_string(),
        generated_at,
    })
}

fn diagnostics_os_info() -> DiagnosticsOsInfo {
    DiagnosticsOsInfo {
        family: env::consts::OS.to_string(),
        architecture: env::consts::ARCH.to_string(),
        version: os_version(),
        computer_name: env::var("COMPUTERNAME")
            .ok()
            .or_else(|| env::var("HOSTNAME").ok()),
    }
}

#[cfg(windows)]
fn os_version() -> String {
    Command::new("cmd")
        .args(["/D", "/S", "/C", "ver"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Windows version unavailable".to_string())
}

#[cfg(not(windows))]
fn os_version() -> String {
    env::var("OSTYPE").unwrap_or_else(|_| "Version unavailable".to_string())
}

fn truncate_text(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

fn load_session_history(
    workspace: &Path,
    workspace_name: &str,
    active_sessions: Vec<SessionInfo>,
) -> Result<SessionHistory, String> {
    let logs_dir = workspace.join(".agentboard").join("logs");
    fs::create_dir_all(&logs_dir).map_err(to_error)?;
    let active_by_id: HashMap<String, SessionInfo> = active_sessions
        .into_iter()
        .filter(|session| PathBuf::from(&session.workspace_path) == workspace)
        .map(|session| (session.id.clone(), session))
        .collect();
    let mut sessions = Vec::new();
    let mut logs = HashMap::new();
    let mut restored_ids = HashSet::new();

    for entry in fs::read_dir(&logs_dir).map_err(to_error)? {
        let entry = entry.map_err(to_error)?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("log") {
            continue;
        }
        let raw = fs::read(&path).map_err(to_error)?;
        let text = String::from_utf8_lossy(&raw);
        let Some(mut info) = session_info_from_log(&path, workspace, workspace_name, &text) else {
            continue;
        };
        if let Some(active) = active_by_id.get(&info.id) {
            info = active.clone();
        } else if session_is_active(&info.status) {
            info.status = "stopped".to_string();
            info.finished_at = file_modified_seconds(&path);
        }
        if info.agent == "claude" && is_claude_access_blocked(&text) {
            info.status = "external_blocked".to_string();
            info.finished_at = info.finished_at.or_else(|| file_modified_seconds(&path));
        }
        let display_lines = text
            .lines()
            .filter(|line| !line.starts_with("[system] session-meta="))
            .map(clean_windows_output)
            .collect();
        restored_ids.insert(info.id.clone());
        logs.insert(info.id.clone(), display_lines);
        sessions.push(info);
    }

    for active in active_by_id.into_values() {
        if restored_ids.insert(active.id.clone()) {
            logs.insert(active.id.clone(), Vec::new());
            sessions.push(active);
        }
    }
    sessions.sort_by(|left, right| {
        session_time_sort_key(&right.started_at).cmp(&session_time_sort_key(&left.started_at))
    });
    Ok(SessionHistory { sessions, logs })
}

fn session_info_from_log(
    path: &Path,
    workspace: &Path,
    workspace_name: &str,
    text: &str,
) -> Option<SessionInfo> {
    let mut persisted = None;
    for line in text.lines() {
        if let Some(metadata) = line.strip_prefix("[system] session-meta=") {
            if let Ok(info) = serde_json::from_str::<SessionInfo>(metadata) {
                persisted = Some(info);
            }
        }
    }
    if persisted.is_some() {
        return persisted;
    }

    let stem = path.file_stem()?.to_str()?;
    let (agent, suffix) = stem.split_once("-session-")?;
    if !matches!(
        agent,
        "claude" | "codex" | "gemini" | "aider" | "powershell" | "cmd"
    ) {
        return None;
    }
    let id = format!("session-{suffix}");
    let started_at = suffix
        .parse::<u128>()
        .ok()
        .map(|millis| (millis / 1000).to_string())
        .or_else(|| file_modified_seconds(path))
        .unwrap_or_else(now_iso);
    let status = if agent == "claude" && is_claude_access_blocked(text) {
        "external_blocked"
    } else if legacy_log_failed(text) {
        "failed"
    } else if text.lines().any(|line| line.starts_with("[stdout]")) {
        "completed"
    } else {
        "failed"
    };
    Some(SessionInfo {
        id,
        workspace_path: workspace.to_string_lossy().to_string(),
        workspace_name: workspace_name.to_string(),
        agent: agent.to_string(),
        node_id: None,
        node_name: None,
        selected_skills: Vec::new(),
        prompt: format!("Restored from {}", path.file_name()?.to_string_lossy()),
        run_mode: "edit".to_string(),
        status: status.to_string(),
        started_at,
        finished_at: file_modified_seconds(path),
        log_path: path.to_string_lossy().to_string(),
        exit_code: None,
        execution_path: workspace.to_string_lossy().to_string(),
        worktree_path: None,
    })
}

fn legacy_log_failed(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    [
        "command not found",
        "is not recognized as an internal or external command",
        "failed to spawn",
        "process exited with status",
        "fatal:",
    ]
    .iter()
    .any(|pattern| lower.contains(pattern))
}

fn is_claude_access_blocked(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    lower.contains("disabled claude subscription access")
        || lower.contains("claude access blocked")
        || lower.contains("claude code is not available with your current plan")
        || (lower.contains("anthropic api key") && lower.contains("enable access"))
}

fn clean_windows_output(line: &str) -> String {
    line.replace("\u{00c3}\u{201a}\u{00c2}\u{00b7}", "\u{00b7}")
        .replace("\u{00c2}\u{00b7}", "\u{00b7}")
        .replace("\u{00c2}\u{00a0}", " ")
        .replace("\u{00e2}\u{20ac}\u{0153}", "\u{201c}")
        .replace("\u{00e2}\u{20ac}\u{009d}", "\u{201d}")
        .replace("\u{00e2}\u{20ac}\u{2122}", "\u{2019}")
        .replace("\u{00e2}\u{20ac}\u{201c}", "\u{2013}")
        .replace("\u{00e2}\u{20ac}\u{201d}", "\u{2014}")
}

fn file_modified_seconds(path: &Path) -> Option<String> {
    fs::metadata(path)
        .ok()?
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_secs().to_string())
}

fn session_time_sort_key(value: &str) -> u128 {
    value.parse::<u128>().unwrap_or_default()
}

fn app_data_dir() -> Result<PathBuf, String> {
    let root = env::var_os("APPDATA")
        .map(PathBuf::from)
        .or_else(|| env::var_os("LOCALAPPDATA").map(PathBuf::from))
        .ok_or_else(|| "APPDATA and LOCALAPPDATA are not set.".to_string())?;
    Ok(root.join("AgentBoard"))
}

fn ensure_global_files(app_data: &Path) -> Result<(), String> {
    fs::create_dir_all(app_data).map_err(to_error)?;
    let workspaces = app_data.join("workspaces.json");
    if !workspaces.exists() {
        fs::write(&workspaces, pretty_json(&WorkspacesFile::default())?).map_err(to_error)?;
    }
    let preferences = app_data.join("preferences.json");
    if !preferences.exists() {
        fs::write(
            &preferences,
            "{\n  \"theme\": \"dark\",\n  \"defaultAgent\": \"codex\"\n}\n",
        )
        .map_err(to_error)?;
    }
    let recent = app_data.join("recent_sessions.json");
    if !recent.exists() {
        fs::write(&recent, "{\n  \"sessions\": []\n}\n").map_err(to_error)?;
    }
    let agents = app_data.join("agents.json");
    if !agents.exists() {
        write_json_atomic(&agents, &AgentProfilesFile::default())?;
    }
    let deployments = app_data.join("deployments.json");
    if !deployments.exists() {
        write_json_atomic(&deployments, &AgentDeploymentsFile::default())?;
    }
    Ok(())
}

fn read_json_file<T: for<'de> Deserialize<'de> + Default>(path: &Path) -> Result<T, String> {
    if !path.exists() {
        return Ok(T::default());
    }
    let text = fs::read_to_string(path).map_err(to_error)?;
    let text = text.strip_prefix('\u{feff}').unwrap_or(&text);
    serde_json::from_str(text).map_err(|error| format!("Invalid {}: {error}", path.display()))
}

fn write_json_atomic<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(to_error)?;
    }
    let temp = path.with_extension("json.tmp");
    fs::write(&temp, pretty_json(value)?).map_err(to_error)?;
    if path.exists() {
        fs::remove_file(path).map_err(to_error)?;
    }
    fs::rename(&temp, path).map_err(to_error)
}

fn validate_profile(profile: &AgentProfile) -> Result<(), String> {
    if profile.id.trim().is_empty() {
        return Err("Agent profile id is required.".to_string());
    }
    if profile.name.trim().is_empty() {
        return Err("Agent profile name is required.".to_string());
    }
    if !matches!(
        profile.provider.as_str(),
        "codex" | "claude" | "gemini" | "aider" | "powershell" | "cmd" | "custom"
    ) {
        return Err(format!(
            "Unsupported agent profile provider: {}",
            profile.provider
        ));
    }
    if !matches!(profile.effort.as_str(), "ultra" | "high" | "medium" | "low") {
        return Err(format!("Unsupported effort: {}", profile.effort));
    }
    if !matches!(
        profile.isolation_mode.as_str(),
        "same_workspace" | "worktree_per_deployment"
    ) {
        return Err(format!(
            "Unsupported isolation mode: {}",
            profile.isolation_mode
        ));
    }
    Ok(())
}

fn read_agent_profiles_file(app_data: &Path) -> Result<AgentProfilesFile, String> {
    ensure_global_files(app_data)?;
    read_json_file(&app_data.join("agents.json"))
}

fn save_agent_profile_impl(app_data: &Path, profile: AgentProfile) -> Result<AgentProfile, String> {
    validate_profile(&profile)?;
    let mut file = read_agent_profiles_file(app_data)?;
    if let Some(existing) = file.profiles.iter_mut().find(|item| item.id == profile.id) {
        *existing = profile.clone();
    } else {
        file.profiles.push(profile.clone());
    }
    file.profiles
        .sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    write_json_atomic(&app_data.join("agents.json"), &file)?;
    Ok(profile)
}

fn delete_agent_profile_impl(app_data: &Path, id: &str) -> Result<bool, String> {
    let mut file = read_agent_profiles_file(app_data)?;
    let before = file.profiles.len();
    file.profiles.retain(|profile| profile.id != id);
    if before == file.profiles.len() {
        return Err(format!("Unknown agent profile id: {id}"));
    }
    write_json_atomic(&app_data.join("agents.json"), &file)?;
    Ok(true)
}

fn validate_deployment(deployment: &AgentDeployment) -> Result<(), String> {
    if deployment.id.trim().is_empty() {
        return Err("Deployment id is required.".to_string());
    }
    if deployment.agent_profile_id.trim().is_empty() {
        return Err("Deployment agent profile id is required.".to_string());
    }
    if !matches!(
        deployment.target_type.as_str(),
        "workspace" | "folder" | "file" | "pipeline_node"
    ) {
        return Err(format!(
            "Unsupported deployment target type: {}",
            deployment.target_type
        ));
    }
    if !matches!(
        deployment.isolation_mode.as_str(),
        "same_workspace" | "worktree_per_deployment"
    ) {
        return Err(format!(
            "Unsupported deployment isolation mode: {}",
            deployment.isolation_mode
        ));
    }
    if !matches!(deployment.run_mode.as_str(), "inspect_only" | "edit") {
        return Err(format!(
            "Unsupported deployment run mode: {}",
            deployment.run_mode
        ));
    }
    if !matches!(
        deployment.status.as_str(),
        "staged"
            | "running"
            | "completed"
            | "completed_inspection"
            | "failed"
            | "stopped"
            | "external_blocked"
    ) {
        return Err(format!(
            "Unsupported deployment status: {}",
            deployment.status
        ));
    }
    Ok(())
}

fn read_deployments_file(app_data: &Path) -> Result<AgentDeploymentsFile, String> {
    ensure_global_files(app_data)?;
    read_json_file(&app_data.join("deployments.json"))
}

fn save_deployment_impl(
    app_data: &Path,
    deployment: AgentDeployment,
    require_existing: bool,
) -> Result<AgentDeployment, String> {
    validate_deployment(&deployment)?;
    let mut file = read_deployments_file(app_data)?;
    if let Some(existing) = file
        .deployments
        .iter_mut()
        .find(|item| item.id == deployment.id)
    {
        *existing = deployment.clone();
    } else if require_existing {
        return Err(format!("Unknown deployment id: {}", deployment.id));
    } else {
        file.deployments.push(deployment.clone());
    }
    file.deployments.sort_by(|left, right| {
        session_time_sort_key(&right.created_at).cmp(&session_time_sort_key(&left.created_at))
    });
    write_json_atomic(&app_data.join("deployments.json"), &file)?;
    Ok(deployment)
}

fn delete_deployment_impl(app_data: &Path, id: &str) -> Result<bool, String> {
    let mut file = read_deployments_file(app_data)?;
    let before = file.deployments.len();
    file.deployments.retain(|deployment| deployment.id != id);
    if before == file.deployments.len() {
        return Err(format!("Unknown deployment id: {id}"));
    }
    write_json_atomic(&app_data.join("deployments.json"), &file)?;
    Ok(true)
}

fn deployment_preflight_impl(
    request: DeploymentPreflightRequest,
) -> Result<DeploymentPreflightResult, String> {
    let mut blockers = Vec::new();
    let mut warnings = Vec::new();
    let workspace = PathBuf::from(&request.workspace_path);
    let valid_target_type = matches!(
        request.target_type.as_str(),
        "workspace" | "folder" | "file" | "pipeline_node"
    );
    if !valid_target_type {
        blockers.push(preflight_message(
            "invalid_target_type",
            format!(
                "Unsupported deployment target type: {}",
                request.target_type
            ),
        ));
    }
    if !matches!(request.run_mode.as_str(), "inspect_only" | "edit") {
        blockers.push(preflight_message(
            "invalid_run_mode",
            format!("Unsupported deployment run mode: {}", request.run_mode),
        ));
    }

    let target = match request.target_type.as_str() {
        "workspace" | "pipeline_node" => workspace.clone(),
        _ => PathBuf::from(&request.target_path),
    };
    let target_exists = match request.target_type.as_str() {
        "workspace" | "folder" | "pipeline_node" => target.is_dir(),
        "file" => target.is_file(),
        _ => false,
    };
    if !target_exists {
        blockers.push(preflight_message(
            "target_missing",
            format!("Deployment target does not exist: {}", target.display()),
        ));
    }
    if workspace.exists() && target.exists() && !path_is_within(&target, &workspace) {
        blockers.push(preflight_message(
            "target_outside_workspace",
            "The deployment target is outside the selected workspace.",
        ));
    }

    let source_file_count =
        if target_exists && matches!(request.target_type.as_str(), "workspace" | "folder") {
            count_source_files(&target)?
        } else if target_exists && request.target_type == "file" {
            usize::from(is_source_file(&target))
        } else {
            request
                .concerned_files
                .iter()
                .filter(|path| is_source_file(&workspace.join(path)))
                .count()
        };
    let has_source_files = source_file_count > 0;
    let only_agentboard = target_exists
        && matches!(request.target_type.as_str(), "workspace" | "folder")
        && directory_contains_only_agentboard(&target)?;
    if matches!(request.target_type.as_str(), "workspace" | "folder") && !has_source_files {
        warnings.push(preflight_message(
            "no_source_files",
            "This target has no source files. Deploying an agent may do nothing.",
        ));
        if request.run_mode == "edit" {
            blockers.push(preflight_message(
                "empty_target_requires_inspection",
                "An empty target cannot start in edit mode. Choose Inspect target only to continue.",
            ));
        }
    }
    if request.run_mode == "edit" && request.task.trim().is_empty() {
        blockers.push(preflight_message(
            "task_required",
            "Tell the agent what to build, fix, inspect, or verify.",
        ));
    }
    if request.run_mode == "edit" && !request.write_files_permission {
        blockers.push(preflight_message(
            "write_permission_required",
            "Edit mode requires an agent profile with Write files enabled.",
        ));
    }

    let provider_command = provider_command(&request.provider);
    let provider_available = provider_command.and_then(resolve_command).is_some();
    if !provider_available {
        blockers.push(preflight_message(
            "provider_unavailable",
            format!(
                "{} is not installed or is not available on PATH.",
                request.provider
            ),
        ));
    }

    let installed_skills: HashSet<String> = if workspace.is_dir() {
        load_skills(&workspace)
            .into_iter()
            .map(|skill| skill.name)
            .collect()
    } else {
        HashSet::new()
    };
    let missing_skills: Vec<String> = request
        .selected_skills
        .iter()
        .filter(|skill| !installed_skills.contains(*skill))
        .cloned()
        .collect();
    if !missing_skills.is_empty() {
        blockers.push(preflight_message(
            "skills_missing",
            format!(
                "Selected local skills are unavailable: {}",
                missing_skills.join(", ")
            ),
        ));
    }

    let (log_writable, log_error) = check_log_folder_writable(&workspace);
    if !log_writable {
        blockers.push(preflight_message(
            "log_not_writable",
            log_error.unwrap_or_else(|| "The AgentBoard log folder is not writable.".to_string()),
        ));
    }

    let (git_status, git_message) = deployment_git_status(&target);
    if git_status != "git_repo" {
        warnings.push(preflight_message("git_unavailable", git_message.clone()));
    }

    let pipeline_concerned_file_count = request.concerned_files.len();
    if request.target_type == "pipeline_node" && pipeline_concerned_file_count == 0 {
        blockers.push(preflight_message(
            "pipeline_scope_missing",
            "This pipeline node has no concerned files. Add explicit scope before deployment.",
        ));
    }

    let (run_mode_supported, effective_sandbox) =
        provider_run_mode(&request.provider, &request.run_mode);
    if !run_mode_supported {
        blockers.push(preflight_message(
            "run_mode_unsupported",
            format!(
                "{} does not support {} mode through AgentBoard.",
                request.provider, request.run_mode
            ),
        ));
    } else if request.run_mode == "inspect_only" && request.provider != "codex" {
        warnings.push(preflight_message(
            "inspect_sandbox_not_enforced",
            format!(
                "AgentBoard cannot enforce a read-only sandbox for {}. The inspect-only prompt is advisory.",
                request.provider
            ),
        ));
    }

    Ok(DeploymentPreflightResult {
        target_exists,
        source_file_count,
        has_source_files,
        only_agentboard,
        provider_available,
        missing_skills,
        log_writable,
        git_status,
        git_message,
        pipeline_concerned_file_count,
        run_mode_supported,
        effective_sandbox,
        blockers,
        warnings,
    })
}

fn preflight_message(
    code: impl Into<String>,
    message: impl Into<String>,
) -> DeploymentPreflightMessage {
    DeploymentPreflightMessage {
        code: code.into(),
        message: message.into(),
    }
}

fn provider_command(provider: &str) -> Option<&str> {
    match provider {
        "codex" => Some("codex"),
        "claude" => Some("claude"),
        "gemini" => Some("gemini"),
        "aider" => Some("aider"),
        "powershell" => Some("powershell"),
        "cmd" => Some("cmd"),
        _ => None,
    }
}

fn provider_run_mode(provider: &str, run_mode: &str) -> (bool, String) {
    match (provider, run_mode) {
        ("codex", "inspect_only") => (true, "read-only".to_string()),
        ("codex", "edit") => (true, "workspace-write".to_string()),
        ("custom", _) => (false, "unavailable".to_string()),
        (_, "inspect_only") => (
            true,
            "provider-controlled; read-only not enforced".to_string(),
        ),
        (_, "edit") => (true, "provider-controlled write mode".to_string()),
        _ => (false, "unavailable".to_string()),
    }
}

fn path_is_within(path: &Path, workspace: &Path) -> bool {
    let canonical_path = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let canonical_workspace = workspace
        .canonicalize()
        .unwrap_or_else(|_| workspace.to_path_buf());
    canonical_path.starts_with(canonical_workspace)
}

fn count_source_files(root: &Path) -> Result<usize, String> {
    let mut count = 0;
    count_source_files_inner(root, &mut count)?;
    Ok(count)
}

fn count_source_files_inner(dir: &Path, count: &mut usize) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(to_error)? {
        let entry = entry.map_err(to_error)?;
        let path = entry.path();
        if path.is_dir() {
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("");
            if matches!(
                name,
                ".agentboard" | ".git" | "node_modules" | "target" | "dist" | "build" | ".next"
            ) {
                continue;
            }
            count_source_files_inner(&path, count)?;
        } else if is_source_file(&path) {
            *count += 1;
        }
    }
    Ok(())
}

fn is_source_file(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "rs" | "ts"
                    | "tsx"
                    | "js"
                    | "jsx"
                    | "mjs"
                    | "cjs"
                    | "py"
                    | "go"
                    | "java"
                    | "kt"
                    | "kts"
                    | "cs"
                    | "cpp"
                    | "cc"
                    | "c"
                    | "h"
                    | "hpp"
                    | "swift"
                    | "rb"
                    | "php"
                    | "vue"
                    | "svelte"
                    | "html"
                    | "css"
                    | "scss"
                    | "sql"
                    | "sh"
                    | "ps1"
            )
        })
}

fn directory_contains_only_agentboard(dir: &Path) -> Result<bool, String> {
    let mut names = Vec::new();
    for entry in fs::read_dir(dir).map_err(to_error)? {
        let entry = entry.map_err(to_error)?;
        names.push(entry.file_name().to_string_lossy().to_string());
    }
    Ok(!names.is_empty() && names.iter().all(|name| name == ".agentboard"))
}

fn check_log_folder_writable(workspace: &Path) -> (bool, Option<String>) {
    let logs = workspace.join(".agentboard").join("logs");
    if let Err(error) = fs::create_dir_all(&logs) {
        return (
            false,
            Some(format!(
                "Could not create the AgentBoard log folder {}: {error}",
                logs.display()
            )),
        );
    }
    let probe = logs.join(format!(".preflight-{}.tmp", now_compact()));
    match OpenOptions::new().create_new(true).write(true).open(&probe) {
        Ok(mut file) => {
            let write_result = file.write_all(b"AgentBoard preflight\n");
            let flush_result = file.flush();
            drop(file);
            let _ = fs::remove_file(&probe);
            match write_result.and(flush_result) {
                Ok(()) => (true, None),
                Err(error) => (
                    false,
                    Some(format!(
                        "The AgentBoard log folder is not writable: {error}"
                    )),
                ),
            }
        }
        Err(error) => (
            false,
            Some(format!(
                "The AgentBoard log folder is not writable: {error}"
            )),
        ),
    }
}

fn deployment_git_status(target: &Path) -> (String, String) {
    if resolve_command("git").is_none() {
        return (
            "git_missing".to_string(),
            "Git is not installed. Worktree isolation and Git diff review are unavailable."
                .to_string(),
        );
    }
    let cwd = if target.is_file() {
        target.parent().unwrap_or(target)
    } else {
        target
    };
    let output = Command::new("git")
        .current_dir(cwd)
        .args(["rev-parse", "--is-inside-work-tree"])
        .output();
    match output {
        Ok(output)
            if output.status.success()
                && String::from_utf8_lossy(&output.stdout).trim() == "true" =>
        {
            (
                "git_repo".to_string(),
                "Git repository detected.".to_string(),
            )
        }
        _ => (
            "not_git_repo".to_string(),
            "Not a Git repository. Worktree isolation and Git diff review are unavailable."
                .to_string(),
        ),
    }
}

fn read_workspaces_file(app_data: &Path) -> Result<WorkspacesFile, String> {
    ensure_global_files(app_data)?;
    let path = app_data.join("workspaces.json");
    let text = fs::read_to_string(&path).map_err(to_error)?;
    let text = text.strip_prefix('\u{feff}').unwrap_or(&text);
    let mut file: WorkspacesFile = serde_json::from_str(&text)
        .map_err(|error| format!("Invalid {}: {}", path.display(), error))?;
    let mut normalized: Vec<WorkspaceConfig> = Vec::with_capacity(file.workspaces.len());
    let mut positions: HashMap<String, usize> = HashMap::new();
    let mut changed = false;

    for mut workspace in file.workspaces.drain(..) {
        let workspace_path = PathBuf::from(&workspace.path);
        if workspace_path.exists() {
            let canonical = canonical_string(&workspace_path)?;
            let id = stable_id(&canonical);
            if workspace.path != canonical || workspace.id != id {
                workspace.path = canonical;
                workspace.id = id;
                changed = true;
            }
        }
        let key = if cfg!(windows) {
            workspace.path.to_lowercase()
        } else {
            workspace.path.clone()
        };
        if let Some(index) = positions.get(&key).copied() {
            changed = true;
            if workspace.updated_at > normalized[index].updated_at {
                normalized[index] = workspace;
            }
        } else {
            positions.insert(key, normalized.len());
            normalized.push(workspace);
        }
    }

    file.workspaces = normalized;
    if changed {
        fs::write(&path, pretty_json(&file)?).map_err(to_error)?;
    }
    Ok(file)
}

fn write_workspaces_file(app_data: &Path, file: &WorkspacesFile) -> Result<(), String> {
    fs::write(app_data.join("workspaces.json"), pretty_json(file)?).map_err(to_error)
}

fn load_workspace_summaries(app_data: &Path) -> Result<Vec<WorkspaceSummary>, String> {
    let file = read_workspaces_file(app_data)?;
    let mut summaries = Vec::new();
    for workspace in file.workspaces {
        summaries.push(workspace_summary(&workspace)?);
    }
    Ok(summaries)
}

fn workspace_summary(config: &WorkspaceConfig) -> Result<WorkspaceSummary, String> {
    let path = PathBuf::from(&config.path);
    let exists = path.exists() && path.is_dir();
    let has_agentboard = path.join(".agentboard").exists();
    let mut pipeline_count = 0;
    let mut node_count = 0;
    let mut error = None;
    if exists {
        let pipelines = load_pipelines(&path);
        pipeline_count = pipelines.pipelines.len();
        node_count = pipelines
            .pipelines
            .iter()
            .map(|pipeline| pipeline.nodes.len())
            .sum();
    } else {
        error = Some("Workspace path no longer exists.".to_string());
    }
    Ok(WorkspaceSummary {
        id: config.id.clone(),
        name: config.name.clone(),
        path: config.path.clone(),
        exists,
        has_agentboard,
        pipeline_count,
        node_count,
        last_opened: Some(config.updated_at.clone()),
        error,
    })
}

fn initialize_workspace(path: &Path) -> Result<(), String> {
    let agentboard = path.join(".agentboard");
    fs::create_dir_all(agentboard.join("skills")).map_err(to_error)?;
    fs::create_dir_all(agentboard.join("logs")).map_err(to_error)?;
    fs::create_dir_all(agentboard.join("sessions")).map_err(to_error)?;
    fs::create_dir_all(agentboard.join("reviews")).map_err(to_error)?;
    let workspace_json = agentboard.join("workspace.json");
    if !workspace_json.exists() {
        let canonical = canonical_string(path)?;
        let now = now_iso();
        let config = WorkspaceConfig {
            id: stable_id(&canonical),
            name: path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("workspace")
                .to_string(),
            path: canonical,
            created_at: now.clone(),
            updated_at: now,
        };
        fs::write(workspace_json, pretty_json(&config)?).map_err(to_error)?;
    }
    let pipelines_json = agentboard.join("pipelines.json");
    if !pipelines_json.exists() {
        fs::write(pipelines_json, "{\n  \"pipelines\": []\n}\n").map_err(to_error)?;
    }
    Ok(())
}

fn load_pipelines(workspace: &Path) -> PipelinesDocument {
    let path = workspace.join(".agentboard").join("pipelines.json");
    let Ok(text) = fs::read_to_string(&path) else {
        return PipelinesDocument { pipelines: vec![] };
    };
    serde_json::from_str(&text).unwrap_or(PipelinesDocument { pipelines: vec![] })
}

const GITHUB_API_BASE: &str = "https://api.github.com";
const GITHUB_CACHE_TTL_SECONDS: u64 = 15 * 60;
const GITHUB_MAX_TEXT_FILE_BYTES: u64 = 256 * 1024;
const GITHUB_SEARCH_TERMS: [&str; 6] = [
    "agent skill",
    "SKILL.md",
    "claude skill",
    "codex skill",
    "ai agent skill",
    "developer skill",
];
const GITHUB_SKILL_PATHS: [&str; 9] = [
    "SKILL.md",
    "skill.json",
    "README.md",
    ".agentboard/skill.json",
    ".agentboard/SKILL.md",
    "skills/SKILL.md",
    "skills/skill.json",
    "agentboard/skill.json",
    "agentboard/SKILL.md",
];

fn github_marketplace_search_impl(
    state: &AppState,
    app_data: &Path,
    request: GithubMarketplaceSearchRequest,
) -> Result<GithubMarketplaceSearchResult, String> {
    let workspace = validate_marketplace_workspace(&request.workspace_path)?;
    let query = request.query.trim();
    if query.is_empty() {
        return Err("Enter a GitHub marketplace search query.".to_string());
    }
    let search_queries =
        build_github_search_queries(query, request.language.as_deref(), request.minimum_stars);
    let api_query = search_queries[0].clone();
    let cache_key = format!(
        "{}|{}|{}|{}|{}",
        normalized_cache_path(&workspace),
        api_query,
        request.sort,
        request.only_detected_skill_files,
        request.minimum_stars.unwrap_or_default()
    );
    let mut cache = read_github_marketplace_cache(app_data);
    if !request.force_refresh && cache_is_fresh(cache.updated_at.as_deref()) {
        if let Some(cached) = cache.searches.get(&cache_key) {
            let mut result = cached.clone();
            result.cached = true;
            mark_cached_previews(&mut result, &cache, &workspace);
            return Ok(result);
        }
    }
    let cached_result = if request.force_refresh {
        None
    } else {
        cache.searches.get(&cache_key).cloned()
    };

    let sort = match request.sort.as_str() {
        "stars" => Some("stars"),
        "updated" => Some("updated"),
        "best_match" | "" => None,
        other => return Err(format!("Unsupported GitHub sort option: {other}")),
    };
    let url = github_search_url(&api_query, sort)?;
    let (mut response, mut rate_limit) =
        match github_get_json::<GithubSearchApiResponse>(state, url.as_str(), "search") {
            Ok(value) => value,
            Err(error) if is_github_rate_limit_error(&error) => {
                if let Some(mut cached) = cached_result.clone() {
                    cached.cached = true;
                    mark_cached_previews(&mut cached, &cache, &workspace);
                    return Ok(cached);
                }
                return Err(error);
            }
            Err(error) => return Err(error),
        };
    let mut effective_api_query = api_query;
    if response.items.is_empty() {
        for fallback_query in search_queries.into_iter().skip(1) {
            let fallback_url = github_search_url(&fallback_query, sort)?;
            let (fallback, fallback_rate) = match github_get_json::<GithubSearchApiResponse>(
                state,
                fallback_url.as_str(),
                "search",
            ) {
                Ok(value) => value,
                Err(error) if is_github_rate_limit_error(&error) => {
                    if let Some(mut cached) = cached_result.clone() {
                        cached.cached = true;
                        mark_cached_previews(&mut cached, &cache, &workspace);
                        return Ok(cached);
                    }
                    return Err(error);
                }
                Err(error) => return Err(error),
            };
            rate_limit = fallback_rate;
            if !fallback.items.is_empty() {
                response = fallback;
                effective_api_query = fallback_query;
                break;
            }
        }
    }
    let installed = load_skills(&workspace);
    let mut items = Vec::new();
    for repo in response.items {
        let tree_url = github_api_url(&[
            "repos",
            &repo.owner.login,
            &repo.name,
            "git",
            "trees",
            &repo.default_branch,
        ])?;
        let tree_url = format!("{tree_url}?recursive=1");
        let tree_result = github_get_json::<GithubTreeApi>(state, &tree_url, "core");
        let (detected_files, tree_sha, detection_unavailable) = match tree_result {
            Ok((tree, tree_rate)) => {
                rate_limit = tree_rate;
                (detect_skill_paths(&tree.tree), Some(tree.sha), false)
            }
            Err(error) if is_github_rate_limit_error(&error) => (Vec::new(), None, true),
            Err(_) => (Vec::new(), None, false),
        };
        let status = if detection_unavailable {
            "detection_unavailable".to_string()
        } else {
            detected_skill_status(&detected_files)
        };
        if request.only_detected_skill_files && status == "no_skill_files" && !detection_unavailable
        {
            continue;
        }
        let installed_skill = installed.iter().find(|skill| {
            skill
                .repo_full_name
                .as_deref()
                .is_some_and(|value| value.eq_ignore_ascii_case(&repo.full_name))
        });
        let mut latest_commit_sha = tree_sha;
        let mut install_status = installed_skill
            .map(|skill| {
                if skill.trust_state == "disabled" {
                    "disabled".to_string()
                } else {
                    "installed".to_string()
                }
            })
            .unwrap_or_else(|| "not_installed".to_string());
        if let Some(skill) = installed_skill {
            let commit_url = github_api_url(&[
                "repos",
                &repo.owner.login,
                &repo.name,
                "commits",
                &repo.default_branch,
            ])?;
            if let Ok((commit, commit_rate)) =
                github_get_json::<GithubCommitApi>(state, &commit_url, "core")
            {
                rate_limit = commit_rate;
                latest_commit_sha = Some(commit.sha.clone());
                if skill.trust_state != "disabled" {
                    let installed_sha = read_github_skill_source(Path::new(&skill.path))
                        .map(|source| source.commit_sha)
                        .unwrap_or_default();
                    if installed_sha != commit.sha {
                        install_status = "update_available".to_string();
                    }
                }
            }
        }
        let (quality_score, quality_label) = skill_quality(
            &detected_files,
            repo.stargazers_count,
            repo.license.is_some(),
            &repo.topics,
        );
        let preview_cached = cache
            .previews
            .contains_key(&github_preview_cache_key(&workspace, &repo.full_name));
        items.push(GithubMarketplaceRepo {
            id: repo.id,
            full_name: repo.full_name,
            name: repo.name,
            owner: repo.owner.login,
            description: repo.description.unwrap_or_default(),
            html_url: repo.html_url,
            default_branch: repo.default_branch,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language,
            license: github_license_name(repo.license.as_ref()),
            updated_at: repo.updated_at,
            topics: repo.topics,
            detected_skill_status: status,
            detected_files,
            quality_score,
            quality_label,
            installed_skill_name: installed_skill.map(|skill| skill.name.clone()),
            install_status,
            latest_commit_sha,
            preview_cached,
        });
    }
    let result = GithubMarketplaceSearchResult {
        query: query.to_string(),
        api_query: effective_api_query,
        items,
        cached: false,
        fetched_at: now_iso(),
        rate_limit,
    };
    cache.searches.insert(cache_key, result.clone());
    cache.updated_at = Some(now_iso());
    write_github_marketplace_cache(app_data, &cache)?;
    Ok(result)
}

fn github_marketplace_preview_impl(
    state: &AppState,
    app_data: &Path,
    request: GithubMarketplacePreviewRequest,
) -> Result<GithubMarketplacePreview, String> {
    let workspace = validate_marketplace_workspace(&request.workspace_path)?;
    validate_repo_full_name(&request.repo_full_name)?;
    let cache_key = github_preview_cache_key(&workspace, &request.repo_full_name);
    let mut cache = read_github_marketplace_cache(app_data);
    if !request.force_refresh && cache_is_fresh(cache.updated_at.as_deref()) {
        if let Some(cached) = cache.previews.get(&cache_key) {
            let mut preview = cached.clone();
            preview.cached = true;
            return Ok(preview);
        }
    }
    let mut preview = match fetch_github_preview(state, &workspace, &request.repo_full_name) {
        Ok(preview) => preview,
        Err(error) if !request.force_refresh && is_github_rate_limit_error(&error) => {
            if let Some(cached) = cache.previews.get(&cache_key) {
                let mut preview = cached.clone();
                preview.cached = true;
                return Ok(preview);
            }
            return Err(error);
        }
        Err(error) => return Err(error),
    };
    preview.cached = false;
    cache.previews.insert(cache_key, preview.clone());
    cache.updated_at = Some(now_iso());
    write_github_marketplace_cache(app_data, &cache)?;
    Ok(preview)
}

fn github_marketplace_install_impl(
    state: &AppState,
    app_data: &Path,
    request: GithubMarketplaceInstallRequest,
) -> Result<GithubMarketplaceInstallResult, String> {
    let workspace = validate_marketplace_workspace(&request.workspace_path)?;
    let preview = github_marketplace_preview_impl(
        state,
        app_data,
        GithubMarketplacePreviewRequest {
            workspace_path: request.workspace_path.clone(),
            repo_full_name: request.repo_full_name.clone(),
            force_refresh: true,
        },
    )?;
    if !preview.formal_skill && !preview.readme_only {
        return Err(
            "This repository has no supported skill or README file to install.".to_string(),
        );
    }
    if preview.readme_only && !request.allow_readme_draft {
        return Err(
            "No formal skill file was found. Confirm Install README as skill draft first."
                .to_string(),
        );
    }
    let requested_name = request
        .install_name
        .as_deref()
        .unwrap_or(&preview.recommended_name);
    let mut safe_name = validate_safe_skill_name(requested_name)?;
    let skills_root = workspace.join(".agentboard").join("skills");
    fs::create_dir_all(&skills_root).map_err(to_error)?;
    let mut destination = skills_root.join(&safe_name);
    let mut backup_path = None;
    if destination.exists() {
        match request.duplicate_action.as_str() {
            "cancel" | "" => {
                return Ok(GithubMarketplaceInstallResult {
                    status: "conflict".to_string(),
                    skill: None,
                    path: None,
                    suggested_name: Some(unique_skill_name(&skills_root, &safe_name)),
                    backup_path: None,
                    message: format!(
                        "A skill folder named {safe_name} already exists. Choose overwrite, install as new name, or cancel."
                    ),
                });
            }
            "rename" => {
                safe_name = unique_skill_name(&skills_root, &safe_name);
                destination = skills_root.join(&safe_name);
            }
            "overwrite" => {
                let backup =
                    skills_root
                        .join(".backups")
                        .join(format!("{}-{}", safe_name, now_compact()));
                copy_dir_recursive(&destination, &backup)?;
                backup_path = Some(backup.to_string_lossy().to_string());
                fs::remove_dir_all(&destination).map_err(to_error)?;
            }
            other => return Err(format!("Unsupported duplicate action: {other}")),
        }
    }
    let fetched = fetched_skill_from_preview(&preview, request.allow_readme_draft)?;
    write_github_skill_install(
        &destination,
        &safe_name,
        &preview.repo,
        &fetched,
        "untrusted",
        None,
    )?;
    let skill = load_skill_directory(&destination)?;
    Ok(GithubMarketplaceInstallResult {
        status: "installed".to_string(),
        skill: Some(skill),
        path: Some(destination.to_string_lossy().to_string()),
        suggested_name: None,
        backup_path,
        message:
            "Skill installed as untrusted. Remote code was not executed; review before enabling."
                .to_string(),
    })
}

fn github_marketplace_update_impl(
    state: &AppState,
    app_data: &Path,
    request: GithubMarketplaceUpdateRequest,
) -> Result<GithubMarketplaceUpdateResult, String> {
    let workspace = validate_marketplace_workspace(&request.workspace_path)?;
    let skill_name = validate_safe_skill_name(&request.skill_name)?;
    let skill_dir = workspace
        .join(".agentboard")
        .join("skills")
        .join(&skill_name);
    let source = read_github_skill_source(&skill_dir)?;
    let preview = github_marketplace_preview_impl(
        state,
        app_data,
        GithubMarketplacePreviewRequest {
            workspace_path: request.workspace_path,
            repo_full_name: source.repo_full_name.clone(),
            force_refresh: true,
        },
    )?;
    let fetched = fetched_skill_from_preview(&preview, preview.readme_only)?;
    let manifest = normalize_github_manifest(
        fetched.skill_json.as_ref(),
        &skill_name,
        &preview.repo,
        source.trust_state == "trusted",
    )?;
    let manifest_text = pretty_json(&manifest)?;
    let markdown_text = format!("{}\n", fetched.markdown.trim_end());
    let mut changed_files = Vec::new();
    if fs::read_to_string(skill_dir.join("SKILL.md")).unwrap_or_default() != markdown_text {
        changed_files.push("SKILL.md".to_string());
    }
    if fs::read_to_string(skill_dir.join("skill.json")).unwrap_or_default() != manifest_text {
        changed_files.push("skill.json".to_string());
    }
    let latest_commit_sha = preview.repo.latest_commit_sha.clone().unwrap_or_default();
    if latest_commit_sha != source.commit_sha {
        changed_files.push("source.json".to_string());
    }
    changed_files.sort();
    changed_files.dedup();
    if changed_files.is_empty() {
        return Ok(GithubMarketplaceUpdateResult {
            status: "up_to_date".to_string(),
            changed_files,
            previous_commit_sha: source.commit_sha,
            latest_commit_sha,
            backup_path: None,
            skill: Some(load_skill_directory(&skill_dir)?),
            message: "Installed skill already matches the latest fetched content.".to_string(),
        });
    }
    if !request.confirm {
        return Ok(GithubMarketplaceUpdateResult {
            status: "confirmation_required".to_string(),
            changed_files,
            previous_commit_sha: source.commit_sha,
            latest_commit_sha,
            backup_path: None,
            skill: None,
            message: "Remote changes are available. Confirm before updating local files."
                .to_string(),
        });
    }
    let backup =
        apply_github_skill_update(&skill_dir, &skill_name, &preview.repo, &fetched, &source)?;
    Ok(GithubMarketplaceUpdateResult {
        status: "updated".to_string(),
        changed_files,
        previous_commit_sha: source.commit_sha,
        latest_commit_sha,
        backup_path: Some(backup.to_string_lossy().to_string()),
        skill: Some(load_skill_directory(&skill_dir)?),
        message: "Skill updated after creating a local backup.".to_string(),
    })
}

fn apply_github_skill_update(
    skill_dir: &Path,
    skill_name: &str,
    repo: &GithubMarketplaceRepo,
    fetched: &FetchedGithubSkill,
    source: &GithubSkillSource,
) -> Result<PathBuf, String> {
    let backup = skill_dir.join("backups").join(now_compact());
    fs::create_dir_all(&backup).map_err(to_error)?;
    for file in ["SKILL.md", "skill.json", "source.json"] {
        let source_file = skill_dir.join(file);
        if source_file.exists() {
            fs::copy(&source_file, backup.join(file)).map_err(to_error)?;
        }
    }
    write_github_skill_install(
        skill_dir,
        skill_name,
        repo,
        fetched,
        &source.trust_state,
        Some(source.installed_at.clone()),
    )?;
    Ok(backup)
}

fn github_marketplace_uninstall_impl(
    request: GithubMarketplaceSkillRequest,
) -> Result<GithubMarketplaceUninstallResult, String> {
    let workspace = validate_marketplace_workspace(&request.workspace_path)?;
    let skill_name = validate_safe_skill_name(&request.skill_name)?;
    let skills_root = workspace.join(".agentboard").join("skills");
    let skill_dir = skills_root.join(&skill_name);
    let _ = read_github_skill_source(&skill_dir)?;
    let trash = skills_root
        .join(".trash")
        .join(format!("{}-{}", skill_name, now_compact()));
    if let Some(parent) = trash.parent() {
        fs::create_dir_all(parent).map_err(to_error)?;
    }
    fs::rename(&skill_dir, &trash).map_err(to_error)?;
    Ok(GithubMarketplaceUninstallResult {
        skill_name,
        trash_path: trash.to_string_lossy().to_string(),
        message: "Skill moved to .agentboard/skills/.trash. No files were executed.".to_string(),
    })
}

fn github_marketplace_set_trust_impl(
    request: GithubMarketplaceTrustRequest,
) -> Result<SkillInfo, String> {
    let workspace = validate_marketplace_workspace(&request.workspace_path)?;
    let skill_name = validate_safe_skill_name(&request.skill_name)?;
    if !matches!(
        request.trust_state.as_str(),
        "untrusted" | "reviewed" | "trusted" | "disabled"
    ) {
        return Err("Trust state must be untrusted, reviewed, trusted, or disabled.".to_string());
    }
    let skill_dir = workspace
        .join(".agentboard")
        .join("skills")
        .join(&skill_name);
    let mut source = read_github_skill_source(&skill_dir)?;
    source.trust_state = request.trust_state.clone();
    source.trusted = request.trust_state == "trusted";
    source.updated_at = now_iso();
    write_json_atomic(&skill_dir.join("source.json"), &source)?;
    let manifest_path = skill_dir.join("skill.json");
    let mut manifest: SkillManifest =
        serde_json::from_str(&fs::read_to_string(&manifest_path).map_err(to_error)?)
            .map_err(to_error)?;
    manifest.trusted = source.trusted;
    write_json_atomic(&manifest_path, &manifest)?;
    load_skill_directory(&skill_dir)
}

fn github_marketplace_rate_limit_impl(state: &AppState) -> Result<GithubRateLimits, String> {
    let url = format!("{GITHUB_API_BASE}/rate_limit");
    let (response, _) = github_get_json::<GithubRateApiResponse>(state, &url, "core")?;
    Ok(GithubRateLimits {
        core: GithubRateLimit {
            limit: response.resources.core.limit,
            remaining: response.resources.core.remaining,
            reset_at: Some(response.resources.core.reset.to_string()),
            resource: "core".to_string(),
        },
        search: GithubRateLimit {
            limit: response.resources.search.limit,
            remaining: response.resources.search.remaining,
            reset_at: Some(response.resources.search.reset.to_string()),
            resource: "search".to_string(),
        },
    })
}

fn fetch_github_preview(
    state: &AppState,
    workspace: &Path,
    repo_full_name: &str,
) -> Result<GithubMarketplacePreview, String> {
    let (owner, repo_name) = split_repo_full_name(repo_full_name)?;
    let repo_url = github_api_url(&["repos", owner, repo_name])?;
    let (repo, _) = github_get_json::<GithubRepoApi>(state, &repo_url, "core")?;
    let commit_url = github_api_url(&["repos", owner, repo_name, "commits", &repo.default_branch])?;
    let (commit, _) = github_get_json::<GithubCommitApi>(state, &commit_url, "core")?;
    let tree_url = github_api_url(&[
        "repos",
        owner,
        repo_name,
        "git",
        "trees",
        &repo.default_branch,
    ])?;
    let (tree, mut rate_limit) =
        github_get_json::<GithubTreeApi>(state, &format!("{tree_url}?recursive=1"), "core")?;
    let detected_files = detect_skill_paths(&tree.tree);
    let selected_paths = selected_preview_paths(&detected_files);
    let mut files = Vec::new();
    for path in selected_paths {
        let item = tree
            .tree
            .iter()
            .find(|item| item.path.eq_ignore_ascii_case(&path))
            .ok_or_else(|| format!("GitHub tree entry disappeared for {path}"))?;
        let size = item.size.unwrap_or_default();
        if size > GITHUB_MAX_TEXT_FILE_BYTES {
            return Err(format!(
                "GitHub file {path} is too large to preview safely ({size} bytes; limit is {GITHUB_MAX_TEXT_FILE_BYTES})."
            ));
        }
        let content_url = github_contents_url(owner, repo_name, &item.path, &commit.sha)?;
        let (content, content_rate) = github_get_text(
            state,
            &content_url,
            "application/vnd.github.raw+json",
            "core",
        )?;
        rate_limit = content_rate;
        if content.len() as u64 > GITHUB_MAX_TEXT_FILE_BYTES {
            return Err(format!(
                "GitHub file {} exceeds the safe preview limit.",
                item.path
            ));
        }
        files.push(GithubMarketplaceFile {
            path: item.path.clone(),
            kind: github_file_kind(&item.path).to_string(),
            content,
            size,
            sha: item.sha.clone(),
        });
    }
    let formal_skill = files.iter().any(|file| file.kind == "skill_markdown");
    let readme_only = !formal_skill && files.iter().any(|file| file.kind == "readme");
    let installed = load_skills(workspace);
    let installed_skill = installed.iter().find(|skill| {
        skill
            .repo_full_name
            .as_deref()
            .is_some_and(|value| value.eq_ignore_ascii_case(&repo.full_name))
    });
    let (quality_score, quality_label) = skill_quality(
        &detected_files,
        repo.stargazers_count,
        repo.license.is_some(),
        &repo.topics,
    );
    let license = github_license_name(repo.license.as_ref());
    let repo_info = GithubMarketplaceRepo {
        id: repo.id,
        full_name: repo.full_name,
        name: repo.name.clone(),
        owner: repo.owner.login,
        description: repo.description.unwrap_or_default(),
        html_url: repo.html_url,
        default_branch: repo.default_branch,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        language: repo.language,
        license,
        updated_at: repo.updated_at,
        topics: repo.topics,
        detected_skill_status: detected_skill_status(&detected_files),
        detected_files,
        quality_score,
        quality_label,
        installed_skill_name: installed_skill.map(|skill| skill.name.clone()),
        install_status: installed_skill
            .map(|skill| {
                if skill.trust_state == "disabled" {
                    "disabled".to_string()
                } else {
                    let current_sha = read_github_skill_source(Path::new(&skill.path))
                        .map(|source| source.commit_sha)
                        .unwrap_or_default();
                    if current_sha != commit.sha {
                        "update_available".to_string()
                    } else {
                        "installed".to_string()
                    }
                }
            })
            .unwrap_or_else(|| "not_installed".to_string()),
        latest_commit_sha: Some(commit.sha),
        preview_cached: false,
    };
    let warning = if formal_skill {
        None
    } else if readme_only {
        Some(
            "No formal skill file. Installation requires confirming README as a skill draft."
                .to_string(),
        )
    } else {
        Some("No supported skill files were detected.".to_string())
    };
    Ok(GithubMarketplacePreview {
        repo: repo_info,
        files,
        formal_skill,
        readme_only,
        installable: formal_skill || readme_only,
        recommended_name: validate_safe_skill_name(&sanitize_slug(&repo_name))
            .unwrap_or_else(|_| "github-skill".to_string()),
        warning,
        cached: false,
        rate_limit,
    })
}

struct FetchedGithubSkill {
    markdown: String,
    markdown_path: String,
    skill_json: Option<Value>,
    skill_json_path: Option<String>,
}

fn fetched_skill_from_preview(
    preview: &GithubMarketplacePreview,
    allow_readme_draft: bool,
) -> Result<FetchedGithubSkill, String> {
    let markdown = preview
        .files
        .iter()
        .find(|file| file.kind == "skill_markdown")
        .or_else(|| {
            if allow_readme_draft {
                preview.files.iter().find(|file| file.kind == "readme")
            } else {
                None
            }
        })
        .ok_or_else(|| {
            "No formal skill file was found. Confirm README draft installation first.".to_string()
        })?;
    let skill_json_file = preview.files.iter().find(|file| file.kind == "skill_json");
    let skill_json = skill_json_file
        .map(|file| serde_json::from_str::<Value>(&file.content).map_err(to_error))
        .transpose()?;
    if let Some(value) = &skill_json {
        if !value.is_object() {
            return Err("Remote skill.json must contain a JSON object.".to_string());
        }
    }
    Ok(FetchedGithubSkill {
        markdown: markdown.content.clone(),
        markdown_path: markdown.path.clone(),
        skill_json,
        skill_json_path: skill_json_file.map(|file| file.path.clone()),
    })
}

fn write_github_skill_install(
    destination: &Path,
    skill_name: &str,
    repo: &GithubMarketplaceRepo,
    fetched: &FetchedGithubSkill,
    trust_state: &str,
    installed_at: Option<String>,
) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(to_error)?;
    let manifest = normalize_github_manifest(
        fetched.skill_json.as_ref(),
        skill_name,
        repo,
        trust_state == "trusted",
    )?;
    let installed_at = installed_at.unwrap_or_else(now_iso);
    let mut fetched_files = vec![fetched.markdown_path.clone()];
    if let Some(path) = &fetched.skill_json_path {
        fetched_files.push(path.clone());
    }
    let source = GithubSkillSource {
        source: "github".to_string(),
        repo_full_name: repo.full_name.clone(),
        repo_url: repo.html_url.clone(),
        default_branch: repo.default_branch.clone(),
        commit_sha: repo.latest_commit_sha.clone().unwrap_or_default(),
        installed_at,
        updated_at: now_iso(),
        stars_at_install: repo.stars,
        forks_at_install: repo.forks,
        license: repo.license.clone(),
        fetched_files,
        trusted: trust_state == "trusted",
        trust_state: trust_state.to_string(),
        warning: "Imported GitHub skill. Remote code was not executed.".to_string(),
        original_skill_json: fetched.skill_json.clone(),
    };
    fs::write(
        destination.join("SKILL.md"),
        format!("{}\n", fetched.markdown.trim_end()),
    )
    .map_err(to_error)?;
    write_json_atomic(&destination.join("skill.json"), &manifest)?;
    write_json_atomic(&destination.join("source.json"), &source)?;
    Ok(())
}

fn normalize_github_manifest(
    original: Option<&Value>,
    skill_name: &str,
    repo: &GithubMarketplaceRepo,
    trusted: bool,
) -> Result<SkillManifest, String> {
    let object = original.and_then(Value::as_object);
    let string_value = |key: &str| {
        object
            .and_then(|value| value.get(key))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string)
    };
    let string_array = |keys: &[&str]| {
        keys.iter()
            .find_map(|key| object.and_then(|value| value.get(*key)))
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(ToString::to_string)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default()
    };
    let mut compatible_agents = string_array(&["compatible_agents", "compatibleAgents"]);
    compatible_agents.retain(|agent| {
        matches!(
            agent.as_str(),
            "codex" | "claude" | "gemini" | "aider" | "powershell" | "cmd"
        )
    });
    if compatible_agents.is_empty() {
        compatible_agents = vec![
            "codex".to_string(),
            "claude".to_string(),
            "gemini".to_string(),
            "aider".to_string(),
        ];
    }
    let mut categories = string_array(&["categories"]);
    if !categories.iter().any(|category| category == "github") {
        categories.push("github".to_string());
    }
    if !categories.iter().any(|category| category == "imported") {
        categories.push("imported".to_string());
    }
    Ok(SkillManifest {
        name: validate_safe_skill_name(skill_name)?,
        title: string_value("title").unwrap_or_else(|| repo.name.clone()),
        description: string_value("description").unwrap_or_else(|| repo.description.clone()),
        categories,
        compatible_agents,
        version: string_value("version").unwrap_or_else(|| "0.1.0".to_string()),
        source: "github".to_string(),
        trusted,
        permissions: SkillPermissions {
            filesystem: "read".to_string(),
            shell: false,
            network: false,
        },
    })
}

fn github_get_json<T: for<'de> Deserialize<'de>>(
    state: &AppState,
    url: &str,
    resource: &str,
) -> Result<(T, GithubRateLimit), String> {
    let response = github_request(state, url, "application/vnd.github+json")?;
    let rate_limit = github_rate_from_headers(response.headers(), resource);
    let status = response.status();
    if !status.is_success() {
        let body = response.text().unwrap_or_default();
        return Err(github_http_error(status.as_u16(), &body, &rate_limit));
    }
    let value = response.json::<T>().map_err(to_error)?;
    Ok((value, rate_limit))
}

fn github_get_text(
    state: &AppState,
    url: &str,
    accept: &str,
    resource: &str,
) -> Result<(String, GithubRateLimit), String> {
    let response = github_request(state, url, accept)?;
    let rate_limit = github_rate_from_headers(response.headers(), resource);
    let status = response.status();
    if !status.is_success() {
        let body = response.text().unwrap_or_default();
        return Err(github_http_error(status.as_u16(), &body, &rate_limit));
    }
    let text = response.text().map_err(to_error)?;
    Ok((text, rate_limit))
}

fn github_request(
    state: &AppState,
    url: &str,
    accept: &str,
) -> Result<reqwest::blocking::Response, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(to_error)?;
    let token = state
        .github_token
        .lock()
        .map_err(|_| "GitHub token state lock poisoned".to_string())?
        .clone();
    let mut request = client
        .get(url)
        .header("User-Agent", "AgentBoard/0.1.0-alpha")
        .header("Accept", accept)
        .header("X-GitHub-Api-Version", "2022-11-28");
    if let Some(token) = token {
        request = request.bearer_auth(token);
    }
    request.send().map_err(|error| {
        if error.is_timeout() {
            "GitHub request timed out. Check the internet connection and try again.".to_string()
        } else if error.is_connect() {
            "Could not connect to GitHub. Check the internet connection and firewall.".to_string()
        } else {
            format!("GitHub request failed: {error}")
        }
    })
}

fn github_http_error(status: u16, body: &str, rate_limit: &GithubRateLimit) -> String {
    let message = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|value| {
            value
                .get("message")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .unwrap_or_else(|| body.trim().chars().take(240).collect());
    match status {
        401 => "GitHub rejected the token. Clear it or enter a valid personal access token."
            .to_string(),
        403 if rate_limit.remaining == 0 => format!(
            "GitHub {} API limit reached. Add a GitHub token or {}.",
            rate_limit.resource,
            github_retry_text(rate_limit.reset_at.as_deref())
        ),
        429 => format!(
            "GitHub {} API limit reached. Add a GitHub token or {}.",
            rate_limit.resource,
            github_retry_text(rate_limit.reset_at.as_deref())
        ),
        404 => "GitHub repository or requested file was not found.".to_string(),
        422 => format!("GitHub rejected the search query: {message}"),
        _ => format!("GitHub API returned HTTP {status}: {message}"),
    }
}

fn github_retry_text(reset_at: Option<&str>) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    github_retry_text_at(reset_at, now)
}

fn github_retry_text_at(reset_at: Option<&str>, now: u64) -> String {
    let Some(reset) = reset_at.and_then(|value| value.parse::<u64>().ok()) else {
        return "try again after the GitHub limit resets".to_string();
    };
    if reset <= now {
        return "try again now".to_string();
    }
    let minutes = reset.saturating_sub(now).div_ceil(60);
    if minutes == 1 {
        "try again in 1 minute".to_string()
    } else {
        format!("try again in {minutes} minutes")
    }
}

fn is_github_rate_limit_error(error: &str) -> bool {
    error.to_ascii_lowercase().contains("api limit reached")
        || error.to_ascii_lowercase().contains("rate limit")
}

fn github_rate_from_headers(
    headers: &reqwest::header::HeaderMap,
    resource: &str,
) -> GithubRateLimit {
    let parse = |name: &'static str| {
        headers
            .get(name)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or_default()
    };
    GithubRateLimit {
        limit: parse("x-ratelimit-limit"),
        remaining: parse("x-ratelimit-remaining"),
        reset_at: headers
            .get("x-ratelimit-reset")
            .and_then(|value| value.to_str().ok())
            .map(ToString::to_string),
        resource: headers
            .get("x-ratelimit-resource")
            .and_then(|value| value.to_str().ok())
            .unwrap_or(resource)
            .to_string(),
    }
}

fn build_github_search_queries(
    query: &str,
    language: Option<&str>,
    minimum_stars: Option<u64>,
) -> Vec<String> {
    let lower = query.to_ascii_lowercase();
    let primary_term = if GITHUB_SEARCH_TERMS
        .iter()
        .any(|term| lower.contains(&term.to_ascii_lowercase()))
    {
        None
    } else {
        Some(GITHUB_SEARCH_TERMS[0])
    };
    let mut queries = vec![build_github_search_query_variant(
        query,
        primary_term,
        language,
        minimum_stars,
    )];
    for term in GITHUB_SEARCH_TERMS {
        if lower.contains(&term.to_ascii_lowercase()) {
            continue;
        }
        let fallback =
            build_github_search_query_variant(query, Some(term), language, minimum_stars);
        if !queries.contains(&fallback) {
            queries.push(fallback);
        }
    }
    queries
}

fn build_github_search_query_variant(
    query: &str,
    skill_term: Option<&str>,
    language: Option<&str>,
    minimum_stars: Option<u64>,
) -> String {
    let mut parts = vec![query.trim().to_string()];
    if let Some(skill_term) = skill_term {
        parts.push(format!("\"{skill_term}\""));
    }
    parts.push("in:name,description,readme".to_string());
    if let Some(language) = language.map(str::trim).filter(|value| !value.is_empty()) {
        parts.push(format!("language:{}", sanitize_github_qualifier(language)));
    }
    if let Some(stars) = minimum_stars.filter(|value| *value > 0) {
        parts.push(format!("stars:>={stars}"));
    }
    parts.join(" ")
}

fn github_search_url(query: &str, sort: Option<&str>) -> Result<reqwest::Url, String> {
    let mut params = vec![("q", query.to_string()), ("per_page", "12".to_string())];
    if let Some(sort) = sort {
        params.push(("sort", sort.to_string()));
        params.push(("order", "desc".to_string()));
    }
    reqwest::Url::parse_with_params(&format!("{GITHUB_API_BASE}/search/repositories"), params)
        .map_err(to_error)
}

fn detect_skill_paths(tree: &[GithubTreeItemApi]) -> Vec<String> {
    let mut detected = Vec::new();
    for expected in GITHUB_SKILL_PATHS {
        if let Some(item) = tree
            .iter()
            .find(|item| item.item_type == "blob" && item.path.eq_ignore_ascii_case(expected))
        {
            detected.push(item.path.clone());
        }
    }
    detected
}

fn selected_preview_paths(detected: &[String]) -> Vec<String> {
    let mut selected = Vec::new();
    if let Some(path) = GITHUB_SKILL_PATHS.iter().find_map(|expected| {
        detected
            .iter()
            .find(|path| {
                path.eq_ignore_ascii_case(expected) && github_file_kind(path) == "skill_markdown"
            })
            .cloned()
    }) {
        selected.push(path);
    }
    if let Some(path) = GITHUB_SKILL_PATHS.iter().find_map(|expected| {
        detected
            .iter()
            .find(|path| {
                path.eq_ignore_ascii_case(expected) && github_file_kind(path) == "skill_json"
            })
            .cloned()
    }) {
        selected.push(path);
    }
    if selected
        .iter()
        .all(|path| github_file_kind(path) != "skill_markdown")
    {
        if let Some(readme) = detected
            .iter()
            .find(|path| github_file_kind(path) == "readme")
        {
            selected.push(readme.clone());
        }
    }
    selected
}

fn detected_skill_status(files: &[String]) -> String {
    if files
        .iter()
        .any(|path| github_file_kind(path) == "skill_markdown")
    {
        "formal_skill".to_string()
    } else if files.iter().any(|path| github_file_kind(path) == "readme") {
        "readme_only".to_string()
    } else {
        "no_skill_files".to_string()
    }
}

fn github_file_kind(path: &str) -> &'static str {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with("skill.md") {
        "skill_markdown"
    } else if lower.ends_with("skill.json") {
        "skill_json"
    } else if lower.ends_with("readme.md") {
        "readme"
    } else {
        "other"
    }
}

fn skill_quality(
    files: &[String],
    stars: u64,
    has_license: bool,
    topics: &[String],
) -> (u8, String) {
    let mut score = 0u8;
    if files
        .iter()
        .any(|path| github_file_kind(path) == "skill_markdown")
    {
        score += 45;
    }
    if files
        .iter()
        .any(|path| github_file_kind(path) == "skill_json")
    {
        score += 20;
    }
    if files.iter().any(|path| github_file_kind(path) == "readme") {
        score += 10;
    }
    if stars >= 100 {
        score += 10;
    } else if stars >= 10 {
        score += 5;
    }
    if has_license {
        score += 5;
    }
    if topics.iter().any(|topic| {
        let topic = topic.to_ascii_lowercase();
        topic.contains("agent") || topic.contains("skill")
    }) {
        score += 10;
    }
    let label = if score >= 75 {
        "high"
    } else if score >= 45 {
        "medium"
    } else {
        "low"
    };
    (score.min(100), label.to_string())
}

fn github_api_url(segments: &[&str]) -> Result<String, String> {
    let mut url = reqwest::Url::parse(GITHUB_API_BASE).map_err(to_error)?;
    {
        let mut path = url
            .path_segments_mut()
            .map_err(|_| "Could not construct GitHub API URL.".to_string())?;
        path.pop_if_empty();
        for segment in segments {
            path.push(segment);
        }
    }
    Ok(url.to_string())
}

fn github_contents_url(
    owner: &str,
    repo: &str,
    path: &str,
    reference: &str,
) -> Result<String, String> {
    let mut segments = vec!["repos", owner, repo, "contents"];
    let path_segments = path.split('/').collect::<Vec<_>>();
    segments.extend(path_segments);
    let mut url = reqwest::Url::parse(&github_api_url(&segments)?).map_err(to_error)?;
    url.query_pairs_mut().append_pair("ref", reference);
    Ok(url.to_string())
}

fn split_repo_full_name(value: &str) -> Result<(&str, &str), String> {
    validate_repo_full_name(value)?;
    value
        .split_once('/')
        .ok_or_else(|| "GitHub repository must use owner/name format.".to_string())
}

fn validate_repo_full_name(value: &str) -> Result<(), String> {
    let parts = value.split('/').collect::<Vec<_>>();
    if parts.len() != 2
        || parts.iter().any(|part| {
            part.is_empty()
                || part.len() > 100
                || !part
                    .chars()
                    .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
        })
    {
        return Err("Unsafe GitHub repository name. Expected owner/name.".to_string());
    }
    Ok(())
}

fn validate_marketplace_workspace(value: &str) -> Result<PathBuf, String> {
    let workspace = PathBuf::from(value);
    if !workspace.exists() || !workspace.is_dir() {
        return Err("Select an existing workspace before using the marketplace.".to_string());
    }
    let canonical = workspace.canonicalize().map_err(to_error)?;
    let agentboard = canonical.join(".agentboard");
    if !agentboard.exists() {
        return Err(
            "The selected folder is not initialized as an AgentBoard workspace.".to_string(),
        );
    }
    Ok(canonical)
}

fn validate_safe_skill_name(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty()
        || value.len() > 80
        || value == "."
        || value == ".."
        || value.ends_with('.')
        || value.ends_with(' ')
        || !value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
    {
        return Err(
            "Unsafe skill name. Use 1-80 ASCII letters, numbers, hyphens, or underscores."
                .to_string(),
        );
    }
    let reserved = [
        "con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8",
        "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
    ];
    if reserved.iter().any(|name| value.eq_ignore_ascii_case(name)) {
        return Err("That skill name is reserved on Windows.".to_string());
    }
    Ok(value.to_string())
}

fn unique_skill_name(root: &Path, base: &str) -> String {
    for index in 2..1000 {
        let candidate = format!("{base}-{index}");
        if !root.join(&candidate).exists() {
            return candidate;
        }
    }
    format!("{base}-{}", now_compact())
}

fn read_github_skill_source(skill_dir: &Path) -> Result<GithubSkillSource, String> {
    let path = skill_dir.join("source.json");
    let text = fs::read_to_string(&path)
        .map_err(|_| "This action is available only for installed GitHub skills.".to_string())?;
    let source: GithubSkillSource = serde_json::from_str(&text).map_err(to_error)?;
    if source.source != "github" {
        return Err("This action is available only for installed GitHub skills.".to_string());
    }
    Ok(source)
}

fn load_skill_directory(path: &Path) -> Result<SkillInfo, String> {
    let manifest: SkillManifest =
        serde_json::from_str(&fs::read_to_string(path.join("skill.json")).map_err(to_error)?)
            .map_err(to_error)?;
    let markdown = fs::read_to_string(path.join("SKILL.md")).map_err(to_error)?;
    let source = if manifest.source == "github" {
        Some(read_github_skill_source(path)?)
    } else {
        fs::read_to_string(path.join("source.json"))
            .ok()
            .and_then(|text| serde_json::from_str::<GithubSkillSource>(&text).ok())
    };
    let trust_state = source
        .as_ref()
        .map(|source| source.trust_state.clone())
        .unwrap_or_else(|| "local".to_string());
    Ok(SkillInfo {
        name: manifest.name.clone(),
        title: manifest.title.clone(),
        description: manifest.description.clone(),
        path: path.to_string_lossy().to_string(),
        manifest,
        markdown,
        enabled: matches!(trust_state.as_str(), "local" | "reviewed" | "trusted"),
        error: None,
        trust_state,
        repo_full_name: source.as_ref().map(|source| source.repo_full_name.clone()),
        source_url: source.as_ref().map(|source| source.repo_url.clone()),
    })
}

fn read_github_marketplace_cache(app_data: &Path) -> GithubMarketplaceCache {
    let path = app_data.join("github-marketplace-cache.json");
    fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn github_preview_cache_key(workspace: &Path, repo_full_name: &str) -> String {
    format!(
        "{}|{}",
        normalized_cache_path(workspace),
        repo_full_name.to_ascii_lowercase()
    )
}

fn mark_cached_previews(
    result: &mut GithubMarketplaceSearchResult,
    cache: &GithubMarketplaceCache,
    workspace: &Path,
) {
    for repo in &mut result.items {
        repo.preview_cached = cache
            .previews
            .contains_key(&github_preview_cache_key(workspace, &repo.full_name));
    }
}

fn write_github_marketplace_cache(
    app_data: &Path,
    cache: &GithubMarketplaceCache,
) -> Result<(), String> {
    fs::create_dir_all(app_data).map_err(to_error)?;
    write_json_atomic(&app_data.join("github-marketplace-cache.json"), cache)
}

fn cache_is_fresh(updated_at: Option<&str>) -> bool {
    let Some(updated_at) = updated_at.and_then(|value| value.parse::<u64>().ok()) else {
        return false;
    };
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    now.saturating_sub(updated_at) <= GITHUB_CACHE_TTL_SECONDS
}

fn normalized_cache_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "/")
        .to_ascii_lowercase()
}

fn github_license_name(license: Option<&GithubLicenseApi>) -> Option<String> {
    license.and_then(|license| {
        license
            .spdx_id
            .as_ref()
            .filter(|value| value.as_str() != "NOASSERTION")
            .cloned()
            .or_else(|| license.name.clone())
    })
}

fn sanitize_github_qualifier(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '+' | '#' | '-' | '.'))
        .collect()
}

fn copy_dir_recursive(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(to_error)?;
    for entry in fs::read_dir(source).map_err(to_error)? {
        let entry = entry.map_err(to_error)?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        if source_path.is_dir() {
            copy_dir_recursive(&source_path, &destination_path)?;
        } else {
            fs::copy(&source_path, &destination_path).map_err(to_error)?;
        }
    }
    Ok(())
}

fn load_skills(workspace: &Path) -> Vec<SkillInfo> {
    let skills_root = workspace.join(".agentboard").join("skills");
    let mut skills = Vec::new();
    let Ok(entries) = fs::read_dir(&skills_root) else {
        return skills;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let skill_json = path.join("skill.json");
        let skill_md = path.join("SKILL.md");
        let markdown = fs::read_to_string(&skill_md).unwrap_or_default();
        let fallback_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("skill")
            .to_string();
        if fallback_name.starts_with('.') {
            continue;
        }
        match fs::read_to_string(&skill_json)
            .map_err(|error| error.to_string())
            .and_then(|text| {
                serde_json::from_str::<SkillManifest>(&text).map_err(|error| error.to_string())
            }) {
            Ok(manifest) => {
                let source_result = fs::read_to_string(path.join("source.json"))
                    .map_err(to_error)
                    .and_then(|text| {
                        serde_json::from_str::<GithubSkillSource>(&text).map_err(to_error)
                    });
                let (source, source_error) = match source_result {
                    Ok(source) => {
                        if manifest.source == "github" && source.source != "github" {
                            (
                                None,
                                Some("Missing valid GitHub source metadata.".to_string()),
                            )
                        } else {
                            (Some(source), None)
                        }
                    }
                    Err(error) => {
                        if manifest.source == "github" {
                            (None, Some(error))
                        } else {
                            (None, None)
                        }
                    }
                };
                let trust_state = if manifest.source == "github" {
                    source
                        .as_ref()
                        .map(|source| source.trust_state.clone())
                        .unwrap_or_else(|| "untrusted".to_string())
                } else {
                    "local".to_string()
                };
                skills.push(SkillInfo {
                    name: manifest.name.clone(),
                    title: manifest.title.clone(),
                    description: manifest.description.clone(),
                    path: path.to_string_lossy().to_string(),
                    manifest,
                    markdown,
                    enabled: source_error.is_none()
                        && matches!(trust_state.as_str(), "local" | "reviewed" | "trusted"),
                    error: source_error,
                    trust_state,
                    repo_full_name: source.as_ref().map(|source| source.repo_full_name.clone()),
                    source_url: source.as_ref().map(|source| source.repo_url.clone()),
                })
            }
            Err(error) => {
                let manifest = SkillManifest {
                    name: fallback_name.clone(),
                    title: fallback_name.clone(),
                    description: "Invalid local skill manifest.".to_string(),
                    categories: vec!["invalid".to_string()],
                    compatible_agents: vec![],
                    version: "0.0.0".to_string(),
                    source: "local".to_string(),
                    trusted: false,
                    permissions: SkillPermissions {
                        filesystem: "read".to_string(),
                        shell: false,
                        network: false,
                    },
                };
                skills.push(SkillInfo {
                    name: fallback_name.clone(),
                    title: fallback_name,
                    description: "Invalid local skill manifest.".to_string(),
                    path: path.to_string_lossy().to_string(),
                    manifest,
                    markdown,
                    enabled: false,
                    error: Some(error),
                    trust_state: "invalid".to_string(),
                    repo_full_name: None,
                    source_url: None,
                });
            }
        }
    }
    skills.sort_by(|a, b| a.title.cmp(&b.title));
    skills
}

fn scan_dir(base: &Path, dir: &Path, issues: &mut Vec<RealityIssue>) -> Result<(), String> {
    if should_skip_dir(dir) {
        return Ok(());
    }
    let entries = fs::read_dir(dir).map_err(to_error)?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_dir(base, &path, issues)?;
        } else if is_probably_text(&path) {
            scan_file(base, &path, issues);
        }
    }
    Ok(())
}

fn scan_file(base: &Path, path: &Path, issues: &mut Vec<RealityIssue>) {
    let Ok(metadata) = fs::metadata(path) else {
        return;
    };
    if metadata.len() > 1_500_000 {
        return;
    }
    let Ok(content) = fs::read_to_string(path) else {
        return;
    };
    let relative = path
        .strip_prefix(base)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/");
    for (index, line) in content.lines().enumerate() {
        let line_number = index + 1;
        let lower = line.to_lowercase();
        let trimmed = line.trim();
        for (pattern, severity) in [
            ("mock", "medium"),
            ("fake", "high"),
            ("dummy", "medium"),
            ("placeholder", "medium"),
            ("todo", "low"),
            ("fixme", "medium"),
            ("stub", "medium"),
            ("demo only", "high"),
            ("coming soon", "medium"),
            ("notimplementederror", "high"),
            ("throw new error(\"not implemented\")", "high"),
            ("throw new error('not implemented')", "high"),
            ("skipped", "medium"),
            ("hardcoded fake", "high"),
            ("fakedata", "high"),
        ] {
            if lower.contains(pattern) {
                issues.push(RealityIssue {
                    file: relative.clone(),
                    line: line_number,
                    pattern: pattern.to_string(),
                    severity: severity.to_string(),
                    snippet: trimmed.chars().take(180).collect(),
                });
            }
        }
        if trimmed == "pass" {
            issues.push(RealityIssue {
                file: relative.clone(),
                line: line_number,
                pattern: "pass".to_string(),
                severity: "medium".to_string(),
                snippet: trimmed.to_string(),
            });
        }
        if let Some(import_path) = extract_relative_import(line) {
            if !relative_import_exists(path.parent().unwrap_or(base), &import_path) {
                issues.push(RealityIssue {
                    file: relative.clone(),
                    line: line_number,
                    pattern: "broken relative import".to_string(),
                    severity: "high".to_string(),
                    snippet: trimmed.chars().take(180).collect(),
                });
            }
        }
    }
}

fn should_skip_dir(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| {
            matches!(
                name,
                ".git"
                    | "node_modules"
                    | ".next"
                    | "dist"
                    | "build"
                    | "target"
                    | ".agentboard-worktrees"
            ) || path.ends_with(Path::new(".agentboard").join("logs"))
        })
        .unwrap_or(false)
}

fn is_probably_text(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            matches!(
                ext.to_ascii_lowercase().as_str(),
                "ts" | "tsx"
                    | "js"
                    | "jsx"
                    | "json"
                    | "rs"
                    | "py"
                    | "md"
                    | "css"
                    | "scss"
                    | "html"
                    | "toml"
                    | "yml"
                    | "yaml"
                    | "txt"
                    | "sql"
                    | "sh"
                    | "ps1"
                    | "bat"
            )
        })
        .unwrap_or(false)
}

fn extract_relative_import(line: &str) -> Option<String> {
    for marker in [
        "from \"",
        "from '",
        "require(\"",
        "require('",
        "import(\"",
        "import('",
    ] {
        if let Some(start) = line.find(marker) {
            let quote = marker.chars().last()?;
            let rest = &line[start + marker.len()..];
            if let Some(end) = rest.find(quote) {
                let value = &rest[..end];
                if value.starts_with("./") || value.starts_with("../") {
                    return Some(value.to_string());
                }
            }
        }
    }
    None
}

fn relative_import_exists(parent: &Path, import_path: &str) -> bool {
    let target = parent.join(import_path);
    if target.exists() {
        return true;
    }
    for ext in ["ts", "tsx", "js", "jsx", "json", "css"] {
        if target.with_extension(ext).exists() {
            return true;
        }
    }
    for ext in ["ts", "tsx", "js", "jsx"] {
        if target.join(format!("index.{ext}")).exists() {
            return true;
        }
    }
    false
}

fn safe_workspace_join(base: &Path, relative: &str) -> Result<PathBuf, String> {
    let base = base.canonicalize().map_err(to_error)?;
    let rel = Path::new(relative);
    if rel.is_absolute() {
        return Err("Only workspace-relative file paths are allowed.".to_string());
    }
    if rel
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("Parent directory segments are not allowed in file paths.".to_string());
    }
    Ok(base.join(rel))
}

fn command_exists(command: &str) -> bool {
    resolve_command(command).is_some()
}

fn resolve_command(command: &str) -> Option<PathBuf> {
    let requested = Path::new(command);
    if requested.components().count() > 1 {
        return requested.is_file().then(|| requested.to_path_buf());
    }

    #[cfg(windows)]
    {
        if command.eq_ignore_ascii_case("cmd") {
            return env::var_os("COMSPEC").map(PathBuf::from);
        }
        let extensions = env::var_os("PATHEXT")
            .map(|value| {
                value
                    .to_string_lossy()
                    .split(';')
                    .filter(|extension| !extension.is_empty())
                    .map(|extension| extension.to_ascii_lowercase())
                    .collect::<Vec<_>>()
            })
            .filter(|extensions| !extensions.is_empty())
            .unwrap_or_else(|| {
                vec![
                    ".com".to_string(),
                    ".exe".to_string(),
                    ".bat".to_string(),
                    ".cmd".to_string(),
                ]
            });
        for directory in env::split_paths(&env::var_os("PATH")?) {
            if requested.extension().is_some() {
                let candidate = directory.join(command);
                if candidate.is_file() {
                    return Some(candidate);
                }
                continue;
            }
            for extension in &extensions {
                let candidate = directory.join(format!("{command}{extension}"));
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
        None
    }

    #[cfg(not(windows))]
    {
        for directory in env::split_paths(&env::var_os("PATH")?) {
            let candidate = directory.join(command);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
        None
    }
}

fn command_for_program(program: &Path, args: &[String]) -> Command {
    #[cfg(windows)]
    {
        let extension = program
            .extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or_default();
        if extension.eq_ignore_ascii_case("cmd") || extension.eq_ignore_ascii_case("bat") {
            let mut command =
                Command::new(env::var_os("COMSPEC").unwrap_or_else(|| "cmd.exe".into()));
            command.args(["/D", "/S", "/C"]).arg(program).args(args);
            return command;
        }
    }
    let mut command = Command::new(program);
    command.args(args);
    command
}

fn run_command_capture(cwd: &Path, program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .current_dir(cwd)
        .args(args)
        .output()
        .map_err(to_error)?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let detail = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        format!("command exited with {}", output.status)
    };
    Err(detail)
}

fn agent_invocation(
    agent: &str,
    prompt: &str,
    run_mode: &str,
) -> Result<(String, Vec<String>), String> {
    match agent {
        "claude" => Ok((
            "claude".to_string(),
            vec!["--print".to_string(), prompt.to_string()],
        )),
        "codex" => Ok((
            "codex".to_string(),
            vec![
                "exec".to_string(),
                "--sandbox".to_string(),
                if run_mode == "inspect_only" {
                    "read-only".to_string()
                } else {
                    "workspace-write".to_string()
                },
                "--skip-git-repo-check".to_string(),
                prompt.to_string(),
            ],
        )),
        "gemini" => Ok((
            "gemini".to_string(),
            vec!["-p".to_string(), prompt.to_string()],
        )),
        "aider" => Ok((
            "aider".to_string(),
            vec!["--message".to_string(), prompt.to_string()],
        )),
        "powershell" => Ok((
            "powershell".to_string(),
            vec![
                "-NoProfile".to_string(),
                "-ExecutionPolicy".to_string(),
                "Bypass".to_string(),
                "-Command".to_string(),
                prompt.to_string(),
            ],
        )),
        "cmd" => Ok((
            "cmd".to_string(),
            vec!["/C".to_string(), prompt.to_string()],
        )),
        other => Err(format!("Unsupported agent: {other}")),
    }
}

fn spawn_reader<R: std::io::Read + Send + 'static>(
    session_id: String,
    stream: &str,
    reader: R,
    log_file: Arc<Mutex<File>>,
    output_sink: OutputSink,
) -> std::thread::JoinHandle<()> {
    let stream_name = stream.to_string();
    std::thread::spawn(move || {
        let reader = BufReader::new(reader);
        for line in reader.lines().map_while(Result::ok) {
            write_log(&log_file, &format!("[{stream_name}] {line}"));
            output_sink(&session_id, &stream_name, &line);
        }
    })
}

fn finish_session(
    sessions: &Arc<Mutex<HashMap<String, SessionControl>>>,
    session_id: &str,
    requested_status: &str,
    exit_code: Option<i32>,
    mut message: Option<String>,
    log_file: &Arc<Mutex<File>>,
    status_sink: &StatusSink,
) {
    let mut final_status = requested_status.to_string();
    let mut final_info = None;
    if let Ok(mut controls) = sessions.lock() {
        if let Some(control) = controls.get_mut(session_id) {
            if control.stop_requested {
                final_status = "stopped".to_string();
                message = Some("Session stopped by user".to_string());
            }
            control.info.status = final_status.clone();
            control.info.exit_code = exit_code;
            control.info.finished_at = Some(now_iso());
            control.pid = None;
            final_info = Some(control.info.clone());
        }
    }
    if let Some(info) = final_info {
        persist_session_metadata(log_file, &info);
    }
    status_sink(AgentStatusEvent {
        session_id: session_id.to_string(),
        status: final_status,
        exit_code,
        message,
    });
}

fn persist_session_metadata(log_file: &Arc<Mutex<File>>, info: &SessionInfo) {
    if let Ok(metadata) = serde_json::to_string(info) {
        write_log(log_file, &format!("[system] session-meta={metadata}"));
    }
}

fn emit_output<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    session_id: &str,
    stream: &str,
    line: &str,
) {
    let _ = app.emit(
        "agent-output",
        AgentOutputEvent {
            session_id: session_id.to_string(),
            stream: stream.to_string(),
            line: line.to_string(),
        },
    );
}

fn write_log(file: &Arc<Mutex<File>>, line: &str) {
    if let Ok(mut file) = file.lock() {
        let _ = writeln!(file, "{line}");
        let _ = file.flush();
    }
}

fn canonical_string(path: &Path) -> Result<String, String> {
    let canonical = path.canonicalize().map_err(to_error)?;
    #[cfg(windows)]
    {
        let text = canonical.to_string_lossy();
        if let Some(path) = text.strip_prefix(r"\\?\UNC\") {
            return Ok(format!(r"\\{path}"));
        }
        if let Some(path) = text.strip_prefix(r"\\?\") {
            return Ok(path.to_string());
        }
    }
    Ok(canonical.to_string_lossy().to_string())
}

fn stable_id(value: &str) -> String {
    let mut hash: u64 = 1469598103934665603;
    for byte in value.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(1099511628211);
    }
    format!("ws-{hash:x}")
}

fn new_session_id(prefix: &str) -> String {
    let sequence = SESSION_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    format!(
        "{prefix}-{}-{}-{sequence}",
        now_compact(),
        std::process::id()
    )
}

fn now_compact() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string()
}

fn now_iso() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{seconds}")
}

fn default_edit_run_mode() -> String {
    "edit".to_string()
}

fn sanitize_slug(value: &str) -> String {
    let clean: String = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    clean.trim_matches('-').to_string()
}

fn session_is_active(status: &str) -> bool {
    matches!(status, "staged" | "running")
}

fn paths_match(left: &Path, right: &Path) -> bool {
    let left = left
        .canonicalize()
        .unwrap_or_else(|_| left.to_path_buf())
        .to_string_lossy()
        .replace('\\', "/");
    let right = right
        .canonicalize()
        .unwrap_or_else(|_| right.to_path_buf())
        .to_string_lossy()
        .replace('\\', "/");
    if cfg!(windows) {
        left.eq_ignore_ascii_case(&right)
    } else {
        left == right
    }
}

fn pretty_json<T: Serialize>(value: &T) -> Result<String, String> {
    serde_json::to_string_pretty(value).map_err(to_error)
}

fn to_error<E: std::fmt::Display>(error: E) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    struct Cleanup(PathBuf);

    impl Drop for Cleanup {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn run_git(cwd: &Path, args: &[&str]) {
        let output = Command::new("git")
            .current_dir(cwd)
            .args(args)
            .output()
            .expect("failed to run git");
        assert!(
            output.status.success(),
            "git {:?} failed: {}",
            args,
            String::from_utf8_lossy(&output.stderr)
        );
    }

    fn test_root() -> PathBuf {
        let base = env::var_os("AGENTBOARD_TEST_TMP")
            .map(PathBuf::from)
            .or_else(|| env::var_os("CARGO_TARGET_DIR").map(PathBuf::from))
            .unwrap_or_else(env::temp_dir);
        base.join("agentboard-runtime-tests")
            .join(new_session_id("case"))
    }

    fn powershell_request(workspace: &Path, node_name: &str, prompt: &str) -> RunAgentRequest {
        RunAgentRequest {
            workspace_path: workspace.to_string_lossy().to_string(),
            workspace_name: "Multi-agent Runtime".to_string(),
            agent: "powershell".to_string(),
            prompt: prompt.to_string(),
            run_mode: "edit".to_string(),
            node_id: Some(sanitize_slug(node_name)),
            node_name: Some(node_name.to_string()),
            skills: vec!["runtime-test-skill".to_string()],
            use_worktree: false,
            allow_shared_workspace: true,
        }
    }

    fn test_agent_profile(id: &str, name: &str) -> AgentProfile {
        AgentProfile {
            id: id.to_string(),
            name: name.to_string(),
            provider: "codex".to_string(),
            model: "GPT-5.5".to_string(),
            effort: "high".to_string(),
            default_skills: vec!["runtime-test-skill".to_string()],
            permissions: AgentProfilePermissions {
                read_files: true,
                write_files: false,
                run_shell: false,
                network: false,
            },
            isolation_mode: "worktree_per_deployment".to_string(),
            description: "Runtime persistence profile".to_string(),
            created_at: "100".to_string(),
            updated_at: "100".to_string(),
        }
    }

    #[test]
    fn github_rate_limit_error_is_human_readable() {
        let now = 1_700_000_000;
        let reset = (now + 18 * 60).to_string();
        assert_eq!(
            github_retry_text_at(Some(&reset), now),
            "try again in 18 minutes"
        );

        let rate_limit = GithubRateLimit {
            limit: 60,
            remaining: 0,
            reset_at: Some(reset.clone()),
            resource: "core".to_string(),
        };
        let error = github_http_error(403, r#"{"message":"API rate limit exceeded"}"#, &rate_limit);
        assert!(error.contains("GitHub core API limit reached"));
        assert!(error.contains("Add a GitHub token"));
        assert!(!error.contains(&reset));
    }

    fn test_deployment(id: &str, profile_id: &str, workspace: &Path) -> AgentDeployment {
        AgentDeployment {
            id: id.to_string(),
            agent_profile_id: profile_id.to_string(),
            agent_name: "Runtime Codex".to_string(),
            target_type: "file".to_string(),
            workspace_path: workspace.to_string_lossy().to_string(),
            target_path: "src/node.ts".to_string(),
            target_label: "src/node.ts".to_string(),
            pipeline_id: None,
            pipeline_name: None,
            node_id: None,
            node_name: None,
            selected_skills: vec!["runtime-test-skill".to_string()],
            prompt: "Inspect the file without editing.".to_string(),
            run_mode: "inspect_only".to_string(),
            isolation_mode: "same_workspace".to_string(),
            status: "staged".to_string(),
            session_id: None,
            log_path: None,
            created_at: "200".to_string(),
            updated_at: "200".to_string(),
        }
    }

    fn wait_for_status(
        state: &AppState,
        session_id: &str,
        expected: &[&str],
        timeout: Duration,
    ) -> SessionInfo {
        let started = Instant::now();
        loop {
            let info = state
                .sessions
                .lock()
                .expect("session state")
                .get(session_id)
                .map(|control| control.info.clone())
                .expect("session should exist");
            if expected.contains(&info.status.as_str()) {
                return info;
            }
            assert!(
                started.elapsed() < timeout,
                "session {session_id} remained {} instead of reaching {:?}",
                info.status,
                expected
            );
            std::thread::sleep(Duration::from_millis(50));
        }
    }

    fn verify_multi_agent_runtime(workspace: &Path) {
        initialize_workspace(workspace).expect("multi-agent workspace should initialize");
        let state = AppState::default();
        let output_sink: OutputSink = Arc::new(|_, _, _| {});
        let status_sink: StatusSink = Arc::new(|_| {});

        let session_a = run_agent_core(
            state.sessions.clone(),
            powershell_request(
                workspace,
                "Multi-agent smoke A",
                "Write-Output AgentA-Start; Start-Sleep -Seconds 5; Write-Output AgentA-Done",
            ),
            output_sink.clone(),
            status_sink.clone(),
        )
        .expect("session A should start");
        let session_b = run_agent_core(
            state.sessions.clone(),
            powershell_request(
                workspace,
                "Multi-agent smoke B",
                "Write-Output AgentB-Start; Start-Sleep -Seconds 3; Write-Output AgentB-Done",
            ),
            output_sink.clone(),
            status_sink.clone(),
        )
        .expect("session B should start");

        assert_ne!(session_a.id, session_b.id);
        assert_ne!(session_a.log_path, session_b.log_path);
        let (pid_a, pid_b) = {
            let controls = state.sessions.lock().expect("session state");
            let control_a = controls.get(&session_a.id).expect("session A control");
            let control_b = controls.get(&session_b.id).expect("session B control");
            assert_eq!(control_a.info.status, "running");
            assert_eq!(control_b.info.status, "running");
            assert_ne!(control_a.pid, control_b.pid);
            (
                control_a.pid.expect("session A pid"),
                control_b.pid.expect("session B pid"),
            )
        };
        eprintln!(
            "multi-agent overlap: A={} pid={} B={} pid={}",
            session_a.id, pid_a, session_b.id, pid_b
        );

        let completed_b = wait_for_status(
            &state,
            &session_b.id,
            &["completed"],
            Duration::from_secs(5),
        );
        let overlapping_a = state
            .sessions
            .lock()
            .expect("session state")
            .get(&session_a.id)
            .expect("session A control")
            .info
            .clone();
        assert_eq!(
            overlapping_a.status, "running",
            "session A must still be alive after session B finishes"
        );
        eprintln!(
            "completion order: B={} while A={}",
            completed_b.status, overlapping_a.status
        );
        let completed_a = wait_for_status(
            &state,
            &session_a.id,
            &["completed"],
            Duration::from_secs(4),
        );
        assert_eq!(completed_a.exit_code, Some(0));
        assert_eq!(completed_b.exit_code, Some(0));

        let log_a = fs::read_to_string(&session_a.log_path).expect("session A log");
        let log_b = fs::read_to_string(&session_b.log_path).expect("session B log");
        assert!(log_a.contains("AgentA-Start"));
        assert!(log_a.contains("AgentA-Done"));
        assert!(!log_a.contains("AgentB-Start"));
        assert!(log_b.contains("AgentB-Start"));
        assert!(log_b.contains("AgentB-Done"));
        assert!(!log_b.contains("AgentA-Start"));

        let stop_me = run_agent_core(
            state.sessions.clone(),
            powershell_request(
                workspace,
                "Independent stop target",
                "Write-Output StopMe-Start; Start-Sleep -Seconds 6; Write-Output StopMe-Done",
            ),
            output_sink.clone(),
            status_sink.clone(),
        )
        .expect("stop target should start");
        let keep_going = run_agent_core(
            state.sessions.clone(),
            powershell_request(
                workspace,
                "Independent survivor",
                "Write-Output KeepGoing-Start; Start-Sleep -Seconds 3; Write-Output KeepGoing-Done",
            ),
            output_sink,
            status_sink,
        )
        .expect("survivor should start");
        std::thread::sleep(Duration::from_millis(300));
        stop_session_impl(&state, &stop_me.id).expect("targeted stop should succeed");
        let stopped = wait_for_status(&state, &stop_me.id, &["stopped"], Duration::from_secs(3));
        assert_eq!(stopped.status, "stopped");
        let survivor_during_stop = state
            .sessions
            .lock()
            .expect("session state")
            .get(&keep_going.id)
            .expect("survivor control")
            .info
            .clone();
        assert_eq!(
            survivor_during_stop.status, "running",
            "stopping one session must not stop another"
        );
        eprintln!(
            "targeted stop: target={} survivor={}",
            stopped.status, survivor_during_stop.status
        );
        wait_for_status(
            &state,
            &keep_going.id,
            &["completed"],
            Duration::from_secs(5),
        );
        let survivor_log = fs::read_to_string(&keep_going.log_path).expect("survivor session log");
        assert!(survivor_log.contains("KeepGoing-Done"));

        let captured_lines = Arc::new(Mutex::new(Vec::<String>::new()));
        let captured_for_sink = captured_lines.clone();
        let dedupe_sink: OutputSink = Arc::new(move |_, stream, line| {
            captured_for_sink
                .lock()
                .expect("captured output")
                .push(format!("[{stream}] {line}"));
        });
        let mut dedupe_request = powershell_request(
            workspace,
            "Log deduplication",
            "Write-Output \"LineA\"; Write-Output \"LineB\"",
        );
        dedupe_request.run_mode = "inspect_only".to_string();
        let dedupe_session = run_agent_core(
            state.sessions.clone(),
            dedupe_request,
            dedupe_sink,
            Arc::new(|_| {}),
        )
        .expect("dedupe session should start");
        assert!(
            fs::metadata(&dedupe_session.log_path)
                .expect("dedupe log metadata")
                .len()
                > 0,
            "session metadata must be durable before run_agent returns"
        );
        let inspected = wait_for_status(
            &state,
            &dedupe_session.id,
            &["completed_inspection"],
            Duration::from_secs(5),
        );
        assert_eq!(inspected.exit_code, Some(0));
        let events = captured_lines.lock().expect("captured output");
        assert_eq!(
            events
                .iter()
                .filter(|line| line.as_str() == "[stdout] LineA")
                .count(),
            1
        );
        assert_eq!(
            events
                .iter()
                .filter(|line| line.as_str() == "[stdout] LineB")
                .count(),
            1
        );
        assert_eq!(
            events
                .iter()
                .filter(|line| line.contains("Spawned") && line.contains("pid"))
                .count(),
            1
        );
        drop(events);
        let dedupe_log =
            fs::read_to_string(&dedupe_session.log_path).expect("dedupe log should read");
        assert_eq!(dedupe_log.matches("[stdout] LineA").count(), 1);
        assert_eq!(dedupe_log.matches("[stdout] LineB").count(), 1);
        assert_eq!(dedupe_log.matches("[system] Spawned").count(), 1);

        let restored = load_session_history(workspace, "Multi-agent Runtime", Vec::new())
            .expect("completed sessions should restore");
        for session in [
            &session_a,
            &session_b,
            &stop_me,
            &keep_going,
            &dedupe_session,
        ] {
            let restored_session = restored
                .sessions
                .iter()
                .find(|candidate| candidate.id == session.id)
                .expect("session metadata should restore");
            assert_eq!(restored_session.log_path, session.log_path);
            assert_eq!(
                restored_session.selected_skills,
                vec!["runtime-test-skill".to_string()]
            );
            assert!(restored.logs.contains_key(&session.id));
        }
        eprintln!(
            "restoration: {} sessions and {} logs loaded",
            restored.sessions.len(),
            restored.logs.len()
        );
    }

    #[test]
    fn runtime_backend_flow() {
        let sample_summary = open_sample_workspace().expect("sample workspace should open");
        let copied_sample = app_data_dir()
            .expect("app data directory")
            .join("sample-workspace");
        assert_eq!(
            PathBuf::from(&sample_summary.path).canonicalize().unwrap(),
            copied_sample.canonicalize().unwrap()
        );
        assert_eq!(sample_summary.pipeline_count, 1);
        assert_eq!(sample_summary.node_count, 6);

        let bundle = load_workspace_impl(sample_summary.id.clone(), Vec::new())
            .expect("sample workspace should load");
        assert_eq!(bundle.pipelines.pipelines.len(), 1);
        let pipeline = &bundle.pipelines.pipelines[0];
        assert_eq!(pipeline.id, "main-pipeline");
        assert_eq!(pipeline.nodes.len(), 6);
        let sample_skill = bundle
            .skills
            .iter()
            .find(|skill| skill.name == "software-engineering-debugger")
            .expect("sample skill should load");
        assert!(sample_skill.error.is_none());
        assert_eq!(sample_skill.title, "Software Engineering Debugger");

        for node in &pipeline.nodes {
            for file in &node.files {
                let result = read_file(sample_summary.path.clone(), file.path.clone())
                    .expect("concerned file command should succeed");
                assert!(result.exists, "missing concerned file {}", file.path);
                assert!(result.error.is_none(), "file error for {}", file.path);
                assert!(
                    !result.content.is_empty(),
                    "empty concerned file {}",
                    file.path
                );
            }
        }

        let scan = scan_workspace(sample_summary.path.clone()).expect("reality scan should run");
        assert!(
            !scan.is_empty(),
            "sample workspace should contain scanner findings"
        );
        assert!(
            scan.iter().any(|issue| issue.pattern == "mock"),
            "scanner should identify mock content"
        );
        assert!(
            scan.iter()
                .any(|issue| issue.pattern == "throw new error(\"not implemented\")"),
            "scanner should identify not-implemented content"
        );

        let sample_git = git_status(sample_summary.path.clone()).expect("git status should return");
        assert!(!sample_git.is_repo);
        assert!(sample_git.error.is_some());
        let sample_preflight = deployment_preflight_impl(DeploymentPreflightRequest {
            target_type: "workspace".to_string(),
            workspace_path: sample_summary.path.clone(),
            target_path: sample_summary.path.clone(),
            provider: "powershell".to_string(),
            selected_skills: vec!["software-engineering-debugger".to_string()],
            task: "Write-Output \"LineA\"; Write-Output \"LineB\"".to_string(),
            run_mode: "edit".to_string(),
            write_files_permission: true,
            concerned_files: Vec::new(),
        })
        .expect("sample preflight should run");
        assert!(sample_preflight.has_source_files);
        assert!(sample_preflight.source_file_count >= 6);
        assert!(sample_preflight.blockers.is_empty());
        assert_eq!(sample_preflight.git_status, "not_git_repo");
        assert!(sample_preflight
            .warnings
            .iter()
            .any(|item| item.code == "git_unavailable"));

        let detected = detect_agents().expect("agent detection should return");
        let detected_ids: Vec<&str> = detected.iter().map(|agent| agent.id.as_str()).collect();
        assert_eq!(
            detected_ids,
            [
                "claude",
                "codex",
                "gemini",
                "aider",
                "git",
                "powershell",
                "cmd"
            ]
        );
        for required in ["git", "powershell", "cmd"] {
            let agent = detected
                .iter()
                .find(|agent| agent.id == required)
                .expect("required command missing from response");
            assert_eq!(agent.status, "available", "{required} should be available");
        }

        let diagnostics = export_diagnostics_impl(DiagnosticsExportRequest {
            recent_errors: vec!["runtime diagnostic sentinel".to_string()],
            workspace_path: Some(sample_summary.path.clone()),
            issue_notes: Some("runtime backend flow".to_string()),
        })
        .expect("diagnostics export should succeed");
        let diagnostics_text =
            fs::read_to_string(&diagnostics.path).expect("diagnostics report should read");
        let diagnostics_json: serde_json::Value =
            serde_json::from_str(&diagnostics_text).expect("diagnostics report should be JSON");
        assert_eq!(diagnostics_json["appVersion"], env!("CARGO_PKG_VERSION"));
        assert_eq!(
            diagnostics_json["recentErrors"][0],
            "runtime diagnostic sentinel"
        );
        assert_eq!(diagnostics_json["issueNotes"], "runtime backend flow");
        assert!(diagnostics_json["logFolderPath"]
            .as_str()
            .is_some_and(|path| path.ends_with("logs")));
        fs::remove_file(&diagnostics.path).expect("diagnostics report cleanup");

        let (program, args) =
            agent_invocation("powershell", "Write-Output AgentBoardSmokeTest", "edit")
                .expect("PowerShell invocation should resolve");
        let smoke_output = Command::new(&program)
            .args(&args)
            .current_dir(&copied_sample)
            .output()
            .expect("PowerShell smoke command should start");
        assert!(
            smoke_output.status.success(),
            "{}",
            String::from_utf8_lossy(&smoke_output.stderr)
        );

        let expected_logs = copied_sample.join(".agentboard").join("logs");
        fs::create_dir_all(&expected_logs).expect("logs directory");
        let log_path = expected_logs.join(format!("runtime-verification-{}.log", now_compact()));
        let log_file = Arc::new(Mutex::new(
            OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
                .expect("runtime log"),
        ));
        write_log(
            &log_file,
            &format!("[system] program={program} args={args:?}"),
        );
        for line in String::from_utf8_lossy(&smoke_output.stdout).lines() {
            write_log(&log_file, &format!("[stdout] {line}"));
        }
        for line in String::from_utf8_lossy(&smoke_output.stderr).lines() {
            write_log(&log_file, &format!("[stderr] {line}"));
        }
        let log_text = fs::read_to_string(&log_path).expect("runtime log should read");
        assert!(log_text.contains("AgentBoardSmokeTest"));
        assert!(log_text.contains("[stdout]"));
        fs::remove_file(&log_path).expect("runtime log cleanup");

        let (_, inspect_args) =
            agent_invocation("codex", "Inspect only", "inspect_only").expect("Codex inspect args");
        assert!(inspect_args
            .windows(2)
            .any(|pair| pair == ["--sandbox", "read-only"]));
        let (_, edit_args) =
            agent_invocation("codex", "Edit safely", "edit").expect("Codex edit args");
        assert!(edit_args
            .windows(2)
            .any(|pair| pair == ["--sandbox", "workspace-write"]));

        let root = test_root();
        fs::create_dir_all(&root).expect("test root");
        let _cleanup = Cleanup(root.clone());
        let onboarding_workspace = root.join("onboarding-workspace");
        fs::create_dir_all(&onboarding_workspace).expect("onboarding workspace");
        let starter_error = prepare_workspace(&onboarding_workspace, false)
            .expect_err("missing pipeline metadata should require approval");
        assert!(starter_error.starts_with("STARTER_REQUIRED:"));
        assert!(!onboarding_workspace.join(".agentboard").exists());
        prepare_workspace(&onboarding_workspace, true).expect("starter metadata creation");
        assert!(onboarding_workspace
            .join(".agentboard")
            .join("pipelines.json")
            .is_file());
        let empty_edit_preflight = deployment_preflight_impl(DeploymentPreflightRequest {
            target_type: "workspace".to_string(),
            workspace_path: onboarding_workspace.to_string_lossy().to_string(),
            target_path: onboarding_workspace.to_string_lossy().to_string(),
            provider: "powershell".to_string(),
            selected_skills: Vec::new(),
            task: String::new(),
            run_mode: "edit".to_string(),
            write_files_permission: true,
            concerned_files: Vec::new(),
        })
        .expect("empty edit preflight");
        assert!(empty_edit_preflight.target_exists);
        assert!(!empty_edit_preflight.has_source_files);
        assert!(empty_edit_preflight.only_agentboard);
        assert_eq!(empty_edit_preflight.git_status, "not_git_repo");
        assert!(empty_edit_preflight.log_writable);
        assert!(empty_edit_preflight
            .blockers
            .iter()
            .any(|item| item.code == "empty_target_requires_inspection"));
        assert!(empty_edit_preflight
            .blockers
            .iter()
            .any(|item| item.code == "task_required"));
        assert!(empty_edit_preflight
            .warnings
            .iter()
            .any(|item| item.code == "no_source_files"));

        let empty_inspect_preflight = deployment_preflight_impl(DeploymentPreflightRequest {
            target_type: "workspace".to_string(),
            workspace_path: onboarding_workspace.to_string_lossy().to_string(),
            target_path: onboarding_workspace.to_string_lossy().to_string(),
            provider: "powershell".to_string(),
            selected_skills: Vec::new(),
            task: String::new(),
            run_mode: "inspect_only".to_string(),
            write_files_permission: true,
            concerned_files: Vec::new(),
        })
        .expect("empty inspect preflight");
        assert!(empty_inspect_preflight.blockers.is_empty());
        assert!(empty_inspect_preflight.run_mode_supported);
        assert_eq!(
            empty_inspect_preflight.effective_sandbox,
            "provider-controlled; read-only not enforced"
        );

        let pipeline_scope_preflight = deployment_preflight_impl(DeploymentPreflightRequest {
            target_type: "pipeline_node".to_string(),
            workspace_path: onboarding_workspace.to_string_lossy().to_string(),
            target_path: "pipeline:runtime/missing-scope".to_string(),
            provider: "powershell".to_string(),
            selected_skills: Vec::new(),
            task: "Inspect the node".to_string(),
            run_mode: "inspect_only".to_string(),
            write_files_permission: true,
            concerned_files: Vec::new(),
        })
        .expect("pipeline scope preflight");
        assert!(pipeline_scope_preflight
            .blockers
            .iter()
            .any(|item| item.code == "pipeline_scope_missing"));

        let persistence_root = root.join("global-persistence");
        fs::create_dir_all(&persistence_root).expect("persistence root");
        ensure_global_files(&persistence_root).expect("global files");
        let mut profile = test_agent_profile("profile-runtime", "Runtime Codex");
        save_agent_profile_impl(&persistence_root, profile.clone()).expect("save profile");
        let profiles = read_agent_profiles_file(&persistence_root).expect("list profiles");
        assert_eq!(profiles.profiles.len(), 1);
        assert_eq!(profiles.profiles[0].default_skills, profile.default_skills);
        profile.description = "Updated runtime profile".to_string();
        profile.updated_at = "101".to_string();
        save_agent_profile_impl(&persistence_root, profile.clone()).expect("update profile");
        assert_eq!(
            read_agent_profiles_file(&persistence_root)
                .expect("restored profiles")
                .profiles[0]
                .description,
            "Updated runtime profile"
        );
        let mut deployment =
            test_deployment("deployment-runtime", &profile.id, &onboarding_workspace);
        save_deployment_impl(&persistence_root, deployment.clone(), false)
            .expect("save deployment");
        deployment.status = "completed".to_string();
        deployment.session_id = Some("session-runtime".to_string());
        deployment.log_path = Some("runtime.log".to_string());
        deployment.updated_at = "201".to_string();
        save_deployment_impl(&persistence_root, deployment.clone(), true)
            .expect("update deployment");
        let restored_deployments =
            read_deployments_file(&persistence_root).expect("restore deployments");
        assert_eq!(restored_deployments.deployments.len(), 1);
        assert_eq!(restored_deployments.deployments[0].status, "completed");
        assert_eq!(
            restored_deployments.deployments[0].session_id.as_deref(),
            Some("session-runtime")
        );
        delete_deployment_impl(&persistence_root, &deployment.id).expect("delete deployment");
        delete_agent_profile_impl(&persistence_root, &profile.id).expect("delete profile");
        assert!(read_deployments_file(&persistence_root)
            .expect("empty deployments")
            .deployments
            .is_empty());
        assert!(read_agent_profiles_file(&persistence_root)
            .expect("empty profiles")
            .profiles
            .is_empty());

        let marketplace_workspace = root.join("marketplace-workspace");
        fs::create_dir_all(&marketplace_workspace).expect("marketplace workspace");
        initialize_workspace(&marketplace_workspace).expect("marketplace workspace metadata");
        let search_queries = build_github_search_queries("React", Some("TypeScript"), Some(10));
        let search_query = &search_queries[0];
        assert!(search_query.contains("React"));
        assert!(search_query.contains("\"agent skill\""));
        assert!(search_query.contains("language:TypeScript"));
        assert!(search_query.contains("stars:>=10"));
        let all_search_variants = search_queries.join("\n").to_ascii_lowercase();
        for term in GITHUB_SEARCH_TERMS {
            assert!(all_search_variants.contains(&term.to_ascii_lowercase()));
        }
        assert!(validate_safe_skill_name("../unsafe").is_err());
        assert!(validate_safe_skill_name("CON").is_err());

        let marketplace_repo = GithubMarketplaceRepo {
            id: 42,
            full_name: "example/engineering-skill".to_string(),
            name: "engineering-skill".to_string(),
            owner: "example".to_string(),
            description: "Engineering review instructions".to_string(),
            html_url: "https://github.com/example/engineering-skill".to_string(),
            default_branch: "main".to_string(),
            stars: 120,
            forks: 12,
            language: Some("Markdown".to_string()),
            license: Some("MIT".to_string()),
            updated_at: "2026-06-10T00:00:00Z".to_string(),
            topics: vec!["agent-skill".to_string()],
            detected_skill_status: "formal_skill".to_string(),
            detected_files: vec!["SKILL.md".to_string(), "skill.json".to_string()],
            quality_score: 90,
            quality_label: "high".to_string(),
            installed_skill_name: None,
            install_status: "not_installed".to_string(),
            latest_commit_sha: Some("commit-one".to_string()),
            preview_cached: false,
        };
        let fetched_v1 = FetchedGithubSkill {
            markdown: "# Engineering Skill\nInspect before editing.".to_string(),
            markdown_path: "SKILL.md".to_string(),
            skill_json: Some(serde_json::json!({
                "title": "Engineering Skill",
                "description": "Remote description",
                "compatible_agents": ["codex", "claude"],
                "permissions": {
                    "filesystem": "write",
                    "shell": true,
                    "network": true
                }
            })),
            skill_json_path: Some("skill.json".to_string()),
        };
        let installed_dir = marketplace_workspace
            .join(".agentboard")
            .join("skills")
            .join("engineering-skill");
        write_github_skill_install(
            &installed_dir,
            "engineering-skill",
            &marketplace_repo,
            &fetched_v1,
            "untrusted",
            None,
        )
        .expect("fixture GitHub skill install");
        let installed = load_skill_directory(&installed_dir).expect("installed GitHub skill");
        assert_eq!(installed.trust_state, "untrusted");
        assert!(!installed.enabled);
        assert_eq!(
            installed.repo_full_name.as_deref(),
            Some("example/engineering-skill")
        );
        assert_eq!(installed.manifest.permissions.filesystem, "read");
        assert!(!installed.manifest.permissions.shell);
        assert!(!installed.manifest.permissions.network);
        assert!(installed_dir.join("SKILL.md").is_file());
        assert!(installed_dir.join("skill.json").is_file());
        assert!(installed_dir.join("source.json").is_file());

        let reviewed = github_marketplace_set_trust_impl(GithubMarketplaceTrustRequest {
            workspace_path: marketplace_workspace.to_string_lossy().to_string(),
            skill_name: "engineering-skill".to_string(),
            trust_state: "reviewed".to_string(),
        })
        .expect("review GitHub skill");
        assert_eq!(reviewed.trust_state, "reviewed");
        assert!(reviewed.enabled);

        let mut updated_repo = marketplace_repo.clone();
        updated_repo.latest_commit_sha = Some("commit-two".to_string());
        let fetched_v2 = FetchedGithubSkill {
            markdown: "# Engineering Skill\nInspect, edit, and verify.".to_string(),
            markdown_path: "SKILL.md".to_string(),
            skill_json: fetched_v1.skill_json.clone(),
            skill_json_path: Some("skill.json".to_string()),
        };
        let source_v1 =
            read_github_skill_source(&installed_dir).expect("installed source metadata");
        let backup = apply_github_skill_update(
            &installed_dir,
            "engineering-skill",
            &updated_repo,
            &fetched_v2,
            &source_v1,
        )
        .expect("fixture GitHub skill update");
        assert!(backup.join("SKILL.md").is_file());
        assert!(fs::read_to_string(backup.join("SKILL.md"))
            .expect("backup markdown")
            .contains("Inspect before editing"));
        assert!(fs::read_to_string(installed_dir.join("SKILL.md"))
            .expect("updated markdown")
            .contains("Inspect, edit, and verify"));
        let source_v2 = read_github_skill_source(&installed_dir).expect("updated source metadata");
        assert_eq!(source_v2.commit_sha, "commit-two");
        assert_eq!(source_v2.trust_state, "reviewed");
        fs::write(installed_dir.join("source.json"), "{ invalid").expect("corrupt source fixture");
        let fail_closed = load_skills(&marketplace_workspace)
            .into_iter()
            .find(|skill| skill.name == "engineering-skill")
            .expect("corrupted GitHub skill remains visible");
        assert!(!fail_closed.enabled);
        assert_eq!(fail_closed.trust_state, "untrusted");
        assert!(fail_closed.error.is_some());
        write_json_atomic(&installed_dir.join("source.json"), &source_v2)
            .expect("restore source fixture");

        let uninstalled = github_marketplace_uninstall_impl(GithubMarketplaceSkillRequest {
            workspace_path: marketplace_workspace.to_string_lossy().to_string(),
            skill_name: "engineering-skill".to_string(),
        })
        .expect("trash GitHub skill");
        assert!(!installed_dir.exists());
        assert!(PathBuf::from(&uninstalled.trash_path).is_dir());
        eprintln!(
            "github skill lifecycle: installed untrusted, reviewed, updated with backup, trashed at {}",
            uninstalled.trash_path
        );

        let workspace = root.join("git-workspace");
        fs::create_dir_all(workspace.join("src")).expect("workspace source");
        fs::write(
            workspace.join("src").join("node.ts"),
            "export const ready = true;\n",
        )
        .expect("workspace file");
        initialize_workspace(&workspace).expect("workspace should initialize");
        let history_logs = workspace.join(".agentboard").join("logs");
        fs::write(
            history_logs.join("claude-session-123000.log"),
            "[stdout] Your organization has disabled Claude subscription access for Claude Code \u{00c2}\u{00b7} Use an Anthropic API key instead, or ask your admin to enable access\n",
        )
        .expect("legacy Claude log");
        let history = load_session_history(&workspace, "Runtime Workspace", Vec::new())
            .expect("session history should load");
        let claude = history
            .sessions
            .iter()
            .find(|session| session.agent == "claude")
            .expect("Claude session should restore");
        assert_eq!(claude.status, "external_blocked");
        let restored_log = history.logs.get(&claude.id).expect("restored log lines");
        assert!(restored_log.iter().any(|line| line.contains("\u{00b7}")));
        assert!(restored_log
            .iter()
            .all(|line| !line.contains("\u{00c2}\u{00b7}")));
        let running_log = history_logs.join("powershell-session-124000.log");
        let completed_log = history_logs.join("codex-session-125000.log");
        fs::write(&running_log, "[stdout] still running\n").expect("running log");
        fs::write(&completed_log, "[stdout] complete\n").expect("completed log");
        let state = AppState::default();
        state.sessions.lock().unwrap().insert(
            "session-124000".to_string(),
            SessionControl {
                info: SessionInfo {
                    id: "session-124000".to_string(),
                    workspace_path: workspace.to_string_lossy().to_string(),
                    workspace_name: "Runtime Workspace".to_string(),
                    agent: "powershell".to_string(),
                    node_id: Some("runtime-node".to_string()),
                    node_name: Some("Runtime Node".to_string()),
                    selected_skills: Vec::new(),
                    prompt: "Start-Sleep".to_string(),
                    run_mode: "edit".to_string(),
                    status: "running".to_string(),
                    started_at: "124".to_string(),
                    finished_at: None,
                    log_path: running_log.to_string_lossy().to_string(),
                    exit_code: None,
                    execution_path: workspace.to_string_lossy().to_string(),
                    worktree_path: None,
                },
                pid: Some(0),
                stop_requested: false,
            },
        );
        let cleared = clear_session_history_impl(&state, workspace.to_string_lossy().to_string())
            .expect("session history should clear");
        assert_eq!(cleared.removed, 2);
        assert_eq!(cleared.retained_running, 1);
        assert!(running_log.is_file());
        assert!(!completed_log.exists());
        assert_eq!(state.sessions.lock().unwrap().len(), 1);
        fs::write(
            workspace.join(".agentboard").join("pipelines.json"),
            r#"{
  "pipelines": [{
    "id": "runtime",
    "name": "Runtime",
    "nodes": [{
      "id": "runtime-node",
      "label": "Runtime Node",
      "status": "tested",
      "files": [{"path": "src/node.ts", "reason": "runtime verification"}],
      "issues": [],
      "checks": [{"name": "smoke", "status": "pass", "message": "ready"}]
    }],
    "edges": []
  }]
}"#,
        )
        .expect("runtime pipeline");

        run_git(&workspace, &["init"]);
        run_git(
            &workspace,
            &["config", "user.email", "agentboard@example.invalid"],
        );
        run_git(&workspace, &["config", "user.name", "AgentBoard Runtime"]);
        run_git(&workspace, &["add", "."]);
        run_git(&workspace, &["commit", "-m", "runtime baseline"]);

        let workspace_path = canonical_string(&workspace).expect("canonical test workspace");
        let status = git_status(workspace_path.clone()).expect("git status should run");
        assert!(status.is_repo);
        assert!(status.changed_files.is_empty());
        assert!(status.untracked_files.is_empty());

        let worktree =
            create_worktree(workspace_path, "runtime-node".to_string()).expect("worktree creation");
        let worktree_path = PathBuf::from(worktree);
        assert!(worktree_path.is_dir());
        assert!(worktree_path.join("src").join("node.ts").is_file());

        let multi_agent_workspace = root.join("multi-agent-workspace");
        fs::create_dir_all(&multi_agent_workspace).expect("multi-agent workspace");
        verify_multi_agent_runtime(&multi_agent_workspace);
    }

    #[test]
    #[ignore = "requires live GitHub API access"]
    fn github_marketplace_live_search_and_preview() {
        let root = test_root();
        fs::create_dir_all(&root).expect("GitHub live test root");
        let _cleanup = Cleanup(root.clone());
        let workspace = root.join("workspace");
        fs::create_dir_all(&workspace).expect("GitHub live workspace");
        initialize_workspace(&workspace).expect("GitHub live workspace metadata");
        let app_data = root.join("app-data");
        fs::create_dir_all(&app_data).expect("GitHub live app data");
        let state = AppState::default();
        let result = github_marketplace_search_impl(
            &state,
            &app_data,
            GithubMarketplaceSearchRequest {
                workspace_path: workspace.to_string_lossy().to_string(),
                query: "software engineering agent skill".to_string(),
                sort: "best_match".to_string(),
                language: None,
                minimum_stars: None,
                only_detected_skill_files: true,
                force_refresh: true,
            },
        )
        .expect("live GitHub marketplace search");
        assert!(
            !result.items.is_empty(),
            "live GitHub search returned no skills"
        );
        let selected = result.items[0].clone();
        let preview = github_marketplace_preview_impl(
            &state,
            &app_data,
            GithubMarketplacePreviewRequest {
                workspace_path: workspace.to_string_lossy().to_string(),
                repo_full_name: selected.full_name.clone(),
                force_refresh: true,
            },
        )
        .expect("live GitHub marketplace preview");
        assert!(preview.installable);
        assert!(!preview.files.is_empty());
        let installed = github_marketplace_install_impl(
            &state,
            &app_data,
            GithubMarketplaceInstallRequest {
                workspace_path: workspace.to_string_lossy().to_string(),
                repo_full_name: selected.full_name.clone(),
                install_name: Some("live-github-skill".to_string()),
                allow_readme_draft: preview.readme_only,
                duplicate_action: "cancel".to_string(),
            },
        )
        .expect("live GitHub marketplace install");
        assert_eq!(installed.status, "installed");
        let installed_skill = installed.skill.expect("live installed skill");
        assert_eq!(installed_skill.trust_state, "untrusted");
        let reviewed = github_marketplace_set_trust_impl(GithubMarketplaceTrustRequest {
            workspace_path: workspace.to_string_lossy().to_string(),
            skill_name: installed_skill.name.clone(),
            trust_state: "reviewed".to_string(),
        })
        .expect("live GitHub marketplace trust");
        assert_eq!(reviewed.trust_state, "reviewed");
        let update = github_marketplace_update_impl(
            &state,
            &app_data,
            GithubMarketplaceUpdateRequest {
                workspace_path: workspace.to_string_lossy().to_string(),
                skill_name: reviewed.name.clone(),
                confirm: false,
            },
        )
        .expect("live GitHub marketplace update check");
        assert!(matches!(
            update.status.as_str(),
            "up_to_date" | "confirmation_required"
        ));
        let removed = github_marketplace_uninstall_impl(GithubMarketplaceSkillRequest {
            workspace_path: workspace.to_string_lossy().to_string(),
            skill_name: reviewed.name,
        })
        .expect("live GitHub marketplace uninstall");
        assert!(PathBuf::from(&removed.trash_path).is_dir());
        eprintln!(
            "github marketplace live: query={:?} results={} preview={} files={:?} install=untrusted trust=reviewed update={} trash={} rate={}/{}",
            result.api_query,
            result.items.len(),
            preview.repo.full_name,
            preview
                .files
                .iter()
                .map(|file| file.path.clone())
                .collect::<Vec<_>>(),
            update.status,
            removed.trash_path,
            preview.rate_limit.remaining,
            preview.rate_limit.limit
        );
    }
}
