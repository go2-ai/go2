// src/components/tabs/pageDefinitions.ts
//
// Single source of truth for every routable page in the app.
// Add a new page here ONCE and it will automatically:
//  - get a route in App.tsx
//  - be resolvable by the tab system (PageRegistry)
//  - be openable as a tab when someone hits its URL directly (RouteSynchronizer)
//  - have its tab path computed correctly (tabPaths)
//
// `path` is relative to `/app/organizations/:organizationId/`.
// Use react-router param syntax (`:paramName`) for dynamic segments.

import type { ComponentType } from 'react';
import { MembersPage } from '../../features/members/MembersPage';
import { DepartmentsPage } from '../../features/departments/DepartmentsPage';
import { RolesPage } from '../../features/roles/RolesPage';
import { GroupsPage } from '../../features/groups/GroupsPage';
import { RecordHistoryPage } from '../../features/versions/RecordHistoryPage';
import { PermissionsPage } from '../../features/permissions/PermissionsPage';
import { PermissionHistoryPage } from '../../features/permissions/PermissionHistoryPage';
import { OrganizationSettingsPage } from '../../features/organizations/OrganizationSettingsPage';
import { DocumentsPage } from '../../features/documents/DocumentsPage';
import { ReportPage } from '../../features/reports/ReportPage';
import { ReportSettingsPage } from '../../features/reports/ReportSettingsPage';
import { ReportDesignerPage } from '../../features/reports/ReportDesignerPage';
import { AccountingSettingsPage } from '../../features/accounting/settings/AccountingSettingsPage';
import { CenterTypesPage } from '../../features/accounting/centerTypes/CenterTypesPage';
import { CentersPage } from '../../features/accounting/centers/CentersPage';
import { ChartOfAccountsPage } from '../../features/accounting/chartOfAccounts/ChartOfAccountsPage';
import { FiscalYearsPage } from '../../features/fiscalYears/FiscalYearsPage';
import { JournalEntryPage } from '../../features/accounting/journalEntries/JournalEntryPage';
import { JournalEntriesPage } from '../../features/accounting/journalEntries/JournalEntriesPage';
import { JournalEntryEditPage } from '../../features/accounting/journalEntries/JournalEntryEditPage';
import { ExplorerPage } from '../../features/accounting/journalEntryItems/ExplorerPage';
import { JournalEntryItemsPage } from '../../features/accounting/journalEntryItems/JournalEntryItemsPage';
import { matchPath } from 'react-router-dom';

export interface PageDefinition {
  pageId: string;
  /** Relative to /app/organizations/:organizationId/ — supports :params */
  path: string;
  /** i18n key under the `menu` namespace, e.g. t(`menu.${titleKey}`) */
  titleKey: string;
  /** Used if the i18n key is missing */
  fallbackTitle: string;
  component: ComponentType;
}

export const PAGE_DEFINITIONS: PageDefinition[] = [
  { pageId: 'members', path: 'members', titleKey: 'members', fallbackTitle: 'Members', component: MembersPage },
  { pageId: 'departments', path: 'departments', titleKey: 'departments', fallbackTitle: 'Departments', component: DepartmentsPage },
  { pageId: 'roles', path: 'roles', titleKey: 'roles', fallbackTitle: 'Roles', component: RolesPage },
  { pageId: 'groups', path: 'groups', titleKey: 'groups', fallbackTitle: 'Groups', component: GroupsPage },
  { pageId: 'record-history', path: 'record-history', titleKey: 'recordHistory', fallbackTitle: 'History', component: RecordHistoryPage },
  { pageId: 'permission-history', path: 'permission-history', titleKey: 'permissionHistory', fallbackTitle: 'History', component: PermissionHistoryPage },
  { pageId: 'permissions', path: 'permissions', titleKey: 'permissions', fallbackTitle: 'Permissions', component: PermissionsPage },
  { pageId: 'fiscal-years', path: 'fiscal-years', titleKey: 'fiscalYears', fallbackTitle: 'Fiscal Years', component: FiscalYearsPage },
  { pageId: 'organization-settings', path: 'settings', titleKey: 'settings', fallbackTitle: 'Settings', component: OrganizationSettingsPage },
  { pageId: 'documents', path: 'documents', titleKey: 'documents', fallbackTitle: 'Documents', component: DocumentsPage },
  { pageId: 'reports', path: 'reports', titleKey: 'reports', fallbackTitle: 'Reports', component: ReportPage },
  { pageId: 'report-settings', path: 'report-settings', titleKey: 'reportSettings', fallbackTitle: 'Report Settings', component: ReportSettingsPage },
  { pageId: 'report-designer', path: 'report-designer', titleKey: 'reportDesigner', fallbackTitle: 'Report Designer', component: ReportDesignerPage },
  { pageId: 'accounting-settings', path: 'accounting/settings', titleKey: 'accountingSettings', fallbackTitle: 'Accounting Settings', component: AccountingSettingsPage },
  { pageId: 'center-types', path: 'accounting/center-types', titleKey: 'centerTypes', fallbackTitle: 'Center Types', component: CenterTypesPage },
  { pageId: 'centers', path: 'accounting/centers', titleKey: 'centers', fallbackTitle: 'Centers', component: CentersPage },
  { pageId: 'chart-of-accounts', path: 'accounting/chart-of-accounts', titleKey: 'chartOfAccounts', fallbackTitle: 'Chart of Accounts', component: ChartOfAccountsPage },
  { pageId: 'journal-entry', path: 'accounting/journal-entry', titleKey: 'journalEntry', fallbackTitle: 'Journal Entry', component: JournalEntryPage },
  { pageId: 'journal-entries', path: 'accounting/journal-entries', titleKey: 'journalEntries', fallbackTitle: 'Journal Entries', component: JournalEntriesPage },
  { pageId: 'journal-entry-edit', path: 'accounting/journal-entries/:journalEntryId', titleKey: 'journalEntryEdit', fallbackTitle: 'Edit Journal Entry', component: JournalEntryEditPage },
  { pageId: 'explorer', path: 'accounting/explorer', titleKey: 'explorer', fallbackTitle: 'Explorer', component: ExplorerPage },
  { pageId: 'journal-entry-items', path: 'accounting/journal-entry-items', titleKey: 'journalEntryItems', fallbackTitle: 'Journal Entry Items', component: JournalEntryItemsPage },
];

export const DEFAULT_PAGE = PAGE_DEFINITIONS[0]; // landing page when hitting the org root

export function getPageDefinition(pageId: string): PageDefinition | undefined {
  return PAGE_DEFINITIONS.find((d) => d.pageId === pageId);
}

/**
 * Matches a pathname like /app/organizations/42/accounting/journal-entries/7
 * against the registry and returns the page definition + extracted params.
 */
export function matchPageByPathname(
  pathname: string,
): { def: PageDefinition; params: Record<string, string | undefined> } | null {
  for (const def of PAGE_DEFINITIONS) {
    const pattern = `/app/organizations/:organizationId/${def.path}`;
    const match = matchPath({ path: pattern, end: true }, pathname);
    if (match) {
      return { def, params: match.params };
    }
  }
  return null;
}