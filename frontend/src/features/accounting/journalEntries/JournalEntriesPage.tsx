// frontend/src/features/accounting/journalEntries/JournalEntriesPage.tsx
import { useMemo } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Button,
  Chip,
} from '@mui/material';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';
import {
  useGetJournalEntriesQuery,
  type JournalEntry,
} from './journalEntriesApi';
import { useActiveFiscalYear } from '../../../hooks/useActiveFiscalYear';
import { ExtendedDataGrid } from '../../../components/shared/ExtendedDataGrid';
import { useNavigate, useParams } from 'react-router-dom';
import { useTabManager } from '../../../components/tabs/useTabManager';


export const JournalEntriesPage = () => {
  const { t } = useTranslation('shared');
  const { t: tJE } = useTranslation('accounting');
  const { i18n } = useTranslation();
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);

  const { activeFiscalYearId } = useActiveFiscalYear(orgId);
  const navigate = useNavigate();
  const { openTab } = useTabManager();

  const handleRowDoubleClick = (params: GridRowParams) => {
    const journalEntry = params.row as JournalEntry;
    const path = `/app/organizations/${orgId}/accounting/journal-entries/${journalEntry.id}`;
    openTab('journal-entry-edit', `Journal Entry #${journalEntry.no || journalEntry.id}`, path);
    navigate(path);
  };

  const {
    data: journalEntries,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetJournalEntriesQuery(
    { organizationId: orgId, fiscalYearId: activeFiscalYearId ?? undefined },
    { skip: !orgId || !activeFiscalYearId }
  );

  const columns = useMemo<GridColDef<JournalEntry>[]>(() => {
    const currentLocale = i18n.language;

    const resolveDescription = (entry: JournalEntry): string =>
      entry.t?.description?.[currentLocale] ?? '';

    const formatNumber = (value: number | string): string =>
      Number(value).toLocaleString();

    const formatCreatedAt = (iso: string): string => {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return iso;
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${d} ${hh}:${mm}`;
    };

    const stateLabel = (state: JournalEntry['state']): string =>
      tJE(state) === state ? state : tJE(state);

    const entryTypeLabel = (entryType: JournalEntry['entry_type']): string =>
      tJE(entryType) === entryType ? entryType : tJE(entryType);

    return [
      { field: 'no', headerName: tJE('no'), width: 100 },
      { field: 'ref', headerName: tJE('ref'), width: 100 },
      { field: 'date', headerName: tJE('date'), width: 140 },
      {
        field: 'description',
        headerName: tJE('journalEntryDescription'),
        width: 300,
        valueGetter: (_value, row) => resolveDescription(row),
      },
      {
        field: 'debit',
        headerName: tJE('debit'),
        width: 140,
        align: 'right',
        headerAlign: 'right',
        valueGetter: (_value, row) => formatNumber(row.debit),
      },
      {
        field: 'credit',
        headerName: tJE('credit'),
        width: 140,
        align: 'right',
        headerAlign: 'right',
        valueGetter: (_value, row) => formatNumber(row.credit),
      },
      {
        field: 'state',
        headerName: tJE('state'),
        width: 130,
        renderCell: (params) => {
          const state = params.row.state;
          const color =
            state === 'approved'
              ? 'success'
              : state === 'booked'
                ? 'primary'
                : 'default';

          return (
            <Chip
              label={stateLabel(state)}
              color={color}
              size="small"
              variant={state === 'draft' ? 'outlined' : 'filled'}
            />
          );
        },
      },
      {
        field: 'entry_type',
        headerName: tJE('entryType'),
        width: 130,
        valueGetter: (_value, row) => entryTypeLabel(row.entry_type),
      },
      {
        field: 'created_at',
        headerName: tJE('createdAt'),
        width: 180,
        valueGetter: (_value, row) => formatCreatedAt(row.created_at),
      },
      {
        field: 'daily_no',
        headerName: tJE('dailyNo'),
        width: 100,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'creator_name',
        headerName: tJE('createdBy'),
        width: 180,
      },
    ];
  }, [i18n.language, tJE]);
  

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={refetch}>
              {t('commonActions.retry')}
            </Button>
          }
        >
          {tJE('failedToLoadJournalEntries')}
        </Alert>
      </Container>
    );
  }
  

  return (
    <Container maxWidth="xl" sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 2 }}>
      <Box sx={{ mb: 2, flexShrink: 0 }}>
        <Typography variant="h4" gutterBottom>
          {tJE('journalEntries')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {tJE('journalEntriesDescription')}
        </Typography>
      </Box>

      {!journalEntries || journalEntries.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {tJE('noJournalEntries')}
          </Typography>
        </Paper>
      ) : (
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <ExtendedDataGrid
            rows={journalEntries}
            columns={columns}
            showHeaderSearchRow
            excludeSearchFields={[]}
            hideFooterPagination
            hideFooter
            disableColumnMenu
            disableRowSelectionOnClick
            rowHeight={40}
            loading={isFetching}
            onRowDoubleClick={handleRowDoubleClick}
            initialState={{
              sorting: {
                sortModel: [{ field: 'created_at', sort: 'desc' }],
              },
            }}
            sx={{
              flex: 1,
              '& .MuiDataGrid-cell:focus': { outline: 'none' },
              '& .MuiDataGrid-row:hover': { cursor: 'pointer' },
              
              '& .MuiDataGrid-row': {
                '&:nth-of-type(odd)': {
                  backgroundColor: (theme) => theme.palette.action.hover,
                },
              },
              '& .MuiDataGrid-cell': {
                borderRight: 1,
                borderColor: 'divider',
              },
              '& .MuiDataGrid-columnHeaders': {
                borderBottom: 1,
                borderColor: 'divider',
              },
            }}
          />
        </Paper>
      )}
    </Container>
  );
};