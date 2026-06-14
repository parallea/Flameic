'use client';
import React, { useState } from 'react';
import PipelineStats from './PipelineStats';
import PipelineTable from './PipelineTable';
import PipelineDetailPanel from './PipelineDetailPanel';

export interface Pipeline {
  id: string;
  name: string;
  status: 'active' | 'coded' | 'broken';
  fileCount: number;
  lastRun: string;
  agent: string | null;
  branch: string;
  description: string;
  files: { name: string; highlighted: boolean }[];
  errorMessage?: string;
}

const pipelines: Pipeline[] = [
  {
    id: 'pipe-auth',
    name: 'auth-pipeline',
    status: 'active',
    fileCount: 4,
    lastRun: '2m ago',
    agent: 'Claude',
    branch: 'main',
    description: 'JWT authentication and session management pipeline',
    files: [
      { name: 'src/pipelines/auth-pipeline.ts', highlighted: true },
      { name: 'src/middleware/auth.ts', highlighted: true },
      { name: 'src/utils/jwt.ts', highlighted: true },
      { name: 'config/pipeline.config.json', highlighted: true },
    ],
  },
  {
    id: 'pipe-data',
    name: 'data-ingestion',
    status: 'active',
    fileCount: 8,
    lastRun: '5m ago',
    agent: 'Codex',
    branch: 'main',
    description: 'ETL pipeline for ingesting and processing raw data streams',
    files: [
      { name: 'src/ingestion/loader.ts', highlighted: true },
      { name: 'src/ingestion/transformer.ts', highlighted: true },
      { name: 'src/ingestion/validator.ts', highlighted: true },
      { name: 'src/db/writer.ts', highlighted: false },
      { name: 'config/ingestion.json', highlighted: true },
    ],
  },
  {
    id: 'pipe-test',
    name: 'test-runner',
    status: 'active',
    fileCount: 12,
    lastRun: '1h ago',
    agent: 'Claude',
    branch: 'main',
    description: 'Automated test suite runner with coverage reporting',
    files: [
      { name: 'scripts/run-tests.sh', highlighted: true },
      { name: 'jest.config.ts', highlighted: true },
      { name: 'src/test/setup.ts', highlighted: false },
    ],
  },
  {
    id: 'pipe-deploy',
    name: 'deploy-staging',
    status: 'active',
    fileCount: 6,
    lastRun: '3h ago',
    agent: 'Codex',
    branch: 'main',
    description: 'Staging environment deployment with health checks',
    files: [
      { name: '.github/workflows/deploy-staging.yml', highlighted: true },
      { name: 'scripts/deploy.sh', highlighted: true },
      { name: 'docker-compose.staging.yml', highlighted: true },
    ],
  },
  {
    id: 'pipe-ml',
    name: 'ml-training',
    status: 'active',
    fileCount: 15,
    lastRun: '1d ago',
    agent: 'Claude',
    branch: 'feat/ml-v2',
    description: 'Model training pipeline with hyperparameter tuning',
    files: [
      { name: 'src/ml/train.py', highlighted: true },
      { name: 'src/ml/model.py', highlighted: true },
      { name: 'config/training.yaml', highlighted: true },
    ],
  },
  {
    id: 'pipe-notif',
    name: 'notification-svc',
    status: 'active',
    fileCount: 3,
    lastRun: '2d ago',
    agent: 'Codex',
    branch: 'main',
    description: 'Email and push notification delivery service',
    files: [
      { name: 'src/notifications/sender.ts', highlighted: true },
      { name: 'src/notifications/templates.ts', highlighted: false },
      { name: 'config/smtp.config.ts', highlighted: true },
    ],
  },
  {
    id: 'pipe-analytics',
    name: 'analytics-pipe',
    status: 'active',
    fileCount: 7,
    lastRun: '3d ago',
    agent: 'Claude',
    branch: 'main',
    description: 'User event tracking and analytics aggregation',
    files: [
      { name: 'src/analytics/tracker.ts', highlighted: true },
      { name: 'src/analytics/aggregator.ts', highlighted: true },
      { name: 'src/analytics/reporter.ts', highlighted: false },
    ],
  },
  {
    id: 'pipe-cache',
    name: 'cache-warmer',
    status: 'coded',
    fileCount: 2,
    lastRun: 'Never',
    agent: null,
    branch: 'feat/cache',
    description: 'Redis cache pre-warming on deployment — dev only, not yet in production',
    files: [
      { name: 'src/cache/warmer.ts', highlighted: true },
      { name: 'config/redis.config.ts', highlighted: true },
    ],
  },
  {
    id: 'pipe-backup',
    name: 'backup-service',
    status: 'coded',
    fileCount: 5,
    lastRun: 'Never',
    agent: null,
    branch: 'feat/backup',
    description: 'Automated database backup to S3 — awaiting production approval',
    files: [
      { name: 'src/backup/scheduler.ts', highlighted: true },
      { name: 'src/backup/uploader.ts', highlighted: true },
      { name: 'scripts/backup.sh', highlighted: false },
    ],
  },
  {
    id: 'pipe-email',
    name: 'email-queue',
    status: 'coded',
    fileCount: 3,
    lastRun: 'Never',
    agent: null,
    branch: 'feat/email-queue',
    description: 'Async email queue processor using BullMQ — not deployed',
    files: [
      { name: 'src/email/queue.ts', highlighted: true },
      { name: 'src/email/worker.ts', highlighted: true },
    ],
  },
  {
    id: 'pipe-webhook',
    name: 'webhook-handler',
    status: 'broken',
    fileCount: 6,
    lastRun: '4d ago',
    agent: 'Claude',
    branch: 'main',
    description: 'Incoming webhook processor — broken due to schema mismatch in payload validator',
    errorMessage:
      'TypeError: Cannot read properties of undefined (reading "payload") at validateWebhook (src/webhooks/validator.ts:42)',
    files: [
      { name: 'src/webhooks/handler.ts', highlighted: true },
      { name: 'src/webhooks/validator.ts', highlighted: true },
      { name: 'src/webhooks/router.ts', highlighted: false },
    ],
  },
  {
    id: 'pipe-legacy',
    name: 'legacy-sync',
    status: 'broken',
    fileCount: 11,
    lastRun: '1w ago',
    agent: 'Codex',
    branch: 'main',
    description:
      'Legacy CRM sync pipeline — broken after upstream API v2 migration removed deprecated endpoints',
    errorMessage:
      'Error: 410 Gone — /api/v1/contacts endpoint removed. Migrate to /api/v2/contacts',
    files: [
      { name: 'src/sync/legacy-client.ts', highlighted: true },
      { name: 'src/sync/mapper.ts', highlighted: true },
      { name: 'src/sync/scheduler.ts', highlighted: false },
    ],
  },
];

export default function PipelineViewClient() {
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'visual' | 'code'>('overview');

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-subtle flex-shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Pipeline Structure</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Monitor, debug, and edit your AI pipelines
            </p>
          </div>
          <div className="flex items-center gap-0.5 bg-hover rounded p-0.5">
            {(['overview', 'visual', 'code'] as const).map((tab) => (
              <button
                key={`pipeline-tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs rounded transition-all duration-150 capitalize ${
                  activeTab === tab
                    ? 'bg-card text-foreground font-medium shadow-panel'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'visual' ? 'Visual Editor' : tab === 'code' ? 'Code View' : 'Overview'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <PipelineStats pipelines={pipelines} />

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <PipelineTable
            pipelines={pipelines}
            selectedId={selectedPipeline?.id ?? null}
            onSelect={(p) => setSelectedPipeline((prev) => (prev?.id === p.id ? null : p))}
          />
        </div>
      </div>

      {/* Detail Panel */}
      {selectedPipeline && (
        <PipelineDetailPanel
          pipeline={selectedPipeline}
          onClose={() => setSelectedPipeline(null)}
        />
      )}
    </div>
  );
}
