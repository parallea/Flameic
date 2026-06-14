'use client';
import React from 'react';
import AgentCard from './AgentCard';

export type AgentStatus = 'running' | 'idle' | 'error';

export interface AgentData {
  id: string;
  workspace: string;
  agentName: string;
  status: AgentStatus;
  model: 'Claude-3.5-Sonnet' | 'Codex';
  task: string;
  files: { name: string; diff: string }[];
  runtime: string;
  branch: string;
}

const agents: AgentData[] = [
  {
    id: 'agent-fa1',
    workspace: 'frontend-app',
    agentName: 'agent-1',
    status: 'running',
    model: 'Claude-3.5-Sonnet',
    task: 'Refactoring auth middleware and updating JWT token validation logic with refresh token support',
    files: [
      { name: 'src/auth.ts', diff: '+12' },
      { name: 'src/middleware.ts', diff: '+8' },
    ],
    runtime: '4m 32s',
    branch: 'feat/auth',
  },
  {
    id: 'agent-api1',
    workspace: 'api-service',
    agentName: 'agent-1',
    status: 'running',
    model: 'Codex',
    task: 'Adding rate limiting to REST endpoints with Redis integration and sliding window algorithm',
    files: [
      { name: 'api/routes.py', diff: '+24' },
      { name: 'api/middleware.py', diff: '+15' },
    ],
    runtime: '12m 18s',
    branch: 'feat/rate-limit',
  },
  {
    id: 'agent-ml1',
    workspace: 'ml-pipeline',
    agentName: 'agent-1',
    status: 'idle',
    model: 'Claude-3.5-Sonnet',
    task: 'Waiting for next task...',
    files: [],
    runtime: '0s',
    branch: 'main',
  },
  {
    id: 'agent-fa2',
    workspace: 'frontend-app',
    agentName: 'agent-2',
    status: 'running',
    model: 'Codex',
    task: 'Writing unit tests for React components — Button, Modal, Dropdown, and Form validation',
    files: [
      { name: 'tests/Button.test.tsx', diff: '+45' },
      { name: 'tests/Modal.test.tsx', diff: '+32' },
    ],
    runtime: '7m 05s',
    branch: 'feat/tests',
  },
  {
    id: 'agent-docs1',
    workspace: 'docs-generator',
    agentName: 'agent-1',
    status: 'error',
    model: 'Claude-3.5-Sonnet',
    task: 'Failed: Anthropic API rate limit exceeded — retry in 60s',
    files: [{ name: 'docs/api.md', diff: '—' }],
    runtime: '0s',
    branch: 'main',
  },
  {
    id: 'agent-api2',
    workspace: 'api-service',
    agentName: 'agent-2',
    status: 'running',
    model: 'Codex',
    task: 'Optimizing database queries and adding composite indexes for user lookup tables',
    files: [{ name: 'db/migrations/001.sql', diff: '+18' }],
    runtime: '2m 44s',
    branch: 'feat/db-opt',
  },
];

export default function AgentGrid() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-3 pt-3">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}
