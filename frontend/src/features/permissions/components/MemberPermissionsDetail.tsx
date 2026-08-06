// src/features/permissions/components/MemberPermissionsDetail.tsx

import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Button,
  Stack,
  CircularProgress,
  alpha,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  PersonRemove as PersonRemoveIcon,
  Assignment as AssignmentIcon,
  GroupRemove as GroupRemoveIcon,
  Business as BusinessIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useRevokePermissionMutation } from '../permissionsApi';
import { useUpdateRoleMutation } from '../../roles/rolesApi';
import { useUpdateGroupMutation } from '../../groups/groupsApi';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/confirmContext';
import type { Permission, GranteeType } from '../types';
import type { Group } from '../../groups/groupsApi';
import type { Role } from '../../roles/rolesApi';

export interface IndirectPermissionDetail {
  permission: Permission;
  source_type: GranteeType;
  source_id: number;
  source_name: string;
}

interface MemberPermissionsDetailProps {
  memberName: string;
  memberId: number;
  directPermissions: Permission[];
  indirectPermissions: IndirectPermissionDetail[];
  organizationId: number;
  groups: Group[];
  roles: Role[];
  onPermissionRevoked: () => void;
  onAddPermissionClick: () => void;
  permissionNameMap?: Record<string, string>;
}

const sourceTypeColors = {
  Member: 'default',
  Role: 'success',
  Department: 'warning',
  Group: 'info',
} as const;

const sourceTypeIcons = {
  Member: AssignmentIcon,
  Role: AssignmentIcon,
  Department: BusinessIcon,
  Group: GroupRemoveIcon,
} as const;

