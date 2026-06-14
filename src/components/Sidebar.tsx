'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import AppLogo from './ui/AppLogo';
import {
  LayoutGrid,
  GitBranch,
  Puzzle,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight as ChevronRightSmall,
  Plus,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  currentPath: string;
}

const navItems = [
  { id: 'nav-dashboard', label: 'Dashboard', icon: LayoutGrid, href: '/' },
  { id: 'nav-pipelines', label: 'Pipelines', icon: GitBranch, href: '/pipeline-view' },
  { id: 'nav-skills', label: 'Skills', icon: Puzzle, href: '/skill-marketplace' },
  { id: 'nav-team', label: 'Team', icon: Users, href: '#' },
  { id: 'nav-settings', label: 'Settings', icon: Settings, href: '#' },
];

const workspaces = [
  {
    id: 'ws-frontend',
    name: 'frontend-app',
    agentCount: 3,
    agents: [
      { id: 'agent-fa-1', name: 'agent-1', status: 'running' as const },
      { id: 'agent-fa-2', name: 'agent-2', status: 'running' as const },
      { id: 'agent-fa-3', name: 'agent-3', status: 'idle' as const },
    ],
  },
  {
    id: 'ws-api',
    name: 'api-service',
    agentCount: 2,
    agents: [
      { id: 'agent-api-1', name: 'agent-1', status: 'running' as const },
      { id: 'agent-api-2', name: 'agent-2', status: 'running' as const },
    ],
  },
  {
    id: 'ws-ml',
    name: 'ml-pipeline',
    agentCount: 1,
    agents: [{ id: 'agent-ml-1', name: 'agent-1', status: 'idle' as const }],
  },
  {
    id: 'ws-docs',
    name: 'docs-generator',
    agentCount: 2,
    agents: [
      { id: 'agent-docs-1', name: 'agent-1', status: 'error' as const },
      { id: 'agent-docs-2', name: 'agent-2', status: 'idle' as const },
    ],
  },
];

const statusDotClass: Record<string, string> = {
  running: 'status-dot-running',
  idle: 'status-dot-idle',
  error: 'status-dot-error',
  coded: 'status-dot-coded',
};

export default function Sidebar({ collapsed, onToggle, currentPath }: SidebarProps) {
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(
    new Set(['ws-frontend', 'ws-api'])
  );

  const toggleWorkspace = (id: string) => {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isActive = (href: string) => {
    if (href === '/') return currentPath === '/';
    return currentPath.startsWith(href);
  };

  return (
    <div
      className="relative flex flex-col h-full border-r border-subtle transition-all duration-300 ease-in-out flex-shrink-0"
      style={{
        width: collapsed ? '48px' : '220px',
        background: 'var(--sidebar-bg)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center h-12 px-3 border-b border-subtle flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <AppLogo size={24} />
          {!collapsed && (
            <span className="font-semibold text-md text-foreground truncate tracking-tight">
              AgentFlow
            </span>
          )}
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex flex-col gap-0.5 p-2 flex-shrink-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded text-sm transition-all duration-150 group relative ${
                active
                  ? 'nav-active font-medium'
                  : 'text-muted-foreground hover:bg-hover hover:text-foreground'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={15} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-card border border-subtle rounded text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity duration-150 shadow-card">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-2 my-1 border-t border-subtle" />

      {/* Workspaces Section */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
              Workspaces
            </span>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <Plus size={12} />
            </button>
          </div>
          <div className="px-1 pb-2">
            {workspaces.map((ws) => {
              const isExpanded = expandedWorkspaces.has(ws.id);
              return (
                <div key={ws.id}>
                  <button
                    onClick={() => toggleWorkspace(ws.id)}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-hover transition-all duration-150 group"
                  >
                    {isExpanded ? (
                      <FolderOpen size={13} className="flex-shrink-0 text-coded" />
                    ) : (
                      <Folder size={13} className="flex-shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1 text-left truncate font-mono text-xs">{ws.name}</span>
                    <span className="text-2xs text-muted-foreground bg-hover px-1 py-0.5 rounded">
                      {ws.agentCount}
                    </span>
                    {isExpanded ? (
                      <ChevronDown size={10} className="flex-shrink-0" />
                    ) : (
                      <ChevronRightSmall size={10} className="flex-shrink-0" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="ml-5 pl-2 border-l border-subtle">
                      {ws.agents.map((agent) => (
                        <div
                          key={agent.id}
                          className="flex items-center gap-2 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-hover transition-all duration-150 cursor-pointer"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotClass[agent.status]}`}
                          />
                          <span className="font-mono truncate">{agent.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapsed workspace dots */}
      {collapsed && (
        <div className="flex-1 flex flex-col items-center gap-1 py-2">
          {workspaces.map((ws) => (
            <div key={ws.id} className="relative group" title={ws.name}>
              <div className="w-6 h-6 flex items-center justify-center rounded hover:bg-hover cursor-pointer">
                <Folder size={13} className="text-muted-foreground" />
              </div>
              <div className="absolute left-full ml-2 px-2 py-1 bg-card border border-subtle rounded text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity duration-150 shadow-card">
                {ws.name} ({ws.agentCount})
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom: User */}
      <div className="flex-shrink-0 border-t border-subtle p-2">
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-hover cursor-pointer transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-2xs font-bold text-primary-foreground">AC</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">Alex Chen</p>
              <p className="text-2xs text-muted-foreground truncate">Admin</p>
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-14 w-6 h-6 rounded-full border border-subtle bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-hover transition-all duration-150 z-10 shadow-card"
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>
    </div>
  );
}
