import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FolderOpen,
  GitFork,
  KeyRound,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  canOpenGithubPreview,
  githubLimitMessage,
  githubResetTimeMs,
  githubUserFacingError,
  isGithubCoreQuotaLow,
} from '../../lib/githubRateLimit';
import { agentboardApi } from '../../lib/tauri';
import type {
  GithubMarketplaceCandidate,
  GithubMarketplacePreview,
  GithubMarketplaceRepo,
  GithubMarketplaceSearchResult,
  GithubMarketplaceUpdateResult,
  GithubRateLimit,
  GithubRateLimits,
  SkillInfo,
} from '../../lib/types';

interface GithubSkillsMarketplaceProps {
  workspacePath: string;
  skills: SkillInfo[];
  onRefresh: () => Promise<void>;
}

type MarketplaceSort = 'best_match' | 'stars' | 'updated';

function statusLabel(status: GithubMarketplaceRepo['detectedSkillStatus']) {
  if (status === 'formal_skill') return 'Formal skill';
  if (status === 'readme_only') return 'README draft';
  if (status === 'detection_unavailable') return 'Detection unavailable';
  return 'No skill files';
}

function candidateKindLabel(candidate: GithubMarketplaceCandidate) {
  if (candidate.readmeOnly) return 'README draft';
  if (candidate.formalSkill) return 'Formal skill';
  return 'Formal metadata';
}

