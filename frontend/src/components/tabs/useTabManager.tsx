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
import { useTabPersistence } from './useTabPersistence';
import { useWorkspaceState } from './useWorkspaceState';

interface TabContextType {
  layout: WorkspaceLayout;
  setLayout: React.Dispatch<React.SetStateAction<WorkspaceLayout>>;
  openTab: (pageId: string, title: string) => void;
  closeTab: (tabId: string, panelId: string) => void;
  splitTab: (
    tabId: string,
    panelId: string,
    direction?: 'horizontal' | 'vertical',
  ) => void;
  duplicateTab: (pageId: string, title: string) => void;
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
}

const TabContext = createContext<TabContextType | null>(null);

interface TabProviderProps {
  children: ReactNode;
  organizationId: number;
}

export function TabProvider({ children, organizationId }: TabProviderProps) {
  const { layout, setLayout } = useWorkspaceState();
  useTabPersistence(organizationId, layout, setLayout);

  const { openTab, closeTab, splitTab, duplicateTab, resetLayout } =
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
        p.id === panelId ? { ...p, activeTabId: tabId } : p,
      ),
    }));
  };

  const setActiveTabByPageId = (tabId: string, panelId: string) => {
    setLayout((prev) => ({
      ...prev,
      panels: prev.panels.map((p) =>
        p.id === panelId ? { ...p, activeTabId: tabId } : p,
      ),
    }));
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
    setActiveTabByPageId, // NEW
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