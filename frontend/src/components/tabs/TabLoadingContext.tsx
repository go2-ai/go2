// src/components/tabs/TabLoadingContext.tsx
//
// Lets a page tell its tab that it is still loading. The tab then shows a
// spinner in its title and a progress bar above the page, so a page that is
// still fetching doesn't look empty or broken.
//
//   useTabLoading(isLoading || isFetching);
//
// Several components of a page may report loading at the same time; the tab
// is loading while at least one of them does.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useCurrentTabId } from './TabIdContext';

interface TabLoadingActions {
  begin: (tabId: string) => void;
  end: (tabId: string) => void;
}

const TabLoadingActionsContext = createContext<TabLoadingActions | null>(null);
// Separate from the actions so that pages reporting loading don't re-render
// whenever any tab's loading state changes.
const TabLoadingStateContext = createContext<Record<string, number>>({});

export function TabLoadingProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const begin = useCallback((tabId: string) => {
    setCounts(prev => ({ ...prev, [tabId]: (prev[tabId] ?? 0) + 1 }));
  }, []);

  const end = useCallback((tabId: string) => {
    setCounts(prev => {
      const next = { ...prev };
      const count = (next[tabId] ?? 0) - 1;
      if (count > 0) next[tabId] = count; else delete next[tabId];
      return next;
    });
  }, []);

  const actions = useMemo(() => ({ begin, end }), [begin, end]);

  return (
    <TabLoadingActionsContext.Provider value={actions}>
      <TabLoadingStateContext.Provider value={counts}>
        {children}
      </TabLoadingStateContext.Provider>
    </TabLoadingActionsContext.Provider>
  );
}

/**
 * Marks the current tab as loading while `loading` is true. Safe to call
 * outside a tab (does nothing then).
 */
export function useTabLoading(loading: boolean) {
  const tabId = useCurrentTabId();
  const actions = useContext(TabLoadingActionsContext);

  useEffect(() => {
    if (!loading || !tabId || !actions) return;
    actions.begin(tabId);
    return () => actions.end(tabId);
  }, [loading, tabId, actions]);
}

/** Whether the given tab is loading. */
export function useIsTabLoading(tabId: string): boolean {
  return (useContext(TabLoadingStateContext)[tabId] ?? 0) > 0;
}
