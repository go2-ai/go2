// src/components/tabs/useTabManager.tsx

import type { WorkspaceLayout } from './types';
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { createContext, useContext, type ReactNode } from 'react';
import { useTabDragAndDrop } from './useTabDragAndDrop';
import { useTabOperations } from './useTabOperations';
import { useWorkspaceState } from './useWorkspaceState';
import { pushActivation } from './tabActivation';

interface TabContextType {
  layout: WorkspaceLayout;
  setLayout: React.Dispatch<React.SetStateAction<WorkspaceLayout>>;
  openTab: (pageId: string, title: string, path?: string) => void;
  closeTab: (tabId: string, panelId: string) => void;
  splitTab: (
    tabId: string,
    panelId: string,
    direction?: 'horizontal' | 'vertical',
  ) => void;
  duplicateTab: (pageId: string, title: string, path?: string) => void;
  resetLayout: () => void;
  moveTab: (
    tabId: string,
    fromPanelId: string,
    toPanelId: string,
    newIndex: number,
  ) => void;
  activeDragTabId: string | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  setActiveTab: (panelId: string, tabId: string) => void;
  setActiveTabByPageId: (tabId: string, panelId: string) => void;
  updateTabTitle: (pageId: string, title: string) => void;
}

const TabContext = createContext<TabContextType | null>(null);

interface TabProviderProps {
  children: ReactNode;
  organizationId: number;
}

export function TabProvider({ children }: TabProviderProps) {
  const { layout, setLayout } = useWorkspaceState();

  const { openTab, closeTab, splitTab, duplicateTab, resetLayout, updateTabTitle } =
    useTabOperations(setLayout);

  const {
    moveTab,
    activeDragTabId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useTabDragAndDrop(layout, setLayout);

  const setActiveTab = (panelId: string, tabId: string) => {
    setLayout((prev) => ({
      ...prev,
      panels: prev.panels.map((p) =>
        p.id === panelId
          ? {
              ...p,
              activeTabId: tabId,
              activationHistory: pushActivation(p.activationHistory, tabId),
            }
          : p,
      ),
    }));
  };

  const setActiveTabByPageId = (tabId: string, panelId: string) => {
    // Same operation as setActiveTab — kept as a distinct name because
    // callers (e.g. RouteSynchronizer) are activating by a resolved tab id
    // that was looked up via pageId, not from a direct user click.
    setActiveTab(panelId, tabId);
  };

  const value: TabContextType = {
    layout,
    setLayout,
    openTab,
    closeTab,
    splitTab,
    duplicateTab,
    resetLayout,
    moveTab,
    activeDragTabId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    setActiveTab,
    setActiveTabByPageId,
    updateTabTitle,
  };

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export function useTabManager() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabManager must be used within a TabProvider');
  }
  return context;
}