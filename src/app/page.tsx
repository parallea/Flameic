import React from 'react';
import AppLayout from '@/components/AppLayout';
import KpiBar from './components/KpiBar';
import AgentGrid from './components/AgentGrid';
import ActivityFeed from './components/ActivityFeed';
import WorkspaceHeader from './components/WorkspaceHeader';

export default function WorkspaceDashboardPage() {
  return (
    <AppLayout currentPath="/">
      <div className="flex h-full overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <KpiBar />
          <WorkspaceHeader />
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <AgentGrid />
          </div>
        </div>
        {/* Right Panel - Activity Feed */}
        <ActivityFeed />
      </div>
    </AppLayout>
  );
}
