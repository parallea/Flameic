'use client';
import React, { useState } from 'react';
import { Search, Bell, ChevronDown, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface TopbarProps {
  currentPath: string;
}

const breadcrumbMap: Record<string, string[]> = {
  '/': ['AgentFlow', 'Dashboard'],
  '/pipeline-view': ['AgentFlow', 'Pipelines'],
  '/skill-marketplace': ['AgentFlow', 'Skills Marketplace'],
};

export default function Topbar({ currentPath }: TopbarProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const crumbs = breadcrumbMap[currentPath] ?? ['AgentFlow'];

  const handleRunAll = () => {
    toast.success('All agents started', {
      description: '6 agents are now running across 4 workspaces',
    });
  };

  return (
    <div
      className="flex items-center h-12 px-4 gap-4 border-b border-subtle flex-shrink-0"
      style={{ background: 'var(--topbar-bg)' }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {crumbs.map((crumb, i) => (
          <React.Fragment key={`crumb-${i}`}>
            {i > 0 && <span className="text-muted-foreground text-sm">/</span>}
            <span
              className={`text-sm ${
                i === crumbs.length - 1
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground cursor-pointer transition-colors'
              }`}
            >
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Search */}
      <div
        className={`flex-1 max-w-md relative transition-all duration-200 ${searchFocused ? 'max-w-lg' : ''}`}
      >
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          placeholder="Search workspaces, pipelines, skills... (⌘K)"
          className="w-full bg-input border border-subtle rounded pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/30 transition-all"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </div>

      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        {/* Notifications */}
        <button className="relative w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-hover transition-all duration-150">
          <Bell size={15} />
          <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-error rounded-full text-2xs text-white flex items-center justify-center font-bold leading-none">
            3
          </span>
        </button>

        {/* Run All */}
        <button onClick={handleRunAll} className="btn-primary text-xs gap-1.5">
          <Zap size={12} />
          Run All
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-hover transition-all duration-150"
          >
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <span className="text-2xs font-bold text-primary-foreground">AC</span>
            </div>
            <span className="text-sm text-foreground hidden sm:block">Alex Chen</span>
            <ChevronDown size={12} className="text-muted-foreground hidden sm:block" />
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-subtle rounded shadow-card z-50 py-1 fade-in">
              {['Profile', 'Settings', 'API Keys', 'Sign Out'].map((item) => (
                <button
                  key={`user-menu-${item}`}
                  className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
                  onClick={() => setUserMenuOpen(false)}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
