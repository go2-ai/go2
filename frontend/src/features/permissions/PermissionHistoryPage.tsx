// src/features/permissions/PermissionHistoryPage.tsx

import { useParams, useSearchParams } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tooltip,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import {
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow, format } from 'date-fns';
import { useGetPermissionVersionsQuery, useGetGrantablePermissionsQuery } from './permissionsApi';

const granteeTypeIcons = {
  Member: PersonIcon,
  Role: AssignmentIcon,
  Department: BusinessIcon,
  Group: GroupIcon,
};

const granteeTypeColors = {
  Member: 'primary',
  Role: 'success',
  Department: 'warning',
  Group: 'info',
} as const;

export const PermissionHistoryPage = () => {
  const { t } = useTranslation('permissions');
  const { t: tShared } = useTranslation('shared');
  const { organizationId } = useParams<{ organizationId: string }>();
  const [searchParams] = useSearchParams();
  const orgId = parseInt(organizationId || '0', 10);
  const permissionCode = searchParams.get('code') || '';

  // ─── Fetch grantable permissions to get the permission name ────────────
  const { data: grantablePermissions } = useGetGrantablePermissionsQuery(orgId, {
    skip: !orgId,
  });

  const permissionName = grantablePermissions?.find(
    (p) => p.code === permissionCode
  )?.name || permissionCode;

  // ─── Fetch permission versions ──────────────────────────────────────────
  const {
    data: versions,
    isLoading,
    error,
    refetch,
  } = useGetPermissionVersionsQuery(
    { organizationId: orgId, code: permissionCode },
    { skip: !orgId || !permissionCode, refetchOnMountOrArgChange: true }
  );

  // ─── Loading / Error States ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>{t('loadingHistory')}</Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              {tShared('commonActions.retry')}
            </Button>
          }
        >
          {t('failedToLoadHistory')}
        </Alert>
      </Container>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Typography variant="h4" component="h1">
          {t('permissionHistoryFor', { name: permissionName })}
        </Typography>
      </Box>

      {/* History Table */}
      {!permissionCode ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('noPermissionCodeProvided')}</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('event')}</TableCell>
                <TableCell>{t('dateTime')}</TableCell>
                <TableCell>{t('actor')}</TableCell>
                <TableCell>{t('granteeType')}</TableCell>
                <TableCell>{t('grantee')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!versions || versions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      { t('noHistoryForPermission') }
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                versions.map((entry) => {
                  const Icon = granteeTypeIcons[entry.grantee_type] ?? PersonIcon;
                  const color = granteeTypeColors[entry.grantee_type] ?? 'default';
                  const relativeTime = formatDistanceToNow(new Date(entry.created_at), {
                    addSuffix: true,
                  });
                  const absoluteTime = format(new Date(entry.created_at), 'PPpp');

                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Chip
                          label={entry.event === 'create' ? t('granted') : t('revoked')}
                          size="small"
                          color={entry.event === 'create' ? 'success' : 'error'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={absoluteTime} arrow>
                          <Typography variant="body2" sx={{ cursor: 'help' }}>
                            {relativeTime}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{entry.actor_name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={<Icon fontSize="small" />}
                          label={entry.grantee_type}
                          size="small"
                          color={color as any}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {entry.grantee_name}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
};