'use client';
import React, { useState } from 'react';
import {
  Activity,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Plus,
  Users,
  ChevronRight,
} from 'lucide-react';

const events = [
  {
    id: 'evt-001',
    type: 'file_update',
    icon: FileCode,
    iconColor: 'text-accent',
    text: 'agent-1 updated',
    entity: 'src/auth.ts',
    workspace: 'frontend-app',
    time: '4s ago',
  },
  {
    id: 'evt-002',
    type: 'task_complete',
    icon: CheckCircle2,
    iconColor: 'text-running',
    text: 'agent-2 completed test suite',
    entity: '78 tests passed',
    workspace: 'frontend-app',
    time: '12s ago',
  },
  {
    id: 'evt-003',
    type: 'idle',
    icon: Activity,
    iconColor: 'text-muted-foreground',
    text: 'ml-pipeline agent went idle',
    entity: 'Awaiting task',
    workspace: 'ml-pipeline',
    time: '1m ago',
  },
  {
    id: 'evt-004',
    type: 'task_start',
    icon: Activity,
    iconColor: 'text-accent',
    text: 'api-service agent started',
    entity: 'feat/rate-limit',
    workspace: 'api-service',
    time: '2m ago',
  },
  {
    id: 'evt-005',
    type: 'workspace_create',
    icon: Plus,
    iconColor: 'text-coded',
    text: 'New workspace created',
    entity: 'docs-generator',
    workspace: 'docs-generator',
    time: '5m ago',
  },
  {
    id: 'evt-006',
    type: 'error',
    icon: AlertCircle,
    iconColor: 'text-error',
    text: 'API rate limit exceeded',
    entity: 'docs-generator/agent-1',
    workspace: 'docs-generator',
    time: '6m ago',
  },
  {
    id: 'evt-007',
    type: 'file_update',
    icon: FileCode,
    iconColor: 'text-accent',
    text: 'agent-2 updated',
    entity: 'db/migrations/001.sql',
    workspace: 'api-service',
    time: '8m ago',
  },
  {
    id: 'evt-008',
    type: 'task_complete',
    icon: CheckCircle2,
    iconColor: 'text-running',
    text: 'Pipeline auth-pipeline ran',
    entity: 'completed in 1.2s',
    workspace: 'api-service',
    time: '12m ago',
  },
];

const teamMembers = [
  { id: 'tm-alex', name: 'Alex Chen', initials: 'AC', agents: 3, color: 'bg-primary' },
  { id: 'tm-sarah', name: 'Sarah Kim', initials: 'SK', agents: 2, color: 'bg-accent' },
  { id: 'tm-marcus', name: 'Marcus J.', initials: 'MJ', agents: 2, color: 'bg-coded' },
  { id: 'tm-priya', name: 'Priya P.', initials: 'PP', agents: 1, color: 'bg-error' },
];

export default function ActivityFeed() {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex flex-col items-center justify-start pt-4 w-8 border-l border-subtle bg-sidebar text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        title="Show activity feed"
      >
        <Activity size={14} />
      </button>
    );
  }

  return (
    <div
      className="w-64 flex-shrink-0 border-l border-subtle flex flex-col overflow-hidden"
      style={{ background: 'var(--sidebar-bg)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-subtle flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full status-dot-running pulse-green" />
          <span className="text-sm font-medium text-foreground">Activity</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight size={13} />
        </button>
      </div>
      {/* Events */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1">
        {events?.map((evt) => {
          const Icon = evt?.icon;
          return (
            <div
              key={evt?.id}
              className="flex gap-2.5 px-3 py-2 hover:bg-hover transition-colors cursor-pointer"
            >
              <Icon size={12} className={`${evt?.iconColor} flex-shrink-0 mt-0.5`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground leading-snug">{evt?.text}</p>
                <p className="text-2xs font-mono text-muted-foreground truncate mt-0.5">
                  {evt?.entity}
                </p>
                <p className="text-2xs text-muted-foreground/60 mt-0.5">{evt?.time}</p>
              </div>
            </div>
          );
        })}
      </div>
      {/* Team Overview */}
      <div className="border-t border-subtle flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Users size={12} className="text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Team
          </span>
        </div>
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          {teamMembers?.map((member) => (
            <div key={member?.id} className="flex items-center gap-2">
              <div
                className={`w-5 h-5 rounded-full ${member?.color} flex items-center justify-center flex-shrink-0`}
              >
                <span className="text-2xs font-bold text-primary-foreground">
                  {member?.initials}
                </span>
              </div>
              <span className="text-xs text-muted-foreground flex-1 truncate">{member?.name}</span>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full status-dot-running" />
                <span className="text-2xs font-mono text-muted-foreground">{member?.agents}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
