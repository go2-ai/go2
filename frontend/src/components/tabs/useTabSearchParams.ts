import { useMemo } from 'react';
import { useTabManager } from './useTabManager';
import { useCurrentTabId } from './TabIdContext';

/** Query parameters of the current tab's path (tabs keep their own URL). */
export const useTabSearchParams = (): URLSearchParams => {
  const { layout } = useTabManager();
  const tabId = useCurrentTabId();

  const path = useMemo(
    () => layout.panels.flatMap((panel) => panel.tabs).find((tab) => tab.id === tabId)?.path,
    [layout, tabId]
  );

  return useMemo(() => new URL(path || '/', window.location.origin).searchParams, [path]);
};

export const parseId = (value: string | null): number | null => {
  const id = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
};
