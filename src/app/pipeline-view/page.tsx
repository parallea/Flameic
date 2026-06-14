import React from 'react';
import AppLayout from '@/components/AppLayout';
import PipelineViewClient from './components/PipelineViewClient';

export default function PipelineViewPage() {
  return (
    <AppLayout currentPath="/pipeline-view">
      <PipelineViewClient />
    </AppLayout>
  );
}
