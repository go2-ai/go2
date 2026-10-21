import { useTabManager } from './useTabManager';
import { useCurrentTabId } from './TabIdContext';

/**
 * Whether the tab rendering this component is the visible tab of its panel.
 * Hidden tabs stay mounted, so pages can use this to refresh data when the
 * user comes back to them.
 */
export const useIsTabActive = (): boolean => {
  const { layout } = useTabManager();
  const tabId = useCurrentTabId();
  if (!tabId) return true;
  return layout.panels.some((panel) => panel.activeTabId === tabId);
};
