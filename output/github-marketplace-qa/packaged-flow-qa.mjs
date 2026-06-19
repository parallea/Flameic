import fs from 'node:fs';
import path from 'node:path';
import { evalValue, withPage } from './cdp-qa-utils.mjs';

const port = Number(process.argv[2] ?? 9223);
const workspacePath = path.resolve('output/github-marketplace-qa/workspace-live');
const outDir = path.resolve('output/github-marketplace-qa');
const installName = `qa-package-formal-${Date.now().toString(36)}`;
const repoFullName = 'joeseesun/qiaomu-skill-publisher';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function quote(value) {
  return JSON.stringify(value);
}

async function invoke(send, command, args = {}) {
  return evalValue(
    send,
    `window.__TAURI__.core.invoke(${quote(command)}, ${quote(args)})`,
    true
  );
}

async function ui(send, source) {
  return evalValue(send, `(async () => { ${source} })()`, true);
}

async function clickButton(send, text, options = {}) {
  const { contains = true, index = 0 } = options;
  return ui(
    send,
    `
      const text = ${quote(text)};
      const matches = Array.from(document.querySelectorAll('button')).filter((button) => {
        const value = (button.innerText || button.getAttribute('aria-label') || '').trim();
        return ${contains ? 'value.includes(text)' : 'value === text'};
      });
      const button = matches[${index}];
      if (!button) throw new Error('Button not found: ' + text);
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 350));
      return document.body.innerText;
    `
  );
}

async function contextMenuButton(send, text) {
  return ui(
    send,
    `
      const text = ${quote(text)};
      const button = Array.from(document.querySelectorAll('button')).find((item) =>
        (item.innerText || '').includes(text)
      );
      if (!button) throw new Error('Context target not found: ' + text);
      const rect = button.getBoundingClientRect();
      button.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
        buttons: 2,
        clientX: rect.left + 20,
        clientY: rect.top + 20
      }));
      await new Promise((resolve) => setTimeout(resolve, 350));
      return document.body.innerText;
    `
  );
}

async function openDeployStep3(send) {
  await clickButton(send, 'workspace-live');
  await contextMenuButton(send, 'workspace-live');
  await clickButton(send, 'Deploy agent', { contains: false });
  await clickButton(send, 'Continue');
  await clickButton(send, 'Continue');
  return evalValue(send, 'document.body.innerText', false);
}

async function stageDeploymentFromUi(send, skillName, skillIndex) {
  await openDeployStep3(send);
  const modalState = await ui(
    send,
    `
      const task = document.querySelector('textarea');
      if (!task) throw new Error('Task textarea not found');
      task.value = 'Packaged QA prompt preview only. Do not run Codex.';
      task.dispatchEvent(new Event('input', { bubbles: true }));

      const buttons = Array.from(document.querySelectorAll('button'));
      const inspect = buttons.find((button) => (button.innerText || '').includes('Inspect target only'));
      if (inspect) inspect.click();
      const stageOnly = buttons.find((button) => (button.innerText || '').trim() === 'Stage only');
      if (!stageOnly) throw new Error('Stage only button not found');
      stageOnly.click();

      const modal = Array.from(document.querySelectorAll('.fixed')).find((item) =>
        (item.innerText || '').includes('Deploy agent')
      ) || document;
      const labels = Array.from(modal.querySelectorAll('label')).filter((label) =>
        label.querySelector('input[type="checkbox"]')
      );
      const skillLabel = labels[${skillIndex}];
      if (!skillLabel) {
        throw new Error(
          'Skill label index not found: ' + ${skillIndex} + ' for ' + ${quote(skillName)} +
          ' labels=' + labels.map((label) => label.innerText).join(' || ')
        );
      }
      const checkbox = skillLabel.querySelector('input[type="checkbox"]');
      if (!checkbox) throw new Error('Skill checkbox not found: ' + ${quote(skillName)});
      const beforeDisabled = checkbox.disabled;
      if (!checkbox.checked) checkbox.click();
      await new Promise((resolve) => setTimeout(resolve, 250));
      return {
        skillLabel: skillLabel.innerText,
        checkboxDisabled: beforeDisabled,
        checkboxChecked: checkbox.checked,
        modalText: document.body.innerText.slice(0, 4000)
      };
    `
  );
  await clickButton(send, 'Run preflight');
  await clickButton(send, 'Stage deployment');
  return modalState;
}

async function screenshot(send, filename) {
  const result = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const target = path.join(outDir, filename);
  fs.writeFileSync(target, Buffer.from(result.data, 'base64'));
  return target;
}

