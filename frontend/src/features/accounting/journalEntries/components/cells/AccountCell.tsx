import { useState, useEffect, useMemo } from 'react';
import { TextField, Autocomplete, Box, type AutocompleteInputChangeReason, type FilterOptionsState } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import type { Account } from '../../../accounts/accountsApi';
import { createFilterOptions } from '@mui/material';

interface AccountCellProps {
  value: number | null;
  accounts: Account[];
  onChange: (accountId: number | null) => void;
  /** Called with the search text when the user picks "Add account". */
  onAddNew?: (searchText: string) => void;
  disabled?: boolean;
  error?: boolean;
}

// Sentinel option shown when the search has no matches.
const ADD_NEW_OPTION = { id: -1 } as Account;
const isAddNew = (option: Account | null | undefined) => option?.id === ADD_NEW_OPTION.id;

const getAccountCode = (account: Account): string => {
  return account.full_code || account.code;
};

const baseFilter = createFilterOptions<Account>({
  stringify: (option) => `${getAccountCode(option)} ${option.name}`,
});

export const AccountCell = ({ value, accounts, onChange, onAddNew, disabled, error }: AccountCellProps) => {
  const { t: tJE } = useTranslation('accounting');

  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === value) ?? null,
    [accounts, value]
  );

  const [inputValue, setInputValue] = useState(
    selectedAccount ? getAccountCode(selectedAccount) : ''
  );

  useEffect(() => {
    setInputValue(selectedAccount ? getAccountCode(selectedAccount) : '');
  }, [selectedAccount]);

  const handleInputChange = (newValue: string, reason: AutocompleteInputChangeReason) => {
    setInputValue(newValue);

    // Only auto-resolve while the user is actively typing.
    // 'reset' = an option was picked (text is already correct)
    // 'clear' = the field was cleared
    // 'blur'  = focus left the field — don't force-resolve here, the match
    //           (if any) should already have happened during 'input'
    if (reason !== 'input') return;

    const codeMatch = accounts.find(a => getAccountCode(a) === newValue.trim());
    if (codeMatch) {
      onChange(codeMatch.id);
    }
  };

  const filterOptions = (options: Account[], state: FilterOptionsState<Account>) => {
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
      options={accounts}
      filterOptions={filterOptions}
      getOptionLabel={(option) => (isAddNew(option) ? '' : getAccountCode(option))}
      // Always pass a defined value (null when empty) so the Autocomplete stays
      // controlled. With `undefined` it starts uncontrolled, ignores later
      // values, and wipes a typed code on blur. The cast is needed only because
      // `disableClearable` narrows the value type to non-null.
      value={selectedAccount as Account}
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
      sx={{ px: 1 }}
      slotProps={{
        popper: {
          sx: {
            '& .MuiAutocomplete-listbox': {
              minWidth: 350,  // Or any width you want
            },
          },
        },
        paper: {
          sx: {
            minWidth: 350,  // Ensure the paper itself is also wide enough
          },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          variant="standard"
          error={error}
          onBlur={handleBlur}
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
                <span>{tJE('addAccountNamed', { text: inputValue.trim() })}</span>
              </Box>
            </li>
          );
        }
        return (
          <li key={key} {...optionProps}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, minWidth: 80 }}>
                {getAccountCode(option)}
              </span>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {option.name}
              </span>
            </Box>
          </li>
        );
      }}
    />
  );
};
