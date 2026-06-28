
import { useState } from 'react';
import type { Tab, WorkspaceLayout } from './types';

function createTab(pageId: string, title: string): Tab {
  return { id: `${pageId}-${Date.now()}`, pageId, title };
}

const defaultTab = createTab('dashboard', 'Dashboard');

const defaultLayout: WorkspaceLayout = {
  panels: [
    {
      id: 'panel-1',
      tabs: [defaultTab],
      activeTabId: defaultTab.id,
    },
  ],
  direction: 'horizontal',
  sizes: [100],
};

export function useWorkspaceState() {
  const [layout, setLayout] = useState<WorkspaceLayout>(defaultLayout);
  return { layout, setLayout };
}