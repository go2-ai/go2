import { useMemo } from 'react';
import {
  Box,
  TextField,
  MenuItem,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';
import { ExtendedDataGrid } from '../../../../components/shared/ExtendedDataGrid';
import { useToast } from '../../../../contexts/ToastContext';
import { apiErrorMessage } from '../../../../utils/apiErrorMessage';
import type { AccountingCurrency } from '../../currencies/currenciesApi';
import {
  ECB_CURRENCIES,
  useCreateExchangeRateSourceMutation,
  useUpdateExchangeRateSourceMutation,
  type ExchangeRateProvider,
  type ExchangeRateSource,
  type ExchangeRateSourcePayload,
} from '../exchangeRatesApi';

const PROVIDERS: ExchangeRateProvider[] = ['manual', 'ecb'];

interface Props {
  organizationId: number;
  currencies: AccountingCurrency[];
  mainCurrencyId: number | null;
  sources: ExchangeRateSource[];
  canManage: boolean;
}

/** Where each foreign currency's rates come from. Changes are saved immediately. */
export const ExchangeRateSourcesTable = ({ organizationId, currencies, mainCurrencyId, sources, canManage }: Props) => {
  const { t: tAccounting } = useTranslation('accounting');
  const { showError } = useToast();
  const [createSource] = useCreateExchangeRateSourceMutation();
  const [updateSource] = useUpdateExchangeRateSourceMutation();

  const sourceByCurrency = useMemo(
    () => new Map(sources.map((s) => [s.currency_id, s])),
    [sources]
  );
  const foreignCurrencies = currencies.filter((c) => c.id !== mainCurrencyId);
  const abrOf = (id: number | '') => currencies.find((c) => c.id === id)?.abr?.toUpperCase() ?? '';

  // Codes of the currency or its quote currency that the ECB doesn't publish.
  const unpublished = (currency: AccountingCurrency, quoteId: number | '') =>
    [currency.abr.toUpperCase(), abrOf(quoteId)].filter((code) => code && !ECB_CURRENCIES.has(code));

  const save = async (currency: AccountingCurrency, changes: ExchangeRateSourcePayload) => {
    const existing = sourceByCurrency.get(currency.id);
    try {
      if (existing) {
        await updateSource({ organizationId, id: existing.id, data: changes }).unwrap();
      } else {
        await createSource({
          organizationId,
          data: { currency_id: currency.id, provider: 'manual', active: true, ...changes },
        }).unwrap();
      }
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('exchangeRates.saveFailed'));
    }
  };

  // One row per foreign currency, with its source (manual when none is stored).
  const rows = foreignCurrencies.map((currency) => {
    const source = sourceByCurrency.get(currency.id);
    return {
      id: currency.id,
      currency,
      provider: (source?.provider ?? 'manual') as ExchangeRateProvider,
      quoteId: (source?.quote_currency_id ?? mainCurrencyId ?? '') as number | '',
      active: source?.active ?? true,
    };
  });
  type Row = (typeof rows)[number];
  const stop = { onClick: (e: React.MouseEvent) => e.stopPropagation(), onDoubleClick: (e: React.MouseEvent) => e.stopPropagation() };

  const columns: GridColDef<Row>[] = [
    {
      field: 'currency',
      headerName: tAccounting('exchangeRates.currency'),
      flex: 1,
      minWidth: 180,
      valueGetter: (_v, row) => `${row.currency.abr} - ${row.currency.name}`,
    },
    {
      field: 'provider',
      headerName: tAccounting('exchangeRates.provider'),
      width: 240,
      valueGetter: (_v, row) => tAccounting(`exchangeRates.providers.${row.provider}`),
      renderCell: (params: GridRenderCellParams<Row>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
          <TextField
            select
            size="small"
            variant="standard"
            fullWidth
            value={params.row.provider}
            disabled={!canManage}
            onChange={(e) => save(params.row.currency, { provider: e.target.value as ExchangeRateProvider })}
            inputProps={{ 'aria-label': `${tAccounting('exchangeRates.provider')} ${params.row.currency.abr}` }}
            {...stop}
          >
            {PROVIDERS.map((p) => (
              <MenuItem key={p} value={p}>{tAccounting(`exchangeRates.providers.${p}`)}</MenuItem>
            ))}
          </TextField>
          {params.row.provider === 'ecb' && unpublished(params.row.currency, params.row.quoteId).length > 0 && (
            <Tooltip title={tAccounting('exchangeRates.notPublishedByEcb', {
              codes: unpublished(params.row.currency, params.row.quoteId).join(', '),
            })}>
              <WarningAmberIcon color="warning" fontSize="small" />
            </Tooltip>
          )}
        </Box>
      ),
    },
    {
      field: 'quoteId',
      headerName: tAccounting('exchangeRates.quoteCurrency'),
      width: 170,
      valueGetter: (_v, row) => abrOf(row.quoteId),
      renderCell: (params: GridRenderCellParams<Row>) => (
        <TextField
          select
          size="small"
          variant="standard"
          fullWidth
          value={params.row.quoteId}
          disabled={!canManage || params.row.provider === 'manual'}
          onChange={(e) => {
            const id = Number(e.target.value);
            save(params.row.currency, { quote_currency_id: id === mainCurrencyId ? null : id });
          }}
          inputProps={{ 'aria-label': `${tAccounting('exchangeRates.quoteCurrency')} ${params.row.currency.abr}` }}
          {...stop}
        >
          {currencies.filter((c) => c.id !== params.row.currency.id).map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.abr}</MenuItem>
          ))}
        </TextField>
      ),
    },
    {
      field: 'active',
      headerName: tAccounting('exchangeRates.active'),
      width: 120,
      valueGetter: (_v, row) => tAccounting(row.active ? 'exchangeRates.activeYes' : 'exchangeRates.activeNo'),
      renderCell: (params: GridRenderCellParams<Row>) => (
        <Switch
          size="small"
          checked={params.row.active}
          disabled={!canManage}
          onChange={(e) => save(params.row.currency, { active: e.target.checked })}
          inputProps={{ 'aria-label': `${tAccounting('exchangeRates.active')} ${params.row.currency.abr}` }}
          {...stop}
        />
      ),
    },
  ];

  if (foreignCurrencies.length === 0) {
    return <Typography color="text.secondary" sx={{ p: 2 }}>{tAccounting('exchangeRates.noForeignCurrencies')}</Typography>;
  }

  return (
    <ExtendedDataGrid
      rows={rows}
      columns={columns}
      showHeaderSearchRow
      excludeSearchFields={[]}
      hideFooter
      disableColumnMenu
      disableRowSelectionOnClick
      showCellVerticalBorder
      rowHeight={44}
      sx={{ flex: 1, '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' } }}
    />
  );
};
