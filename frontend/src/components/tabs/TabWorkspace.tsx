// src/components/tabs/TabWorkspace.tsx

import { useTabManager } from './useTabManager';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import Box from '@mui/material/Box';
import React from 'react';
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from 'react-resizable-panels';
import { TabGroup } from './TabGroup';

export function TabWorkspace() {
  const {
    layout,
    setLayout,
    closeTab,
    splitTab,
    duplicateTab,
    activeDragTabId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    setActiveTab,
  } = useTabManager();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Helper to find the tab object for overlay
  const activeDragTab = layout.panels
    .flatMap((p) => p.tabs)
    .find((t) => t.id === activeDragTabId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <Box
        sx={{ height: '100%', width: '100%', bgcolor: 'background.default' }}
      >
        <PanelGroup
          orientation={layout.direction}
          style={{ height: '100%', width: '100%' }}
        >
          {layout.panels.map((panel, index) => (
            <React.Fragment key={panel.id}>
              {index > 0 && (
                <PanelResizeHandle style={{ position: 'relative', zIndex: 10 }}>
                  <Box
                    sx={{
                      backgroundColor: 'divider',
                      transition: 'background-color 0.2s',
                      '&:hover': {
                        backgroundColor: 'primary.main',
                        opacity: 0.5,
                      },
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: layout.direction === 'horizontal' ? '4px' : '100%',
                      height: layout.direction === 'vertical' ? '4px' : '100%',
                      cursor:
                        layout.direction === 'horizontal'
                          ? 'col-resize'
                          : 'row-resize',
                    }}
                  >
                    <Box
                      sx={{
                        bgcolor: 'divider',
                        borderRadius: '999px',
                        width: layout.direction === 'vertical' ? '16px' : '4px',
                        height:
                          layout.direction === 'vertical' ? '4px' : '16px',
                      }}
                    />
                  </Box>
                </PanelResizeHandle>
              )}
              <Panel
                defaultSize={layout.sizes[index]}
                minSize={10}
                style={{ position: 'relative' }}
              >
                <TabGroup
                  panelId={panel.id}
                  tabs={panel.tabs}
                  activeTabId={panel.activeTabId}
                  activationHistory={panel.activationHistory}
                  onTabsChange={(tabs) =>
                    setLayout((prev) => ({
                      ...prev,
                      panels: prev.panels.map((p) => {
                        if (p.id !== panel.id) return p;
                        // TabGroup's bulk-close handlers (Close Others / Close All / Close to
                        // the Right) already pick an explicit next-active tab themselves via
                        // onActiveTabChange right after this call — here we just prune stale
                        // ids out of the history so it doesn't reference closed tabs.
                        const validIds = new Set(tabs.map((t) => t.id));
                        return {
                          ...p,
                          tabs,
                          activationHistory: p.activationHistory.filter((id) => validIds.has(id)),
                        };
                      }),
                    }))
                  }
                  onActiveTabChange={(id) => setActiveTab(panel.id, id)}
                  onCloseTab={closeTab}
                  onSplitRight={() => {
                    const activeTab = panel.tabs.find((t) => t.id === panel.activeTabId);
                    if (activeTab) splitTab(activeTab.id, panel.id, 'horizontal');
                  }}
                  onSplitDown={() => {
                    const activeTab = panel.tabs.find((t) => t.id === panel.activeTabId);
                    if (activeTab) splitTab(activeTab.id, panel.id, 'vertical');
                  }}
                  onDuplicateTab={(pageId, title) => duplicateTab(pageId, title)}
                  onCopyLink={() => {
                    // Implement copy link functionality
                    const url = window.location.href;
                    navigator.clipboard?.writeText(url);
                  }}
                />
              </Panel>
            </React.Fragment>
          ))}
        </PanelGroup>

        <DragOverlay>
          {activeDragTabId ? (
            <Box
              sx={{
                px: 1.5,
                py: 0.75,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                fontSize: '0.8125rem',
                fontWeight: 600,
                boxShadow: 3,
                color: 'text.primary',
                opacity: 0.9,
                cursor: 'grabbing',
              }}
            >
              {activeDragTab?.title}
            </Box>
          ) : null}
        </DragOverlay>
      </Box>
    </DndContext>
  );
}