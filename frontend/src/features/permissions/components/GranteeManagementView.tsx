// src/features/permissions/components/GranteeManagementView.tsx

import { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Stack,
  TextField,
  Autocomplete,
  alpha,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  Group as GroupIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useGetMembersQuery } from '../../members/membersApi';
import { useGetRolesQuery } from '../../roles/rolesApi';
import { useGetGroupsQuery } from '../../groups/groupsApi';
import { useGetDepartmentsQuery } from '../../departments/departmentsApi';
import { useGrantPermissionMutation, useRevokePermissionMutation } from '../permissionsApi';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/confirmContext';
import { MemberAvatar } from '../../members/components/MemberAvatar';
import type { Permission, ResolvedMember, GranteeType } from '../types';

interface GranteeManagementViewProps {
  permissionCode: string;
  permissionName: string;
  organizationId: number;
  grantees: Permission[];
  resolvedMembers: ResolvedMember[];
  abilities?: string[];
  onGranteeAdded: () => void;
  onGranteeRemoved: () => void;
  onViewHistory: () => void; 
}

const granteeTypeColors = {
  Member: 'primary',
  Role: 'success',
  Department: 'warning',
  Group: 'info',
} as const;

const granteeTypeIcons = {
  Member: PersonIcon,
  Role: AssignmentIcon,
  Department: BusinessIcon,
  Group: GroupIcon,
} as const;