const summary = await withPage(port, async (send) => {
  let bootstrap = await invoke(send, 'bootstrap');
  if (!bootstrap.workspaces.some((workspace) => path.resolve(workspace.path) === workspacePath)) {
    await invoke(send, 'add_workspace', { path: workspacePath, createStarter: false });
    bootstrap = await invoke(send, 'bootstrap');
  }

  const beforeRate = await invoke(send, 'github_marketplace_rate_limit').catch((error) => ({
    error: error.message,
  }));
  const search = await invoke(send, 'github_marketplace_search', {
    request: {
      workspacePath,
      query: repoFullName,
      sort: 'best_match',
      onlyDetectedSkillFiles: false,
      forceRefresh: false,
    },
  });
  const repo = search.items.find((item) => item.fullName === repoFullName) ?? search.items[0];
  if (!repo) throw new Error('Package QA repo not found');
  const candidate =
    repo.candidates.find((item) => item.sourceContentKind === 'formal_skill') ??
    repo.candidates[0];
  if (!candidate) throw new Error('Package QA candidate not found');
  const preview = await invoke(send, 'github_marketplace_preview', {
    request: {
      workspacePath,
      repoFullName: repo.fullName,
      candidateId: candidate.id,
      candidatePath: candidate.candidatePath,
      forceRefresh: false,
    },
  });
  const install = await invoke(send, 'github_marketplace_install', {
    request: {
      workspacePath,
      repoFullName: repo.fullName,
      candidateId: preview.candidateId,
      candidatePath: preview.candidatePath,
      previewCommitSha: preview.commitSha,
      skillMarkdownPath: preview.skillMarkdownPath,
      skillJsonPath: preview.skillJsonPath,
      readmePath: preview.readmePath,
      installName,
      allowReadmeDraft: false,
      duplicateAction: 'overwrite',
    },
  });
  const reviewed = await invoke(send, 'github_marketplace_set_trust', {
    request: { workspacePath, skillName: installName, trustState: 'reviewed' },
  });
  const afterRate = await invoke(send, 'github_marketplace_rate_limit').catch((error) => ({
    error: error.message,
  }));

  await send('Page.reload', { ignoreCache: true });
  await sleep(2500);
  await send('Runtime.enable');
  bootstrap = await invoke(send, 'bootstrap');
  const workspace = bootstrap.workspaces.find(
    (item) => path.resolve(item.path) === workspacePath
  );
  if (!workspace) throw new Error('Workspace missing after reload');
  const bundle = await invoke(send, 'load_workspace', { workspaceId: workspace.id });
  const targetSkillIndex = bundle.skills.findIndex((skill) => skill.name === installName);
  if (targetSkillIndex < 0) throw new Error('Installed skill missing from bundle after reload');

  const uiStageState = await stageDeploymentFromUi(send, installName, targetSkillIndex);
  await sleep(700);
  const deployments = await invoke(send, 'list_deployments');
  const deployment = deployments.find((item) => item.selectedSkills.includes(installName));
  if (!deployment) throw new Error('Staged deployment not found for package QA skill');
  const shot = await screenshot(send, 'packaged-flow-after-stage.png');

  const skillPath = path.join(workspacePath, '.agentboard', 'skills', installName);
  const sourceJsonPath = path.join(skillPath, 'source.json');
  const sourceJson = JSON.parse(fs.readFileSync(sourceJsonPath, 'utf8'));
  const filesExist = {
    skillMarkdown: fs.existsSync(path.join(skillPath, 'SKILL.md')),
    skillJson: fs.existsSync(path.join(skillPath, 'skill.json')),
    sourceJson: fs.existsSync(sourceJsonPath),
  };

  return {
    workspacePath,
    repoFullName: repo.fullName,
    searchCached: search.cached,
    repositoryCardPresent: Boolean(repo),
    candidateListCount: repo.candidates.length,
    preview: {
      cached: preview.cached,
      candidatePath: preview.candidatePath,
      commitSha: preview.commitSha,
      selectedFiles: preview.files.map((file) => file.path),
      sourceContentKind: preview.sourceContentKind,
    },
    install: {
      name: installName,
      status: install.status,
      path: install.path,
      message: install.message,
      filesExist,
      sourceJson,
    },
    reviewed: {
      name: reviewed.name,
      trustState: reviewed.trustState,
      enabled: reviewed.enabled,
    },
    rateLimit: {
      beforeRemaining: beforeRate.core?.remaining,
      afterRemaining: afterRate.core?.remaining,
    },
    uiStageState,
    targetSkillIndex,
    promptProof: {
      deploymentId: deployment.id,
      status: deployment.status,
      selectedSkills: deployment.selectedSkills,
      includesRepoSource: deployment.prompt.includes(
        `Skill source: GitHub import from ${repo.fullName}`
      ),
      includesFormalKind: deployment.prompt.includes('sourceContentKind: formal_skill'),
      includesSkillName: deployment.prompt.includes(installName),
      promptPath: path.join(outDir, 'packaged-staged-prompt-proof.txt'),
    },
    screenshot: shot,
  };
});

fs.writeFileSync(summary.promptProof.promptPath, summary.promptProof.deploymentId + '\n\n');
const deploymentsPath = path.join(process.env.APPDATA ?? '', 'AgentBoard', 'deployments.json');
if (fs.existsSync(deploymentsPath)) {
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8')).deployments ?? [];
  const deployment = deployments.find((item) => item.id === summary.promptProof.deploymentId);
  if (deployment?.prompt) {
    fs.writeFileSync(summary.promptProof.promptPath, deployment.prompt);
  }
}

const summaryPath = path.join(outDir, 'packaged-flow-summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ summaryPath, ...summary }, null, 2));
