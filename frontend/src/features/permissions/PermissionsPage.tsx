// src/features/permissions/PermissionsPage.tsx

import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Grid,
  alpha,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useGetGrantablePermissionsQuery, useGetPermissionsQuery } from './permissionsApi';
import { useGetMembersQuery } from '../members/membersApi';
import { useGetRolesQuery } from '../roles/rolesApi';
import { useGetGroupsQuery } from '../groups/groupsApi';
import { useGetDepartmentsQuery } from '../departments/departmentsApi';
import { GrantablePermissionsList } from './components/GrantablePermissionsList';
import { GranteeManagementView } from './components/GranteeManagementView';
import { MembersPermissionsView } from './components/MembersPermissionsView';
import { resolveMembersForPermission, getMemberPermissions } from './permissionUtils';
import type { ResolvedMember } from './types';
import { MemberPermissionsDetail } from './components/MemberPermissionsDetail';
import { AddPermissionToMemberModal } from './components/AddPermissionToMemberModal';
import { useTabManager } from '../../components/tabs/useTabManager';
import { useNavigate } from 'react-router-dom';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`permissions-tabpanel-${index}`}
      aria-labelledby={`permissions-tab-${index}`}
      {...other}
      style={{ height: '100%', overflow: 'hidden' }}
    >
      {value === index && <Box sx={{ height: '100%', p: 2 }}>{children}</Box>}
    </div>
  );
}

const scrollbarStyles = {
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: (theme: any) => alpha(theme.palette.text.secondary, 0.3),
    borderRadius: '4px',
    '&:hover': {
      backgroundColor: (theme: any) => alpha(theme.palette.text.secondary, 0.5),
    },
  },
  scrollbarWidth: 'thin',
  scrollbarColor: (theme: any) => `${alpha(theme.palette.text.secondary, 0.3)} transparent`,
} as const;

