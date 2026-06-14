#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env,
    fs::{self, File, OpenOptions},
    io::{BufRead, BufReader, Write},
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{Emitter, Manager, State};

#[derive(Default)]
struct AppState {
    sessions: Mutex<HashMap<String, SessionControl>>,
}

struct SessionControl {
    info: SessionInfo,
    pid: u32,
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
    compatible_agents: Vec<String>,
    version: String,
    source: String,
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
    prompt: String,
    status: String,
    started_at: String,
    finished_at: Option<String>,
    log_path: String,
    exit_code: Option<i32>,
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
struct RunAgentRequest {
    workspace_path: String,
    workspace_name: String,
    agent: String,
    prompt: String,
    node_id: Option<String>,
    skills: Vec<String>,
}

fn main() {
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
            stop_session,
            list_sessions
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
                } else {
                    format!("`{command}` was not found on PATH.")
                },
            }
        })
        .collect())
}

#[tauri::command]
fn add_workspace(path: String) -> Result<WorkspaceSummary, String> {
    let workspace_path = PathBuf::from(path.trim());
    if !workspace_path.exists() {
        return Err(format!("Workspace path does not exist: {}", workspace_path.display()));
    }
    if !workspace_path.is_dir() {
        return Err(format!("Workspace path is not a directory: {}", workspace_path.display()));
    }
    initialize_workspace(&workspace_path)?;
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
    if let Some(existing) = file.workspaces.iter_mut().find(|workspace| workspace.id == id) {
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

#[tauri::command]
fn open_sample_workspace() -> Result<WorkspaceSummary, String> {
    let sample = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or_else(|| "Could not locate project root".to_string())?
        .join("sample-workspace");
    add_workspace(sample.to_string_lossy().to_string())
}

#[tauri::command]
fn load_workspace(workspace_id: String) -> Result<WorkspaceBundle, String> {
    let app_data = app_data_dir()?;
    let file = read_workspaces_file(&app_data)?;
    let workspace = file
        .workspaces
        .iter()
        .find(|workspace| workspace.id == workspace_id)
        .ok_or_else(|| format!("Unknown workspace id: {workspace_id}"))?;
    let path = PathBuf::from(&workspace.path);
    initialize_workspace(&path)?;
    Ok(WorkspaceBundle {
        workspace: workspace_summary(workspace)?,
        pipelines: load_pipelines(&path),
        skills: load_skills(&path),
        git: git_status(workspace.path.clone())?,
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
    let repo_check = run_command_capture(&workspace, "git", &["rev-parse", "--is-inside-work-tree"]);
    if repo_check.as_deref().unwrap_or("").trim() != "true" {
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
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let status_text = run_command_capture(&workspace, "git", &["status", "--porcelain"]).unwrap_or_default();
    let diff_stat = run_command_capture(&workspace, "git", &["diff", "--stat"]).unwrap_or_default();
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
    let workspace = PathBuf::from(&workspace_path);
    let status = git_status(workspace_path.clone())?;
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
    let target = worktrees_root.join(format!("{workspace_name}-{clean_node}"));
    let target_arg = target.to_string_lossy().to_string();
    let branch = format!("agentboard/{}-{}", clean_node, now_compact());
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
    let workspace = PathBuf::from(&request.workspace_path);
    if !workspace.exists() || !workspace.is_dir() {
        return Err(format!("Workspace does not exist: {}", workspace.display()));
    }
    let (program, args) = agent_invocation(&request.agent, &request.prompt)?;
    if !command_exists(&program) {
        return Err(format!("Command `{program}` is not available on PATH."));
    }
    let logs_dir = workspace.join(".agentboard").join("logs");
    fs::create_dir_all(&logs_dir).map_err(to_error)?;
    let session_id = now_id("session");
    let log_path = logs_dir.join(format!("{}-{}.log", request.agent, session_id));
    let mut command = Command::new(&program);
    command.args(&args).current_dir(&workspace).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().map_err(|error| {
        format!(
            "Failed to spawn `{}` in {}: {}",
            program,
            workspace.display(),
            error
        )
    })?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let pid = child.id();
    let started_at = now_iso();
    let info = SessionInfo {
        id: session_id.clone(),
        workspace_path: workspace.to_string_lossy().to_string(),
        workspace_name: request.workspace_name,
        agent: request.agent.clone(),
        prompt: request.prompt.clone(),
        status: "running".to_string(),
        started_at,
        finished_at: None,
        log_path: log_path.to_string_lossy().to_string(),
        exit_code: None,
    };
    {
        let mut sessions = state
            .sessions
            .lock()
            .map_err(|_| "session state lock poisoned".to_string())?;
        sessions.insert(
            session_id.clone(),
            SessionControl {
                info: info.clone(),
                pid,
            },
        );
    }
    let log_file = Arc::new(Mutex::new(
        OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .map_err(to_error)?,
    ));
    write_log(
        &log_file,
        &format!(
            "[system] program={} args={:?} node={:?} skills={:?}",
            program, args, request.node_id, request.skills
        ),
    );
    emit_output(&app, &session_id, "system", &format!("Spawned `{program}` with pid {pid}"));
    if let Some(stdout) = stdout {
        spawn_reader(app.clone(), session_id.clone(), "stdout", stdout, log_file.clone());
    }
    if let Some(stderr) = stderr {
        spawn_reader(app.clone(), session_id.clone(), "stderr", stderr, log_file.clone());
    }
    let app_for_wait = app.clone();
    let session_for_wait = session_id.clone();
    let session_for_state = session_id.clone();
    std::thread::spawn(move || {
        let result = child.wait();
        let (status, exit_code, message) = match result {
            Ok(exit) if exit.success() => ("completed".to_string(), exit.code(), None),
            Ok(exit) => (
                "failed".to_string(),
                exit.code(),
                Some(format!("Process exited with status {exit}")),
            ),
            Err(error) => ("failed".to_string(), None, Some(error.to_string())),
        };
        let state = app_for_wait.state::<AppState>();
        if let Ok(mut sessions) = state.sessions.lock() {
            if let Some(control) = sessions.get_mut(&session_for_state) {
                control.info.status = status.clone();
                control.info.exit_code = exit_code;
                control.info.finished_at = Some(now_iso());
            }
        }
        let _ = app_for_wait.emit(
            "agent-status",
            AgentStatusEvent {
                session_id: session_for_wait,
                status,
                exit_code,
                message,
            },
        );
    });
    Ok(info)
}

#[tauri::command]
fn stop_session(state: State<AppState>, session_id: String) -> Result<bool, String> {
    let pid = {
        let sessions = state
            .sessions
            .lock()
            .map_err(|_| "session state lock poisoned".to_string())?;
        sessions
            .get(&session_id)
            .map(|control| control.pid)
            .ok_or_else(|| format!("Unknown session id: {session_id}"))?
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
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(true)
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
        fs::write(&preferences, "{\n  \"theme\": \"dark\",\n  \"defaultAgent\": \"codex\"\n}\n").map_err(to_error)?;
    }
    let recent = app_data.join("recent_sessions.json");
    if !recent.exists() {
        fs::write(&recent, "{\n  \"sessions\": []\n}\n").map_err(to_error)?;
    }
    Ok(())
}

fn read_workspaces_file(app_data: &Path) -> Result<WorkspacesFile, String> {
    ensure_global_files(app_data)?;
    let path = app_data.join("workspaces.json");
    let text = fs::read_to_string(&path).map_err(to_error)?;
    serde_json::from_str(&text).map_err(|error| format!("Invalid {}: {}", path.display(), error))
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
        node_count = pipelines.pipelines.iter().map(|pipeline| pipeline.nodes.len()).sum();
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
        match fs::read_to_string(&skill_json)
            .map_err(|error| error.to_string())
            .and_then(|text| serde_json::from_str::<SkillManifest>(&text).map_err(|error| error.to_string()))
        {
            Ok(manifest) => skills.push(SkillInfo {
                name: manifest.name.clone(),
                title: manifest.title.clone(),
                description: manifest.description.clone(),
                path: path.to_string_lossy().to_string(),
                manifest,
                markdown,
                enabled: true,
                error: None,
            }),
            Err(error) => {
                let manifest = SkillManifest {
                    name: fallback_name.clone(),
                    title: fallback_name.clone(),
                    description: "Invalid local skill manifest.".to_string(),
                    categories: vec!["invalid".to_string()],
                    compatible_agents: vec![],
                    version: "0.0.0".to_string(),
                    source: "local".to_string(),
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
                ".git" | "node_modules" | ".next" | "dist" | "build" | "target" | ".agentboard-worktrees"
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
                "ts"
                    | "tsx"
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
    for marker in ["from \"", "from '", "require(\"", "require('", "import(\"", "import('"] {
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
    if rel.components().any(|component| matches!(component, Component::ParentDir)) {
        return Err("Parent directory segments are not allowed in file paths.".to_string());
    }
    Ok(base.join(rel))
}

fn command_exists(command: &str) -> bool {
    if command.eq_ignore_ascii_case("cmd") {
        return env::var_os("COMSPEC").is_some();
    }
    let checker = if cfg!(windows) { "where" } else { "which" };
    Command::new(checker)
        .arg(command)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn run_command_capture(cwd: &Path, program: &str, args: &[&str]) -> Option<String> {
    Command::new(program)
        .current_dir(cwd)
        .args(args)
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).to_string())
}

fn agent_invocation(agent: &str, prompt: &str) -> Result<(String, Vec<String>), String> {
    match agent {
        "claude" => Ok(("claude".to_string(), vec!["--print".to_string(), prompt.to_string()])),
        "codex" => Ok(("codex".to_string(), vec!["exec".to_string(), prompt.to_string()])),
        "gemini" => Ok(("gemini".to_string(), vec!["-p".to_string(), prompt.to_string()])),
        "aider" => Ok(("aider".to_string(), vec!["--message".to_string(), prompt.to_string()])),
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
        "cmd" => Ok(("cmd".to_string(), vec!["/C".to_string(), prompt.to_string()])),
        other => Err(format!("Unsupported agent: {other}")),
    }
}

fn spawn_reader<R: std::io::Read + Send + 'static>(
    app: tauri::AppHandle,
    session_id: String,
    stream: &str,
    reader: R,
    log_file: Arc<Mutex<File>>,
) {
    let stream_name = stream.to_string();
    std::thread::spawn(move || {
        let reader = BufReader::new(reader);
        for line in reader.lines().map_while(Result::ok) {
            write_log(&log_file, &format!("[{stream_name}] {line}"));
            emit_output(&app, &session_id, &stream_name, &line);
        }
    });
}

fn emit_output(app: &tauri::AppHandle, session_id: &str, stream: &str, line: &str) {
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
    path.canonicalize()
        .map_err(to_error)
        .map(|path| path.to_string_lossy().to_string())
}

fn stable_id(value: &str) -> String {
    let mut hash: u64 = 1469598103934665603;
    for byte in value.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(1099511628211);
    }
    format!("ws-{hash:x}")
}

fn now_id(prefix: &str) -> String {
    format!("{prefix}-{}", now_compact())
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

fn sanitize_slug(value: &str) -> String {
    let clean: String = value
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch.to_ascii_lowercase() } else { '-' })
        .collect();
    clean.trim_matches('-').to_string()
}

fn pretty_json<T: Serialize>(value: &T) -> Result<String, String> {
    serde_json::to_string_pretty(value).map_err(to_error)
}

fn to_error<E: std::fmt::Display>(error: E) -> String {
    error.to_string()
}
