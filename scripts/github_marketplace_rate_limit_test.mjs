import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const utilityPath = path.join(root, 'src/lib/githubRateLimit.ts');
const source = readFileSync(utilityPath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2021,
  },
  fileName: utilityPath,
}).outputText;
const module = { exports: {} };
new Function('exports', 'module', 'require', compiled)(
  module.exports,
  module,
  () => {
    throw new Error('The rate-limit utility must not have runtime imports.');
  }
);

const {
  canOpenGithubPreview,
  formatGithubRetry,
  githubLimitMessage,
  githubUserFacingError,
} = module.exports;

const now = 1_700_000_000_000;
const resetAt = String(now / 1000 + 18 * 60);
const exhaustedCore = {
  limit: 60,
  remaining: 0,
  resetAt,
  resource: 'core',
};

assert.equal(formatGithubRetry(resetAt, now), 'Try again in 18 minutes');
assert.match(formatGithubRetry(String(now / 1000 + 2 * 60 * 60), now), /^Try again at /);

const rawEpochError = 'GitHub API rate limit reached. Retry after 1781107372.';
const userError = githubUserFacingError(rawEpochError, { core: exhaustedCore }, now);
assert.equal(
  userError,
  'GitHub core API limit reached. Add a GitHub token or try again in 18 minutes.'
);
assert.equal(userError.includes('1781107372'), false);
assert.match(githubLimitMessage('core', exhaustedCore, now), /Add a GitHub token/);

assert.equal(canOpenGithubPreview(exhaustedCore, false, now), false);
assert.equal(canOpenGithubPreview(exhaustedCore, true, now), true);
assert.equal(
  canOpenGithubPreview({ ...exhaustedCore, remaining: 5 }, false, now),
  true
);

const component = readFileSync(
  path.join(root, 'src/components/skills/GithubMarketplace.tsx'),
  'utf8'
);
assert.match(component, /disabled=\{!previewEnabled\}/);
assert.match(component, /coreQuotaLow \|\|/);
assert.match(component, /\{coreQuotaLow && \([\s\S]*?Add GitHub token/);
assert.match(component, /cached preview/);

console.log('GitHub marketplace rate-limit UX tests passed.');
