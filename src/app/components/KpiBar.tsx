import React from 'react';
import { Zap, AlertCircle, CheckCircle2, GitBranch } from 'lucide-react';

const kpis = [
  {
    id: 'kpi-active',
    label: 'Active Agents',
    value: '4',
    sub: 'of 6 total',
    icon: Zap,
    color: 'text-running',
    bg: 'rgba(74,222,128,0.06)',
    border: 'rgba(74,222,128,0.15)',
  },
  {
    id: 'kpi-errors',
    label: 'Errors',
    value: '1',
    sub: 'needs attention',
    icon: AlertCircle,
    color: 'text-error',
    bg: 'rgba(239,68,68,0.06)',
    border: 'rgba(239,68,68,0.2)',
  },
  {
    id: 'kpi-tasks',
    label: 'Tasks Today',
    value: '47',
    sub: 'across team',
    icon: CheckCircle2,
    color: 'text-accent',
    bg: 'rgba(96,165,250,0.06)',
    border: 'rgba(96,165,250,0.15)',
  },
  {
    id: 'kpi-pipelines',
    label: 'Pipelines',
    value: '7',
    sub: 'active in prod',
    icon: GitBranch,
    color: 'text-coded',
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.15)',
  },
];

export default function KpiBar() {
  return (
    <div className="flex gap-3 px-4 py-3 border-b border-subtle flex-shrink-0">
      {kpis?.map((kpi) => {
        const Icon = kpi?.icon;
        return (
          <div
            key={kpi?.id}
            className="flex items-center gap-3 px-3 py-2 rounded border flex-1"
            style={{ background: kpi?.bg, borderColor: kpi?.border }}
          >
            <Icon size={15} className={kpi?.color} />
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-xl font-bold tabular-nums ${kpi?.color}`}>{kpi?.value}</span>
                <span className="text-2xs text-muted-foreground">{kpi?.sub}</span>
              </div>
              <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                {kpi?.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
