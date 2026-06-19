import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { evalValue, withPage } from './cdp-qa-utils.mjs';

const port = Number(process.argv[2] ?? 9223);
const outDir = path.resolve('output/github-marketplace-qa');
const workspacePath = path.resolve('output/github-marketplace-qa/workspace-live');
const flow = JSON.parse(fs.readFileSync(path.join(outDir, 'packaged-flow-summary.json'), 'utf8'));
const skillName = flow.install.name;
const skillPath = path.join(workspacePath, '.agentboard', 'skills', skillName);

const quote = (value) => JSON.stringify(value);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fileHash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function hashInstall() {
  return {
    skillMarkdown: fileHash(path.join(skillPath, 'SKILL.md')),
    skillJson: fileHash(path.join(skillPath, 'skill.json')),
    sourceJson: fileHash(path.join(skillPath, 'source.json')),
  };
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

const beforeHashes = hashInstall();

const result = await withPage(port, async (send) => {
  const rateBefore = await invoke(send, 'github_marketplace_rate_limit').catch((error) => ({
    error: error.message,
  }));
  const update = await invoke(send, 'github_marketplace_update', {
    request: { workspacePath, skillName, confirm: false },
  });
  const rateAfter = await invoke(send, 'github_marketplace_rate_limit').catch((error) => ({
    error: error.message,
  }));

  const bootstrap = await invoke(send, 'bootstrap');
  const workspace = bootstrap.workspaces.find((item) => path.resolve(item.path) === workspacePath);
  const bundle = await invoke(send, 'load_workspace', { workspaceId: workspace.id });
  const githubIndex = bundle.skills
    .filter((skill) => skill.manifest.source === 'github')
    .findIndex((skill) => skill.name === skillName);

  const uiWarning = await ui(
    send,
    `
      const close = document.querySelector('[aria-label="Close deployment"]');
      if (close) close.click();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const navSkills = Array.from(document.querySelectorAll('button')).find((button) =>
        (button.innerText || '').trim() === 'Skills'
      );
      if (!navSkills) throw new Error('Skills navigation button not found');
      navSkills.click();
      await new Promise((resolve) => setTimeout(resolve, 600));
      const marketplaceTab = Array.from(document.querySelectorAll('button')).find((button) =>
        (button.innerText || '').trim() === 'Marketplace'
      );
      if (marketplaceTab) {
        marketplaceTab.click();
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
      const section = Array.from(document.querySelectorAll('section')).find((item) =>
        (item.innerText || '').includes('Installed from GitHub')
      );
      if (!section) throw new Error('Installed from GitHub section not found');
      const updates = Array.from(section.querySelectorAll('button')).filter((button) =>
        (button.innerText || '').includes('Update')
      );
      const button = updates[${githubIndex}];
      if (!button) throw new Error('Update button not found at github index ' + ${githubIndex});
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 1600));
      const text = document.body.innerText;
      return {
        githubIndex: ${githubIndex},
        updateButtonCount: updates.length,
        hasRateLimitedToast: text.includes('GitHub update check is rate-limited'),
        hasCachedMessage: text.includes('Existing install was left unchanged') ||
          text.includes('cached preview status is available'),
        bodyText: text.slice(0, 5000)
      };
    `
  );

  return { rateBefore, update, rateAfter, uiWarning };
});

const afterHashes = hashInstall();
const summary = {
  skillName,
  skillPath,
  beforeHashes,
  afterHashes,
  unchanged:
    beforeHashes.skillMarkdown === afterHashes.skillMarkdown &&
    beforeHashes.skillJson === afterHashes.skillJson &&
    beforeHashes.sourceJson === afterHashes.sourceJson,
  ...result,
};

const summaryPath = path.join(outDir, 'rate-limit-update-summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ summaryPath, ...summary }, null, 2));
