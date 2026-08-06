// src/features/permissions/components/AddPermissionToMemberModal.tsx

import { useState, useMemo } from 'react';
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
  ListItemText,
  alpha,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import { useGrantPermissionMutation } from '../permissionsApi';
import { useToast } from '../../../contexts/ToastContext';
import type { GrantablePermission } from '../types';

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
  const [selectedPermission, setSelectedPermission] = useState<GrantablePermission | null>(null);
  const [grantPermission, { isLoading }] = useGrantPermissionMutation();

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

  const handleSelectPermission = (perm: GrantablePermission) => {
    setSelectedPermission(perm);
  };

  const handleClearSelection = () => {
    setSelectedPermission(null);
  };

  const handleSave = async () => {
    if (!selectedPermission) return;

    try {
      await grantPermission({
        organizationId,
        data: {
          code: selectedPermission.code,
          grantee_type: 'Member',
          grantee_id: memberId,
        },
      }).unwrap();

      showSuccess(tPermissions('permissionGranted'));
      setSelectedPermission(null);
      setSearchQuery('');
      onPermissionAdded();
      onClose();
    } catch (error: any) {
      console.error('Failed to grant permission:', error);
      showError(error?.data?.errors?.[0] || tPermissions('grantPermissionFailed'));
    }
  };

  const handleClose = () => {
    setSelectedPermission(null);
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

          {/* Available Permissions List */}
          {!selectedPermission ? (
            <Box
              sx={{
                maxHeight: 300,
                overflow: 'auto',
                border: (theme) => `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
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
                  {availablePermissions.map((perm) => (
                    <ListItem
                      key={perm.code}
                      disablePadding
                      sx={{
                        '&:hover': {
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                        },
                      }}
                    >
                      <ListItemButton onClick={() => handleSelectPermission(perm)} sx={{ py: 1, px: 2 }}>
                        <ListItemText
                          primary={
                            <Typography variant="body2">{perm.name}</Typography>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          ) : (
            /* Selected Permission Preview */
            <Box
              sx={{
                p: 2,
                border: (theme) => `1px solid ${theme.palette.primary.main}`,
                borderRadius: 1,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {selectedPermission.name}
                </Typography>
                <Button size="small" onClick={handleClearSelection} color="primary">
                  {tPermissions('changePermission')}
                </Button>
              </Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                {tPermissions('abilities')}:
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                {selectedPermission.abilities.map((ability) => (
                  <Typography key={ability} variant="body2" color="text.secondary" sx={{ py: 0.25 }}>
                    • {ability}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={handleClose} disabled={isLoading}>
          {t('commonActions.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!selectedPermission || isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {tPermissions('grantPermission')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};