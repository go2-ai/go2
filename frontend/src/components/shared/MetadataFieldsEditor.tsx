import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  TextField,
  Switch,
  FormControlLabel,
  MenuItem,
  alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import MultiLocaleInput from './MultiLocaleInput';
import { useTranslatableLocales } from '../../hooks/useTranslatableLocales';
import { useConfirm } from '../../contexts/confirmContext';
import type { LocaleMap } from '../../utils/translationHelper';

const SNAKE_CASE_REGEX = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

export interface MetadataField {
  id: string;
  name: LocaleMap;
  type: 'text' | 'number' | 'boolean';
  required: boolean;
  [key: string]: any;
}

interface MetadataFieldsEditorProps {
  fields: MetadataField[];
  onChange: (fields: MetadataField[]) => void;
  organizationId: number;
  isSaved?: boolean;
  maxFields?: number;
  disabled?: boolean;
  /** Callback to register a validate function that returns true if valid */
  onRegisterValidate?: (validate: () => boolean) => void;
}

const FIELD_TYPES = ['text', 'number', 'boolean'] as const;

const tKey = (suffix: string) => `components.metadataFieldsEditor.${suffix}`;

const scrollbarStyles = {
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: (theme: any) => alpha(theme.palette.text.secondary, 0.3),
    borderRadius: '4px',
    '&:hover': {
      backgroundColor: (theme: any) => alpha(theme.palette.text.secondary, 0.5),
    },
  },
  scrollbarWidth: 'thin',
  scrollbarColor: (theme: any) => `${alpha(theme.palette.text.secondary, 0.3)} transparent`,
} as const;

export function MetadataFieldsEditor({
  fields,
  onChange,
  organizationId,
  isSaved = false,
  maxFields,
  disabled = false,
  onRegisterValidate,
}: MetadataFieldsEditorProps) {
  const { t } = useTranslation('shared');
  const confirm = useConfirm();
  const { allLocales, isReady } = useTranslatableLocales({ organizationId });

  const [errors, setErrors] = useState<Record<number, string>>({});

  const canAdd = maxFields === undefined || fields.length < maxFields;

  // Validate function exposed to parent via ref
  const validate = useCallback((): boolean => {
    const newErrors: Record<number, string> = {};
    const seenIds = new Set<string>();

    fields.forEach((field, index) => {
      if (!field.id.trim()) {
        newErrors[index] = t('validations.required');
      } else if (!SNAKE_CASE_REGEX.test(field.id)) {
        newErrors[index] = t(tKey('invalidSnakeCase'));
      } else if (seenIds.has(field.id)) {
        newErrors[index] = t(tKey('duplicateFieldId'));
      } else {
        seenIds.add(field.id);
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [fields, t]);

  // Register validate with parent
  useState(() => {
    onRegisterValidate?.(validate);
  });

  // Re-register when validate function changes
  // We use a simple approach: call onRegisterValidate whenever validate changes
  if (onRegisterValidate) {
    onRegisterValidate(validate);
  }

  const handleAdd = () => {
    if (!canAdd) return;
    const newField: MetadataField = {
      id: '',
      name: Object.fromEntries(allLocales.map((l) => [l, ''])) as LocaleMap,
      type: 'text',
      required: false,
    };
    onChange([...fields, newField]);
  };

  const handleRemove = async (index: number) => {
    const field = fields[index];
    if (isSaved && field.id) {
      const confirmed = await confirm({
        title: t(tKey('deleteFieldTitle')),
        message: t(tKey('deleteFieldMessage'), { id: field.id }),
        confirmText: t('commonActions.delete'),
        confirmColor: 'error',
      });
      if (!confirmed) return;
    }
    onChange(fields.filter((_, i) => i !== index));
    // Clear error for removed field
    setErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      // Re-index errors after removal
      const reindexed: Record<number, string> = {};
      Object.entries(next).forEach(([key, val]) => {
        const oldIndex = parseInt(key, 10);
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = val;
        } else if (oldIndex < index) {
          reindexed[oldIndex] = val;
        }
      });
      return reindexed;
    });
  };

  const handleChange = (index: number, key: string, value: any) => {
    const updated = fields.map((field, i) =>
      i === index ? { ...field, [key]: value } : field
    );
    onChange(updated);
    // Clear error for this field when user edits
    if (errors[index]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const handleNameChange = (index: number, val: LocaleMap) => {
    handleChange(index, 'name', val);
  };

  return (
    <Box>
      {/* Fixed header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexShrink: 0 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {t(tKey('title'))} ({fields.length})
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          variant="outlined"
          disabled={disabled || !canAdd}
        >
          {t(tKey('addField'))}
        </Button>
      </Box>

      {!isReady ? null : (
        /* Scrollable fields area */
        <Box
          sx={{
            maxHeight: 400,
            overflow: 'auto',
            pr: 0.5,
            ...scrollbarStyles,
          }}
        >
          {fields.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              {t(tKey('noFields'))}
            </Typography>
          ) : (
            <Stack spacing={2}>
              {fields.map((field, index) => (
                <Box
                  key={`meta-${index}`}
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: errors[index] ? 'error.main' : 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Stack spacing={2}>
                    <TextField
                      label={t(tKey('fieldId'))}
                      value={field.id}
                      onChange={(e) => handleChange(index, 'id', e.target.value)}
                      size="small"
                      fullWidth
                      required
                      disabled={disabled}
                      error={!!errors[index]}
                      helperText={errors[index] || t(tKey('snakeCaseHint'))}
                      placeholder="swift_code"
                    />

                    <MultiLocaleInput
                      field={t('name')}
                      value={field.name}
                      onChange={(val) => handleNameChange(index, val)}
                      required
                      disabled={disabled}
                    />

                    <TextField
                      select
                      label={t(tKey('fieldType'))}
                      value={field.type}
                      onChange={(e) => handleChange(index, 'type', e.target.value)}
                      size="small"
                      fullWidth
                      disabled={disabled}
                    >
                      {FIELD_TYPES.map((ft) => (
                        <MenuItem key={ft} value={ft}>
                          {t(tKey(`types.${ft}`))}
                        </MenuItem>
                      ))}
                    </TextField>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={field.required}
                            onChange={(e) => handleChange(index, 'required', e.target.checked)}
                            size="small"
                            disabled={disabled}
                          />
                        }
                        label={t(tKey('required'))}
                      />
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        onClick={() => handleRemove(index)}
                        disabled={disabled}
                        sx={{ textTransform: 'none' }}
                      >
                        {t('commonActions.delete')}
                      </Button>
                    </Box>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
}