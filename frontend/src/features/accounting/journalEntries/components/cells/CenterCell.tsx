import { useState, useEffect, useMemo } from 'react';
import { TextField, Autocomplete, Box, type AutocompleteInputChangeReason } from '@mui/material';
import type { Center } from '../../../centers/centersApi';
import { createFilterOptions } from '@mui/material';

interface CenterCellProps {
  value: number | null;
  centers: Center[];
  disabled?: boolean;
  error?: boolean;
  onChange: (centerId: number | null) => void;
}

export const CenterCell = ({ value, centers, disabled, error, onChange }: CenterCellProps) => {
  const selectedCenter = useMemo(
    () => centers.find(c => c.id === value) ?? null,
    [centers, value]
  );

  const [inputValue, setInputValue] = useState(selectedCenter ? selectedCenter.code : '');

  useEffect(() => {
    setInputValue(selectedCenter ? selectedCenter.code : '');
  }, [selectedCenter]);

  const handleInputChange = (newValue: string, reason: AutocompleteInputChangeReason) => {
    setInputValue(newValue);
    if (reason !== 'input') return;

    const codeMatch = centers.find(c => c.code === newValue.trim());
    if (codeMatch) {
      onChange(codeMatch.id);
    }
  };

  const filterOptions = createFilterOptions<Center>({
    stringify: (option) => `${option.code} ${option.name}`,
  });

  const handleBlur = () => {
    if (inputValue.trim() === '') {
      onChange(null);
    }
  };

  return (
    <Autocomplete
      options={centers}
      filterOptions={filterOptions}
      getOptionLabel={(option) => option.code}
      value={selectedCenter ?? undefined}
      onChange={(_, newValue) => onChange(newValue?.id ?? null)}
      inputValue={inputValue}
      onInputChange={(_, newValue, reason) => handleInputChange(newValue, reason)}
      disabled={disabled}
      isOptionEqualToValue={(option, value) => option.id === value?.id}
      size="small"
      fullWidth
      disableClearable
      sx={{
        height: '100%',
        '& .MuiFormControl-root': {
          height: '100%',
          backgroundColor: disabled ? 'action.disabledBackground' : 'transparent',
        },
        '& .MuiInputBase-root': {
          height: '100%',
          pt: 0,
          pb: 0,
        },
        '& .MuiInputBase-input': {
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          pt: 0,
          pb: 0,
        },
        '& .MuiAutocomplete-endAdornment': {
          display: 'flex',
          alignItems: 'center',
        },
      }}
      slotProps={{
        popper: {
          sx: {
            '& .MuiAutocomplete-listbox': {
              minWidth: 350,
            },
          },
        },
        paper: {
          sx: {
            minWidth: 350,
          },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          variant="standard"
          error={error}
          onBlur={handleBlur}
          sx={{ px: 1 }}
          InputProps={{
            ...params.InputProps,
            disableUnderline: true,
          }}
        />
      )}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        return (
          <li key={key} {...optionProps}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{option.code}</span>
              <span>{option.name}</span>
            </Box>
          </li>
        );
      }}
    />
  );
};