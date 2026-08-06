// src/features/permissions/components/GrantablePermissionsList.tsx

import { useState, useMemo } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  CircularProgress,
  alpha,
  TextField,
  InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import type { GrantablePermission } from '../types';

interface GrantablePermissionsListProps {
  grantablePermissions?: GrantablePermission[];
  selectedCode?: string;
  onSelect: (code: string) => void;
  isLoading?: boolean;
}

export const GrantablePermissionsList = ({
  grantablePermissions,
  selectedCode,
  onSelect,
  isLoading,
}: GrantablePermissionsListProps) => {
  const { t } = useTranslation('permissions');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPermissions = useMemo(() => {
    if (!grantablePermissions) return [];
    if (!searchQuery.trim()) return grantablePermissions;

    const query = searchQuery.toLowerCase().trim();
    return grantablePermissions.filter(
      (perm) =>
        perm.name.toLowerCase().includes(query) ||
        perm.code.toLowerCase().includes(query) ||
        perm.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [grantablePermissions, searchQuery]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search Box */}
      <TextField
        fullWidth
        variant="outlined"
        placeholder={t('searchPermissions')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        size="small"
        sx={{ mb: 2, flexShrink: 0 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {/* Permission List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {filteredPermissions.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {searchQuery.trim() ? t('noPermissionsFound') : t('noGrantablePermissions')}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {filteredPermissions.map((perm) => {
              const isSelected = selectedCode === perm.code;

              return (
                <ListItem
                  key={perm.code}
                  disablePadding
                  sx={{
                    bgcolor: isSelected ? (theme) => alpha(theme.palette.primary.main, 0.08) : 'transparent',
                    borderLeft: isSelected ? (theme) => `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                    '&:hover': {
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                    },
                  }}
                >
                  <ListItemButton onClick={() => onSelect(perm.code)} sx={{ py: 0.75, px: 1.5 }}>
                    <ListItemText
                      primary={
                        <Typography variant="body2" fontWeight={isSelected ? 600 : 400} fontSize="0.875rem">
                          {perm.name}
                        </Typography>
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
  );
};