// src/components/tabs/PageRegistry.tsx

import { Dashboard } from '../../features/app/Dashboard';
import { MembersPage } from '../../features/members/MembersPage';
import { DepartmentsPage } from '../../features/departments/DepartmentsPage';
import { RolesPage } from '../../features/roles/RolesPage';
import { GroupsPage } from '../../features/groups/GroupsPage';
import { RecordHistoryPage } from '../../features/versions/RecordHistoryPage';
import { PermissionsPage } from '../../features/permissions/PermissionsPage';
import { TabIdContext } from './TabIdContext';
import { Box, Typography } from '@mui/material';

export const PAGE_REGISTRY: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  members: MembersPage,
  departments: DepartmentsPage,
  roles: RolesPage,
  groups: GroupsPage,
  'record-history': RecordHistoryPage,
  permissions: PermissionsPage,
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