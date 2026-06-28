// src/components/tabs/useTabDragAndDrop.ts

import type { WorkspaceLayout } from './types';
import {
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useState } from 'react';

export function useTabDragAndDrop(
  layout: WorkspaceLayout,
  setLayout: React.Dispatch<React.SetStateAction<WorkspaceLayout>>,
) {
  const [activeDragTabId, setActiveDragTabId] = useState<string | null>(null);

  const moveTab = (
    tabId: string,
    fromPanelId: string,
    toPanelId: string,
    newIndex: number,
  ) => {
    setLayout((prev) => {
      const newPanels = prev.panels.map((p) => ({
        ...p,
        tabs: [...p.tabs],
      }));

      const fromPanel = newPanels.find((p) => p.id === fromPanelId);
      const toPanel = newPanels.find((p) => p.id === toPanelId);

      if (!fromPanel || !toPanel) return prev;

      const tabIndex = fromPanel.tabs.findIndex((t) => t.id === tabId);
      if (tabIndex === -1) return prev;

      const [tab] = fromPanel.tabs.splice(tabIndex, 1);

      if (fromPanel.activeTabId === tabId) {
        fromPanel.activeTabId =
          fromPanel.tabs.length > 0
            ? fromPanel.tabs[Math.max(0, tabIndex - 1)].id
            : '';
      }

      toPanel.tabs.splice(newIndex, 0, tab);
      toPanel.activeTabId = tab.id;

      return {
        ...prev,
        panels: newPanels,
      };
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragTabId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const sourcePanel = layout.panels.find((p) =>
      p.tabs.some((t) => t.id === activeId),
    );
    const destPanel = layout.panels.find(
      (p) => p.tabs.some((t) => t.id === overId) || p.id === overId,
    );

    if (!sourcePanel || !destPanel) return;
    if (sourcePanel === destPanel) return;

    let overTabIndex;
    if (destPanel.tabs.some((t) => t.id === overId)) {
      overTabIndex = destPanel.tabs.findIndex((t) => t.id === overId);
    } else {
      overTabIndex = destPanel.tabs.length;
    }

    moveTab(activeId, sourcePanel.id, destPanel.id, overTabIndex);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragTabId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const sourcePanel = layout.panels.find((p) =>
      p.tabs.some((t) => t.id === activeId),
    );

    if (sourcePanel && sourcePanel.tabs.some((t) => t.id === overId)) {
      const oldIndex = sourcePanel.tabs.findIndex((t) => t.id === activeId);
      const newIndex = sourcePanel.tabs.findIndex((t) => t.id === overId);
      if (oldIndex !== newIndex) {
        setLayout((prev) => {
          const newPanels = prev.panels.map((p) => {
            if (p.id === sourcePanel.id) {
              return { ...p, tabs: arrayMove(p.tabs, oldIndex, newIndex) };
            }
            return p;
          });
          return { ...prev, panels: newPanels };
        });
      }
    }
  };

  return {
    activeDragTabId,
    moveTab,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}