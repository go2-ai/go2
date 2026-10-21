import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  CircularProgress,
  IconButton,
  MenuItem,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { BaseDatePicker } from '../../../../components/shared/BaseDatePicker';
import { useToast } from '../../../../contexts/ToastContext';
import { apiErrorMessage } from '../../../../utils/apiErrorMessage';
import type { AccountingCurrency } from '../../currencies/currenciesApi';
import {
  useCreateExchangeRateMutation,
  useUpdateExchangeRateMutation,
  type ExchangeRate,
} from '../exchangeRatesApi';

interface ExchangeRateModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  currencies: AccountingCurrency[];
  mainCurrencyId: number | null;
  /** Edit this (manual) rate; create a new one when null. */
  exchangeRate?: ExchangeRate | null;
  defaultDate?: string | null;
  /** Currency preselected for a new rate. */
  defaultCurrencyId?: number | null;
  /** Called after the rate was saved (before onClose). */
  onSaved?: (rate: ExchangeRate) => void;
}

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

export const ExchangeRateModal = ({
  open,
  onClose,
  organizationId,
  currencies,
  mainCurrencyId,
  exchangeRate,
  defaultDate,
  defaultCurrencyId,
  onSaved,
}: ExchangeRateModalProps) => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { showSuccess, showError } = useToast();
  const [createRate, { isLoading: isCreating }] = useCreateExchangeRateMutation();
  const [updateRate, { isLoading: isUpdating }] = useUpdateExchangeRateMutation();
  const isLoading = isCreating || isUpdating;
  const isEditMode = !!exchangeRate;

  const [currencyId, setCurrencyId] = useState<number | ''>('');
  const [quoteCurrencyId, setQuoteCurrencyId] = useState<number | ''>('');
  const [date, setDate] = useState<string | null>(null);
  const [rate, setRate] = useState('');

  useEffect(() => {
    if (!open) return;
    setCurrencyId(exchangeRate?.currency_id ?? defaultCurrencyId ?? '');
    setQuoteCurrencyId(exchangeRate?.quote_currency_id ?? mainCurrencyId ?? '');
    setDate(exchangeRate?.date ?? defaultDate ?? null);
    setRate(exchangeRate?.rate ?? '');
  }, [open, exchangeRate, mainCurrencyId, defaultDate, defaultCurrencyId]);

  const foreignCurrencies = useMemo(
    () => currencies.filter((c) => c.id !== mainCurrencyId),
    [currencies, mainCurrencyId]
  );
  const quoteOptions = useMemo(
    () => currencies.filter((c) => c.id !== currencyId),
    [currencies, currencyId]
  );

  const rateError = rate !== '' && (!DECIMAL_PATTERN.test(rate) || Number(rate) <= 0);
  const canSave = currencyId !== '' && quoteCurrencyId !== '' && !!date && rate !== '' && !rateError;

  const handleSave = async () => {
    if (!canSave) return;
    const data = {
      currency_id: Number(currencyId),
      // The main currency is stored as "no quote currency".
      quote_currency_id: quoteCurrencyId === mainCurrencyId ? null : Number(quoteCurrencyId),
      date: date!,
      rate,
    };
    try {
      const saved = isEditMode
        ? await updateRate({ organizationId, id: exchangeRate!.id, data }).unwrap()
        : await createRate({ organizationId, data }).unwrap();
      showSuccess(tAccounting('exchangeRates.saved'));
      onSaved?.(saved);
      onClose();
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('exchangeRates.saveFailed'));
    }
  };

  const currencyLabel = (c: AccountingCurrency) => `${c.abr} - ${c.name}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="span">
          {isEditMode ? tAccounting('exchangeRates.editRate') : tAccounting('exchangeRates.addRate')}
        </Typography>
        <IconButton size="small" onClick={onClose} disabled={isLoading} aria-label={t('commonActions.cancel')}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          <TextField
            select
            label={tAccounting('exchangeRates.currency')}
            value={currencyId}
            onChange={(e) => setCurrencyId(Number(e.target.value))}
            disabled={isEditMode}
            size="small"
            required
            fullWidth
          >
            {foreignCurrencies.map((c) => (
              <MenuItem key={c.id} value={c.id}>{currencyLabel(c)}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label={tAccounting('exchangeRates.quoteCurrency')}
            value={quoteCurrencyId}
            onChange={(e) => setQuoteCurrencyId(Number(e.target.value))}
            helperText={tAccounting('exchangeRates.quoteCurrencyHint')}
            size="small"
            required
            fullWidth
          >
            {quoteOptions.map((c) => (
              <MenuItem key={c.id} value={c.id}>{currencyLabel(c)}</MenuItem>
            ))}
          </TextField>

          <BaseDatePicker
            label={tAccounting('exchangeRates.date')}
            value={date}
            onChange={setDate}
            required
            fullWidth
            size="small"
          />

          <TextField
            label={tAccounting('exchangeRates.rate')}
            value={rate}
            onChange={(e) => setRate(e.target.value.trim())}
            error={rateError}
            helperText={rateError ? tAccounting('exchangeRates.rateInvalid') : tAccounting('exchangeRates.rateHint')}
            inputProps={{ inputMode: 'decimal' }}
            size="small"
            required
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} disabled={isLoading}>
          {t('commonActions.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!canSave || isLoading}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {t('commonActions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
