import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';
import { ExtendedDataGrid } from '../../../../components/shared/ExtendedDataGrid';
import { useToast } from '../../../../contexts/ToastContext';
import { useConfirm } from '../../../../contexts/confirmContext';
import { apiErrorMessage } from '../../../../utils/apiErrorMessage';
import { journalEntriesApi } from '../../journalEntries/journalEntriesApi';
import {
  useRenumberEntriesMutation,
  useSkipRenumberMutation,
  type ClosingState,
  type RenumberChange,
} from '../fiscalYearClosingApi';

interface Props {
  state: ClosingState;
}

const ORDER = ['date', 'type', 'created'] as const;

/**
 * Optional step after starting: consecutive entry numbers in date order.
 * References don't change.
 */
export const RenumberStep = ({ state }: Props) => {
  const { t: tAccounting } = useTranslation('accounting');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const dispatch = useDispatch();
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();
  const [renumber, { isLoading: renumbering }] = useRenumberEntriesMutation();
  const [skip, { isLoading: skipping }] = useSkipRenumberMutation();
  const busy = renumbering || skipping;

  const preview = state.renumber;
  if (!preview) return null;
  const args = { organizationId: orgId, fiscalYearId: state.fiscal_year.id };

  const handleRenumber = async () => {
    const ok = await confirm({
      title: tAccounting('closing.renumber.confirmTitle'),
      message: tAccounting('closing.renumber.confirmMessage', { count: preview.changed_count }),
      confirmText: tAccounting('closing.renumber.renumber'),
      confirmColor: 'primary',
    });
    if (!ok) return;
    try {
      await renumber(args).unwrap();
      dispatch(journalEntriesApi.util.invalidateTags(['JournalEntry']));
      showSuccess(tAccounting('closing.renumber.done', { count: preview.changed_count }));
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('closing.actionFailed'));
    }
  };

  const handleSkip = async () => {
    try {
      await skip(args).unwrap();
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('closing.actionFailed'));
    }
  };

  const columns: GridColDef<RenumberChange>[] = [
    { field: 'ref', headerName: tAccounting('ref'), width: 110, type: 'number' },
    { field: 'date', headerName: tAccounting('date'), width: 130 },
    {
      field: 'entry_type',
      headerName: tAccounting('entryType'),
      flex: 1,
      minWidth: 160,
      valueGetter: (_v, row) => tAccounting(row.entry_type),
    },
    { field: 'no', headerName: tAccounting('closing.renumber.currentNo'), width: 140, type: 'number' },
    {
      field: 'new_no',
      headerName: tAccounting('closing.renumber.newNo'),
      width: 140,
      type: 'number',
      cellClassName: 'renumber-new',
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">{tAccounting('closing.renumber.intro')}</Typography>
      <Box component="ol" sx={{ m: 0, pl: 3 }}>
        {ORDER.map((key) => (
          <Typography key={key} component="li" variant="body2">{tAccounting(`closing.renumber.order.${key}`)}</Typography>
        ))}
      </Box>
      <Typography variant="body2" color="text.secondary">{tAccounting('closing.renumber.refsKept')}</Typography>

      {preview.changed_count === 0 ? (
        <Alert severity="success">{tAccounting('closing.renumber.inOrder', { count: preview.entries_count })}</Alert>
      ) : (
        <>
          <Typography variant="subtitle2">
            {tAccounting('closing.renumber.changes', { count: preview.changed_count, total: preview.entries_count })}
          </Typography>
          <Paper variant="outlined" sx={{ height: 360, display: 'flex' }}>
            <ExtendedDataGrid
              rows={preview.changes}
              columns={columns}
              showHeaderSearchRow
              excludeSearchFields={[]}
              hideFooter
              disableColumnMenu
              disableRowSelectionOnClick
              showCellVerticalBorder
              rowHeight={36}
              initialState={{ sorting: { sortModel: [{ field: 'new_no', sort: 'asc' }] } }}
              sx={{ flex: 1, '& .renumber-new': { fontWeight: 600 }, '& .MuiDataGrid-cell:focus': { outline: 'none' } }}
            />
          </Paper>
          {preview.changes.length < preview.changed_count && (
            <Typography variant="caption" color="text.secondary">
              {tAccounting('closing.renumber.partialList', { shown: preview.changes.length })}
            </Typography>
          )}
        </>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        {/* Same main button as the other steps: Continue when nothing would change. */}
        <Button
          variant={preview.changed_count === 0 ? 'contained' : 'outlined'}
          onClick={handleSkip}
          disabled={busy}
          startIcon={skipping ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {tAccounting(preview.changed_count === 0 ? 'closing.tempClosing.continue' : 'closing.renumber.skip')}
        </Button>
        {preview.changed_count > 0 && (
          <Button variant="contained" onClick={handleRenumber} disabled={busy}
            startIcon={renumbering ? <CircularProgress size={16} color="inherit" /> : null}>
            {tAccounting('closing.renumber.renumber')}
          </Button>
        )}
      </Box>
    </Box>
  );
};
