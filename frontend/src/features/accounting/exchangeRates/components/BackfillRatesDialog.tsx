import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { BaseDatePicker } from '../../../../components/shared/BaseDatePicker';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (from: string, to: string) => Promise<void>;
  isLoading: boolean;
}

/** Fetch provider rates for a past date range. */
export const BackfillRatesDialog = ({ open, onClose, onSubmit, isLoading }: Props) => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFrom(null);
      setTo(null);
    }
  }, [open]);

  const rangeInvalid = !!from && !!to && from > to;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{tAccounting('exchangeRates.backfill')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {tAccounting('exchangeRates.backfillHint')}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <BaseDatePicker label={tAccounting('exchangeRates.from')} value={from} onChange={setFrom} required fullWidth size="small" />
          <BaseDatePicker
            label={tAccounting('exchangeRates.to')}
            value={to}
            onChange={setTo}
            required
            fullWidth
            size="small"
            error={rangeInvalid}
            helperText={rangeInvalid ? tAccounting('exchangeRates.rangeInvalid') : undefined}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} disabled={isLoading}>{t('commonActions.cancel')}</Button>
        <Button
          variant="contained"
          disabled={!from || !to || rangeInvalid || isLoading}
          onClick={() => from && to && onSubmit(from, to)}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {tAccounting('exchangeRates.fetch')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
