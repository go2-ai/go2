// tabs/tabPaths.ts
import type { Tab } from './types';

export function getTabPath(tab: Tab, organizationId: string): string {
  if (tab.path) return tab.path; // e.g. record-history tabs with query params

  switch (tab.pageId) {
    case 'dashboard':
      return `/app/organizations/${organizationId}`;
    case 'members':
      return `/app/organizations/${organizationId}/members`;
    case 'departments':
      return `/app/organizations/${organizationId}/departments`;
    default:
      return `/app/organizations/${organizationId}`;
  }
}