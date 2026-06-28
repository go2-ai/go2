// src/components/tabs/TabGroup.tsx

import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { TabContext, TabList } from '@mui/lab';
import Box from '@mui/material/Box';
import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { Tab } from './types';
import { PageContent } from './PageRegistry';
import { SortableTab } from './SortableTab';
import { TabContextMenu } from './TabContextMenu';
import { TabContainerContextMenu } from './TabContainerContextMenu';

interface TabGroupProps {
  panelId: string;
  tabs: Tab[];
  activeTabId: string;
  onTabsChange: (tabs: Tab[]) => void;
  onActiveTabChange: (id: string) => void;
  onCloseTab: (id: string, panelId: string) => void;
  onSplitRight: (tabId: string) => void;
  onSplitDown: (tabId: string) => void;
  onDuplicateTab: (pageId: string, title: string) => void;
  onCopyLink: () => void;
  onClosePanel?: () => void;
}

export function TabGroup({
  panelId,
  tabs,
  activeTabId,
  onTabsChange,
  onActiveTabChange,
  onCloseTab,
  onSplitRight,
  onSplitDown,
  onDuplicateTab,
  onCopyLink,
  onClosePanel,
}: TabGroupProps) {
  const navigate = useNavigate();
  const { organizationId } = useParams<{ organizationId: string }>();
  const tabIds = useMemo(() => tabs.map((t) => t.id), [tabs]);

  const [tabContextMenu, setTabContextMenu] = useState<{
    anchorPoint: { x: number; y: number };
    tabId: string;
  } | null>(null);
  const [containerContextMenu, setContainerContextMenu] = useState<{
    anchorPoint: { x: number; y: number };
  } | null>(null);

  const handleTabChange = (tabId: string) => {
    onActiveTabChange(tabId);

    const tab = tabs.find((t) => t.id === tabId);
    if (tab && organizationId) {
      let path = '';
      switch (tab.pageId) {
        case 'dashboard':
          path = `/app/organizations/${organizationId}`;
          break;
        case 'members':
          path = `/app/organizations/${organizationId}/members`;
          break;
        case 'departments':
          path = `/app/organizations/${organizationId}/departments`;
          break;
        default:
          path = `/app/organizations/${organizationId}`;
      }
      navigate(path);
    }
  };

  const handleCloseOthers = (id: string) => {
    const keep = tabs.filter((t) => t.id === id || t.pinned);
    onTabsChange(keep);
    onActiveTabChange(id);
  };

  const handleCloseToRight = (id: string) => {
    const tabIndex = tabs.findIndex((t) => t.id === id);
    if (tabIndex === -1) return;

    // Keep tabs up to and including the current one, and pinned tabs
    const keepTabs = tabs.filter((t, index) => {
      // Keep pinned tabs regardless of position
      if (t.pinned) return true;
      // Keep tabs to the left of the current tab
      if (index <= tabIndex) return true;
      // Remove tabs to the right
      return false;
    });

    onTabsChange(keepTabs);
    
    // If the active tab was closed, activate the current tab
    if (!keepTabs.some((t) => t.id === activeTabId)) {
      onActiveTabChange(id);
    }
  };

  const handleCloseAll = () => {
    const pinned = tabs.filter((t) => t.pinned);
    onTabsChange(pinned);
    if (pinned.length > 0) onActiveTabChange(pinned[0].id);
  };

  const handleTogglePin = (id: string) => {
    onTabsChange(
      tabs.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)),
    );
  };

  // Handle close from SortableTab
  const handleCloseTab = (tabId: string) => {
    onCloseTab(tabId, panelId);
  };

  if (tabs.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'text.secondary',
          bgcolor: 'background.default',
        }}
      >
        No tabs open. Select a page from the sidebar.
      </Box>
    );
  }

  return (
    <TabContext value={activeTabId}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <SortableContext
          items={tabIds}
          strategy={horizontalListSortingStrategy}
        >
          <Box
            onContextMenu={(e: React.MouseEvent) => {
              e.preventDefault();
              setContainerContextMenu({
                anchorPoint: { x: e.clientX, y: e.clientY },
              });
            }}
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              px: 1,
            }}
          >
            <TabList
              onChange={(_, v) => handleTabChange(v as string)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 32,
                height: 32,
                '& .MuiTabs-flexContainer': {
                  gap: 0,
                },
                '& .MuiTabs-indicator': {
                  display: 'none',
                },
              }}
            >
              {tabs.map((tab) => (
                <SortableTab
                  key={tab.id}
                  tab={tab}
                  onClose={handleCloseTab}
                  value={tab.id}
                  isActive={activeTabId === tab.id}
                  onContextMenu={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTabContextMenu({
                      anchorPoint: { x: e.clientX, y: e.clientY },
                      tabId: tab.id,
                    });
                  }}
                />
              ))}
            </TabList>
          </Box>
        </SortableContext>

        <TabContextMenu
          anchorPoint={tabContextMenu?.anchorPoint ?? null}
          tabId={tabContextMenu?.tabId ?? null}
          onClose={() => setTabContextMenu(null)}
          onCloseTab={handleCloseTab}
          onCloseOthers={handleCloseOthers}
          onCloseAll={handleCloseAll}
          onCloseToRight={handleCloseToRight}
          onSplitRight={(id) => onSplitRight(id)}
          onSplitDown={(id) => onSplitDown(id)}
/>

        <TabContainerContextMenu
          anchorPoint={containerContextMenu?.anchorPoint ?? null}
          onClose={() => setContainerContextMenu(null)}
          onCloseAll={handleCloseAll}
        />

        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {tabs.map((tab) => (
            <Box
              key={tab.id}
              sx={{
                height: '100%',
                width: '100%',
                overflow: 'auto',
                display: activeTabId === tab.id ? 'block' : 'none',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            >
              <PageContent pageId={tab.pageId} />
            </Box>
          ))}
        </Box>
      </Box>
    </TabContext>
  );
}