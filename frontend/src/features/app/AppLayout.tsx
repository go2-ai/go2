// src/features/app/AppLayout.tsx

import { Outlet, useParams } from 'react-router-dom';
import { Box, Toolbar } from '@mui/material';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useGetOrganizationQuery } from '../organizations/organizationsApi';
import { setCurrentOrganization } from '../organizations/organizationsSlice';
import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { TabProvider } from '../../components/tabs/useTabManager';
import { TabWorkspace } from '../../components/tabs/TabWorkspace';
import { RouteSynchronizer } from '../../components/tabs/RouteSynchronizer';

const drawerWidth = 280;

export const AppLayout = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const { data: currentOrganization, isLoading } = useGetOrganizationQuery(orgId);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!isLoading && currentOrganization) {
      dispatch(setCurrentOrganization(currentOrganization));
    }
  }, [isLoading, currentOrganization, dispatch]);

  // If no orgId yet, show loading or return null
  if (!organizationId || isLoading) {
    return null;
  }

  return (
    <TabProvider organizationId={orgId}>
      <RouteSynchronizer />
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <TopBar />
        <Sidebar />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'background.default',
            overflow: 'hidden',
          }}
        >
          <Toolbar /> {/* Spacer for fixed AppBar */}
          <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <TabWorkspace />
          </Box>
        </Box>
      </Box>
    </TabProvider>
  );
};