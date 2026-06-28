
import { useEffect, useRef } from 'react';
import type { WorkspaceLayout } from './types';

const STORAGE_KEY = 'workspace-layout';

export function useTabPersistence(
  organizationId: number,
  layout: WorkspaceLayout,
  setLayout: React.Dispatch<React.SetStateAction<WorkspaceLayout>>,
) {
  const hasMountedRef = useRef(false);
  const storageKey = `${STORAGE_KEY}-${organizationId}`;

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setLayout(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to hydrate tabs', e);
    }
  }, [storageKey]);

  // Persist on every change
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(layout));
  }, [layout, storageKey]);
}