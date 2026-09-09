// src/components/tabs/tabPaths.ts
import type { Tab } from './types';
import { getPageDefinition } from './pageDefinitions';

export function getTabPath(tab: Tab, organizationId: string): string {
  const orgPrefix = `/app/organizations/${organizationId}/`;

  // Only trust an explicit tab.path if it's actually a full path scoped to
  // this organization (e.g. record-history with query params, or a
  // dynamic-segment page like journal-entry-edit that needs a real id).
  // Otherwise it's stale/relative and we fall back to the canonical path.
  if (tab.path && tab.path.startsWith(orgPrefix)) {
    return tab.path;
  }

  const def = getPageDefinition(tab.pageId);
  if (!def) return `/app/organizations/${organizationId}`;

  return `/app/organizations/${organizationId}/${def.path}`;
}