'use client';
import React, { useState } from 'react';
import {
  Terminal,
  Square,
  Eye,
  AlertTriangle,
  Clock,
  GitBranch,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AgentData } from './AgentGrid';

interface AgentCardProps {
  agent: AgentData;
}

const statusConfig = {
  running: {
    label: 'RUNNING',
    dotClass: 'status-dot-running',
    textClass: 'text-running',
    bgClass: 'rgba(74,222,128,0.04)',
    borderClass: 'rgba(74,222,128,0.12)',
  },
  idle: {
    label: 'IDLE',
    dotClass: 'status-dot-idle',
    textClass: 'text-muted-foreground',
    bgClass: 'transparent',
    borderClass: 'var(--border)',
  },
  error: {
    label: 'ERROR',
    dotClass: 'status-dot-error',
    textClass: 'text-error',
    bgClass: 'rgba(239,68,68,0.04)',
    borderClass: 'rgba(239,68,68,0.2)',
  },
};

const modelBadgeColor: Record<string, string> = {
  'Claude-3.5-Sonnet': 'bg-accent/10 text-accent border-accent/20',
  Codex: 'bg-primary/10 text-primary border-primary/20',
};

export default function AgentCard({ agent }: AgentCardProps) {
  const [stopping, setStopping] = useState(false);
  const cfg = statusConfig[agent.status];

  const handleStop = () => {
    setStopping(true);
    setTimeout(() => {
      setStopping(false);
      toast.success(`${agent.workspace}/${agent.agentName} stopped`);
    }, 1200);
  };

  const handleView = () => {
    toast.info(`Opening ${agent.workspace}/${agent.agentName} workspace`);
  };

  const handleTerminal = () => {
    toast.info(`Opening terminal for ${agent.workspace}/${agent.agentName}`);
  };

  const handleRetry = () => {
    toast.success(`Retrying ${agent.workspace}/${agent.agentName}...`);
  };

  return (
    <div
      className="card-hover rounded border flex flex-col"
      style={{
        background: cfg.bgClass,
        borderColor: cfg.borderClass,
      }}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dotClass} ${
              agent.status === 'running' ? 'pulse-green' : ''
            }`}
          />
          <span className={`text-xs font-semibold font-mono ${cfg.textClass}`}>{cfg.label}</span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="text-xs text-muted-foreground font-mono truncate">
            {agent.workspace}
          </span>
        </div>
        <span
          className={`text-2xs font-mono px-1.5 py-0.5 rounded border ${modelBadgeColor[agent.model]}`}
        >
          {agent.model}
        </span>
      </div>

      {/* Task */}
      <div className="px-3 pb-2">
        <p
          className={`text-sm leading-relaxed line-clamp-2 ${
            agent.status === 'error' ? 'text-error/80' : 'text-foreground'
          }`}
        >
          {agent.status === 'error' && (
            <AlertTriangle size={12} className="inline mr-1 text-error" />
          )}
          {agent.task}
        </p>
      </div>

      {/* Files */}
      {agent.files.length > 0 && (
        <div className="px-3 pb-2 border-t border-subtle pt-2">
          <div className="flex flex-col gap-0.5">
            {agent.files.map((file, fi) => (
              <div
                key={`${agent.id}-file-${fi}`}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-xs font-mono text-muted-foreground truncate">
                  {file.name}
                </span>
                {file.diff !== '—' ? (
                  <span className="text-2xs font-mono text-running flex-shrink-0">{file.diff}</span>
                ) : (
                  <span className="text-2xs font-mono text-muted-foreground flex-shrink-0">—</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-subtle mt-auto">
        <div className="flex items-center gap-3 text-2xs text-muted-foreground font-mono">
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {agent.runtime}
          </span>
          <span className="flex items-center gap-1">
            <GitBranch size={10} />
            {agent.branch}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleView}
            className="btn-ghost text-2xs px-2 py-1"
            title="View workspace"
          >
            <Eye size={11} />
            View
          </button>
          {agent.status === 'error' ? (
            <button
              onClick={handleRetry}
              className="btn-ghost text-2xs px-2 py-1 text-coded border-coded/30 hover:bg-coded/10 hover:text-coded"
              title="Retry agent"
            >
              <RefreshCw size={11} />
              Retry
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={stopping || agent.status === 'idle'}
              className="btn-ghost text-2xs px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Stop agent"
            >
              {stopping ? <Loader2 size={11} className="animate-spin" /> : <Square size={11} />}
              {stopping ? 'Stopping' : 'Stop'}
            </button>
          )}
          <button
            onClick={handleTerminal}
            className="btn-ghost text-2xs px-2 py-1"
            title="Open terminal"
          >
            <Terminal size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
