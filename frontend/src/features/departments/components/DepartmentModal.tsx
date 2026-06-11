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
import { useLocale } from '../../../shared/hooks/useLocale';
import type { Department, DepartmentFormData, TranslatedField } from '../types';
import { flattenTranslations } from '../../../utils/translationHelper';

interface DepartmentModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  department?: Department | null;
}

export const DepartmentModal = ({ open, onClose, organizationId, department }: DepartmentModalProps) => {
  const { t } = useTranslation('shared');
  const { t: tDepartments } = useTranslation('departments');

  const { activeLocales } = useOrganizationLocales(organizationId);
  const { localeDirection } = useLocale();


  const [createDepartment, { isLoading: isCreating }] = useCreateDepartmentMutation();
  const [updateDepartment, { isLoading: isUpdating }] = useUpdateDepartmentMutation();

  const isLoading = isCreating || isUpdating;

  const emptyTranslations = (): TranslatedField =>
    Object.fromEntries(activeLocales.map(l => [l, '']));

  const [formData, setFormData] = useState<DepartmentFormData>({
    name: emptyTranslations(),
    description: emptyTranslations(),
    abbreviation: '',
  });

  const [errors, setErrors] = useState<{ name?: string; abbreviation?: string }>({});

  useEffect(() => {
    if (department) {
      setFormData({
        name: { ...emptyTranslations(), ...department.t.name },
        description: { ...emptyTranslations(), ...department.t.description },
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
  }, [department, open, activeLocales.join(',')]);

  const validateForm = (): boolean => {
    const newErrors: { name?: string; abbreviation?: string } = {};

    if (!formData.name[activeLocales[0]]?.trim()) {
      newErrors.name = t('validations.required');
    }
    if (!formData.abbreviation) {
      newErrors.abbreviation = t('validations.required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTranslatedChange = (
    field: 'name' | 'description',
    locale: string,
    value: string
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: { ...prev[field], [locale]: value },
    }));
    if (field === 'name' && errors.name) {
      setErrors(prev => ({ ...prev, name: undefined }));
    }
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
          {activeLocales.map((locale, idx) => (
            <TextField
              key={`name-${locale}`}
              label={`${tDepartments('name')}`}
              value={formData.name[locale] ?? ''}
              onChange={e => handleTranslatedChange('name', locale, e.target.value)}
              inputProps={{ dir: localeDirection(locale) }}
              error={idx === 0 && !!errors.name}
              helperText={idx === 0 ? errors.name : undefined}
              fullWidth
              required={idx === 0}
              autoFocus={idx === 0}
              size="small"
            />
          ))}

          <TextField
            label={tDepartments('abbreviation')}
            value={formData.abbreviation}
            onChange={handleAbbreviationChange}
            error={!!errors.abbreviation}
            helperText={errors.abbreviation ?? 'Maximum 5 characters'}
            fullWidth
            inputProps={{ maxLength: 5 }}
            size="small"
          />

          {activeLocales.map(locale => (
            <TextField
              key={`description-${locale}`}
              label={`${tDepartments('description')}`}
              value={formData.description[locale] ?? ''}
              onChange={e => handleTranslatedChange('description', locale, e.target.value)}
              inputProps={{ dir: localeDirection(locale) }}
              fullWidth
              size="small"
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
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {department ? t('commonActions.update') : t('commonActions.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};