// src/components/tabs/index.ts

export { PageContent, PAGE_REGISTRY } from './PageRegistry';
export { PAGE_DEFINITIONS, DEFAULT_PAGE, getPageDefinition, matchPageByPathname } from './pageDefinitions';
export { SortableTab } from './SortableTab';
export { TabGroup } from './TabGroup';
export { TabWorkspace } from './TabWorkspace';
export { RouteSynchronizer } from './RouteSynchronizer';
export { TabProvider, useTabManager } from './useTabManager';
export { useCurrentTabId } from './TabIdContext';
export * from './types';