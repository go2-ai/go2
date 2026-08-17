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
  FormControlLabel,
  Switch,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import {
  useCreateAccountMutation,
  useUpdateAccountMutation,
  type Account,
} from '../../accounts/accountsApi';
import { useGetLedgersQuery } from '../../ledgers/ledgersApi';
import { useGetAccountCategoriesQuery } from '../../accountCategories/accountCategoriesApi';
import { useGetAccountingSettingsQuery } from '../../settings/settingsApi';
import { useGetCenterTypesQuery } from '../../centerTypes/centerTypesApi';
import { useGetAccountsQuery } from '../../accounts/accountsApi';
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

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  account?: Account | null;
  parentLedgerId?: number;
  parentLedgerFullCode?: string;
}

export const AccountModal = ({
  open,
  onClose,
  organizationId,
  account,
  parentLedgerId,
  parentLedgerFullCode,
}: AccountModalProps) => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { showSuccess, showError } = useToast();

  const { allLocales, isReady } = useTranslatableLocales({ organizationId });

  const { data: settings } = useGetAccountingSettingsQuery(organizationId, {
    skip: !organizationId,
  });
  const { data: ledgers } = useGetLedgersQuery(organizationId, {
    skip: !organizationId,
  });
  const { data: categories } = useGetAccountCategoriesQuery(organizationId, {
    skip: !organizationId,
  });
  const { data: centerTypes } = useGetCenterTypesQuery(organizationId, {
    skip: !organizationId,
  });
  const { data: accounts } = useGetAccountsQuery(organizationId, {
    skip: !organizationId,
  });

  const accountCategoryLength = settings?.account_category_length ?? 1;
  const ledgerLength = settings?.ledger_length ?? 2;
  const accountLength = settings?.account_length ?? 2;
  const centerLevels = settings?.center_levels ?? 3;
  const prefixSegments = accountCategoryLength + ledgerLength;
  const totalSegments = prefixSegments + accountLength;

  const [createAccount, { isLoading: isCreating }] = useCreateAccountMutation();
  const [updateAccount, { isLoading: isUpdating }] = useUpdateAccountMutation();

  const isLoading = isCreating || isUpdating;
  const isEditMode = !!account;

  const [formData, setFormData] = useState({
    name: {} as LocaleMap,
    ledger_id: null as number | null,
    codeSuffix: '',
    contra_for_id: null as number | null,
    accepts_other_currencies: false,
    allowed_center_types: [] as number[][],
  });

  const [showContraField, setShowContraField] = useState(false);

  const [errors, setErrors] = useState<{
    name?: string;
    ledger_id?: string;
    codeSuffix?: string;
  }>({});

  useEffect(() => {
    if (!open || !isReady) return;

    const emptyLevels = Array.from({ length: centerLevels }, () => [] as number[]);

    if (account) {
      const allowed = [
        account.allowed_center_types_1 ?? [],
        account.allowed_center_types_2 ?? [],
        account.allowed_center_types_3 ?? [],
        account.allowed_center_types_4 ?? [],
        account.allowed_center_types_5 ?? [],
        account.allowed_center_types_6 ?? [],
      ].slice(0, centerLevels);

      setFormData({
        name: buildLocaleMap(account.t?.name, allLocales),
        ledger_id: account.ledger_id,
        codeSuffix: account.code,
        contra_for_id: account.contra_for_id,
        accepts_other_currencies: account.accepts_other_currencies,
        allowed_center_types: allowed,
      });
      setShowContraField(account.contra_for_id !== null);
    } else {
      setFormData({
        name: emptyLocaleMap(allLocales),
        ledger_id: parentLedgerId ?? null,
        codeSuffix: '',
        contra_for_id: null,
        accepts_other_currencies: false,
        allowed_center_types: emptyLevels,
      });
      setShowContraField(false);
    }
    setErrors({});
  }, [open, account, isReady, allLocales.join(','), parentLedgerId, centerLevels, prefixSegments]);

  const selectedLedger = useMemo(
    () => ledgers?.find((l) => l.id === formData.ledger_id) ?? null,
    [ledgers, formData.ledger_id]
  );

  const selectedLedgerFullCode = useMemo(() => {
    if (!selectedLedger) return '';
    const category = categories?.find(
      (c) => c.id === selectedLedger.account_category_id
    );
    return `${category?.code ?? ''}${selectedLedger.code}`;
  }, [selectedLedger, categories]);

  const fullCodeForDisplay = useMemo(() => {
    const prefix = parentLedgerFullCode ?? selectedLedgerFullCode ?? '';
    return `${prefix}${formData.codeSuffix}`;
  }, [parentLedgerFullCode, selectedLedgerFullCode, formData.codeSuffix]);

  const contraOptions = useMemo(() => {
    if (!formData.ledger_id || !accounts) return [];
    const sameLedger = accounts.filter(
      (a) => a.ledger_id === formData.ledger_id
    );
    const available = sameLedger.filter(
      (a) => a.contra_for_id === null && a.id !== account?.id
    );
    if (account?.contra_for_id) {
      const current = sameLedger.find((a) => a.id === account.contra_for_id);
      if (current && !available.some((a) => a.id === current.id)) {
        available.push(current);
      }
    }
    return available;
  }, [formData.ledger_id, accounts, account]);

  const handleNameChange = (val: LocaleMap) => {
    setFormData((prev) => ({ ...prev, name: val }));
    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const handleSuffixChange = (suffix: string) => {
    setFormData((prev) => ({ ...prev, codeSuffix: suffix }));
    if (errors.codeSuffix) {
      setErrors((prev) => ({ ...prev, codeSuffix: undefined }));
    }
  };

  const handleCenterTypeChange = (levelIndex: number, newValue: number[]) => {
    setFormData((prev) => {
      const allowed = [...prev.allowed_center_types];
      allowed[levelIndex] = newValue;
      return { ...prev, allowed_center_types: allowed };
    });
  };

  const validate = (): boolean => {
    const next: { name?: string; ledger_id?: string; codeSuffix?: string } = {};

    if (!Object.values(formData.name).some((v) => v.trim())) {
      next.name = t('validations.required');
    }

    if (!formData.ledger_id) {
      next.ledger_id = t('validations.required');
    }

    if (formData.codeSuffix.length !== accountLength) {
      next.codeSuffix = tAccounting('invalidAccountCodeLength', {
        length: accountLength,
      });
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const payload: Record<string, any> = {
      ...flattenTranslations({ name: formData.name }, ['name']),
      ledger_id: formData.ledger_id,
      code: formData.codeSuffix,
      contra_for_id: formData.contra_for_id,
      accepts_other_currencies: formData.accepts_other_currencies,
    };

    for (let i = 0; i < centerLevels; i++) {
      payload[`allowed_center_types_${i + 1}`] = formData.allowed_center_types[i] ?? [];
    }

    try {
      if (isEditMode) {
        await updateAccount({
          organizationId,
          id: account!.id,
          data: payload,
        }).unwrap();
        showSuccess(tAccounting('accountUpdated'));
      } else {
        await createAccount({
          organizationId,
          data: payload,
        }).unwrap();
        showSuccess(tAccounting('accountCreated'));
      }
      onClose();
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tAccounting('accountSaveFailed'));
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
          {isEditMode ? tAccounting('editAccount') : tAccounting('addAccount')}
        </Typography>
        <IconButton size="small" onClick={onClose} disabled={isLoading}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          <Autocomplete
            options={ledgers || []}
            getOptionLabel={(option) => option.name}
            value={selectedLedger}
            onChange={(_, newValue) => {
              setFormData((prev) => ({
                ...prev,
                ledger_id: newValue?.id ?? null,
                contra_for_id: null,
              }));
              if (errors.ledger_id) {
                setErrors((prev) => ({ ...prev, ledger_id: undefined }));
              }
            }}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            disabled={isEditMode || !!parentLedgerId}
            renderInput={(params) => (
              <TextField
                {...params}
                label={tAccounting('ledger')}
                size="small"
                required
                error={!!errors.ledger_id}
                helperText={errors.ledger_id}
              />
            )}
            fullWidth
          />

          <SegmentedCodeInput
            label={tAccounting('code')}
            segments={totalSegments}
            disabledPrefixSegments={prefixSegments}
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

          <FormControlLabel
            control={
              <Switch
                checked={formData.accepts_other_currencies}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    accepts_other_currencies: e.target.checked,
                  }))
                }
              />
            }
            label={tAccounting('acceptsOtherCurrencies')}
          />

          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {tAccounting('allowedCenterTypes')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {Array.from({ length: centerLevels }).map((_, levelIndex) => {
                const selectedIds = formData.allowed_center_types[levelIndex] ?? [];
                const selectedObjects = (centerTypes || []).filter((ct) =>
                  selectedIds.includes(ct.id)
                );

                return (
                  <Autocomplete
                    key={levelIndex}
                    multiple
                    options={centerTypes || []}
                    getOptionLabel={(option) => option.name}
                    value={selectedObjects}
                    onChange={(_, newValue) => {
                      handleCenterTypeChange(
                        levelIndex,
                        newValue.map((ct) => ct.id)
                      );
                    }}
                    isOptionEqualToValue={(option, value) => option.id === value?.id}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={`${tAccounting('centerLevel')} ${levelIndex + 1}`}
                        size="small"
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => {
                        const { key, ...tagProps } = getTagProps({ index });
                        return (
                          <Chip
                            key={option.id}
                            label={option.name}
                            size="small"
                            {...tagProps}
                          />
                        );
                      })
                    }
                    fullWidth
                  />
                );
              })}
            </Box>
          </Box>

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
            label={tAccounting('setContraAccount')}
          />

          {showContraField && (
            <Autocomplete
              options={contraOptions}
              getOptionLabel={(option) => {
                const ledger = ledgers?.find((l) => l.id === option.ledger_id);
                const category = ledger
                  ? categories?.find((c) => c.id === ledger.account_category_id)
                  : null;
                const fullLedgerCode = `${category?.code ?? ''}${ledger?.code ?? ''}`;
                return `${fullLedgerCode}${option.code} — ${option.name}`;
              }}
              value={contraOptions.find((a) => a.id === formData.contra_for_id) ?? null}
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
                  label={tAccounting('contraAccount')}
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