'use client';
import React, { useState } from 'react';
import { Play, Square, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const filterTabs = [
  { id: 'tab-all', label: 'All', count: 6 },
  { id: 'tab-running', label: 'Running', count: 4 },
  { id: 'tab-idle', label: 'Idle', count: 1 },
  { id: 'tab-error', label: 'Error', count: 1 },
];

interface WorkspaceHeaderProps {
  onFilterChange?: (filter: string) => void;
}

export default function WorkspaceHeader({ onFilterChange }: WorkspaceHeaderProps) {
  const [activeFilter, setActiveFilter] = useState('tab-all');

  const handleFilter = (id: string) => {
    setActiveFilter(id);
    onFilterChange?.(id);
  };

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-subtle flex-shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-md font-semibold text-foreground">Active Workspaces</h1>
          <span className="text-xs bg-hover border border-subtle px-1.5 py-0.5 rounded text-muted-foreground font-mono">
            6 agents
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleFilter(tab.id)}
              className={`px-3 py-1 text-xs rounded transition-all duration-150 flex items-center gap-1.5 ${
                activeFilter === tab.id
                  ? 'bg-hover text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-hover'
              }`}
            >
              {tab.label}
              <span
                className={`text-2xs px-1 rounded ${
                  activeFilter === tab.id
                    ? 'bg-primary/20 text-primary'
                    : 'bg-hover text-muted-foreground'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="btn-ghost text-xs gap-1.5"
          onClick={() => toast.info('Refreshing all agents...')}
        >
          <RefreshCw size={12} />
          Refresh
        </button>
        <button
          className="btn-ghost text-xs gap-1.5 text-error border-error/30 hover:bg-error/10 hover:text-error"
          onClick={() => toast.warning('Stopping all agents...')}
        >
          <Square size={12} />
          Stop All
        </button>
        <button
          className="btn-primary text-xs gap-1.5"
          onClick={() => toast.success('Starting all agents')}
        >
          <Play size={12} />
          Run All
        </button>
      </div>
    </div>
  );
}
