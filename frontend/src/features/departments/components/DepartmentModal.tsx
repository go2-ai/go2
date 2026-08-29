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
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useCreateDepartmentMutation, useUpdateDepartmentMutation } from '../departmentsApi';
import { useOrganizationLocales } from '../../../hooks/useOrganizationLocales';
import type { Department, DepartmentFormData, TranslatedField } from '../types';
import { buildLocaleMap, flattenTranslations, type LocaleMap } from '../../../utils/translationHelper';
import { useTranslatableLocales } from '../../../hooks/useTranslatableLocales';
import MultiLocaleInput from '../../../components/shared/MultiLocaleInput';

interface DepartmentModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  department?: Department | null;
}

export const DepartmentModal = ({ open, onClose, organizationId, department }: DepartmentModalProps) => {
  const { t } = useTranslation('shared');
  const { t: tDepartments } = useTranslation('departments');

  const { defaultLocale } = useOrganizationLocales(organizationId);

  const [createDepartment, { isLoading: isCreating }] = useCreateDepartmentMutation();
  const [updateDepartment, { isLoading: isUpdating }] = useUpdateDepartmentMutation();

  const isLoading = isCreating || isUpdating;
  
  const { allLocales } = useTranslatableLocales({ organizationId });
  
  const emptyTranslations = (): TranslatedField =>
    Object.fromEntries(allLocales.map(l => [l, '']));

  const [formData, setFormData] = useState<DepartmentFormData>({
    name: emptyTranslations(),
    description: emptyTranslations(),
    abbreviation: '',
  });

  const [errors, setErrors] = useState<{ name?: string; abbreviation?: string }>({});


  useEffect(() => {
    if (department) {
      setFormData({
        name: buildLocaleMap(department.t?.name, allLocales),
        description: buildLocaleMap(department.t?.description, allLocales),
        abbreviation: department.abbreviation,
      });
    } else {
      setFormData({
        name: emptyTranslations(),
        description: emptyTranslations(),
        abbreviation: '',
      });
    }
    setErrors({});
  }, [department, open, allLocales.join(',')]);

  const validateForm = (): boolean => {
    const newErrors: { name?: string; abbreviation?: string } = {};

    if (!formData.name[defaultLocale]?.trim()) {
      newErrors.name = t('validations.required');
    }

    if (!formData.abbreviation) {
      newErrors.abbreviation = t('validations.required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNameChange = (val: LocaleMap) => {
    setFormData((prev) => ({ ...prev, name: val }));
    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const handleDescriptionChange = (val: LocaleMap) => {
    setFormData((prev) => ({ ...prev, description: val }));
  };

  const handleAbbreviationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, abbreviation: e.target.value }));
    if (errors.abbreviation) {
      setErrors(prev => ({ ...prev, abbreviation: undefined }));
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const payload = flattenTranslations(formData, ['name', 'description']);

    try {
      if (department) {
        await updateDepartment({
          organizationId,
          departmentId: department.id,
          data: payload,
        }).unwrap();
      } else {
        await createDepartment({
          organizationId,
          data: payload,
        }).unwrap();
      }
      onClose();
    } catch (error) {
      console.error('Failed to save department:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {department ? tDepartments('editDepartment') : tDepartments('addDepartment')}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, mt: 1 }}>
          <MultiLocaleInput
            field={ t("name") }
            value={formData.name}
            onChange={handleNameChange}
            error={!!errors.name}
            required
          />

          <TextField
            label={tDepartments('abbreviation')}
            value={formData.abbreviation}
            onChange={handleAbbreviationChange}
            error={!!errors.abbreviation}
            helperText={errors.abbreviation ?? tDepartments('max5chars')}
            fullWidth
            inputProps={{ maxLength: 5 }}
            size="small"
          />

          <MultiLocaleInput
            field={t("description")}
            value={formData.description}
            onChange={handleDescriptionChange}
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
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {department ? t('commonActions.update') : t('commonActions.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};