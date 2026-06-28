// src/components/tabs/useTabOperations.ts

import { useCallback } from 'react';
import type { PanelConfig, Tab, WorkspaceLayout } from './types';

function createTab(pageId: string, title: string): Tab {
  return { id: `${pageId}-${Date.now()}`, pageId, title };
}

export function useTabOperations(
  setLayout: React.Dispatch<React.SetStateAction<WorkspaceLayout>>,
) {
  const openTab = useCallback((pageId: string, title: string) => {
    setLayout((prev) => {
      // Always create a new tab - no deduplication
      // Find existing tabs of the same page to determine numbering
      const allTabs = prev.panels.flatMap((p) => p.tabs);
      const sameTabs = allTabs.filter((t) => t.pageId === pageId);
      
      // Generate a unique title with numbering
      let newTitle = title;
      if (sameTabs.length > 0) {
        const existingNumbers = sameTabs
          .map((t) => {
            const match = t.title.match(/\((\d+)\)$/);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter((n) => n > 0);
        
        const nextNumber = existingNumbers.length > 0 
          ? Math.max(...existingNumbers) + 1 
          : sameTabs.length + 1;
        
        newTitle = `${title} (${nextNumber})`;
      }

      const newTab = createTab(pageId, newTitle);
      
      return {
        ...prev,
        panels: prev.panels.map((p, i) =>
          i === 0
            ? { ...p, tabs: [...p.tabs, newTab], activeTabId: newTab.id }
            : p,
        ),
      };
    });
  }, [setLayout]);

  const closeTab = useCallback((tabId: string, panelId: string) => {
    setLayout((prev) => {
      const panel = prev.panels.find((p) => p.id === panelId);
      if (!panel) return prev;

      const tab = panel.tabs.find((t) => t.id === tabId);
      if (tab?.pinned) return prev;

      const newTabs = panel.tabs.filter((t) => t.id !== tabId);
      const newActiveId =
        panel.activeTabId === tabId
          ? newTabs[newTabs.length - 1]?.id || ''
          : panel.activeTabId;

      // If panel is now empty and it's not the only panel, remove the panel
      if (newTabs.length === 0 && prev.panels.length > 1) {
        const newPanels = prev.panels.filter((p) => p.id !== panelId);
        return {
          ...prev,
          panels: newPanels,
          sizes: newPanels.map(() => 100 / newPanels.length),
        };
      }

      return {
        ...prev,
        panels: prev.panels.map((p) =>
          p.id === panelId
            ? { ...p, tabs: newTabs, activeTabId: newActiveId }
            : p,
        ),
      };
    });
  }, [setLayout]);

  const splitTab = useCallback((
    tabId: string,
    panelId: string,
    direction: 'horizontal' | 'vertical' = 'horizontal',
  ) => {
    setLayout((prev) => {
      const panel = prev.panels.find((p) => p.id === panelId);
      const tab = panel?.tabs.find((t) => t.id === tabId);
      if (!tab) return prev;

      const newTab = createTab(tab.pageId, tab.title);
      const newPanel: PanelConfig = {
        id: `panel-${Date.now()}`,
        tabs: [newTab],
        activeTabId: newTab.id,
      };

      const newPanels = [...prev.panels, newPanel];
      return {
        ...prev,
        panels: newPanels,
        direction,
        sizes: newPanels.map(() => 100 / newPanels.length),
      };
    });
  }, [setLayout]);

  const duplicateTab = useCallback((pageId: string, title: string) => {
    setLayout((prev) => {
      const allTabs = prev.panels.flatMap((p) => p.tabs);
      const sameTabs = allTabs.filter((t) => t.pageId === pageId);
      const baseTitle = title.replace(/\s*\(\d+\)$/, '');
      const existingNumbers = sameTabs
        .map((t) => {
          const match = t.title.match(/\((\d+)\)$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((n) => n > 0);
      const nextNumber =
        existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

      const newTab = createTab(pageId, `${baseTitle} (${nextNumber})`);
      return {
        ...prev,
        panels: prev.panels.map((p, i) =>
          i === 0
            ? { ...p, tabs: [...p.tabs, newTab], activeTabId: newTab.id }
            : p,
        ),
      };
    });
  }, [setLayout]);

  const resetLayout = useCallback(() => {
    const defaultTab = createTab('dashboard', 'Dashboard');
    setLayout({
      panels: [{ id: 'panel-1', tabs: [defaultTab], activeTabId: defaultTab.id }],
      direction: 'horizontal',
      sizes: [100],
    });
  }, [setLayout]);

  return { openTab, closeTab, splitTab, duplicateTab, resetLayout };
}