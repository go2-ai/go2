// src/components/tabs/RouteSynchronizer.tsx

import { useTabManager } from './useTabManager';
import { useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { matchPageByPathname } from './pageDefinitions';
import { getTabPath } from './tabPaths';
import type { Tab } from './types';

const getTimestamp = (id: string) => {
  const parts = id.split('-');
  const n = Number(parts[parts.length - 1]);
  return Number.isNaN(n) ? 0 : n;
};

export function RouteSynchronizer() {
  const location = useLocation();
  const { organizationId } = useParams<{ organizationId: string }>();
  const { setLayout, resetLayout } = useTabManager();
  const { t } = useTranslation('shared');

  const lastPathRef = useRef('');
  const lastOrgRef = useRef<string | undefined>(organizationId);

  // Reset tabs when the organization changes.
  useEffect(() => {
    if (organizationId !== lastOrgRef.current) {
      lastOrgRef.current = organizationId;
      resetLayout();
      lastPathRef.current = '';
    }
  }, [organizationId, resetLayout]);

  // Make sure the current URL always has a matching, active tab.
  // This is what makes: (a) a page refresh only show the current page,
  // and (b) a pasted/shared link open the right tab.
  useEffect(() => {
    if (!organizationId) return;

    const fullPath = location.pathname + location.search;
    if (fullPath === lastPathRef.current) return;
    lastPathRef.current = fullPath;

    const match = matchPageByPathname(location.pathname);
    if (!match) return; // not a tracked page (e.g. an auth/onboarding screen)

    const { def } = match;

    setLayout((prev) => {
      const allTabs = prev.panels.flatMap((p) => p.tabs);

      // A tab already pointing at this exact URL? Prefer the most recently
      // opened one (handles duplicate tabs of the same page/URL).
      const matchingTabs = allTabs.filter(
        (tab) => tab.pageId === def.pageId && getTabPath(tab, organizationId) === fullPath,
      );
      const existing = matchingTabs.length
        ? matchingTabs.reduce((newest, tab) =>
            getTimestamp(tab.id) > getTimestamp(newest.id) ? tab : newest,
          )
        : undefined;

      if (existing) {
        // Just activate it — it may already be active, in which case this
        // is a no-op update.
        return {
          ...prev,
          panels: prev.panels.map((p) =>
            p.tabs.some((t) => t.id === existing.id) ? { ...p, activeTabId: existing.id } : p,
          ),
        };
      }

      // No tab points here yet — open one for this URL.
      const newTab: Tab = {
        id: `${def.pageId}-${Date.now()}`,
        pageId: def.pageId,
        title: t(`menu.${def.titleKey}`, { defaultValue: def.fallbackTitle }),
        path: fullPath,
      };

      return {
        ...prev,
        panels: prev.panels.map((p, i) =>
          i === 0 ? { ...p, tabs: [...p.tabs, newTab], activeTabId: newTab.id } : p,
        ),
      };
    });
  }, [location.pathname, location.search, organizationId, setLayout, t]);

  return null;
}