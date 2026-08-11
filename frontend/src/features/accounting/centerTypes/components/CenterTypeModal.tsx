import { useState, useEffect, useMemo, useRef } from 'react';
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
  FormControlLabel,
  Switch,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import {
  useCreateCenterTypeMutation,
  useUpdateCenterTypeMutation,
  type CenterType,
} from '../centerTypesApi';
import { useGetAccountingSettingsQuery } from '../../settings/settingsApi';
import { useTranslatableLocales } from '../../../../hooks/useTranslatableLocales';
import { useToast } from '../../../../contexts/ToastContext';
import MultiLocaleInput from '../../../../components/shared/MultiLocaleInput';
import { MetadataFieldsEditor, type MetadataField } from '../../../../components/shared/MetadataFieldsEditor';
import {
  buildLocaleMap,
  emptyLocaleMap,
  flattenTranslations,
  type LocaleMap,
} from '../../../../utils/translationHelper';

interface CenterTypeModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  centerType?: CenterType | null;
}

export const CenterTypeModal = ({ open, onClose, organizationId, centerType }: CenterTypeModalProps) => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { showSuccess, showError } = useToast();

  const { data: settings } = useGetAccountingSettingsQuery(organizationId, { skip: !organizationId });
  const centerLength = settings?.center_length ?? 6;

  const { allLocales, isReady } = useTranslatableLocales({ organizationId });

  const [createCenterType, { isLoading: isCreating }] = useCreateCenterTypeMutation();
  const [updateCenterType, { isLoading: isUpdating }] = useUpdateCenterTypeMutation();

  const isLoading = isCreating || isUpdating;
  const isEditMode = !!centerType;

  const validateMetadataRef = useRef<(() => boolean) | null>(null);

  const [formData, setFormData] = useState({
    name: {} as LocaleMap,
    first_code: '',
    last_code: '',
    auto_increment: true,
    metadata: [] as MetadataField[],
  });

  useEffect(() => {
    if (open && isReady) {
      if (centerType) {
        setFormData({
          name: buildLocaleMap(centerType.t?.name, allLocales),
          first_code: centerType.first_code,
          last_code: centerType.last_code,
          auto_increment: centerType.auto_increment,
          metadata: (centerType.metadata || []).map((entry) => ({
            ...entry,
            name: buildLocaleMap(entry.name, allLocales),
            type: (['text', 'number', 'boolean'].includes(entry.type) ? entry.type : 'text') as MetadataField['type'],
          })),
        });
      } else {
        setFormData({
          name: emptyLocaleMap(allLocales),
          first_code: '',
          last_code: '',
          auto_increment: true,
          metadata: [],
        });
      }
    }
  }, [open, centerType, isReady, allLocales.join(',')]);

  const codeLengthHint = useMemo(() => {
    const paddedExample = '0'.repeat(centerLength - 1) + '1';
    return tAccounting('centerTypeCodeRangeHelp', { length: centerLength, example: paddedExample });
  }, [centerLength, tAccounting]);

  const handleNameChange = (val: LocaleMap) => {
    setFormData((prev) => ({ ...prev, name: val }));
  };

  const handleMetadataChange = (fields: MetadataField[]) => {
    setFormData((prev) => ({ ...prev, metadata: fields }));
  };

  const handleSave = async () => {
    // Validate metadata fields
    if (validateMetadataRef.current && !validateMetadataRef.current()) {
      return;
    }

    const payload = {
      ...flattenTranslations({ name: formData.name }, ['name']),
      first_code: formData.first_code,
      last_code: formData.last_code,
      auto_increment: formData.auto_increment,
      metadata: formData.metadata.map((entry) => ({
        ...entry,
        name: entry.name,
      })),
    };

    try {
      if (isEditMode) {
        await updateCenterType({ organizationId, id: centerType!.id, data: payload }).unwrap();
        showSuccess(tAccounting('centerTypeUpdated'));
      } else {
        await createCenterType({ organizationId, data: payload }).unwrap();
        showSuccess(tAccounting('centerTypeCreated'));
      }
      onClose();
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tAccounting('centerTypeSaveFailed'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">
          {isEditMode ? tAccounting('editCenterType') : tAccounting('addCenterType')}
        </Typography>
        <IconButton size="small" onClick={onClose} disabled={isLoading}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          {/* Name */}
          <MultiLocaleInput
            field={t('name')}
            value={formData.name}
            onChange={handleNameChange}
            required
          />

          {/* Code Range */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label={tAccounting('firstCode')}
              value={formData.first_code}
              onChange={(e) => setFormData((prev) => ({ ...prev, first_code: e.target.value }))}
              fullWidth
              size="small"
              required
              inputProps={{ maxLength: centerLength }}
              helperText={codeLengthHint}
              placeholder={'0'.repeat(centerLength - 1) + '1'}
            />
            <TextField
              label={tAccounting('lastCode')}
              value={formData.last_code}
              onChange={(e) => setFormData((prev) => ({ ...prev, last_code: e.target.value }))}
              fullWidth
              size="small"
              required
              inputProps={{ maxLength: centerLength }}
              helperText={codeLengthHint}
              placeholder={'9'.repeat(centerLength)}
            />
          </Box>

          {/* Auto Increment */}
          <FormControlLabel
            control={
              <Switch
                checked={formData.auto_increment}
                onChange={(e) => setFormData((prev) => ({ ...prev, auto_increment: e.target.checked }))}
              />
            }
            label={tAccounting('autoIncrement')}
          />

          {/* Metadata Fields Editor */}
          <MetadataFieldsEditor
            fields={formData.metadata}
            onChange={handleMetadataChange}
            organizationId={organizationId}
            isSaved={isEditMode}
            savedFieldIds={isEditMode ? new Set(centerType?.metadata?.map((m) => m.id) || []) : undefined}
            onRegisterValidate={(validateFn) => {
              validateMetadataRef.current = validateFn;
            }}
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
          disabled={isLoading || !formData.first_code.trim() || !formData.last_code.trim()}
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {isEditMode ? t('commonActions.update') : t('commonActions.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};