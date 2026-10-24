import { useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import { useGetMembersQuery } from '../../members/membersApi';
import { useGetRolesQuery } from '../../roles/rolesApi';
import { useGetGroupsQuery } from '../../groups/groupsApi';
import { useGetDepartmentsQuery } from '../../departments/departmentsApi';
import { useToast } from '../../../contexts/ToastContext';
import { apiErrorMessage } from '../../../utils/apiErrorMessage';
import { useCreateReportGrantMutation, useDeleteReportGrantMutation, useGetReportGrantsQuery } from '../reportingApi';
import type { GranteeType, ReportSummary } from '../types';

const GRANTEE_TYPES: GranteeType[] = ['Member', 'Role', 'Group', 'Department'];

interface Props {
  organizationId: number;
  report: ReportSummary;
  open: boolean;
  onClose: () => void;
}

/** Members, roles, groups and departments that may view or edit one report. */
export const ReportAccessDialog = ({ organizationId, report, open, onClose }: Props) => {
  const { t } = useTranslation('reporting');
  const { showError, showSuccess } = useToast();
  const [granteeType, setGranteeType] = useState<GranteeType>('Role');
  const [grantee, setGrantee] = useState<{ id: number; name: string } | null>(null);
  const [access, setAccess] = useState<'view' | 'edit'>('view');

  const { data: grants = [], isFetching } = useGetReportGrantsQuery(
    { organizationId, reportId: report.id },
    { skip: !open }
  );
  const { data: members } = useGetMembersQuery(organizationId, { skip: !open });
  const { data: roles } = useGetRolesQuery(organizationId.toString(), { skip: !open });
  const { data: groups } = useGetGroupsQuery(organizationId, { skip: !open });
  const { data: departments } = useGetDepartmentsQuery(organizationId, { skip: !open });
  const [createGrant, { isLoading: creating }] = useCreateReportGrantMutation();
  const [deleteGrant] = useDeleteReportGrantMutation();

  // Names come in the current language (translated fields are resolved by the server).
  const options = useMemo(() => {
    const lists: Record<GranteeType, Array<{ id: number; name: string }> | undefined> = {
      Member: members,
      Role: roles,
      Group: groups,
      Department: departments,
    };
    return (lists[granteeType] ?? []).map((item) => ({ id: item.id, name: item.name || String(item.id) }));
  }, [granteeType, members, roles, groups, departments]);

  const add = async () => {
    if (!grantee) return;
    try {
      await createGrant({ organizationId, reportId: report.id, granteeType, granteeId: grantee.id, access }).unwrap();
      setGrantee(null);
      showSuccess(t('access.granted'));
    } catch (err) {
      showError(apiErrorMessage(err) || t('access.failed'));
    }
  };

  const remove = async (id: number) => {
    try {
      await deleteGrant({ organizationId, reportId: report.id, id }).unwrap();
    } catch (err) {
      showError(apiErrorMessage(err) || t('access.failed'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('access.title', { name: report.name })}</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('access.hint')}
        </Alert>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField
            select
            size="small"
            label={t('access.granteeType')}
            value={granteeType}
            onChange={(e) => {
              setGranteeType(e.target.value as GranteeType);
              setGrantee(null);
            }}
            sx={{ width: 150 }}
          >
            {GRANTEE_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {t(`access.types.${type}`)}
              </MenuItem>
            ))}
          </TextField>
          <Autocomplete
            size="small"
            sx={{ flex: 1 }}
            options={options}
            value={grantee}
            onChange={(_, value) => setGrantee(value)}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => <TextField {...params} label={t('access.grantee')} />}
          />
          <TextField
            select
            size="small"
            label={t('access.access')}
            value={report.system ? 'view' : access}
            disabled={report.system}
            onChange={(e) => setAccess(e.target.value as 'view' | 'edit')}
            sx={{ width: 120 }}
          >
            <MenuItem value="view">{t('access.levels.view')}</MenuItem>
            <MenuItem value="edit">{t('access.levels.edit')}</MenuItem>
          </TextField>
          <Button variant="contained" onClick={add} disabled={!grantee || creating}>
            {t('access.add')}
          </Button>
        </Stack>
        {grants.length === 0 && !isFetching ? (
          <Typography variant="body2" color="text.secondary">
            {t('access.none')}
          </Typography>
        ) : (
          <List dense>
            {grants.map((grant) => (
              <ListItem
                key={grant.id}
                secondaryAction={
                  <IconButton edge="end" size="small" onClick={() => remove(grant.id)} aria-label={t('access.remove')}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={grant.grantee_name ?? grant.grantee_id}
                  secondary={
                    <Box component="span">
                      {t(`access.types.${grant.grantee_type}`)} · {t(`access.levels.${grant.access}`)}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('access.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};
