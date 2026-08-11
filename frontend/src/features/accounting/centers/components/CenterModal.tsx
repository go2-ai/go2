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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import {
  useCreateCenterMutation,
  useUpdateCenterMutation,
  type Center,
} from '../centersApi';
import { useGetCenterTypesQuery, type CenterType } from '../../centerTypes/centerTypesApi';
import { useTranslatableLocales } from '../../../../hooks/useTranslatableLocales';
import { useToast } from '../../../../contexts/ToastContext';
import MultiLocaleInput from '../../../../components/shared/MultiLocaleInput';
import { MetadataInput, type MetadataFieldForInput } from '../../../../components/shared/MetadataInput';
import {
  buildLocaleMap,
  emptyLocaleMap,
  flattenTranslations,
  type LocaleMap,
} from '../../../../utils/translationHelper';
import { useGetAccountingSettingsQuery } from '../../settings/settingsApi';

interface CenterModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  center?: Center | null;
  preselectedCenterTypeId?: number;
}

export const CenterModal = ({ open, onClose, organizationId, center, preselectedCenterTypeId }: CenterModalProps) => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { showSuccess, showError } = useToast();
  const { i18n } = useTranslation();

  const { allLocales, isReady } = useTranslatableLocales({ organizationId });
  const { data: centerTypes } = useGetCenterTypesQuery(organizationId, { skip: !organizationId });

  const [createCenter, { isLoading: isCreating }] = useCreateCenterMutation();
  const [updateCenter, { isLoading: isUpdating }] = useUpdateCenterMutation();

  const isLoading = isCreating || isUpdating;
  const isEditMode = !!center;

  const [selectedCenterType, setSelectedCenterType] = useState<CenterType | null>(null);
  const [formData, setFormData] = useState({
    name: {} as LocaleMap,
    code: '',
    metadata: {} as Record<string, any>,
  });

  const { data: settings } = useGetAccountingSettingsQuery(organizationId, { skip: !organizationId });
  const centerLength = settings?.center_length;

  const [errors, setErrors] = useState<{ name?: string; code?: string; metadata?: Record<string, string> }>({});

  useEffect(() => {
    if (!open || !isReady || !centerTypes) return;

    if (center) {
      const ct = centerTypes.find((c) => c.id === center.center_type.id) || null;
      setSelectedCenterType(ct);
      setFormData({
        name: buildLocaleMap(center.t?.name, allLocales),
        code: center.code,
        metadata: center.metadata || {},
      });
    } else {
      const ct = preselectedCenterTypeId
        ? centerTypes.find((c) => c.id === preselectedCenterTypeId) || null
        : null;
      setSelectedCenterType(ct);
      setFormData({
        name: emptyLocaleMap(allLocales),
        code: '',
        metadata: {},
      });
    }
    setErrors({});
  }, [open, center, centerTypes, isReady, preselectedCenterTypeId, allLocales.join(',')]);

  const resolvedMetadataFields: MetadataFieldForInput[] = useMemo(() => {
    if (!selectedCenterType?.metadata) return [];
    const currentLocale = i18n.language;
    return selectedCenterType.metadata.map((field) => ({
      id: field.id,
      name: field.name?.[currentLocale] || field.name?.en || field.id,
      type: field.type as MetadataFieldForInput['type'],
      required: field.required,
    }));
  }, [selectedCenterType, i18n.language]);

  const isCodeDisabled = isEditMode || selectedCenterType?.auto_increment === true;

  const codeRangeHint = useMemo(() => {
    if (isEditMode || !selectedCenterType) return undefined;
    if (selectedCenterType.auto_increment) return tAccounting('codeAutoAssignedHint');
    return tAccounting('codeRangeHint', {
      first: selectedCenterType.first_code,
      last: selectedCenterType.last_code,
    });
  }, [isEditMode, selectedCenterType, tAccounting]);

  const handleNameChange = (val: LocaleMap) => {
    setFormData((prev) => ({ ...prev, name: val }));
    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const handleMetadataChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, [fieldId]: value },
    }));
    if (errors.metadata?.[fieldId]) {
      setErrors((prev) => ({
        ...prev,
        metadata: { ...prev.metadata, [fieldId]: '' },
      }));
    }
  };

  const handleSave = async () => {
    const newErrors: { name?: string; code?: string; metadata?: Record<string, string> } = {};
    const metadataErrors: Record<string, string> = {};

    if (!formData.name[Object.keys(formData.name)[0]]?.trim()) {
      newErrors.name = t('validations.required');
    }

    if (!isCodeDisabled && !formData.code.trim()) {
      newErrors.code = t('validations.required');
    }

    resolvedMetadataFields.forEach((field) => {
      if (field.required) {
        const val = formData.metadata[field.id];
        if (val === null || val === undefined || val === '') {
          metadataErrors[field.id] = t('validations.required');
        }
      }
    });

    if (Object.keys(metadataErrors).length > 0) {
      newErrors.metadata = metadataErrors;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    const payload: Record<string, any> = {
      ...flattenTranslations({ name: formData.name }, ['name']),
      center_type_id: selectedCenterType?.id,
      metadata: formData.metadata,
    };

    if (!isCodeDisabled) {
      payload.code = formData.code;
    }

    try {
      if (isEditMode) {
        await updateCenter({ organizationId, id: center!.id, data: payload }).unwrap();
        showSuccess(tAccounting('centerUpdated'));
      } else {
        await createCenter({ organizationId, data: payload }).unwrap();
        showSuccess(tAccounting('centerCreated'));
      }
      onClose();
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tAccounting('centerSaveFailed'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">
          {isEditMode ? tAccounting('editCenter') : tAccounting('addCenter')}
        </Typography>
        <IconButton size="small" onClick={onClose} disabled={isLoading}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          <Autocomplete
            options={centerTypes || []}
            getOptionLabel={(option) => option.name}
            value={selectedCenterType}
            onChange={(_, newValue) => {
              setSelectedCenterType(newValue);
              setFormData((prev) => ({ ...prev, code: '', metadata: {} }));
            }}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            disabled={!!preselectedCenterTypeId || isEditMode}
            renderInput={(params) => (
              <TextField {...params} label={tAccounting('centerType')} size="small" required />
            )}
            fullWidth
          />

          <TextField
            label={tAccounting('code')}
            value={isEditMode ? formData.code : (isCodeDisabled ? '' : formData.code)}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, code: e.target.value }));
              if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
            }}
            disabled={isCodeDisabled}
            fullWidth
            size="small"
            required={!isCodeDisabled}
            error={!!errors.code}
            helperText={errors.code || codeRangeHint}
            placeholder={!isEditMode && selectedCenterType?.auto_increment ? tAccounting('autoAssigned') : undefined}
            inputProps={{ maxLength: centerLength }}
          />

          <MultiLocaleInput
            field={t('name')}
            value={formData.name}
            onChange={handleNameChange}
            required
            error={!!errors.name}
            helperText={errors.name}
          />

          {resolvedMetadataFields.map((field) => (
            <MetadataInput
              key={field.id}
              field={field}
              value={formData.metadata[field.id]}
              onChange={handleMetadataChange}
              error={!!errors.metadata?.[field.id]}
              helperText={errors.metadata?.[field.id]}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} disabled={isLoading}>
          {t('commonActions.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isLoading || !selectedCenterType}
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {isEditMode ? t('commonActions.update') : t('commonActions.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};