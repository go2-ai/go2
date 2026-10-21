import { useState } from 'react';
import { Box, Button, Chip, IconButton, Paper, Switch, Tooltip, Typography } from '@mui/material';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import { ExtendedDataGrid } from '../../../../components/shared/ExtendedDataGrid';
import { useToast } from '../../../../contexts/ToastContext';
import { useConfirm } from '../../../../contexts/confirmContext';
import { apiErrorMessage } from '../../../../utils/apiErrorMessage';
import {
  useDeleteRevaluationScheduleMutation,
  useGetRevaluationSchedulesQuery,
  useRunRevaluationScheduleMutation,
  useUpdateRevaluationScheduleMutation,
  type RevaluationSchedule,
  type ScheduleRunStatus,
} from '../currencyRevaluationsApi';
import { formatLocalDateTime } from '../scheduleRule';
import { ScheduleDialog } from './ScheduleDialog';

const RUN_STATUS_COLORS: Record<ScheduleRunStatus, 'success' | 'default' | 'warning' | 'error'> = {
  posted: 'success',
  no_change: 'default',
  skipped: 'default',
  blocked: 'warning',
  failed: 'error',
};

interface Props {
  organizationId: number;
  mainCurrencyId: number | null;
  canRevalue: boolean;
  /** Opens the revaluation a run posted. */
  onOpenRevaluation: (id: number, asOfDate: string) => void;
}

