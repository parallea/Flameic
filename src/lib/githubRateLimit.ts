import type { GithubRateLimit, GithubRateLimits } from './types';

export const GITHUB_CORE_REQUESTS_FOR_PREVIEW = 5;

export function githubResetTimeMs(resetAt?: string) {
  if (!resetAt) return null;
  const numeric = Number(resetAt);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(resetAt);
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatGithubRetry(resetAt?: string, now = Date.now()) {
  const resetTime = githubResetTimeMs(resetAt);
  if (resetTime === null) return 'Try again after the GitHub limit resets';
  const remainingMs = resetTime - now;
  if (remainingMs <= 0) return 'Try again now';
  if (remainingMs <= 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
    return `Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }
  const localTime = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(resetTime));
  return `Try again at ${localTime}`;
}

function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function githubLimitMessage(
  resource: 'core' | 'search',
  rateLimit?: GithubRateLimit,
  now = Date.now()
) {
  return `GitHub ${resource} API limit reached. Add a GitHub token or ${lowerFirst(
    formatGithubRetry(rateLimit?.resetAt, now)
  )}.`;
}

export function githubUserFacingError(
  error: unknown,
  rateLimits: Partial<GithubRateLimits> = {},
  now = Date.now()
) {
  const detail = error instanceof Error ? error.message : String(error);
  const epoch = detail.match(/\b\d{10,13}\b/)?.[0];
  if (/rate limit|api limit reached/i.test(detail)) {
    const resource = /\bsearch\b/i.test(detail) ? 'search' : 'core';
    const knownRate = rateLimits[resource];
    const fallbackRate = epoch
      ? { limit: 0, remaining: 0, resetAt: epoch, resource }
      : undefined;
    return githubLimitMessage(resource, knownRate ?? fallbackRate, now);
  }
  return detail
    .replace(/retry after \d{10,13}\.?/gi, formatGithubRetry(epoch, now))
    .replace(/\b\d{10,13}\b/g, 'the GitHub reset time');
}

export function isGithubCoreQuotaLow(rateLimit?: GithubRateLimit, now = Date.now()) {
  if (!rateLimit) return false;
  const resetTime = githubResetTimeMs(rateLimit.resetAt);
  if (resetTime !== null && resetTime <= now) return false;
  return rateLimit.remaining < GITHUB_CORE_REQUESTS_FOR_PREVIEW;
}

export function canOpenGithubPreview(
  coreRateLimit: GithubRateLimit | undefined,
  cachedPreviewAvailable: boolean,
  now = Date.now()
) {
  return cachedPreviewAvailable || !isGithubCoreQuotaLow(coreRateLimit, now);
}
