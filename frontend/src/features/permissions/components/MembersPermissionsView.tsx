// src/features/permissions/components/MembersPermissionsView.tsx

import { useState, useMemo } from 'react';
import {
  Box,
  Chip,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  InputAdornment,
  Typography,
  CircularProgress,
  alpha,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import SearchIcon from '@mui/icons-material/Search';
import type { Member } from '../../members/types';
import { MemberAvatar } from '../../members/components/MemberAvatar';

interface MembersPermissionsViewProps {
  members: Member[];
  organizationId: number;
  selectedMemberId: number | null;
  onMemberSelect: (memberId: number) => void;
  isLoading?: boolean;
}

const statusColors = {
  joined: 'success',
  invited: 'warning',
  archived: 'default',
  not_invited: 'default',
} as const;

const statusLabels = {
  joined: 'joined',
  invited: 'invited',
  archived: 'archived',
  not_invited: 'notInvited',
} as const;

export const MembersPermissionsView = ({
  members,
  selectedMemberId,
  onMemberSelect,
  isLoading,
}: MembersPermissionsViewProps) => {
  const { t } = useTranslation('permissions');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase().trim();
    return members.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!members || members.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('noMembers')}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search - removed the member count below */}
      <TextField
        fullWidth
        variant="outlined"
        placeholder={t('searchMembers')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        size="small"
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {/* Member List */}
      <List disablePadding sx={{ flex: 1, overflow: 'auto' }}>
        {filteredMembers.map((member) => {
          const isSelected = selectedMemberId === member.id;
          const isUserless = member.user_id === null;
          const status = member.status as keyof typeof statusColors;

          return (
            <ListItem
              key={member.id}
              disablePadding
              sx={{
                bgcolor: isSelected
                  ? (theme) => alpha(theme.palette.primary.main, 0.08)
                  : 'transparent',
                borderLeft: isSelected
                  ? (theme) => `3px solid ${theme.palette.primary.main}`
                  : '3px solid transparent',
                '&:hover': {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                },
              }}
            >
              <ListItemButton onClick={() => onMemberSelect(member.id)} sx={{ py: 1.5, px: 2 }}>
                <MemberAvatar member={member} />
                <ListItemText
                  sx={{ mx: 2 }}
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography
                        variant="body2"
                        fontWeight={isSelected ? 600 : 400}
                        sx={{
                          textDecoration: member.status === 'archived' ? 'line-through' : 'none',
                          opacity: member.status === 'archived' ? 0.6 : 1,
                        }}
                      >
                        {member.name}
                      </Typography>
                      {isUserless && (
                        <Chip
                          label={t('userless')}
                          size="small"
                          variant="outlined"
                          color="warning"
                          sx={{ height: 18, fontSize: '0.625rem' }}
                        />
                      )}
                      {member.org_admin && (
                        <Chip
                          label="Admin"
                          size="small"
                          color="primary"
                          sx={{ height: 18, fontSize: '0.625rem' }}
                        />
                      )}
                      <Chip
                        label={t(`status.${statusLabels[status]}`)}
                        size="small"
                        color={statusColors[status] as any}
                        variant={status === 'joined' ? 'filled' : 'outlined'}
                        sx={{ height: 18, fontSize: '0.625rem' }}
                      />
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {member.email}
                    </Typography>
                  }
                  secondaryTypographyProps={{ component: 'div' }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}

        {filteredMembers.length === 0 && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography color="text.secondary">{t('noMembersFound')}</Typography>
          </Box>
        )}
      </List>
    </Box>
  );
};