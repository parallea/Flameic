import React from 'react';
import AppLayout from '@/components/AppLayout';
import SkillsHeader from './components/SkillsHeader';
import SkillsGrid from './components/SkillsGrid';
import SkillAssignmentPanel from './components/SkillAssignmentPanel';

export default function SkillMarketplacePage() {
  return (
    <AppLayout currentPath="/skill-marketplace">
      <div className="flex h-full overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <SkillsHeader />
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <SkillsGrid />
          </div>
        </div>
        <SkillAssignmentPanel />
      </div>
    </AppLayout>
  );
}