export const PermissionsPage = () => {
  const { t } = useTranslation('shared');
  const { t: tPermissions } = useTranslation('permissions');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const { openTab } = useTabManager();
  const navigate = useNavigate();

  const [isAddPermissionModalOpen, setIsAddPermissionModalOpen] = useState(false);

  // ─── Tab State ──────────────────────────────────────────────────────────────
  const [tabValue, setTabValue] = useState(0);

  // ─── Permission Selection State ──────────────────────────────────────────
  const [selectedPermissionCode, setSelectedPermissionCode] = useState<string | null>(null);

  // ─── Member Selection State ──────────────────────────────────────────────
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  // ─── Data Fetching ──────────────────────────────────────────────────────

  // Grantable permissions (for both tabs)
  const {
    data: grantablePermissions,
    isLoading: isLoadingGrantable,
    error: grantableError,
    refetch: refetchGrantable,
  } = useGetGrantablePermissionsQuery(orgId, { skip: !orgId });

  // By Permission tab - permissions filtered by selected code
  const {
    data: permissionsByCode,
    isLoading: isLoadingPermissionsByCode,
    error: permissionsByCodeError,
    refetch: refetchPermissionsByCode,
  } = useGetPermissionsQuery(
    { organizationId: orgId, code: selectedPermissionCode || undefined },
    { skip: !orgId || !selectedPermissionCode }
  );

  // Members tab - all permissions (no code filter)
  const {
    data: allPermissions,
    isLoading: isLoadingAllPermissions,
    error: allPermissionsError,
    refetch: refetchAllPermissions,
  } = useGetPermissionsQuery(
    { organizationId: orgId },
    { skip: !orgId }
  );

  const {
    data: members,
    isLoading: isLoadingMembers,
    error: membersError,
    refetch: refetchMembers,
  } = useGetMembersQuery(orgId, { skip: !orgId });

  const {
    data: roles,
    isLoading: isLoadingRoles,
    error: rolesError,
    refetch: refetchRoles,
  } = useGetRolesQuery(orgId.toString(), { skip: !orgId });

  const {
    data: groups,
    isLoading: isLoadingGroups,
    error: groupsError,
    refetch: refetchGroups,
  } = useGetGroupsQuery(orgId, { skip: !orgId });

  const {
    data: departments,
    isLoading: isLoadingDepartments,
    error: departmentsError,
    refetch: refetchDepartments,
  } = useGetDepartmentsQuery(orgId, { skip: !orgId });

  const isLoading =
    isLoadingGrantable ||
    (selectedPermissionCode && isLoadingPermissionsByCode) ||
    isLoadingAllPermissions ||
    isLoadingMembers ||
    isLoadingRoles ||
    isLoadingGroups ||
    isLoadingDepartments;

  // ─── Get selected permission details ────────────────────────────────────
  const selectedPermission = useMemo(() => {
    if (!selectedPermissionCode || !grantablePermissions) return null;
    return grantablePermissions.find((p) => p.code === selectedPermissionCode) || null;
  }, [selectedPermissionCode, grantablePermissions]);

  const selectedPermissionAbilities = useMemo(() => {
    return selectedPermission?.abilities || [];
  }, [selectedPermission]);

  const permissionNameMap = useMemo(() => {
    if (!grantablePermissions) return {};
    return grantablePermissions.reduce((acc, p) => {
      acc[p.code] = p.name;
      return acc;
    }, {} as Record<string, string>);
  }, [grantablePermissions]);

  // ─── Resolve Members for Selected Permission (By Permission tab) ──────
  const resolvedMembers = useMemo<ResolvedMember[]>(() => {
    if (!selectedPermissionCode || !permissionsByCode || !members || !roles || !departments || !groups) {
      return [];
    }

    return resolveMembersForPermission({
      permissionCode: selectedPermissionCode,
      permissions: permissionsByCode,
      members,
      roles,
      departments,
      groups,
    });
  }, [selectedPermissionCode, permissionsByCode, members, roles, departments, groups]);

  // ─── Get Permissions for Selected Member (Members tab) ────────────────
  const memberPermissions = useMemo(() => {
    if (!selectedMemberId || !allPermissions || !roles || !groups || !departments) {
      return null;
    }

    return getMemberPermissions({
      memberId: selectedMemberId,
      allPermissions: allPermissions,
      roles,
      groups,
      departments,
    });
  }, [selectedMemberId, allPermissions, roles, groups, departments]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handlePermissionSelect = (code: string) => {
    setSelectedPermissionCode(code);
    setTabValue(0);
  };

  const handleMemberSelect = (memberId: number) => {
    setSelectedMemberId(memberId);
    setTabValue(1);
  };

  const handleGranteeAdded = () => {
    refetchPermissionsByCode();
    refetchAllPermissions();
  };

  const handleGranteeRemoved = () => {
    refetchPermissionsByCode();
    refetchAllPermissions();
  };

  const handleRetry = () => {
    refetchGrantable();
    refetchPermissionsByCode();
    refetchAllPermissions();
    refetchMembers();
    refetchRoles();
    refetchGroups();
    refetchDepartments();
  };

  const handleAddPermissionClick = () => {
    setIsAddPermissionModalOpen(true);
  };

  const handlePermissionAdded = () => {
    refetchAllPermissions();
    refetchPermissionsByCode();
  };

  const handleViewHistory = () => {
    if (!selectedPermissionCode) return;
    const permissionName = selectedPermission?.name || selectedPermissionCode;
    const path = `/app/organizations/${orgId}/permission-history?code=${selectedPermissionCode}`;
    openTab('permission-history', t('history',  {name: permissionName}), path);
    navigate(path);
  };

  // ─── Error State ────────────────────────────────────────────────────────
  if (grantableError || permissionsByCodeError || allPermissionsError || membersError || rolesError || groupsError || departmentsError) {
    return (
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              {t('commonActions.retry')}
            </Button>
          }
        >
          {tPermissions('failedToLoadData')}
        </Alert>
      </Container>
    );
  }

  // ─── Loading State ──────────────────────────────────────────────────────
  if (isLoading && !grantablePermissions) {
    return (
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>{tPermissions('loadingPermissions')}</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 2, overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ mb: 2, flexShrink: 0 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {tPermissions('permissions')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {tPermissions('permissionsDescription')}
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, flexShrink: 0 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label={tPermissions('byPermission')} id="permissions-tab-0" />
          <Tab label={tPermissions('byMember')} id="permissions-tab-1" />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Tab 0: Grantable Permissions View */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={2} sx={{ height: '100%' }}>
            <Grid size={{ xs: 12, md: 4 }} sx={{ height: '100%' }}>
              <Paper sx={{ height: '100%', p: 2, overflow: 'auto', ...scrollbarStyles }}>
                <GrantablePermissionsList
                  grantablePermissions={grantablePermissions}
                  selectedCode={selectedPermissionCode || undefined}
                  onSelect={handlePermissionSelect}
                  isLoading={isLoadingGrantable}
                />
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }} sx={{ height: '100%' }}>
              <Paper sx={{ height: '100%', p: 2, overflow: 'hidden' }}>
                {selectedPermissionCode ? (
                  <GranteeManagementView
                    permissionCode={selectedPermissionCode}
                    permissionName={selectedPermission?.name || selectedPermissionCode}
                    organizationId={orgId}
                    grantees={permissionsByCode || []}
                    resolvedMembers={resolvedMembers}
                    abilities={selectedPermissionAbilities}
                    onGranteeAdded={handleGranteeAdded}
                    onGranteeRemoved={handleGranteeRemoved}
                    onViewHistory={handleViewHistory}
                  />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
                    <Typography>{tPermissions('selectPermissionToView')}</Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 1: Members View */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={2} sx={{ height: '100%' }}>
            <Grid size={{ xs: 12, md: 4 }} sx={{ height: '100%' }}>
              <Paper sx={{ height: '100%', p: 2, overflow: 'auto', ...scrollbarStyles }}>
                <MembersPermissionsView
                  members={members || []}
                  organizationId={orgId}
                  selectedMemberId={selectedMemberId}
                  onMemberSelect={handleMemberSelect}
                  isLoading={isLoadingMembers}
                />
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }} sx={{ height: '100%' }}>
              <Paper sx={{ height: '100%', p: 2, overflow: 'auto', ...scrollbarStyles }}>
                {selectedMemberId && memberPermissions ? (
                  <MemberPermissionsDetail
                    memberName={members?.find((m) => m.id === selectedMemberId)?.name || ''}
                    memberId={selectedMemberId}
                    directPermissions={memberPermissions.direct}
                    indirectPermissions={memberPermissions.indirect}
                    organizationId={orgId}
                    groups={groups || []}
                    roles={roles || []}  // Add this
                    permissionNameMap={permissionNameMap}
                    onPermissionRevoked={() => {
                      refetchAllPermissions();
                      refetchPermissionsByCode();
                      refetchGroups();
                      refetchRoles();  // Add this to refresh roles after department changes
                    }}
                    onAddPermissionClick={handleAddPermissionClick}
                  />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
                    <Typography>{tPermissions('selectMemberToView')}</Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>
      </Box>
      <AddPermissionToMemberModal
        open={isAddPermissionModalOpen}
        onClose={() => setIsAddPermissionModalOpen(false)}
        organizationId={orgId}
        memberId={selectedMemberId!}
        memberName={members?.find((m) => m.id === selectedMemberId)?.name || ''}
        grantablePermissions={grantablePermissions}
        existingDirectPermissions={memberPermissions?.direct.map((p) => p.code) || []}
        onPermissionAdded={handlePermissionAdded}
      />
    </Container>
  );
};