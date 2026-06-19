import fs from 'node:fs';
import path from 'node:path';
import { evalValue, withPage } from './cdp-qa-utils.mjs';

const port = Number(process.argv[2] ?? 9223);
const outDir = path.resolve('output/github-marketplace-qa');
const workspacePath = path.resolve('output/github-marketplace-qa/workspace-live');
const flow = JSON.parse(fs.readFileSync(path.join(outDir, 'packaged-flow-summary.json'), 'utf8'));
const skillName = flow.install.name;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const quote = (value) => JSON.stringify(value);

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

async function clickButton(send, text, exact = false) {
  return ui(
    send,
    `
      const text = ${quote(text)};
      const button = Array.from(document.querySelectorAll('button')).find((item) => {
        const value = (item.innerText || item.getAttribute('aria-label') || '').trim();
        return ${exact ? 'value === text' : 'value.includes(text)'};
      });
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
      const button = Array.from(document.querySelectorAll('button')).find((item) =>
        (item.innerText || '').includes(${quote(text)})
      );
      if (!button) throw new Error('Context target not found: ' + ${quote(text)});
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

const result = await withPage(port, async (send) => {
  await sleep(1000);
  let bootstrap = await invoke(send, 'bootstrap');
  let workspace = bootstrap.workspaces.find((item) => path.resolve(item.path) === workspacePath);
  if (!workspace) {
    workspace = await invoke(send, 'add_workspace', { path: workspacePath, createStarter: false });
    bootstrap = await invoke(send, 'bootstrap');
    workspace = bootstrap.workspaces.find((item) => path.resolve(item.path) === workspacePath);
  }
  const bundle = await invoke(send, 'load_workspace', { workspaceId: workspace.id });
  const skillIndex = bundle.skills.findIndex((skill) => skill.name === skillName);
  const skill = bundle.skills[skillIndex];
  if (!skill) throw new Error('Skill missing after packaged restart: ' + skillName);

  await clickButton(send, 'workspace-live');
  await contextMenuButton(send, 'workspace-live');
  await clickButton(send, 'Deploy agent', true);
  await clickButton(send, 'Continue');
  await clickButton(send, 'Continue');
  const modalSkill = await ui(
    send,
    `
      const modal = Array.from(document.querySelectorAll('.fixed')).find((item) =>
        (item.innerText || '').includes('Deploy agent')
      ) || document;
      const labels = Array.from(modal.querySelectorAll('label')).filter((label) =>
        label.querySelector('input[type="checkbox"]')
      );
      const label = labels[${skillIndex}];
      if (!label) throw new Error('Modal skill label missing at index ' + ${skillIndex});
      const checkbox = label.querySelector('input[type="checkbox"]');
      return {
        label: label.innerText,
        checkboxDisabled: checkbox.disabled,
        checkboxChecked: checkbox.checked,
        modalText: document.body.innerText.slice(0, 2500)
      };
    `
  );

  return {
    skillName,
    skillPath: skill.path,
    repoFullName: skill.repoFullName,
    trustState: skill.trustState,
    enabled: skill.enabled,
    sourceContentKind: skill.sourceContentKind,
    skillIndex,
    modalSkill,
    selectable: skill.enabled && modalSkill.checkboxDisabled === false,
  };
});

const summaryPath = path.join(outDir, 'packaged-restart-summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ summaryPath, ...result }, null, 2));
