// src/components/tabs/PageRegistry.tsx

import { Dashboard } from '../../features/app/Dashboard';
import { MembersPage } from '../../features/members/MembersPage';
import { DepartmentsPage } from '../../features/departments/DepartmentsPage';
import { RolesPage } from '../../features/roles/RolesPage';
import { GroupsPage } from '../../features/groups/GroupsPage';
import { RecordHistoryPage } from '../../features/versions/RecordHistoryPage';
import { PermissionsPage } from '../../features/permissions/PermissionsPage';
import { PermissionHistoryPage } from '../../features/permissions/PermissionHistoryPage';
import { OrganizationSettingsPage } from '../../features/organizations/OrganizationSettingsPage';
import { AccountingSettingsPage } from '../../features/accounting/settings/AccountingSettingsPage';
import { CenterTypesPage } from '../../features/accounting/centerTypes/CenterTypesPage';
import { CentersPage } from '../../features/accounting/centers/CentersPage';
import { ChartOfAccountsPage } from '../../features/accounting/chartOfAccounts/ChartOfAccountsPage';
import { FiscalYearsPage } from '../../features/fiscalYears/FiscalYearsPage';
import { JournalEntryPage } from '../../features/accounting/journalEntries/JournalEntryPage';
import { JournalEntriesPage } from '../../features/accounting/journalEntries/JournalEntriesPage';
import { JournalEntryEditPage } from '../../features/accounting/journalEntries/JournalEntryEditPage';
import { TabIdContext } from './TabIdContext';
import { Box, Typography } from '@mui/material';

export const PAGE_REGISTRY: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  members: MembersPage,
  departments: DepartmentsPage,
  roles: RolesPage,
  groups: GroupsPage,
  'record-history': RecordHistoryPage,
  'permission-history': PermissionHistoryPage,
  permissions: PermissionsPage,
  'organization-settings': OrganizationSettingsPage,
  'accounting-settings': AccountingSettingsPage,
  'center-types': CenterTypesPage,
  centers: CentersPage,
  'chart-of-accounts': ChartOfAccountsPage,
  'fiscal-years': FiscalYearsPage,
  'journal-entry': JournalEntryPage,
  'journal-entries': JournalEntriesPage,
  'journal-entry-edit': JournalEntryEditPage,
};

export function PageContent({ pageId, tabId }: { pageId: string; tabId?: string }) {
  const Component = PAGE_REGISTRY[pageId];

  if (!Component) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.secondary">Page not found: {pageId}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', width: '100%', overflow: 'auto', bgcolor: 'background.default' }}>
      <TabIdContext.Provider value={tabId ?? null}>
        <Component />
      </TabIdContext.Provider>
    </Box>
  );
}