export const GranteeManagementView = ({
  permissionCode,
  permissionName,
  organizationId,
  grantees,
  resolvedMembers,
  abilities = [],
  onGranteeAdded,
  onGranteeRemoved,
  onViewHistory,
}: GranteeManagementViewProps) => {
  const { t } = useTranslation('shared');
  const { t: tPermissions } = useTranslation('permissions');
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedGranteeType, setSelectedGranteeType] = useState<GranteeType | ''>('');
  const [selectedGranteeId, setSelectedGranteeId] = useState<number | ''>('');

  // ─── Data Fetching for Add Dialog ──────────────────────────────────────
  const { data: members, isLoading: isLoadingMembers } = useGetMembersQuery(organizationId);
  const { data: roles, isLoading: isLoadingRoles } = useGetRolesQuery(organizationId.toString());
  const { data: groups, isLoading: isLoadingGroups } = useGetGroupsQuery(organizationId);
  const { data: departments, isLoading: isLoadingDepartments } = useGetDepartmentsQuery(organizationId);

  // ─── Mutations ──────────────────────────────────────────────────────────
  const [grantPermission, { isLoading: isGranting }] = useGrantPermissionMutation();
  const [revokePermission, { isLoading: isRevoking }] = useRevokePermissionMutation();

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleRemoveGrantee = async (permissionId: number, granteeName: string) => {
    const confirmed = await confirm({
      title: tPermissions('revokePermissionTitle'),
      message: tPermissions('revokePermissionMessage', { name: granteeName }),
      confirmText: t('commonActions.revoke'),
      confirmColor: 'error',
    });

    if (!confirmed) return;

    try {
      await revokePermission({ organizationId, id: permissionId }).unwrap();
      showSuccess(tPermissions('permissionRevoked'));
      onGranteeRemoved();
    } catch (error) {
      console.error('Failed to revoke permission:', error);
      showError(tPermissions('revokePermissionFailed'));
    }
  };

  const handleAddGrantee = async () => {
    if (!selectedGranteeType || !selectedGranteeId) return;

    try {
      await grantPermission({
        organizationId,
        data: {
          code: permissionCode,
          grantee_type: selectedGranteeType,
          grantee_id: Number(selectedGranteeId),
        },
      }).unwrap();
      showSuccess(tPermissions('permissionGranted'));
      setIsAddDialogOpen(false);
      setSelectedGranteeType('');
      setSelectedGranteeId('');
      onGranteeAdded();
    } catch (error: any) {
      console.error('Failed to grant permission:', error);
      showError(error?.data?.errors?.[0] || tPermissions('grantPermissionFailed'));
    }
  };

  const handleAddDialogClose = () => {
    setIsAddDialogOpen(false);
    setSelectedGranteeType('');
    setSelectedGranteeId('');
  };

  // ─── Helper Functions ──────────────────────────────────────────────────

  const getGranteeOptions = () => {
    switch (selectedGranteeType) {
      case 'Member':
        return members?.map((m) => ({ id: m.id, name: m.name })) || [];
      case 'Role':
        return roles?.map((r) => ({ id: r.id, name: r.name })) || [];
      case 'Department':
        return departments?.map((d) => ({ id: d.id, name: d.name })) || [];
      case 'Group':
        return groups?.map((g) => ({ id: g.id, name: g.name })) || [];
      default:
        return [];
    }
  };

  const isLoadingOptions =
    (selectedGranteeType === 'Member' && isLoadingMembers) ||
    (selectedGranteeType === 'Role' && isLoadingRoles) ||
    (selectedGranteeType === 'Department' && isLoadingDepartments) ||
    (selectedGranteeType === 'Group' && isLoadingGroups);

  // Filter out already granted entities
  const availableOptions = getGranteeOptions().filter(
    (option) => !grantees.some((g) => g.grantee_id === option.id && g.grantee_type === selectedGranteeType)
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Fixed Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">{permissionName}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<HistoryIcon />}
            onClick={ onViewHistory }
          >
            {tPermissions('viewHistory')}
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setIsAddDialogOpen(true)}
          >
            {tPermissions('addGrantee')}
          </Button>
        </Box>
      </Box>

      {/* Scrollable Content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
          // Modern scrollbar styling
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: (theme) => alpha(theme.palette.text.secondary, 0.3),
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: (theme) => alpha(theme.palette.text.secondary, 0.5),
            },
          },
          scrollbarWidth: 'thin',
          scrollbarColor: (theme) => `${alpha(theme.palette.text.secondary, 0.3)} transparent`,
        }}
      >
        {/* Abilities Section - now in scrollable area */}
        {abilities.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 'bold'}}>
              {tPermissions('abilities')}
            </Typography>
            {abilities.map((ability) => (
              <Typography
                key={ability}
                variant="body2"
                color="text.secondary"
                sx={{ py: 0.25, fontSize: '0.875rem' }}
              >
                - {ability}
              </Typography>
            ))}
          </Box>
        )}

        {/* Grantees List */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 'bold'}}>
            {tPermissions('currentGrantees')} ({grantees.length})
          </Typography>
          {grantees.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              {tPermissions('noGrantees')}
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {grantees.map((grantee) => {
                const Icon = granteeTypeIcons[grantee.grantee_type];
                return (
                  <Paper
                    key={grantee.id}
                    variant="outlined"
                    sx={{
                      p: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      bgcolor: (theme) => alpha(theme.palette.background.default, 0.5),
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Icon fontSize="small" color="action" />
                      <Typography variant="body2">{grantee.grantee_name}</Typography>
                      <Chip
                        label={grantee.grantee_type}
                        size="small"
                        color={granteeTypeColors[grantee.grantee_type] as any}
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.625rem' }}
                      />
                    </Box>
                    <Tooltip title={t('commonActions.revoke')}>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveGrantee(grantee.id, grantee.grantee_name)}
                        disabled={isRevoking}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Resolved Members */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 'bold'}}>
            {tPermissions('resolvedMembers')} ({resolvedMembers.length})
          </Typography>
          {resolvedMembers.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              {tPermissions('noResolvedMembers')}
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {resolvedMembers.map((member) => (
                <Paper
                  key={member.id}
                  variant="outlined"
                  sx={{
                    p: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    bgcolor: (theme) => alpha(theme.palette.background.default, 0.3),
                  }}
                >
                  <MemberAvatar member={member} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={500}>
                      {member.name}
                      {member.isUserless && (
                        <Chip
                          label={tPermissions('userless')}
                          size="small"
                          variant="outlined"
                          sx={{ ml: 0.5, height: 16, fontSize: '0.625rem' }}
                        />
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {member.email}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {member.sources.map((source, index) => (
                      <Chip
                        key={index}
                        label={`${source.grantee_type}: ${source.grantee_name}`}
                        size="small"
                        color={granteeTypeColors[source.grantee_type] as any}
                        variant="outlined"
                        sx={{ height: 18, fontSize: '0.625rem' }}
                      />
                    ))}
                  </Box>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Box>

      {/* Add Grantee Dialog */}
      <Dialog open={isAddDialogOpen} onClose={handleAddDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>{tPermissions('addGrantee')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>{tPermissions('granteeType')}</InputLabel>
              <Select
                value={selectedGranteeType}
                onChange={(e) => {
                  setSelectedGranteeType(e.target.value as GranteeType);
                  setSelectedGranteeId('');
                }}
                label={tPermissions('granteeType')}
              >
                <MenuItem value="Member">{tPermissions('member')}</MenuItem>
                <MenuItem value="Role">{tPermissions('role')}</MenuItem>
                <MenuItem value="Department">{tPermissions('department')}</MenuItem>
                <MenuItem value="Group">{tPermissions('group')}</MenuItem>
              </Select>
            </FormControl>

            {selectedGranteeType && (
              <Autocomplete
                options={availableOptions}
                getOptionLabel={(option) => option.name}
                value={null}
                onChange={(_, newValue) => {
                  setSelectedGranteeId(newValue?.id || '');
                }}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                loading={isLoadingOptions}
                disabled={isLoadingOptions || availableOptions.length === 0}
                ListboxProps={{
                  style: { maxHeight: 200, overflow: 'auto' },
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={tPermissions('selectGrantee')}
                    placeholder={tPermissions('searchAndSelect')}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {isLoadingOptions && <CircularProgress size={20} />}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                noOptionsText={tPermissions('noAvailableOptions')}
                fullWidth
              />
            )}

            {selectedGranteeType && availableOptions.length === 0 && !isLoadingOptions && (
              <Alert severity="info">{tPermissions('allEntitiesAlreadyGranted')}</Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={handleAddDialogClose} disabled={isGranting}>
            {t('commonActions.cancel')}
          </Button>
          <Button
            onClick={handleAddGrantee}
            variant="contained"
            disabled={!selectedGranteeType || !selectedGranteeId || isGranting || isLoadingOptions}
            startIcon={isGranting ? <CircularProgress size={20} /> : null}
          >
            {tPermissions('grantPermission')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};