export const MemberPermissionsDetail = ({
  memberName,
  memberId,
  directPermissions,
  indirectPermissions,
  organizationId,
  groups,
  roles,
  onPermissionRevoked,
  onAddPermissionClick,
  permissionNameMap = {},
}: MemberPermissionsDetailProps) => {
  const { t } = useTranslation('shared');
  const { t: tPermissions } = useTranslation('permissions');
  const { showSuccess, showError, showInfo } = useToast();
  const confirm = useConfirm();

  const [revokePermission, { isLoading: isRevokingDirect }] = useRevokePermissionMutation();
  const [updateRole, { isLoading: isUpdatingRole }] = useUpdateRoleMutation();
  const [updateGroup, { isLoading: isUpdatingGroup }] = useUpdateGroupMutation();

  // ─── Direct Permission Actions ──────────────────────────────────────────

  const handleRevokeDirect = async (permissionId: number, permissionCode: string) => {
    const confirmed = await confirm({
      title: tPermissions('revokeDirectPermissionTitle'),
      message: tPermissions('revokeDirectPermissionMessage', {
        member: memberName,
        permission: permissionCode,
      }),
      confirmText: t('commonActions.revoke'),
      confirmColor: 'error',
    });

    if (!confirmed) return;

    try {
      await revokePermission({ organizationId, id: permissionId }).unwrap();
      showSuccess(tPermissions('permissionRevoked'));
      onPermissionRevoked();
    } catch (error) {
      console.error('Failed to revoke permission:', error);
      showError(tPermissions('revokePermissionFailed'));
    }
  };

  // ─── Indirect Permission Actions ────────────────────────────────────────

  const handleRevokeViaRole = async (roleId: number, roleName: string) => {
    const confirmed = await confirm({
      title: tPermissions('unassignFromRoleTitle'),
      message: tPermissions('unassignFromRoleMessage', {
        member: memberName,
        role: roleName,
      }),
      confirmText: tPermissions('unassign'),
      confirmColor: 'warning',
    });

    if (!confirmed) return;

    try {
      await updateRole({
        organizationId: organizationId.toString(),
        id: roleId,
        data: { member_id: null },
      }).unwrap();
      showSuccess(tPermissions('unassignedFromRole'));
      onPermissionRevoked();
    } catch (error) {
      console.error('Failed to unassign from role:', error);
      showError(tPermissions('unassignFromRoleFailed'));
    }
  };

  const handleRevokeViaDepartment = async (departmentId: number, departmentName: string) => {
    const confirmed = await confirm({
      title: tPermissions('unassignFromDepartmentTitle'),
      message: tPermissions('unassignFromDepartmentMessage', {
        member: memberName,
        department: departmentName,
      }),
      confirmText: tPermissions('unassignAll'),
      confirmColor: 'warning',
    });

    if (!confirmed) return;

    try {
      // Find all roles in this department that have this member assigned
      const departmentRoles = roles.filter(
        (role) => role.department?.id === departmentId && role.member?.id === memberId
      );

      if (departmentRoles.length === 0) {
        showInfo(tPermissions('noRolesFoundForDepartment'));
        return;
      }

      // Unassign the member from each role
      await Promise.all(
        departmentRoles.map((role) =>
          updateRole({
            organizationId: organizationId.toString(),
            id: role.id,
            data: { member_id: null },
          }).unwrap()
        )
      );

      showSuccess(tPermissions('unassignedFromDepartment'));
      onPermissionRevoked();
    } catch (error) {
      console.error('Failed to unassign from department:', error);
      showError(tPermissions('unassignFromDepartmentFailed'));
    }
  };

  const handleRevokeViaGroup = async (groupId: number, groupName: string) => {
    const confirmed = await confirm({
      title: tPermissions('removeFromGroupTitle'),
      message: tPermissions('removeFromGroupMessage', {
        member: memberName,
        group: groupName,
      }),
      confirmText: tPermissions('removeFromGroup'),
      confirmColor: 'warning',
    });

    if (!confirmed) return;

    try {
      const group = groups.find((g) => g.id === groupId);

      if (!group) {
        showError(tPermissions('groupNotFound'));
        return;
      }

      const updatedMemberIds = group.members
        .filter((member) => member.id !== memberId)
        .map((member) => member.id);

      await updateGroup({
        organizationId,
        id: groupId,
        data: { member_ids: updatedMemberIds },
      }).unwrap();

      showSuccess(tPermissions('removedFromGroup'));
      onPermissionRevoked();
    } catch (error) {
      console.error('Failed to remove from group:', error);
      showError(tPermissions('removeFromGroupFailed'));
    }
  };

  const handleRevokeIndirect = (source: IndirectPermissionDetail) => {
    if (source.source_type === 'Member') {
      console.warn('Unexpected Member source_type in indirect permissions');
      return;
    }

    switch (source.source_type) {
      case 'Role':
        handleRevokeViaRole(source.source_id, source.source_name);
        break;
      case 'Department':
        handleRevokeViaDepartment(source.source_id, source.source_name);
        break;
      case 'Group':
        handleRevokeViaGroup(source.source_id, source.source_name);
        break;
    }
  };

  const isLoading = isRevokingDirect || isUpdatingRole || isUpdatingGroup;

  // Filter out any 'Member' type from indirect permissions
  const filteredIndirectPermissions = indirectPermissions.filter(
    (p) => p.source_type !== 'Member'
  );

  // Helper to get display name for a permission
  const getPermissionDisplayName = (code: string): string => {
    return permissionNameMap[code] || code;
  };

  // Helper to get the button text for indirect permission revocation
  const getRevokeButtonText = (sourceType: GranteeType): string => {
    switch (sourceType) {
      case 'Role':
        return tPermissions('unassign');
      case 'Department':
        return tPermissions('unassignAll');
      case 'Group':
        return tPermissions('removeFromGroup');
      default:
        return tPermissions('unassign');
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const hasPermissions = directPermissions.length > 0 || filteredIndirectPermissions.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header - Always visible */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexShrink: 0 }}>
        <Typography variant="h6">
          {tPermissions('permissionsFor', { name: memberName })}
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={onAddPermissionClick}
        >
          {tPermissions('addPermission')}
        </Button>
      </Box>

      <Divider sx={{ mb: 2, flexShrink: 0 }} />

      {/* Content - Scrollable */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {!hasPermissions ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'text.secondary',
            }}
          >
            <Typography>{tPermissions('noPermissionsForMember', { name: memberName })}</Typography>
          </Box>
        ) : (
          <>
            {/* ── Direct Permissions ── */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                {tPermissions('directPermissions')} ({directPermissions.length})
              </Typography>

              {directPermissions.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1, pl: 1 }}>
                  {tPermissions('noDirectPermissions')}
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {directPermissions.map((perm) => (
                    <Paper
                      key={perm.id}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        bgcolor: (theme) => alpha(theme.palette.background.default, 0.3),
                      }}
                    >
                      <Typography variant="body2">
                        {getPermissionDisplayName(perm.code)}
                      </Typography>
                      <Tooltip title={tPermissions('revokeDirectPermission')}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRevokeDirect(perm.id, perm.code)}
                          disabled={isLoading}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* ── Indirect Permissions ── */}
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                {tPermissions('indirectPermissions')} ({filteredIndirectPermissions.length})
              </Typography>

              {filteredIndirectPermissions.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1, pl: 1 }}>
                  {tPermissions('noIndirectPermissions')}
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {filteredIndirectPermissions.map((item, index) => {
                    const Icon = sourceTypeIcons[item.source_type];
                    const color = sourceTypeColors[item.source_type];
                    const buttonText = getRevokeButtonText(item.source_type);

                    return (
                      <Paper
                        key={`${item.permission.id}-${index}`}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          bgcolor: (theme) => alpha(theme.palette.background.default, 0.3),
                          flexWrap: 'wrap',
                          gap: 1,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                            {getPermissionDisplayName(item.permission.code)}
                          </Typography>
                          <Chip
                            icon={<Icon fontSize="small" />}
                            label={`${item.source_type}: ${item.source_name}`}
                            size="small"
                            color={color as any}
                            variant="outlined"
                          />
                        </Box>
                        <Tooltip title={tPermissions('revokeViaSource')}>
                          <Button
                            size="small"
                            color="warning"
                            variant="outlined"
                            onClick={() => handleRevokeIndirect(item)}
                            disabled={isLoading}
                            startIcon={isLoading ? <CircularProgress size={16} /> : <PersonRemoveIcon />}
                            sx={{ textTransform: 'none' }}
                          >
                            {buttonText}
                          </Button>
                        </Tooltip>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};