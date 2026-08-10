import { useState, useEffect } from 'react';
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
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { useCreateCurrencyMutation, useUpdateCurrencyMutation, type AccountingCurrency } from '../currenciesApi';
import { useTranslatableLocales } from '../../../../hooks/useTranslatableLocales';
import { useToast } from '../../../../contexts/ToastContext';
import MultiLocaleInput from '../../../../components/shared/MultiLocaleInput';
import {
  buildLocaleMap,
  emptyLocaleMap,
  flattenTranslations,
  type LocaleMap,
} from '../../../../utils/translationHelper';

interface CurrencyModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  currency?: AccountingCurrency | null;
}

export const CurrencyModal = ({ open, onClose, organizationId, currency }: CurrencyModalProps) => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { showSuccess, showError } = useToast();

  const { allLocales, isReady } = useTranslatableLocales({ organizationId });

  const [createCurrency, { isLoading: isCreating }] = useCreateCurrencyMutation();
  const [updateCurrency, { isLoading: isUpdating }] = useUpdateCurrencyMutation();

  const isLoading = isCreating || isUpdating;
  const isEditMode = !!currency;

  const [formData, setFormData] = useState<{
    name: LocaleMap;
    abr: string;
    decimal_digits: number;
  }>({
    name: {},
    abr: '',
    decimal_digits: 2,
  });

  useEffect(() => {
    if (open && isReady) {
      if (currency) {
        setFormData({
          name: buildLocaleMap(currency.t?.name, allLocales),
          abr: currency.abr,
          decimal_digits: currency.decimal_digits,
        });
      } else {
        setFormData({
          name: emptyLocaleMap(allLocales),
          abr: '',
          decimal_digits: 2,
        });
      }
    }
  }, [open, currency, isReady, allLocales.join(',')]);

  const handleNameChange = (val: LocaleMap) => {
    setFormData((prev) => ({ ...prev, name: val }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'decimal_digits' ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleSave = async () => {
    const payload = {
      ...flattenTranslations({ name: formData.name }, ['name']),
      abr: formData.abr,
      decimal_digits: formData.decimal_digits,
    };

    try {
      if (isEditMode) {
        await updateCurrency({ organizationId, id: currency!.id, data: payload }).unwrap();
        showSuccess(tAccounting('currencyUpdated'));
      } else {
        await createCurrency({ organizationId, data: payload }).unwrap();
        showSuccess(tAccounting('currencyCreated'));
      }
      onClose();
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tAccounting('currencySaveFailed'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">
          {isEditMode ? tAccounting('editCurrency') : tAccounting('addCustomCurrency')}
        </Typography>
        <IconButton size="small" onClick={onClose} disabled={isLoading}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          <MultiLocaleInput
            field={t('name')}
            value={formData.name}
            onChange={handleNameChange}
            required
          />
          <TextField
            label={tAccounting('abbreviation')}
            name="abr"
            value={formData.abr}
            onChange={handleChange}
            fullWidth
            size="small"
            required
            inputProps={{ maxLength: 5 }}
          />
          <TextField
            label={tAccounting('decimalDigits')}
            name="decimal_digits"
            type="number"
            value={formData.decimal_digits}
            onChange={handleChange}
            fullWidth
            size="small"
            inputProps={{ min: 0, max: 4 }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} disabled={isLoading}>
          {t('commonActions.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isLoading || !formData.abr.trim()}
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {isEditMode ? t('commonActions.update') : t('commonActions.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};