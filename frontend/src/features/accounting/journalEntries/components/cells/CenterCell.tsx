import { useState, useEffect, useMemo } from 'react';
import { TextField, Autocomplete, Box, type AutocompleteInputChangeReason, type FilterOptionsState } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import type { Center } from '../../../centers/centersApi';
import { createFilterOptions } from '@mui/material';

interface CenterCellProps {
  value: number | null;
  centers: Center[];
  disabled?: boolean;
  error?: boolean;
  onChange: (centerId: number | null) => void;
  /** Called with the search text when the user picks "Add center". */
  onAddNew?: (searchText: string) => void;
}

// Sentinel option shown when the search has no matches.
const ADD_NEW_OPTION = { id: -1 } as Center;
const isAddNew = (option: Center | null | undefined) => option?.id === ADD_NEW_OPTION.id;

const baseFilter = createFilterOptions<Center>({
  stringify: (option) => `${option.code} ${option.name}`,
});

export const CenterCell = ({ value, centers, disabled, error, onChange, onAddNew }: CenterCellProps) => {
  const { t: tJE } = useTranslation('accounting');

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

  const filterOptions = (options: Center[], state: FilterOptionsState<Center>) => {
    const filtered = baseFilter(options, state);
    if (filtered.length === 0 && onAddNew && state.inputValue.trim()) {
      return [ADD_NEW_OPTION];
    }
    return filtered;
  };

  const handleBlur = () => {
    if (inputValue.trim() === '') {
      onChange(null);
    }
  };

  return (
    <Autocomplete
      options={centers}
      filterOptions={filterOptions}
      getOptionLabel={(option) => (isAddNew(option) ? '' : option.code)}
      // Keep the Autocomplete controlled (null, never undefined) so a typed
      // code isn't wiped on blur. Cast only because of `disableClearable`.
      value={selectedCenter as Center}
      onChange={(_, newValue) => {
        if (isAddNew(newValue)) {
          onAddNew?.(inputValue.trim());
          return;
        }
        onChange(newValue?.id ?? null);
      }}
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
        if (isAddNew(option)) {
          return (
            <li key="__add_new__" {...optionProps}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', color: 'primary.main' }}>
                <AddIcon fontSize="small" />
                <span>{tJE('addCenterNamed', { text: inputValue.trim() })}</span>
              </Box>
            </li>
          );
        }
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