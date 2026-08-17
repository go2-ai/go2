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
  useCreateAccountCategoryMutation,
  useUpdateAccountCategoryMutation,
  type AccountCategory,
} from '../../accountCategories/accountCategoriesApi';
import { useGetAccountingSettingsQuery } from '../../settings/settingsApi';
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

interface AccountCategoryModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  accountCategory?: AccountCategory | null;
}

export const AccountCategoryModal = ({
  open,
  onClose,
  organizationId,
  accountCategory,
}: AccountCategoryModalProps) => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { showSuccess, showError } = useToast();

  const { allLocales, isReady } = useTranslatableLocales({ organizationId });
  const { data: settings } = useGetAccountingSettingsQuery(organizationId, {
    skip: !organizationId,
  });

  const accountCategoryLength = settings?.account_category_length ?? 1;

  const [createAccountCategory, { isLoading: isCreating }] =
    useCreateAccountCategoryMutation();
  const [updateAccountCategory, { isLoading: isUpdating }] =
    useUpdateAccountCategoryMutation();

  const isLoading = isCreating || isUpdating;
  const isEditMode = !!accountCategory;

  const [formData, setFormData] = useState({
    code: '',
    name: {} as LocaleMap,
  });

  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});

  useEffect(() => {
    if (!open || !isReady) return;

    if (accountCategory) {
      setFormData({
        code: accountCategory.code,
        name: buildLocaleMap(accountCategory.t?.name, allLocales),
      });
    } else {
      setFormData({
        code: '',
        name: emptyLocaleMap(allLocales),
      });
    }
    setErrors({});
  }, [open, accountCategory, isReady, allLocales.join(',')]);

  const handleNameChange = (val: LocaleMap) => {
    setFormData((prev) => ({ ...prev, name: val }));
    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const handleCodeChange = (code: string) => {
    setFormData((prev) => ({ ...prev, code }));
    if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
  };

  const validate = (): boolean => {
    const next: { code?: string; name?: string } = {};

    if (formData.code.length !== accountCategoryLength) {
      next.code = tAccounting('invalidCategoryCodeLength', {
        length: accountCategoryLength,
      });
    }

    if (!Object.values(formData.name).some((v) => v.trim())) {
      next.name = t('validations.required');
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const payload = {
      ...flattenTranslations({ name: formData.name }, ['name']),
      code: formData.code,
    };

    try {
      if (isEditMode) {
        await updateAccountCategory({
          organizationId,
          id: accountCategory!.id,
          data: payload,
        }).unwrap();
        showSuccess(tAccounting('accountCategoryUpdated'));
      } else {
        await createAccountCategory({
          organizationId,
          data: payload,
        }).unwrap();
        showSuccess(tAccounting('accountCategoryCreated'));
      }
      onClose();
    } catch (err: any) {
      showError(
        err?.data?.errors?.[0] || tAccounting('accountCategorySaveFailed')
      );
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
          {isEditMode
            ? tAccounting('editAccountCategory')
            : tAccounting('addAccountCategory')}
        </Typography>
        <IconButton size="small" onClick={onClose} disabled={isLoading}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          <SegmentedCodeInput
            label={tAccounting('code')}
            segments={accountCategoryLength}
            disabledPrefixSegments={0}
            value={formData.code}
            onChange={handleCodeChange}
            error={!!errors.code}
            helperText={errors.code}
          />

          <MultiLocaleInput
            field={t('name')}
            value={formData.name}
            onChange={handleNameChange}
            required
            error={!!errors.name}
            helperText={errors.name}
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