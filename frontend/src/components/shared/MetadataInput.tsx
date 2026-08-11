import { TextField, FormControlLabel, Switch } from '@mui/material';

export interface MetadataFieldForInput {
  id: string;
  name: string;  // Already resolved to the current locale
  type: 'text' | 'number' | 'boolean';
  required: boolean;
}

interface MetadataInputProps {
  field: MetadataFieldForInput;
  value: any;
  onChange: (fieldId: string, value: any) => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
}

export function MetadataInput({ field, value, onChange, disabled, error, helperText }: MetadataInputProps) {
  switch (field.type) {
    case 'boolean':
      return (
        <FormControlLabel
          control={
            <Switch
              checked={!!value}
              onChange={(e) => onChange(field.id, e.target.checked)}
              disabled={disabled}
            />
          }
          label={field.name}
        />
      );

    case 'number':
      return (
        <TextField
          label={field.name}
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(field.id, e.target.value === '' ? null : Number(e.target.value))}
          fullWidth
          size="small"
          required={field.required}
          disabled={disabled}
          error={error}
          helperText={helperText}
        />
      );

    case 'text':
    default:
      return (
        <TextField
          label={field.name}
          value={value ?? ''}
          onChange={(e) => onChange(field.id, e.target.value)}
          fullWidth
          size="small"
          required={field.required}
          disabled={disabled}
          error={error}
          helperText={helperText}
        />
      );
  }
}