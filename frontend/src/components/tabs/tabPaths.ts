// tabs/tabPaths.ts
import type { Tab } from './types';

export function getTabPath(tab: Tab, organizationId: string): string {
  const basePath = (() => {
    switch (tab.pageId) {
      case 'dashboard':
        return `/app/organizations/${organizationId}`;
      case 'members':
        return `/app/organizations/${organizationId}/members`;
      case 'departments':
        return `/app/organizations/${organizationId}/departments`;
      case 'roles':
        return `/app/organizations/${organizationId}/roles`;
      case 'groups':
        return `/app/organizations/${organizationId}/groups`;
      case 'record-history':
        return `/app/organizations/${organizationId}/record-history`;
      case 'permissions':
        return `/app/organizations/${organizationId}/permissions`;
      default:
        return `/app/organizations/${organizationId}`;
    }
  })();

  // Only trust an explicit tab.path (e.g. record-history with query params)
  // if it's actually a full path scoped to this organization. Otherwise
  // it's stale/incomplete and we fall back to the canonical path.
  const orgPrefix = `/app/organizations/${organizationId}/`;
  if (tab.path && tab.path.startsWith(orgPrefix)) {
    return tab.path;
  }

  return basePath;
}