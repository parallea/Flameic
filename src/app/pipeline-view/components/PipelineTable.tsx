'use client';
import React, { useState } from 'react';
import { Eye, Wrench, AlertTriangle, Code2, ChevronUp, ChevronDown } from 'lucide-react';
import type { Pipeline } from './PipelineViewClient';

interface PipelineTableProps {
  pipelines: Pipeline[];
  selectedId: string | null;
  onSelect: (p: Pipeline) => void;
}

const statusBadge: Record<
  Pipeline['status'],
  { label: string; className: string; icon: React.FC<{ size?: number }> }
> = {
  active: {
    label: 'ACTIVE',
    className: 'text-running bg-running/10 border-running/20',
    icon: ({ size }) => (
      <span
        className="w-1.5 h-1.5 rounded-full status-dot-running inline-block"
        style={{ width: size, height: size }}
      />
    ),
  },
  coded: {
    label: 'CODED',
    className: 'text-coded bg-coded/10 border-coded/20',
    icon: ({ size }) => <Code2 size={size} />,
  },
  broken: {
    label: 'BROKEN',
    className: 'text-error bg-error/10 border-error/20',
    icon: ({ size }) => <AlertTriangle size={size} />,
  },
};

type SortKey = 'name' | 'status' | 'fileCount' | 'lastRun' | 'agent';

export default function PipelineTable({ pipelines, selectedId, onSelect }: PipelineTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = [...pipelines].sort((a, b) => {
    let av: string | number = a[sortKey] ?? '';
    let bv: string | number = b[sortKey] ?? '';
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortDir === 'asc' ? (
        <ChevronUp size={11} />
      ) : (
        <ChevronDown size={11} />
      )
    ) : (
      <ChevronDown size={11} className="opacity-30" />
    );

  const headers: { key: SortKey; label: string }[] = [
    { key: 'name', label: 'Pipeline' },
    { key: 'status', label: 'Status' },
    { key: 'fileCount', label: 'Files' },
    { key: 'lastRun', label: 'Last Run' },
    { key: 'agent', label: 'Agent' },
  ];

  return (
    <div className="rounded border border-subtle overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-subtle" style={{ background: 'var(--sidebar-bg)' }}>
            {headers.map((h) => (
              <th
                key={`th-${h.key}`}
                className="text-left px-3 py-2 text-2xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
                onClick={() => handleSort(h.key)}
              >
                <div className="flex items-center gap-1">
                  {h.label}
                  <SortIcon col={h.key} />
                </div>
              </th>
            ))}
            <th className="text-left px-3 py-2 text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((pipeline, idx) => {
            const badge = statusBadge[pipeline.status];
            const Icon = badge.icon;
            const isSelected = selectedId === pipeline.id;
            return (
              <tr
                key={pipeline.id}
                onClick={() => onSelect(pipeline)}
                className={`border-b border-subtle cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? 'bg-primary/5 border-l-2 border-l-primary'
                    : idx % 2 === 0
                      ? 'hover:bg-hover'
                      : 'bg-card/30 hover:bg-hover'
                }`}
              >
                <td className="px-3 py-2.5">
                  <span className="text-sm font-mono text-foreground">{pipeline.name}</span>
                  {pipeline.errorMessage && (
                    <p className="text-2xs font-mono text-error/70 mt-0.5 truncate max-w-xs">
                      {pipeline.errorMessage.split('\n')[0].substring(0, 60)}...
                    </p>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 text-2xs font-mono font-semibold px-2 py-0.5 rounded border ${badge.className}`}
                  >
                    <Icon size={9} />
                    {badge.label}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs font-mono text-muted-foreground">
                    {pipeline.fileCount}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs font-mono text-muted-foreground">
                    {pipeline.lastRun}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {pipeline.agent ? (
                    <span
                      className={`text-xs font-mono px-1.5 py-0.5 rounded border ${
                        pipeline.agent === 'Claude'
                          ? 'text-accent bg-accent/10 border-accent/20'
                          : 'text-primary bg-primary/10 border-primary/20'
                      }`}
                    >
                      {pipeline.agent}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground font-mono">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onSelect(pipeline)}
                      className="btn-ghost text-2xs px-2 py-1 gap-1"
                      title="View pipeline details"
                    >
                      <Eye size={11} />
                      View
                    </button>
                    {pipeline.status === 'broken' ? (
                      <button
                        className="btn-ghost text-2xs px-2 py-1 gap-1 text-error border-error/30 hover:bg-error/10 hover:text-error"
                        title="Debug broken pipeline"
                        onClick={() => onSelect(pipeline)}
                      >
                        <Wrench size={11} />
                        Debug
                      </button>
                    ) : (
                      <button
                        className="btn-ghost text-2xs px-2 py-1 gap-1"
                        title="Edit pipeline"
                        onClick={() => onSelect(pipeline)}
                      >
                        <Wrench size={11} />
                        Edit
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