/** Automatic revaluation schedules. */
export const SchedulesPanel = ({ organizationId, mainCurrencyId, canRevalue, onOpenRevaluation }: Props) => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { showSuccess, showError, showInfo } = useToast();
  const confirm = useConfirm();
  const { data: schedules = [], isLoading } = useGetRevaluationSchedulesQuery(organizationId, { skip: !organizationId });
  const [updateSchedule] = useUpdateRevaluationScheduleMutation();
  const [deleteSchedule] = useDeleteRevaluationScheduleMutation();
  const [runSchedule, { isLoading: running }] = useRunRevaluationScheduleMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RevaluationSchedule | null>(null);

  const runDetails = (schedule: RevaluationSchedule) => {
    const details = schedule.last_run_details ?? {};
    const parts: string[] = [];
    if (details.as_of_date) parts.push(tAccounting('revaluationSchedules.runDetails.asOf', { date: details.as_of_date }));
    if (details.posted_items) parts.push(tAccounting('revaluationSchedules.runDetails.posted', { count: Number(details.posted_items) }));
    if (details.blocked) parts.push(tAccounting('revaluationSchedules.runDetails.blocked', { count: Number(details.blocked) }));
    if (details.excluded_blocked_by_unapproved) {
      parts.push(tAccounting('revaluationSchedules.runDetails.blocked', { count: Number(details.excluded_blocked_by_unapproved) }));
    }
    if (details.excluded_missing_rate) {
      parts.push(tAccounting('revaluationSchedules.runDetails.missingRates', { count: Number(details.excluded_missing_rate) }));
    }
    if (details.reason) parts.push(tAccounting(`revaluationSchedules.skipReasons.${details.reason}`));
    if (details.error) parts.push(tAccounting('revaluationSchedules.runDetails.error', { error: details.error }));
    return parts.join(' · ');
  };

  const handleRun = async (schedule: RevaluationSchedule) => {
    try {
      const result = await runSchedule({ organizationId, id: schedule.id }).unwrap();
      const message = tAccounting(`revaluationSchedules.runStatuses.${result.status}`);
      if (result.status === 'posted' && result.revaluation_id) {
        showSuccess(message);
        onOpenRevaluation(result.revaluation_id, String(result.details.as_of_date ?? ''));
      } else if (result.status === 'failed' || result.status === 'blocked') {
        showError(`${message}: ${runDetails(result.schedule)}`);
      } else {
        showInfo(`${message}: ${runDetails(result.schedule)}`);
      }
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('revaluationSchedules.runFailed'));
    }
  };

  const handleToggle = async (schedule: RevaluationSchedule, active: boolean) => {
    try {
      await updateSchedule({ organizationId, id: schedule.id, data: { active } }).unwrap();
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('revaluationSchedules.saveFailed'));
    }
  };

  const handleDelete = async (schedule: RevaluationSchedule) => {
    const ok = await confirm({
      title: tAccounting('revaluationSchedules.deleteTitle'),
      message: tAccounting('revaluationSchedules.deleteMessage', { name: schedule.name }),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });
    if (!ok) return;
    try {
      await deleteSchedule({ organizationId, id: schedule.id }).unwrap();
      showSuccess(tAccounting('revaluationSchedules.deleted'));
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('revaluationSchedules.saveFailed'));
    }
  };

  const columns: GridColDef<RevaluationSchedule>[] = [
    { field: 'name', headerName: t('name'), flex: 1 },
    { field: 'rrule', headerName: tAccounting('revaluationSchedules.rule'), flex: 1 },
    {
      field: 'default_kind',
      headerName: tAccounting('revaluations.kind'),
      width: 120,
      valueGetter: (_v, row) => tAccounting(`revaluations.kinds.${row.default_kind}`),
    },
    {
      field: 'next_run_at',
      headerName: tAccounting('revaluationSchedules.nextRun'),
      width: 160,
      valueGetter: (_v, row) => formatLocalDateTime(row.next_run_at),
    },
    {
      field: 'last_run_status',
      headerName: tAccounting('revaluationSchedules.lastRun'),
      flex: 1.4,
      valueGetter: (_v, row) => (row.last_run_status
        ? `${tAccounting(`revaluationSchedules.runStatuses.${row.last_run_status}`)} ${formatLocalDateTime(row.last_run_at)}`
        : ''),
      renderCell: (params: GridRenderCellParams<RevaluationSchedule>) => {
        const { last_run_status: status, last_run_at: at } = params.row;
        if (!status) return <Typography variant="body2" color="text.secondary">—</Typography>;
        return (
          <Tooltip title={runDetails(params.row)}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip size="small" color={RUN_STATUS_COLORS[status]} label={tAccounting(`revaluationSchedules.runStatuses.${status}`)} />
              <Typography variant="caption" color="text.secondary">{formatLocalDateTime(at)}</Typography>
            </Box>
          </Tooltip>
        );
      },
    },
    {
      field: 'active',
      headerName: tAccounting('revaluationSchedules.active'),
      width: 110,
      valueGetter: (_v, row) => tAccounting(row.active ? 'revaluationSchedules.activeYes' : 'revaluationSchedules.activeNo'),
      renderCell: (params: GridRenderCellParams<RevaluationSchedule>) => (
        <Switch
          size="small"
          checked={params.row.active}
          disabled={!canRevalue}
          onChange={(e) => handleToggle(params.row, e.target.checked)}
          inputProps={{ 'aria-label': `${tAccounting('revaluationSchedules.active')} ${params.row.name}` }}
        />
      ),
    },
    {
      field: 'actions',
      headerName: t('actions'),
      width: 140,
      sortable: false,
      renderCell: (params: GridRenderCellParams<RevaluationSchedule>) =>
        canRevalue ? (
          <Box>
            <Tooltip title={tAccounting('revaluationSchedules.runNow')}>
              <span>
                <IconButton size="small" onClick={() => handleRun(params.row)} disabled={running}
                  aria-label={tAccounting('revaluationSchedules.runNow')}>
                  <PlayArrowOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton size="small" onClick={() => { setEditing(params.row); setDialogOpen(true); }} aria-label={t('commonActions.edit')}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => handleDelete(params.row)} aria-label={t('commonActions.delete')}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : null,
    },
  ];

  return (
    <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">{tAccounting('revaluationSchedules.description')}</Typography>
        {canRevalue && (
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => { setEditing(null); setDialogOpen(true); }}>
            {tAccounting('revaluationSchedules.new')}
          </Button>
        )}
      </Box>
      <ExtendedDataGrid
        rows={schedules}
        columns={columns}
        loading={isLoading}
        showHeaderSearchRow
        excludeSearchFields={['actions']}
        disableRowSelectionOnClick
        disableColumnMenu
        showCellVerticalBorder
        hideFooter
        rowHeight={44}
        onRowOpen={canRevalue ? (row) => { setEditing(row as RevaluationSchedule); setDialogOpen(true); } : undefined}
        rowOpenLabel={t('commonActions.edit')}
        sx={{ flex: 1, '& .MuiDataGrid-cell:focus': { outline: 'none' } }}
        localeText={{ noRowsLabel: tAccounting('revaluationSchedules.empty') }}
      />
      <ScheduleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        organizationId={organizationId}
        mainCurrencyId={mainCurrencyId}
        schedule={editing}
      />
    </Paper>
  );
};
