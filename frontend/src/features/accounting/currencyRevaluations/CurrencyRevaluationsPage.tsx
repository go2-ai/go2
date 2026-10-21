import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { ExtendedDataGrid } from '../../../components/shared/ExtendedDataGrid';
import { useTabManager } from '../../../components/tabs/useTabManager';
import { useTabLoading } from '../../../components/tabs/TabLoadingContext';
import { useToast } from '../../../contexts/ToastContext';
import { useActiveFiscalYear } from '../../../hooks/useActiveFiscalYear';
import { usePermissionCodes } from '../../../hooks/usePermissionCodes';
import { apiErrorMessage } from '../../../utils/apiErrorMessage';
import { PERMISSION_CODES } from '../../app/sidebarConfig';
import { useResolveExchangeRatesQuery } from '../exchangeRates/exchangeRatesApi';
import { useGetCurrenciesQuery } from '../currencies/currenciesApi';
import {
  useCreateCurrencyRevaluationMutation,
  useGetCurrencyRevaluationsQuery,
  type CurrencyRevaluation,
} from './currencyRevaluationsApi';
import { DifferenceAmount } from './components/RevaluationAmountCells';
import { SchedulesPanel } from './components/SchedulesPanel';
import { STATUS_COLORS } from './revaluationStatus';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** List of revaluations and creation of new (draft) ones. */
export const CurrencyRevaluationsPage = () => {
  const { t: tAccounting } = useTranslation('accounting');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const navigate = useNavigate();
  const { openTab } = useTabManager();
  const { showError } = useToast();
  const { activeFiscalYearId, activeFiscalYear } = useActiveFiscalYear(orgId);
  const { has } = usePermissionCodes(orgId);
  const canRevalue = has(PERMISSION_CODES.ACCOUNTING_REVALUE_CURRENCIES);

  const { data: revaluations = [], isLoading, error } = useGetCurrencyRevaluationsQuery(
    { organizationId: orgId, fiscalYearId: activeFiscalYearId },
    { skip: !orgId }
  );
  useTabLoading(isLoading);
  const { data: resolved } = useResolveExchangeRatesQuery({ organizationId: orgId }, { skip: !orgId });
  const { data: currencies = [] } = useGetCurrenciesQuery(orgId, { skip: !orgId });
  const mainDigits = currencies.find((c) => c.id === resolved?.main_currency_id)?.decimal_digits ?? 2;
  const [createRevaluation, { isLoading: creating }] = useCreateCurrencyRevaluationMutation();

  const [tab, setTab] = useState(0);

  const openRevaluation = (revaluation: Pick<CurrencyRevaluation, 'id' | 'as_of_date'>) => {
    const path = `/app/organizations/${orgId}/accounting/currency-revaluations/${revaluation.id}`;
    openTab('currency-revaluation', tAccounting('revaluations.tabTitle', { date: revaluation.as_of_date }), path);
    navigate(path);
  };

  // Today, or the nearest day of the active fiscal year when today is outside it.
  const defaultDate = () => {
    const today = todayIso();
    if (!activeFiscalYear) return today;
    if (today < activeFiscalYear.start_date) return activeFiscalYear.start_date;
    if (today > activeFiscalYear.finish_date) return activeFiscalYear.finish_date;
    return today;
  };

  // Creates a temporary draft (see defaultDate) and opens it; the date and kind
  // are changed there. Every qualifying balance is listed; unwanted ones are
  // left out on the revaluation page.
  const handleCreate = async () => {
    try {
      const created = await createRevaluation({ organizationId: orgId, asOfDate: defaultDate(), scope: {}, kind: 'temporary' }).unwrap();
      openRevaluation(created);
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('revaluations.saveFailed'));
    }
  };

  const columns: GridColDef<CurrencyRevaluation>[] = [
    { field: 'as_of_date', headerName: tAccounting('revaluations.asOfDate'), width: 140 },
    {
      field: 'kind',
      headerName: tAccounting('revaluations.kind'),
      width: 130,
      valueGetter: (_v, row) => tAccounting(`revaluations.kinds.${row.kind}`),
    },
    {
      field: 'status',
      headerName: tAccounting('revaluations.revaluationStatus'),
      width: 140,
      valueGetter: (_v, row) => tAccounting(`revaluations.statuses.${row.status}`),
      renderCell: (params: GridRenderCellParams<CurrencyRevaluation>) => (
        <Chip size="small" color={STATUS_COLORS[params.row.status]}
          label={tAccounting(`revaluations.statuses.${params.row.status}`)} />
      ),
    },
    {
      field: 'total_difference',
      headerName: tAccounting('revaluations.totalDifference'),
      width: 170,
      align: 'right',
      headerAlign: 'right',
      type: 'number',
      valueGetter: (_v, row) => Number(row.total_difference),
      renderCell: (params: GridRenderCellParams<CurrencyRevaluation>) => (
        <DifferenceAmount value={params.row.total_difference} digits={mainDigits} />
      ),
    },
    { field: 'items_count', headerName: tAccounting('revaluations.itemsCount'), width: 110, type: 'number' },
    { field: 'excluded_count', headerName: tAccounting('revaluations.excludedCount'), width: 130, type: 'number' },
    { field: 'removed_count', headerName: tAccounting('revaluations.removedCount'), width: 130, type: 'number' },
    {
      field: 'journal_entry_no',
      headerName: tAccounting('revaluations.journalEntry'),
      width: 130,
      valueGetter: (_v, row) => row.journal_entry_no ?? '',
    },
    {
      field: 'posted_at',
      headerName: tAccounting('revaluations.postedAt'),
      flex: 1,
      minWidth: 170,
      valueGetter: (_v, row) => (row.posted_at ? new Date(row.posted_at).toLocaleString() : ''),
    },
  ];

  return (
    <Container maxWidth={false} sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 2 }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Box>
          <Typography variant="h4" gutterBottom>{tAccounting('revaluations.title')}</Typography>
          <Typography variant="body2" color="text.secondary">{tAccounting('revaluations.description')}</Typography>
        </Box>
        {canRevalue && tab === 0 && (
          <Button variant="contained" startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            onClick={handleCreate} disabled={creating}>
            {tAccounting('revaluations.newRevaluation')}
          </Button>
        )}
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, flexShrink: 0 }}>
        <Tab label={tAccounting('revaluations.title')} />
        <Tab label={tAccounting('revaluationSchedules.title')} />
      </Tabs>

      {tab === 1 ? (
        <SchedulesPanel
          organizationId={orgId}
          mainCurrencyId={resolved?.main_currency_id ?? null}
          canRevalue={canRevalue}
          onOpenRevaluation={(id, asOfDate) => openRevaluation({ id, as_of_date: asOfDate })}
        />
      ) : error ? (
        <Alert severity="error">{tAccounting('revaluations.loadFailed')}</Alert>
      ) : (
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <ExtendedDataGrid
            rows={revaluations}
            columns={columns}
            loading={isLoading}
            showHeaderSearchRow
            excludeSearchFields={[]}
            hideFooter
            disableColumnMenu
            disableRowSelectionOnClick
            showCellVerticalBorder
            rowHeight={40}
            onRowOpen={openRevaluation}
            rowOpenLabel={tAccounting('revaluations.open')}
            initialState={{ sorting: { sortModel: [{ field: 'as_of_date', sort: 'desc' }] } }}
            localeText={{ noRowsLabel: tAccounting('revaluations.noRevaluations') }}
            sx={{ flex: 1, '& .MuiDataGrid-cell:focus': { outline: 'none' } }}
          />
        </Paper>
      )}

    </Container>
  );
};
