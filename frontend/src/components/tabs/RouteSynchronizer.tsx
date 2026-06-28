// src/components/tabs/RouteSynchronizer.tsx

import { useTabManager } from './useTabManager';
import { useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';

export function RouteSynchronizer() {
  const location = useLocation();
  const { organizationId } = useParams<{ organizationId: string }>();
  const { setActiveTabByPageId, resetLayout, layout } = useTabManager();
  const lastPathRef = useRef('');
  const lastOrgRef = useRef<string | undefined>(organizationId);
  const lastTabIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset tabs when organization changes
    if (organizationId !== lastOrgRef.current) {
      lastOrgRef.current = organizationId;
      resetLayout();
      lastPathRef.current = '';
      lastTabIdRef.current = null;
    }
  }, [organizationId, resetLayout]);

  useEffect(() => {
    const pathname = location.pathname;
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;

    let pageId = '';
    let title = '';

    // Match routes based on your app structure
    if (pathname.includes('/members')) {
      pageId = 'members';
      title = 'Members';
    } else if (pathname.includes('/departments')) {
      pageId = 'departments';
      title = 'Departments';
    } else if (pathname.endsWith(`/organizations/${organizationId}`)) {
      pageId = 'dashboard';
      title = 'Dashboard';
    }

    if (pageId) {
      // Find the most recently created tab with this pageId
      // Tabs have IDs like "members-1234567890" with timestamp
      const allTabs = layout.panels.flatMap((p) => p.tabs);
      const matchingTabs = allTabs
        .filter((t) => t.pageId === pageId)
        .sort((a, b) => {
          // Extract timestamps from IDs (format: "pageId-timestamp")
          const getTimestamp = (id: string) => {
            const parts = id.split('-');
            return parts.length > 1 ? parseInt(parts[parts.length - 1], 10) : 0;
          };
          return getTimestamp(b.id) - getTimestamp(a.id);
        });

      // Activate the most recently created tab
      if (matchingTabs.length > 0) {
        const newestTab = matchingTabs[0];
        // Find which panel contains this tab
        for (const panel of layout.panels) {
          if (panel.tabs.some((t) => t.id === newestTab.id)) {
            setActiveTabByPageId(newestTab.id, panel.id);
            break;
          }
        }
      }
    }
  }, [location.pathname, organizationId, layout, setActiveTabByPageId]);

  return null;
}