function installStatusLabel(status: GithubMarketplaceCandidate['installStatus']) {
  if (status === 'update_available') return 'Update available';
  if (status === 'installed') return 'Already installed';
  if (status === 'disabled') return 'Disabled';
  return 'Not installed';
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function trustCanInject(skill: SkillInfo) {
  return skill.trustState === 'reviewed' || skill.trustState === 'trusted';
}

export function GithubSkillsMarketplace({
  workspacePath,
  skills,
  onRefresh,
}: GithubSkillsMarketplaceProps) {
  const [query, setQuery] = useState('software engineering agent skill');
  const [sort, setSort] = useState<MarketplaceSort>('best_match');
  const [language, setLanguage] = useState('');
  const [minimumStars, setMinimumStars] = useState('');
  const [onlyDetected, setOnlyDetected] = useState(true);
  const [result, setResult] = useState<GithubMarketplaceSearchResult | null>(null);
  const [preview, setPreview] = useState<GithubMarketplacePreview | null>(null);
  const [selectedFile, setSelectedFile] = useState(0);
  const [installName, setInstallName] = useState('');
  const [allowReadmeDraft, setAllowReadmeDraft] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<'cancel' | 'rename' | 'overwrite'>(
    'cancel'
  );
  const [token, setToken] = useState('');
  const [tokenStored, setTokenStored] = useState(false);
  const [rateLimits, setRateLimits] = useState<Partial<GithubRateLimits>>({});
  const [quotaNow, setQuotaNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [postInstallSkillName, setPostInstallSkillName] = useState<string | null>(null);
  const [highlightedSkillName, setHighlightedSkillName] = useState<string | null>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const installedSectionRef = useRef<HTMLDivElement>(null);

  const githubSkills = useMemo(
    () => skills.filter((skill) => skill.manifest.source === 'github'),
    [skills]
  );
  const postInstallSkill = useMemo(
    () => githubSkills.find((skill) => skill.name === postInstallSkillName) ?? null,
    [githubSkills, postInstallSkillName]
  );

  const refreshRateLimits = useCallback(async () => {
    try {
      const next = await agentboardApi.githubMarketplaceRateLimit();
      setRateLimits(next);
      setQuotaNow(Date.now());
    } catch {
      // Marketplace requests still return resource-specific quota headers when available.
    }
  }, []);

  useEffect(() => {
    void refreshRateLimits();
  }, [refreshRateLimits]);

  const coreRateLimit = rateLimits.core;
  const searchRateLimit = rateLimits.search;
  const coreQuotaLow = isGithubCoreQuotaLow(coreRateLimit, quotaNow);
  const coreLimitMessage = githubLimitMessage('core', coreRateLimit);

  useEffect(() => {
    const resetTime = githubResetTimeMs(coreRateLimit?.resetAt);
    if (resetTime === null || resetTime <= quotaNow) return;
    const delay = Math.min(resetTime - quotaNow + 1000, 2_147_483_647);
    const timer = window.setTimeout(() => {
      setQuotaNow(Date.now());
      void refreshRateLimits();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [coreRateLimit?.resetAt, quotaNow, refreshRateLimits]);

  const mergeRateLimit = (next: GithubRateLimit) => {
    if (next.resource !== 'core' && next.resource !== 'search') return;
    setRateLimits((current) => ({ ...current, [next.resource]: next }));
    setQuotaNow(Date.now());
  };

  const userFacingError = (nextError: unknown) =>
    githubUserFacingError(nextError, rateLimits);

  const focusGithubToken = () => {
    setPreview(null);
    window.setTimeout(() => {
      tokenInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      tokenInputRef.current?.focus();
    }, 0);
  };

  const search = async (forceRefresh = false) => {
    if (!query.trim()) {
      setError('Enter a GitHub marketplace search query.');
      return;
    }
    try {
      setBusy('search');
      setError('');
      const next = await agentboardApi.githubMarketplaceSearch({
        workspacePath,
        query: query.trim(),
        sort,
        language: language.trim() || undefined,
        minimumStars: minimumStars ? Number(minimumStars) : undefined,
        onlyDetectedSkillFiles: onlyDetected,
        forceRefresh,
      });
      setResult(next);
      mergeRateLimit(next.rateLimit);
      void refreshRateLimits();
      const candidateCount = next.items.reduce((total, item) => total + item.candidates.length, 0);
      toast.success(`GitHub search returned ${next.items.length} repositories`, {
        description: `${candidateCount} candidate${candidateCount === 1 ? '' : 's'} detected`,
      });
    } catch (searchError) {
      const detail = userFacingError(searchError);
      setError(detail);
      toast.error('GitHub marketplace search failed', { description: detail });
    } finally {
      setBusy(null);
    }
  };

  const openPreview = async (
    repo: GithubMarketplaceRepo,
    candidate: GithubMarketplaceCandidate,
    forceRefresh = false
  ) => {
    try {
      setBusy(`preview:${candidate.id}`);
      setError('');
      const next = await agentboardApi.githubMarketplacePreview(
        workspacePath,
        repo.fullName,
        candidate,
        forceRefresh
      );
      setPreview(next);
      setSelectedFile(0);
      setInstallName(next.recommendedName);
      setAllowReadmeDraft(false);
      setDuplicateAction(next.candidate.installedSkillName ? 'cancel' : 'rename');
      mergeRateLimit(next.rateLimit);
      setResult((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.fullName === repo.fullName
                  ? {
                      ...item,
                      previewCached: true,
                      candidates: item.candidates.map((existing) =>
                        existing.id === next.candidateId
                          ? { ...existing, previewCached: true }
                          : existing
                      ),
                    }
                  : item
              ),
            }
          : current
      );
      void refreshRateLimits();
    } catch (previewError) {
      const detail = userFacingError(previewError);
      setError(detail);
      toast.error('GitHub skill preview failed', { description: detail });
    } finally {
      setBusy(null);
    }
  };

  const install = async () => {
    if (!preview) return;
    if (preview.readmeOnly && !allowReadmeDraft) {
      setError('Confirm Create draft from README before installing this repository draft.');
      return;
    }
    try {
      setBusy('install');
      setError('');
      const installed = await agentboardApi.githubMarketplaceInstall({
        workspacePath,
        repoFullName: preview.repo.fullName,
        candidateId: preview.candidateId,
        candidatePath: preview.candidatePath,
        previewCommitSha: preview.commitSha,
        skillMarkdownPath: preview.skillMarkdownPath,
        skillJsonPath: preview.skillJsonPath,
        readmePath: preview.readmePath,
        installName: installName.trim() || preview.recommendedName,
        allowReadmeDraft,
        duplicateAction,
      });
      if (installed.status === 'conflict') {
        setInstallName(installed.suggestedName ?? installName);
        setError(installed.message);
        return;
      }
      toast.success(preview.readmeOnly ? 'README draft created as untrusted' : 'GitHub skill installed as untrusted', {
        description: installed.path,
      });
      if (installed.skill) {
        setPostInstallSkillName(installed.skill.name);
        setHighlightedSkillName(installed.skill.name);
      }
      await onRefresh();
      setResult((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.fullName === preview.repo.fullName
                  ? {
                      ...item,
                      installStatus: 'installed',
                      installedSkillName: installed.skill?.name ?? item.installedSkillName,
                      candidates: item.candidates.map((candidate) =>
                        candidate.id === preview.candidateId
                          ? {
                              ...candidate,
                              installStatus: 'installed',
                              installedSkillName:
                                installed.skill?.name ?? candidate.installedSkillName,
                            }
                          : candidate
                      ),
                    }
                  : item
              ),
            }
          : current
      );
      setPreview(null);
    } catch (installError) {
      const detail = userFacingError(installError);
      setError(detail);
      toast.error('GitHub skill installation failed', { description: detail });
    } finally {
      setBusy(null);
    }
  };

  const setTrust = async (
    skill: SkillInfo,
    trustState: 'untrusted' | 'reviewed' | 'trusted' | 'disabled'
  ) => {
    if (
      (trustState === 'reviewed' || trustState === 'trusted') &&
      !window.confirm(
        `Mark ${skill.title} as ${trustState}?\n\nOnly instruction/context files will be enabled. AgentBoard will not execute repository scripts or install commands.`
      )
    ) {
      return;
    }
    try {
      setBusy(`trust:${skill.name}`);
      const updated = await agentboardApi.githubMarketplaceSetTrust(
        workspacePath,
        skill.name,
        trustState
      );
      await onRefresh();
      if (updated.name === postInstallSkillName && trustCanInject(updated)) {
        setPostInstallSkillName(null);
      }
      toast.success(`${updated.title} is now ${trustState}`);
    } catch (trustError) {
      toast.error('Could not update skill trust', { description: userFacingError(trustError) });
    } finally {
      setBusy(null);
    }
  };

  const updateSkill = async (skill: SkillInfo) => {
    try {
      setBusy(`update:${skill.name}`);
      const plan = await agentboardApi.githubMarketplaceUpdate(workspacePath, skill.name, false);
      if (plan.status === 'cached_rate_limited') {
        toast.warning('GitHub update check is rate-limited', { description: plan.message });
        return;
      }
      if (plan.status === 'up_to_date') {
        toast.success(`${skill.title} is already up to date`);
        return;
      }
      const confirmed = window.confirm(
        `Update ${skill.title}?\n\nChanged files:\n${plan.changedFiles.join(
          '\n'
        )}\n\nAgentBoard will back up the current files before replacing them.`
      );
      if (!confirmed) return;
      const updated: GithubMarketplaceUpdateResult = await agentboardApi.githubMarketplaceUpdate(
        workspacePath,
        skill.name,
        true
      );
      if (updated.status === 'cached_rate_limited') {
        toast.warning('GitHub update check is rate-limited', { description: updated.message });
        return;
      }
      await onRefresh();
      toast.success('GitHub skill updated', { description: updated.backupPath });
    } catch (updateError) {
      toast.error('GitHub skill update failed', { description: userFacingError(updateError) });
    } finally {
      setBusy(null);
    }
  };

  const uninstallSkill = async (skill: SkillInfo) => {
    if (
      !window.confirm(
        `Uninstall ${skill.title}?\n\nThe skill folder will be moved to .agentboard/skills/.trash and can be recovered manually.`
      )
    ) {
      return;
    }
    try {
      setBusy(`uninstall:${skill.name}`);
      const removed = await agentboardApi.githubMarketplaceUninstall(workspacePath, skill.name);
      await onRefresh();
      toast.success('GitHub skill moved to trash', { description: removed.trashPath });
    } catch (uninstallError) {
      toast.error('GitHub skill uninstall failed', {
        description: userFacingError(uninstallError),
      });
    } finally {
      setBusy(null);
    }
  };

  const saveToken = async () => {
    try {
      setBusy('token');
      const status = await agentboardApi.saveGithubToken(token);
      setToken('');
      setTokenStored(status.stored);
      setRateLimits(status.rateLimits ?? {});
      setQuotaNow(Date.now());
      toast.success('GitHub token saved for this session only');
    } catch (tokenError) {
      toast.error('GitHub token was rejected', { description: userFacingError(tokenError) });
    } finally {
      setBusy(null);
    }
  };

  const clearToken = async () => {
    await agentboardApi.clearGithubToken();
    setToken('');
    setTokenStored(false);
    await refreshRateLimits();
    toast.success('GitHub token cleared from memory');
  };

  const reviewNow = () => {
    installedSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (postInstallSkillName) setHighlightedSkillName(postInstallSkillName);
  };

  const openInstalledFolder = async (skillName: string) => {
    try {
      const opened = await agentboardApi.openSkillFolder(workspacePath, skillName);
      toast.success('Opened installed skill folder', { description: opened });
    } catch (folderError) {
      toast.error('Could not open installed skill folder', {
        description: userFacingError(folderError),
      });
    }
  };

  return (
    <div className="space-y-5">
      <section className="surface-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">GitHub Skills Marketplace</p>
            <p className="mt-1 text-2xs text-muted-foreground">
              Search and import instruction files only. AgentBoard never executes remote code.
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-2xs text-muted-foreground">
            {result?.cached && (
              <span className="rounded border border-subtle px-2 py-1">
                cached search results
              </span>
            )}
            {searchRateLimit && (
              <span className="rounded border border-subtle px-2 py-1">
                GitHub search: {searchRateLimit.remaining}/{searchRateLimit.limit}
              </span>
            )}
            {coreRateLimit && (
              <span className="rounded border border-subtle px-2 py-1">
                GitHub core: {coreRateLimit.remaining}/{coreRateLimit.limit}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <div className="command-input flex min-w-0 flex-1 items-center gap-2 rounded border border-subtle bg-input px-3 py-2">
            <Search size={14} className="shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void search()}
              placeholder="Search GitHub for agent skills..."
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
            />
          </div>
          <button
            onClick={() => void search()}
            disabled={busy === 'search'}
            className="btn-primary text-xs"
          >
            {busy === 'search' ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <Search size={13} />
            )}
            Search GitHub
          </button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as MarketplaceSort)}
            className="rounded border border-subtle bg-input px-2 py-1.5 text-xs text-foreground"
          >
            <option value="best_match">Best match</option>
            <option value="stars">Most stars</option>
            <option value="updated">Recently updated</option>
          </select>
          <input
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            placeholder="Language, e.g. TypeScript"
            className="rounded border border-subtle bg-input px-2 py-1.5 text-xs text-foreground outline-none"
          />
          <input
            value={minimumStars}
            onChange={(event) => setMinimumStars(event.target.value.replace(/\D/g, ''))}
            placeholder="Minimum stars"
            className="rounded border border-subtle bg-input px-2 py-1.5 text-xs text-foreground outline-none"
          />
          <label className="flex items-center gap-2 rounded border border-subtle bg-input px-2 py-1.5 text-xs">
            <input
              type="checkbox"
              checked={onlyDetected}
              onChange={(event) => setOnlyDetected(event.target.checked)}
            />
            Only detected skill files
          </label>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {coreQuotaLow && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            <span>{coreLimitMessage}</span>
            <button onClick={focusGithubToken} className="btn-ghost text-xs">
              <KeyRound size={13} /> Add GitHub token
            </button>
          </div>
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        {result?.items.map((repo) => {
          const formalCandidates = repo.candidates.filter((candidate) => !candidate.readmeOnly);
          const readmeDrafts = repo.candidates.filter((candidate) => candidate.readmeOnly);
          const renderCandidate = (candidate: GithubMarketplaceCandidate) => {
            const previewEnabled = canOpenGithubPreview(
              coreRateLimit,
              candidate.previewCached || repo.previewCached,
              quotaNow
            );
            const busyPreview = busy === `preview:${candidate.id}`;
            return (
              <button
                key={candidate.id}
                onClick={() => void openPreview(repo, candidate)}
                disabled={!previewEnabled}
                title={!previewEnabled ? coreLimitMessage : undefined}
                className={`w-full rounded border p-3 text-left transition-colors hover:border-primary/30 hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60 ${
                  candidate.readmeOnly
                    ? 'border-warning/25 bg-warning/[0.04]'
                    : 'border-subtle bg-card/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {candidate.candidateName}
                    </p>
                    <p className="mt-1 truncate font-mono text-2xs text-muted-foreground">
                      {candidate.candidatePath}
                    </p>
                  </div>
                  {busyPreview ? (
                    <RefreshCw size={13} className="mt-0.5 shrink-0 animate-spin text-primary" />
                  ) : (
                    <Download size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span
                    className={`rounded border px-2 py-1 font-mono text-2xs ${
                      candidate.readmeOnly
                        ? 'border-warning/30 text-warning'
                        : candidate.formalSkill
                          ? 'border-success/30 text-success'
                          : 'border-warning/30 text-warning'
                    }`}
                  >
                    {candidateKindLabel(candidate)}
                  </span>
                  {candidate.nested && (
                    <span className="rounded border border-subtle px-2 py-1 font-mono text-2xs">
                      Nested skill
                    </span>
                  )}
                  {candidate.installStatus !== 'not_installed' && (
                    <span
                      className={`rounded border px-2 py-1 font-mono text-2xs ${
                        candidate.installStatus === 'update_available'
                          ? 'border-warning/30 text-warning'
                          : 'border-success/30 text-success'
                      }`}
                    >
                      {installStatusLabel(candidate.installStatus)}
                    </span>
                  )}
                  {candidate.previewCached && (
                    <span className="rounded border border-subtle px-2 py-1 font-mono text-2xs text-muted-foreground">
                      cached preview
                    </span>
                  )}
                </div>
                {!candidate.installable && (
                  <p className="mt-2 text-2xs text-warning">
                    {candidate.detectionWarnings[0] ??
                      'Missing SKILL.md; this candidate cannot be installed.'}
                  </p>
                )}
              </button>
            );
          };
          return (
            <div
              key={repo.id}
              className="surface-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{repo.fullName}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {repo.description || 'No repository description.'}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded border px-2 py-1 font-mono text-2xs ${
                    repo.detectedSkillStatus === 'formal_skill'
                      ? 'border-success/30 text-success'
                      : repo.detectedSkillStatus === 'readme_only'
                        ? 'border-warning/30 text-warning'
                        : repo.detectedSkillStatus === 'detection_unavailable'
                          ? 'border-warning/30 text-warning'
                          : 'border-subtle text-muted-foreground'
                  }`}
                >
                  {statusLabel(repo.detectedSkillStatus)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 font-mono text-2xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star size={11} /> {repo.stars}
                </span>
                <span className="flex items-center gap-1">
                  <GitFork size={11} /> {repo.forks}
                </span>
                <span>{repo.language || 'Unknown language'}</span>
                <span>{repo.license || 'No license detected'}</span>
                <span>Updated {dateLabel(repo.updatedAt)}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded bg-sidebar px-2 py-1 font-mono text-2xs">
                  quality {repo.qualityLabel} / {repo.qualityScore}
                </span>
                <span className="rounded bg-sidebar px-2 py-1 font-mono text-2xs">
                  {repo.installStatus.replaceAll('_', ' ')}
                </span>
                {repo.topics.slice(0, 4).map((topic) => (
                  <span key={topic} className="rounded border border-subtle px-2 py-1 text-2xs">
                    {topic}
                  </span>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {formalCandidates.length > 0 && (
                  <div className="space-y-2">
                    <p className="section-label">Detected candidates</p>
                    {formalCandidates.map(renderCandidate)}
                  </div>
                )}
                {readmeDrafts.length > 0 && (
                  <div className="space-y-2 border-t border-subtle pt-3">
                    <p className="section-label text-warning">README drafts</p>
                    {readmeDrafts.map(renderCandidate)}
                  </div>
                )}
                {!repo.candidates.length && (
                  <p className="rounded border border-dashed border-subtle p-3 text-xs text-muted-foreground">
                    No installable skill candidates were found in supported paths.
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {result && result.items.length === 0 && (
          <div className="surface-card col-span-full p-8 text-center text-xs text-muted-foreground">
            No repositories matched these filters. Disable detected-files-only or broaden the query.
          </div>
        )}
      </section>

      <section ref={installedSectionRef} className="surface-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Installed from GitHub</p>
            <p className="mt-1 text-2xs text-muted-foreground">
              Reviewed or trusted skills can be selected in agent profiles and deployments.
            </p>
          </div>
          <span className="font-mono text-2xs text-muted-foreground">
            {githubSkills.length} installed
          </span>
        </div>
        {postInstallSkillName && (
          <div className="mt-3 rounded border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Installed but not selectable until reviewed.</p>
                <p className="mt-1 text-2xs text-muted-foreground">
                  Review the imported files, then mark the skill reviewed or keep it untrusted.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={reviewNow} className="btn-ghost text-xs">
                  Review now
                </button>
                <button
                  onClick={() => postInstallSkill && void setTrust(postInstallSkill, 'reviewed')}
                  disabled={!postInstallSkill}
                  className="btn-ghost text-xs"
                >
                  Mark reviewed
                </button>
                <button
                  onClick={() => setPostInstallSkillName(null)}
                  className="btn-ghost text-xs"
                >
                  Keep untrusted
                </button>
                <button
                  onClick={() => void openInstalledFolder(postInstallSkillName)}
                  className="btn-ghost text-xs"
                >
                  <FolderOpen size={13} /> Open installed folder
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="mt-3 space-y-2">
          {githubSkills.map((skill) => (
            <div
              key={skill.name}
              className={`flex flex-wrap items-center gap-3 rounded border bg-card/50 p-3 ${
                highlightedSkillName === skill.name
                  ? 'border-warning/40'
                  : 'border-subtle'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{skill.title}</p>
                <p className="truncate font-mono text-2xs text-muted-foreground">
                  {skill.repoFullName} / {skill.trustState}
                </p>
              </div>
              <span
                className={`rounded border px-2 py-1 font-mono text-2xs ${
                  trustCanInject(skill)
                    ? 'border-success/30 text-success'
                    : 'border-warning/30 text-warning'
                }`}
              >
                {trustCanInject(skill)
                  ? 'available to agents'
                  : skill.sourceContentKind === 'readme_draft'
                    ? 'Draft — review required'
                    : 'blocked from prompts'}
              </span>
              <select
                value={skill.trustState}
                disabled={busy === `trust:${skill.name}`}
                onChange={(event) =>
                  void setTrust(
                    skill,
                    event.target.value as 'untrusted' | 'reviewed' | 'trusted' | 'disabled'
                  )
                }
                className="rounded border border-subtle bg-input px-2 py-1 text-2xs text-foreground"
              >
                <option value="untrusted">Untrusted</option>
                <option value="reviewed">Reviewed</option>
                <option value="trusted">Trusted</option>
                <option value="disabled">Disabled</option>
              </select>
              <button
                onClick={() => void updateSkill(skill)}
                disabled={busy === `update:${skill.name}`}
                className="btn-ghost text-2xs"
              >
                <RefreshCw size={12} /> Update
              </button>
              <button
                onClick={() => void uninstallSkill(skill)}
                disabled={busy === `uninstall:${skill.name}`}
                className="btn-ghost text-2xs text-danger"
              >
                <Trash2 size={12} /> Uninstall
              </button>
            </div>
          ))}
          {!githubSkills.length && (
            <p className="rounded border border-dashed border-subtle p-4 text-xs text-muted-foreground">
              No GitHub skills are installed in this workspace.
            </p>
          )}
        </div>
      </section>

      <section id="github-token" className="surface-card p-4">
        <div className="flex items-start gap-3">
          <KeyRound size={15} className="mt-0.5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">Optional GitHub token</p>
            <p className="mt-1 text-2xs text-muted-foreground">
              No login is required. A token improves API limits and is kept in memory only until
              AgentBoard exits.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                ref={tokenInputRef}
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder={tokenStored ? 'Token saved for this session' : 'github_pat_...'}
                className="min-w-0 flex-1 rounded border border-subtle bg-input px-2 py-1.5 text-xs text-foreground outline-none"
              />
              <button
                onClick={() => void saveToken()}
                disabled={!token.trim() || busy === 'token'}
                className="btn-ghost text-xs"
              >
                <ShieldCheck size={13} /> Save session token
              </button>
              {tokenStored && (
                <button onClick={() => void clearToken()} className="btn-ghost text-xs">
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {preview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="surface-card flex h-[760px] w-full max-w-5xl flex-col overflow-hidden shadow-card">
            <header className="flex items-start justify-between border-b border-subtle px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {preview.candidate.candidateName} / {preview.repo.fullName}
                </p>
                <p className="mt-1 text-2xs text-muted-foreground">
                  {candidateKindLabel(preview.candidate)} / {preview.candidatePath} / commit{' '}
                  {preview.commitSha.slice(0, 12) || 'unknown'}
                </p>
                {preview.cached && (
                  <span className="mt-2 inline-flex rounded border border-subtle px-2 py-1 font-mono text-2xs text-muted-foreground">
                    cached preview
                  </span>
                )}
              </div>
              <button onClick={() => setPreview(null)} className="rocket-icon-button">
                <X size={14} />
              </button>
            </header>
            <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr]">
              <aside className="overflow-y-auto border-r border-subtle bg-sidebar/40 p-3">
                <p className="section-label">Detected files</p>
                <div className="mt-2 space-y-1">
                  {preview.files.map((file, index) => (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFile(index)}
                      className={`w-full rounded px-2 py-2 text-left font-mono text-2xs ${
                        selectedFile === index
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-hover'
                      }`}
                    >
                      {file.path}
                    </button>
                  ))}
                </div>
                <div className="mt-4 border-t border-subtle pt-3">
                  <p className="section-label">Source metadata</p>
                  <dl className="mt-2 space-y-2 text-2xs text-muted-foreground">
                    <div>
                      <dt>Stars / forks</dt>
                      <dd className="font-mono text-foreground">
                        {preview.repo.stars} / {preview.repo.forks}
                      </dd>
                    </div>
                    <div>
                      <dt>License</dt>
                      <dd className="font-mono text-foreground">
                        {preview.repo.license || 'Not detected'}
                      </dd>
                    </div>
                    <div>
                      <dt>Default branch</dt>
                      <dd className="font-mono text-foreground">{preview.repo.defaultBranch}</dd>
                    </div>
                    <div>
                      <dt>Content kind</dt>
                      <dd className="font-mono text-foreground">
                        {preview.sourceContentKind}
                      </dd>
                    </div>
                    <div>
                      <dt>Cached at</dt>
                      <dd className="font-mono text-foreground">{preview.cachedAt}</dd>
                    </div>
                  </dl>
                </div>
              </aside>
              <main className="min-h-0 overflow-y-auto p-5">
                {preview.warning && (
                  <div className="mb-4 flex gap-2 rounded border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    {preview.warning}
                  </div>
                )}
                <pre className="min-h-[390px] whitespace-pre-wrap rounded border border-subtle bg-black/20 p-4 font-mono text-xs leading-relaxed text-foreground">
                  {preview.files[selectedFile]?.content || 'No previewable text file.'}
                </pre>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-xs">
                    <span className="block text-2xs text-muted-foreground">Install name</span>
                    <input
                      value={installName}
                      onChange={(event) => setInstallName(event.target.value)}
                      className="mt-1 w-full rounded border border-subtle bg-input px-2 py-1.5 font-mono text-xs text-foreground outline-none"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="block text-2xs text-muted-foreground">
                      Duplicate name behavior
                    </span>
                    <select
                      value={duplicateAction}
                      onChange={(event) =>
                        setDuplicateAction(event.target.value as 'cancel' | 'rename' | 'overwrite')
                      }
                      className="mt-1 w-full rounded border border-subtle bg-input px-2 py-1.5 text-xs text-foreground"
                    >
                      <option value="cancel">Cancel on duplicate</option>
                      <option value="rename">Install as a new name</option>
                      <option value="overwrite">Overwrite after backup</option>
                    </select>
                  </label>
                </div>
                {preview.readmeOnly && (
                  <label className="mt-3 flex items-start gap-2 rounded border border-warning/30 bg-warning/5 p-3 text-xs">
                    <input
                      type="checkbox"
                      checked={allowReadmeDraft}
                      onChange={(event) => setAllowReadmeDraft(event.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block font-semibold text-warning">
                        Create draft from README
                      </span>
                      <span className="mt-1 block text-2xs text-muted-foreground">
                        Draft created from repository README. Review and edit before use.
                      </span>
                    </span>
                  </label>
                )}
                {coreQuotaLow && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                    <span>{coreLimitMessage}</span>
                    <button onClick={focusGithubToken} className="btn-ghost text-xs">
                      <KeyRound size={13} /> Add GitHub token
                    </button>
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-2xs text-muted-foreground">
                    Imported skills default to untrusted. No repository scripts are executed.
                  </p>
                  <button
                    onClick={() => void install()}
                    disabled={
                      !preview.installable ||
                      busy === 'install' ||
                      (preview.readmeOnly && !allowReadmeDraft)
                    }
                    className="btn-primary text-xs"
                  >
                    {busy === 'install' ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Download size={13} />
                    )}
                    {preview.readmeOnly ? 'Create draft from README' : 'Install untrusted skill'}
                  </button>
                </div>
              </main>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
