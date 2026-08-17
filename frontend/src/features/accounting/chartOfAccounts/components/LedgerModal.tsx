import { useState, useEffect, useMemo } from 'react';
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
  Autocomplete,
  MenuItem,
  FormControlLabel,
  Switch,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import {
  useCreateLedgerMutation,
  useUpdateLedgerMutation,
  type Ledger,
} from '../../ledgers/ledgersApi';
import { useGetAccountCategoriesQuery } from '../../accountCategories/accountCategoriesApi';
import { useGetAccountingSettingsQuery } from '../../settings/settingsApi';
import { useGetLedgersQuery } from '../../ledgers/ledgersApi';
import { useTranslatableLocales } from '../../../../hooks/useTranslatableLocales';
import { useToast } from '../../../../contexts/ToastContext';
import MultiLocaleInput from '../../../../components/shared/MultiLocaleInput';
import { SegmentedCodeInput } from '../../../../components/shared/SegmentedCodeInput';
import {
  buildLocaleMap,
  emptyLocaleMap,
  flattenTranslations,
  type LocaleMap,
} from '../../../../utils/translationHelper';

interface LedgerModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  ledger?: Ledger | null;
  parentCategoryId?: number;
  parentCategoryCode?: string;
}

export const LedgerModal = ({
  open,
  onClose,
  organizationId,
  ledger,
  parentCategoryId,
  parentCategoryCode,
}: LedgerModalProps) => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { showSuccess, showError } = useToast();

  const { allLocales, isReady } = useTranslatableLocales({ organizationId });

  const { data: settings } = useGetAccountingSettingsQuery(organizationId, {
    skip: !organizationId,
  });
  const { data: categories } = useGetAccountCategoriesQuery(organizationId, {
    skip: !organizationId,
  });
  const { data: ledgers } = useGetLedgersQuery(organizationId, {
    skip: !organizationId,
  });

  const accountCategoryLength = settings?.account_category_length ?? 1;
  const ledgerLength = settings?.ledger_length ?? 2;
  const totalSegments = accountCategoryLength + ledgerLength;

  const [createLedger, { isLoading: isCreating }] = useCreateLedgerMutation();
  const [updateLedger, { isLoading: isUpdating }] = useUpdateLedgerMutation();

  const isLoading = isCreating || isUpdating;
  const isEditMode = !!ledger;

  const [formData, setFormData] = useState({
    name: {} as LocaleMap,
    account_category_id: null as number | null,
    codeSuffix: '',
    contra_for_id: null as number | null,
    unexpected_balance: 'accept' as 'accept' | 'warn' | 'disallow',
    is_monetary: false,
  });

  const [showContraField, setShowContraField] = useState(false);

  const [errors, setErrors] = useState<{
    name?: string;
    account_category_id?: string;
    codeSuffix?: string;
  }>({});

  useEffect(() => {
    if (!open || !isReady) return;

    if (ledger) {
      setFormData({
        name: buildLocaleMap(ledger.t?.name, allLocales),
        account_category_id: ledger.account_category_id,
        codeSuffix: ledger.code,
        contra_for_id: ledger.contra_for_id,
        unexpected_balance: ledger.unexpected_balance,
        is_monetary: ledger.is_monetary,
      });
      setShowContraField(ledger.contra_for_id !== null);
    } else {
      setFormData({
        name: emptyLocaleMap(allLocales),
        account_category_id: parentCategoryId ?? null,
        codeSuffix: '',
        contra_for_id: null,
        unexpected_balance: 'accept',
        is_monetary: false,
      });
      setShowContraField(false);
    }
    setErrors({});
  }, [open, ledger, isReady, allLocales.join(','), parentCategoryId, accountCategoryLength]);

  const selectedCategory = useMemo(
    () => categories?.find((c) => c.id === formData.account_category_id) ?? null,
    [categories, formData.account_category_id]
  );

  const fullCodeForDisplay = useMemo(() => {
    const prefix = parentCategoryCode ?? selectedCategory?.code ?? '';
    return `${prefix}${formData.codeSuffix}`;
  }, [parentCategoryCode, selectedCategory, formData.codeSuffix]);

  const isBalanceSheetCategory = useMemo(() => {
    if (!selectedCategory) return false;
    if (selectedCategory.type === 'balance_sheet') return true;
    // Also check by identifier for system categories
    return ['CA', 'LA', 'CL', 'LL', 'OE'].includes(selectedCategory.identifier ?? '');
  }, [selectedCategory]);


  const contraOptions = useMemo(() => {
    if (!formData.account_category_id || !ledgers) return [];
    const sameCategory = ledgers.filter(
      (l) => l.account_category_id === formData.account_category_id
    );
    const available = sameCategory.filter(
      (l) => l.contra_for_id === null && l.id !== ledger?.id
    );
    if (ledger?.contra_for_id) {
      const current = sameCategory.find((l) => l.id === ledger.contra_for_id);
      if (current && !available.some((a) => a.id === current.id)) {
        available.push(current);
      }
    }
    return available;
  }, [formData.account_category_id, ledgers, ledger]);

  const handleNameChange = (val: LocaleMap) => {
    setFormData((prev) => ({ ...prev, name: val }));
    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const handleSuffixChange = (suffix: string) => {
    setFormData((prev) => ({ ...prev, codeSuffix: suffix }));
    if (errors.codeSuffix) setErrors((prev) => ({ ...prev, codeSuffix: undefined }));
  };

  const validate = (): boolean => {
    const next: { name?: string; account_category_id?: string; codeSuffix?: string } = {};

    if (!Object.values(formData.name).some((v) => v.trim())) {
      next.name = t('validations.required');
    }

    if (!formData.account_category_id) {
      next.account_category_id = t('validations.required');
    }

    if (formData.codeSuffix.length !== ledgerLength) {
      next.codeSuffix = tAccounting('invalidLedgerCodeLength', { length: ledgerLength });
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const payload: Record<string, any> = {
      ...flattenTranslations({ name: formData.name }, ['name']),
      account_category_id: formData.account_category_id,
      code: formData.codeSuffix,
      contra_for_id: formData.contra_for_id,
      unexpected_balance: formData.unexpected_balance,
    };

    if (isBalanceSheetCategory) {
      payload.is_monetary = formData.is_monetary;
    }

    try {
      if (isEditMode) {
        await updateLedger({
          organizationId,
          id: ledger!.id,
          data: payload,
        }).unwrap();
        showSuccess(tAccounting('ledgerUpdated'));
      } else {
        await createLedger({
          organizationId,
          data: payload,
        }).unwrap();
        showSuccess(tAccounting('ledgerCreated'));
      }
      onClose();
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tAccounting('ledgerSaveFailed'));
    }
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
          {isEditMode ? tAccounting('editLedger') : tAccounting('addLedger')}
        </Typography>
        <IconButton size="small" onClick={onClose} disabled={isLoading}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          <Autocomplete
            options={categories || []}
            getOptionLabel={(option) => option.name}
            value={selectedCategory}
            onChange={(_, newValue) => {
              setFormData((prev) => ({
                ...prev,
                account_category_id: newValue?.id ?? null,
                contra_for_id: null,
              }));
              if (errors.account_category_id) {
                setErrors((prev) => ({ ...prev, account_category_id: undefined }));
              }
            }}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            disabled={isEditMode || !!parentCategoryId}
            renderInput={(params) => (
              <TextField
                {...params}
                label={tAccounting('accountCategory')}
                size="small"
                required
                error={!!errors.account_category_id}
                helperText={errors.account_category_id}
              />
            )}
            fullWidth
          />

          <SegmentedCodeInput
            label={tAccounting('code')}
            segments={totalSegments}
            disabledPrefixSegments={accountCategoryLength}
            value={fullCodeForDisplay}
            onChange={handleSuffixChange}
            error={!!errors.codeSuffix}
            helperText={errors.codeSuffix}
          />

          <MultiLocaleInput
            field={t('name')}
            value={formData.name}
            onChange={handleNameChange}
            required
            error={!!errors.name}
            helperText={errors.name}
          />

          <TextField
            select
            label={tAccounting('unexpectedBalance')}
            value={formData.unexpected_balance}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                unexpected_balance: e.target.value as 'accept' | 'warn' | 'disallow',
              }))
            }
            fullWidth
            size="small"
          >
            <MenuItem value="accept">{tAccounting('accept')}</MenuItem>
            <MenuItem value="warn">{tAccounting('warn')}</MenuItem>
            <MenuItem value="disallow">{tAccounting('disallow')}</MenuItem>
          </TextField>

          {isBalanceSheetCategory && (
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_monetary}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, is_monetary: e.target.checked }))
                  }
                />
              }
              label={tAccounting('isMonetary')}
            />
          )}

          <FormControlLabel
            control={
              <Switch
                checked={showContraField}
                onChange={(e) => {
                  setShowContraField(e.target.checked);
                  if (!e.target.checked) {
                    setFormData((prev) => ({ ...prev, contra_for_id: null }));
                  }
                }}
              />
            }
            label={tAccounting('setContraLedger')}
          />

          {showContraField && (
            <Autocomplete
              options={contraOptions}
              getOptionLabel={(option) => {
                const category = categories?.find((c) => c.id === option.account_category_id);
                return `${category?.code ?? ''}${option.code} — ${option.name}`;
              }}
              value={contraOptions.find((l) => l.id === formData.contra_for_id) ?? null}
              onChange={(_, newValue) => {
                setFormData((prev) => ({
                  ...prev,
                  contra_for_id: newValue?.id ?? null,
                }));
              }}
              isOptionEqualToValue={(option, value) => option.id === value?.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={tAccounting('contraLedger')}
                  size="small"
                />
              )}
              fullWidth
            />
          )}
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