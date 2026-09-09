import { useState } from 'react';
import type { WorkspaceLayout } from './types';

// Starts empty on purpose — RouteSynchronizer populates a tab for whatever
// URL the app loads on, instead of restoring a persisted session.
const defaultLayout: WorkspaceLayout = {
  panels: [
    {
      id: 'panel-1',
      tabs: [],
      activeTabId: '',
      activationHistory: [],
    },
  ],
  direction: 'horizontal',
  sizes: [100],
};

export function useWorkspaceState() {
  const [layout, setLayout] = useState<WorkspaceLayout>(() => structuredClone(defaultLayout));
  return { layout, setLayout };
}