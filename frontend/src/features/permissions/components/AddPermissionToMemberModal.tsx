// src/features/permissions/components/AddPermissionToMemberModal.tsx

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  InputAdornment,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Chip,
  Tooltip,
  alpha,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import { useBulkGrantPermissionsMutation } from '../permissionsApi';
import { useToast } from '../../../contexts/ToastContext';
import type { GrantablePermission } from '../types';
import { Padding } from '@mui/icons-material';

interface AddPermissionToMemberModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  memberId: number;
  memberName: string;
  grantablePermissions?: GrantablePermission[];
  existingDirectPermissions: string[]; // List of already granted permission codes
  onPermissionAdded: () => void;
}

export const AddPermissionToMemberModal = ({
  open,
  onClose,
  organizationId,
  memberId,
  memberName,
  grantablePermissions = [],
  existingDirectPermissions,
  onPermissionAdded,
}: AddPermissionToMemberModalProps) => {
  const { t } = useTranslation('shared');
  const { t: tPermissions } = useTranslation('permissions');
  const { showSuccess, showError } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [bulkGrantPermissions, { isLoading }] = useBulkGrantPermissionsMutation();

  const permissionsByCode = useMemo(() => {
    return grantablePermissions.reduce((acc, perm) => {
      acc[perm.code] = perm;
      return acc;
    }, {} as Record<string, GrantablePermission>);
  }, [grantablePermissions]);

  // Reset selection whenever the modal is (re)opened for a member
  useEffect(() => {
    if (open) {
      setSelectedCodes(new Set());
      setSearchQuery('');
    }
  }, [open, memberId]);

  // Recursively resolve all prerequisite codes for a given code
  const getAllPrerequisites = (code: string, seen: Set<string> = new Set()): string[] => {
    if (seen.has(code)) return [];
    seen.add(code);

    const direct = permissionsByCode[code]?.perquisites || [];
    return direct.reduce<string[]>(
      (acc, prereqCode) => [...acc, prereqCode, ...getAllPrerequisites(prereqCode, seen)],
      []
    );
  };

  // Codes that are currently "locked" because they're a prerequisite of
  // another selected permission — can't be unchecked on their own.
  const lockedCodes = useMemo(() => {
    const locked = new Set<string>();
    selectedCodes.forEach((code) => {
      getAllPrerequisites(code).forEach((prereqCode) => locked.add(prereqCode));
    });
    return locked;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCodes, grantablePermissions]);

  // Filter permissions based on search and exclude already granted ones
  const availablePermissions = useMemo(() => {
    const filtered = grantablePermissions.filter(
      (perm) => !existingDirectPermissions.includes(perm.code)
    );

    if (!searchQuery.trim()) return filtered;

    const query = searchQuery.toLowerCase().trim();
    return filtered.filter(
      (perm) =>
        perm.name.toLowerCase().includes(query) ||
        perm.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [grantablePermissions, existingDirectPermissions, searchQuery]);

  const handleToggle = (perm: GrantablePermission) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);

      if (next.has(perm.code)) {
        if (lockedCodes.has(perm.code)) {
          // Required by another selected permission — no-op
          return prev;
        }
        next.delete(perm.code);
      } else {
        next.add(perm.code);
        getAllPrerequisites(perm.code).forEach((prereqCode) => next.add(prereqCode));
      }

      return next;
    });
  };

  const handleSave = async () => {
    if (selectedCodes.size === 0) return;

    try {
      await bulkGrantPermissions({
        organizationId,
        data: {
          grantee_type: 'Member',
          grantee_id: memberId,
          codes: Array.from(selectedCodes),
        },
      }).unwrap();

      showSuccess(tPermissions('permissionGranted'));
      setSelectedCodes(new Set());
      setSearchQuery('');
      onPermissionAdded();
      onClose();
    } catch (error: any) {
      console.error('Failed to grant permissions:', error);
      showError(error?.data?.errors?.[0] || tPermissions('grantPermissionFailed'));
    }
  };

  const handleClose = () => {
    setSelectedCodes(new Set());
    setSearchQuery('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {tPermissions('addDirectPermissionToMember', { name: memberName })}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* Search Box */}
          <TextField
            fullWidth
            variant="outlined"
            placeholder={tPermissions('searchPermissions')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          {selectedCodes.size > 0 && (
            <Typography variant="caption" color="text.secondary">
              {tPermissions('selectedPermissionsCount', { count: selectedCodes.size })}
            </Typography>
          )}

          {/* Available Permissions List */}
          <Box
            sx={{
              maxHeight: 340,
              overflow: 'auto',
              border: (theme) => `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              '&::-webkit-scrollbar': { width: '6px' },
              '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: (theme) => alpha(theme.palette.text.secondary, 0.3),
                borderRadius: '4px',
              },
              scrollbarWidth: 'thin',
            }}
          >
            {availablePermissions.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {searchQuery.trim()
                    ? tPermissions('noPermissionsFound')
                    : tPermissions('noAvailablePermissionsToGrant')}
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {availablePermissions.map((perm) => {
                  const isChecked = selectedCodes.has(perm.code);
                  const isLocked = isChecked && lockedCodes.has(perm.code);

                  return (
                    <ListItem
                      key={perm.code}
                      disablePadding
                      sx={{
                        '&:hover': {
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                        },
                      }}
                    >
                      <ListItemButton
                        onClick={() => handleToggle(perm)}
                        sx={{ py: 0.5, px: 1 }}
                        disabled={isLocked}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Checkbox
                            edge="start"
                            checked={isChecked}
                            disabled={isLocked}
                            tabIndex={-1}
                            disableRipple
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2">{perm.name}</Typography>
                              {isLocked && (
                                <Tooltip title={tPermissions('requiredByOtherSelection')}>
                                  <Chip
                                    icon={<LockIcon fontSize="small" />}
                                    label={tPermissions('prerequisite')}
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.625rem' }}
                                  />
                                </Tooltip>
                              )}
                            </Box>
                          }
                          secondary={
                            perm.abilities.map((ability) => {
                            return <><Typography variant="caption" color="text.secondary"> {ability} </Typography> <br /> </> })
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={handleClose} disabled={isLoading}>
          {t('commonActions.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={selectedCodes.size === 0 || isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {tPermissions('grantSelectedPermissions')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};