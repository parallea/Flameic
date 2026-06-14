import React from 'react';
import { GitBranch, CheckCircle2, Code2, AlertTriangle } from 'lucide-react';
import type { Pipeline } from './PipelineViewClient';

interface PipelineStatsProps {
  pipelines: Pipeline[];
}

export default function PipelineStats({ pipelines }: PipelineStatsProps) {
  const total = pipelines.length;
  const active = pipelines.filter((p) => p.status === 'active').length;
  const coded = pipelines.filter((p) => p.status === 'coded').length;
  const broken = pipelines.filter((p) => p.status === 'broken').length;

  const stats = [
    {
      id: 'stat-total',
      label: 'Total Pipelines',
      value: total,
      icon: GitBranch,
      color: 'text-muted-foreground',
      bg: 'rgba(136,136,136,0.06)',
      border: 'var(--border)',
    },
    {
      id: 'stat-active',
      label: 'Active in Prod',
      value: active,
      icon: CheckCircle2,
      color: 'text-running',
      bg: 'rgba(74,222,128,0.06)',
      border: 'rgba(74,222,128,0.15)',
    },
    {
      id: 'stat-coded',
      label: 'Coded (Dev Only)',
      value: coded,
      icon: Code2,
      color: 'text-coded',
      bg: 'rgba(245,158,11,0.06)',
      border: 'rgba(245,158,11,0.15)',
    },
    {
      id: 'stat-broken',
      label: 'Broken (Errors)',
      value: broken,
      icon: AlertTriangle,
      color: 'text-error',
      bg: 'rgba(239,68,68,0.06)',
      border: 'rgba(239,68,68,0.2)',
    },
  ];

  return (
    <div className="flex gap-3 px-4 py-3 border-b border-subtle flex-shrink-0">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.id}
            className="flex items-center gap-3 px-3 py-2 rounded border flex-1"
            style={{ background: stat.bg, borderColor: stat.border }}
          >
            <Icon size={16} className={stat.color} />
            <div>
              <div className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
              <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                {stat.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
