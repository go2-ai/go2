import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  CircularProgress,
  IconButton,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import {
  useCreateFiscalYearMutation,
  useUpdateFiscalYearMutation,
  type FiscalYear,
} from '../fiscalYearsApi';
import { useTranslatableLocales } from '../../../hooks/useTranslatableLocales';
import { useToast } from '../../../contexts/ToastContext';
import MultiLocaleInput from '../../../components/shared/MultiLocaleInput';
import { BaseDatePicker } from '../../../components/shared/BaseDatePicker';
import {
  buildLocaleMap,
  emptyLocaleMap,
  flattenTranslations,
  type LocaleMap,
} from '../../../utils/translationHelper';

interface FiscalYearModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  fiscalYear?: FiscalYear | null;
  nextStartDate?: string | null;
}

export const FiscalYearModal = ({
  open,
  onClose,
  organizationId,
  fiscalYear,
  nextStartDate,
}: FiscalYearModalProps) => {
  const { t } = useTranslation('shared');
  const { t: tFiscalYears } = useTranslation('fiscalYears');
  const { showSuccess, showError } = useToast();

  const { allLocales, isReady } = useTranslatableLocales({ organizationId });

  const [createFiscalYear, { isLoading: isCreating }] = useCreateFiscalYearMutation();
  const [updateFiscalYear, { isLoading: isUpdating }] = useUpdateFiscalYearMutation();

  const isLoading = isCreating || isUpdating;
  const isEditMode = !!fiscalYear;
  const isStartDateLocked = !isEditMode && !!nextStartDate;

  const [formData, setFormData] = useState({
    name: {} as LocaleMap,
    start_date: null as string | null,
    finish_date: null as string | null,
  });

  const [errors, setErrors] = useState<{
    name?: string;
    start_date?: string;
    finish_date?: string;
  }>({});

  useEffect(() => {
    if (!open || !isReady) return;

    if (fiscalYear) {
      setFormData({
        name: buildLocaleMap(fiscalYear.t?.name, allLocales),
        start_date: fiscalYear.start_date,
        finish_date: fiscalYear.finish_date,
      });
    } else {
      setFormData({
        name: emptyLocaleMap(allLocales),
        start_date: nextStartDate ?? null,
        finish_date: nextStartDate ? addYearsMinusOneDay(nextStartDate) : null,
      });
    }
    setErrors({});
  }, [open, fiscalYear, isReady, allLocales.join(','), nextStartDate]);

  const handleNameChange = (val: LocaleMap) => {
    setFormData((prev) => ({ ...prev, name: val }));
    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const handleStartDateChange = (val: string | null) => {
    setFormData((prev) => ({ ...prev, start_date: val }));
    if (errors.start_date) setErrors((prev) => ({ ...prev, start_date: undefined }));
  };

  const handleFinishDateChange = (val: string | null) => {
    setFormData((prev) => ({ ...prev, finish_date: val }));
    if (errors.finish_date) setErrors((prev) => ({ ...prev, finish_date: undefined }));
  };

  const validate = (): boolean => {
    const next: { name?: string; start_date?: string; finish_date?: string } = {};

    if (!Object.values(formData.name).some((v) => v.trim())) {
      next.name = t('validations.required');
    }

    if (!formData.start_date) {
      next.start_date = t('validations.required');
    }

    if (!formData.finish_date) {
      next.finish_date = t('validations.required');
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const payload = {
      ...flattenTranslations({ name: formData.name }, ['name']),
      start_date: formData.start_date,
      finish_date: formData.finish_date,
    };

    try {
      if (isEditMode) {
        await updateFiscalYear({
          organizationId,
          id: fiscalYear!.id,
          data: payload,
        }).unwrap();
        showSuccess(tFiscalYears('updateSuccess'));
      } else {
        await createFiscalYear({
          organizationId,
          data: payload,
        }).unwrap();
        showSuccess(tFiscalYears('createSuccess'));
      }
      onClose();
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tFiscalYears('saveFailed'));
    }
  };

  const addYearsMinusOneDay = (iso: string): string => {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setFullYear(date.getFullYear() + 1);
    date.setDate(date.getDate() - 1);

    const ny = date.getFullYear();
    const nm = String(date.getMonth() + 1).padStart(2, '0');
    const nd = String(date.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6">
          {isEditMode ? tFiscalYears('editFiscalYear') : tFiscalYears('addFiscalYear')}
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
            error={!!errors.name}
            helperText={errors.name}
          />

          <BaseDatePicker
            label={tFiscalYears('startDate')}
            value={formData.start_date}
            onChange={handleStartDateChange}
            error={!!errors.start_date}
            helperText={errors.start_date}
            required
            disabled={isStartDateLocked}
          />

          <BaseDatePicker
            label={tFiscalYears('finishDate')}
            value={formData.finish_date}
            onChange={handleFinishDateChange}
            error={!!errors.finish_date}
            helperText={errors.finish_date}
            identifier="fiscal-year-start-date"
            required
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
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {isEditMode ? t('commonActions.update') : t('commonActions.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};