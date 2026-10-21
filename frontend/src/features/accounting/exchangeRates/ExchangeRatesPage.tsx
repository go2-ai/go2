import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';
import { useTranslation } from 'react-i18next';
import { BaseDatePicker } from '../../../components/shared/BaseDatePicker';
import { ExtendedDataGrid } from '../../../components/shared/ExtendedDataGrid';
import { useTabLoading } from '../../../components/tabs/TabLoadingContext';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/confirmContext';
import { usePermissionCodes } from '../../../hooks/usePermissionCodes';
import { PERMISSION_CODES } from '../../app/sidebarConfig';
import { useGetCurrenciesQuery } from '../currencies/currenciesApi';
import { apiErrorMessage } from '../../../utils/apiErrorMessage';
import {
  useDeleteExchangeRateMutation,
  useFetchExchangeRatesMutation,
  useGetExchangeRateSourcesQuery,
  useGetExchangeRatesQuery,
  useResolveExchangeRatesQuery,
  type ExchangeRate,
  type ResolvedRate,
} from './exchangeRatesApi';
import { ExchangeRateModal } from './components/ExchangeRateModal';
import { ExchangeRateSourcesTable } from './components/ExchangeRateSourcesTable';
import { BackfillRatesDialog } from './components/BackfillRatesDialog';
import { formatRate } from './rateFormat';
import { RateWithInverse } from './components/RateWithInverse';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const ExchangeRatesPage = () => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const { showSuccess, showError, showWarning } = useToast();
  const confirm = useConfirm();
  const { has } = usePermissionCodes(orgId);
  const canManage = has(PERMISSION_CODES.ACCOUNTING_MANAGE_EXCHANGE_RATES);

  const [tab, setTab] = useState(0);
  const [asOf, setAsOf] = useState<string | null>(todayIso());
  const [historyCurrencyId, setHistoryCurrencyId] = useState<number | ''>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExchangeRate | null>(null);

  const { data: currencies = [], isLoading: loadingCurrencies } = useGetCurrenciesQuery(orgId, { skip: !orgId });
  const {
    data: resolved,
    isFetching: resolving,
    error: resolveError,
  } = useResolveExchangeRatesQuery({ organizationId: orgId, date: asOf }, { skip: !orgId || !asOf });
  const { data: history = [], isFetching: loadingHistory } = useGetExchangeRatesQuery(
    { organizationId: orgId, currencyId: historyCurrencyId || null },
    { skip: !orgId || tab !== 1 }
  );
  const { data: sources = [] } = useGetExchangeRateSourcesQuery(orgId, { skip: !orgId || tab !== 2 });
  const [deleteRate] = useDeleteExchangeRateMutation();
  const [fetchRates, { isLoading: fetching }] = useFetchExchangeRatesMutation();
  const [backfillOpen, setBackfillOpen] = useState(false);
  useTabLoading(loadingCurrencies);

  const runFetch = async (from?: string, to?: string) => {
    try {
      const summary = await fetchRates({ organizationId: orgId, from, to }).unwrap();
      showSuccess(tAccounting('exchangeRates.fetchSummary', {
        created: summary.created,
        updated: summary.updated,
        unchanged: summary.unchanged,
      }));
      if (summary.skipped.length > 0) {
        showWarning(tAccounting('exchangeRates.fetchSkipped', {
          currencies: summary.skipped.map((s) => s.currency).join(', '),
        }));
      }
      setBackfillOpen(false);
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('exchangeRates.fetchFailed'));
    }
  };

  const mainCurrencyId = resolved?.main_currency_id ?? null;
  const currencyById = useMemo(() => new Map(currencies.map((c) => [c.id, c])), [currencies]);
  const abr = (id: number | null) => (id ? currencyById.get(id)?.abr ?? `#${id}` : '');
  const mainAbr = abr(mainCurrencyId);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleDelete = async (rate: ExchangeRate) => {
    const ok = await confirm({
      title: tAccounting('exchangeRates.deleteTitle'),
      message: tAccounting('exchangeRates.deleteMessage', { currency: abr(rate.currency_id), date: rate.date }),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });
    if (!ok) return;
    try {
      await deleteRate({ organizationId: orgId, id: rate.id }).unwrap();
      showSuccess(tAccounting('exchangeRates.deleted'));
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('exchangeRates.saveFailed'));
    }
  };

  const resolvedColumns: GridColDef<ResolvedRate>[] = [
    {
      field: 'currency_id',
      headerName: tAccounting('exchangeRates.currency'),
      flex: 1,
      valueGetter: (_v, row) => abr(row.currency_id),
    },
    {
      field: 'rate',
      headerName: tAccounting('exchangeRates.rateInMain', { currency: mainAbr }),
      flex: 1,
      type: 'number',
      valueGetter: (_v, row) => (row.rate ? formatRate(row.rate) : tAccounting(`exchangeRates.errors.${row.error ?? 'missing'}`)),
      renderCell: (params: GridRenderCellParams<ResolvedRate>) =>
        params.row.rate ? (
          <RateWithInverse rate={params.row.rate} currency={abr(params.row.currency_id)} quote={mainAbr} />
        ) : (
          <Chip
            size="small"
            color="warning"
            label={tAccounting(`exchangeRates.errors.${params.row.error ?? 'missing'}`)}
          />
        ),
    },
    {
      field: 'rate_date',
      headerName: tAccounting('exchangeRates.rateDate'),
      width: 140,
      valueGetter: (_v, row) => row.rate_date ?? '',
      renderCell: (params: GridRenderCellParams<ResolvedRate>) => {
        const date = params.row.rate_date;
        if (!date) return null;
        const stale = asOf !== null && date !== asOf;
        return stale ? (
          <Tooltip title={tAccounting('exchangeRates.staleHint')}>
            <Chip size="small" variant="outlined" label={date} />
          </Tooltip>
        ) : date;
      },
    },
    {
      field: 'path',
      headerName: tAccounting('exchangeRates.via'),
      flex: 1.5,
      sortable: false,
      valueGetter: (_v, row) =>
        row.path
          .map((r) => `${abr(r.currency_id)}→${abr(r.quote_currency_id ?? mainCurrencyId)} ${formatRate(r.rate)} (${tAccounting(`exchangeRates.providers.${r.source}`)})`)
          .join(' × '),
    },
  ];

  const historyColumns: GridColDef<ExchangeRate>[] = [
    { field: 'date', headerName: tAccounting('exchangeRates.date'), width: 130 },
    {
      field: 'currency_id',
      headerName: tAccounting('exchangeRates.currency'),
      width: 120,
      valueGetter: (_v, row) => abr(row.currency_id),
    },
    {
      field: 'quote_currency_id',
      headerName: tAccounting('exchangeRates.quoteCurrency'),
      width: 140,
      valueGetter: (_v, row) => abr(row.quote_currency_id ?? mainCurrencyId),
    },
    {
      field: 'rate',
      headerName: tAccounting('exchangeRates.rate'),
      flex: 1,
      type: 'number',
      valueGetter: (_v, row) => formatRate(row.rate),
      renderCell: (params: GridRenderCellParams<ExchangeRate>) => (
        <RateWithInverse rate={params.row.rate} currency={abr(params.row.currency_id)}
          quote={abr(params.row.quote_currency_id ?? mainCurrencyId)} />
      ),
    },
    {
      field: 'source',
      headerName: tAccounting('exchangeRates.provider'),
      width: 150,
      valueGetter: (_v, row) => tAccounting(`exchangeRates.providers.${row.source}`),
    },
    {
      field: 'actions',
      headerName: t('actions'),
      width: 110,
      sortable: false,
      renderCell: (params: GridRenderCellParams<ExchangeRate>) =>
        canManage ? (
          <Box>
            <Tooltip title={params.row.source === 'manual' ? t('commonActions.edit') : tAccounting('exchangeRates.providerRateReadOnly')}>
              <span>
                <IconButton
                  size="small"
                  disabled={params.row.source !== 'manual'}
                  onClick={() => {
                    setEditing(params.row);
                    setModalOpen(true);
                  }}
                  aria-label={t('commonActions.edit')}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton size="small" color="error" onClick={() => handleDelete(params.row)} aria-label={t('commonActions.delete')}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : null,
    },
  ];

  if (loadingCurrencies) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth={false} sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 2 }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Box>
          <Typography variant="h4" gutterBottom>{tAccounting('exchangeRates.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {tAccounting('exchangeRates.description', { currency: mainAbr })}
          </Typography>
        </Box>
        {canManage && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={fetching ? <CircularProgress size={16} color="inherit" /> : <CloudDownloadOutlinedIcon />}
              onClick={() => runFetch()}
              disabled={fetching}
            >
              {tAccounting('exchangeRates.fetchNow')}
            </Button>
            <Button variant="outlined" onClick={() => setBackfillOpen(true)} disabled={fetching}>
              {tAccounting('exchangeRates.backfill')}
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              {tAccounting('exchangeRates.addRate')}
            </Button>
          </Box>
        )}
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, flexShrink: 0 }}>
        <Tab label={tAccounting('exchangeRates.ratesOnDate')} />
        <Tab label={tAccounting('exchangeRates.history')} />
        <Tab label={tAccounting('exchangeRates.sources')} />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, p: 2, gap: 2 }}>
          <Box sx={{ maxWidth: 260 }}>
            <BaseDatePicker label={tAccounting('exchangeRates.asOf')} value={asOf} onChange={setAsOf} size="small" fullWidth />
          </Box>
          {resolveError ? (
            <Alert severity="error">{tAccounting('exchangeRates.loadFailed')}</Alert>
          ) : (
            <ExtendedDataGrid
              rows={resolved?.rates ?? []}
              getRowId={(row) => row.currency_id}
              columns={resolvedColumns}
              loading={resolving}
              showHeaderSearchRow
              excludeSearchFields={[]}
              hideFooter
              disableColumnMenu
              disableRowSelectionOnClick
              showCellVerticalBorder
              rowHeight={40}
              localeText={{ noRowsLabel: tAccounting('exchangeRates.noForeignCurrencies') }}
              sx={{ flex: 1, '& .MuiDataGrid-cell:focus': { outline: 'none' } }}
            />
          )}
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, p: 2, gap: 2 }}>
          <TextField
            select
            size="small"
            label={tAccounting('exchangeRates.currency')}
            value={historyCurrencyId}
            onChange={(e) => setHistoryCurrencyId(e.target.value === '' ? '' : Number(e.target.value))}
            sx={{ maxWidth: 260 }}
          >
            <MenuItem value="">{tAccounting('exchangeRates.allCurrencies')}</MenuItem>
            {currencies.filter((c) => c.id !== mainCurrencyId).map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.abr} - {c.name}</MenuItem>
            ))}
          </TextField>
          <ExtendedDataGrid
            rows={history}
            columns={historyColumns}
            loading={loadingHistory}
            showHeaderSearchRow
            excludeSearchFields={['actions']}
            disableColumnMenu
            disableRowSelectionOnClick
            showCellVerticalBorder
            rowHeight={40}
            initialState={{ sorting: { sortModel: [{ field: 'date', sort: 'desc' }] } }}
            localeText={{ noRowsLabel: tAccounting('exchangeRates.noRates') }}
            sx={{ flex: 1, '& .MuiDataGrid-cell:focus': { outline: 'none' } }}
          />
        </Paper>
      )}

      {tab === 2 && (
        <Paper sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', p: 2, gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {tAccounting('exchangeRates.sourcesDescription')}
          </Typography>
          <ExchangeRateSourcesTable
            organizationId={orgId}
            currencies={currencies}
            mainCurrencyId={mainCurrencyId}
            sources={sources}
            canManage={canManage}
          />
        </Paper>
      )}

      <BackfillRatesDialog
        open={backfillOpen}
        onClose={() => setBackfillOpen(false)}
        onSubmit={(from, to) => runFetch(from, to)}
        isLoading={fetching}
      />

      <ExchangeRateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        organizationId={orgId}
        currencies={currencies}
        mainCurrencyId={mainCurrencyId}
        exchangeRate={editing}
        defaultDate={asOf}
      />
    </Container>
  );
};
