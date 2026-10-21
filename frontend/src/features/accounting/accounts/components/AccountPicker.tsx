import { useMemo } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { useGetAccountsQuery, type Account } from '../accountsApi';
import { useGetLedgersQuery } from '../../ledgers/ledgersApi';
import { useGetAccountCategoriesQuery } from '../../accountCategories/accountCategoriesApi';

export interface AccountPickerFilter {
  /** Account category types, e.g. ['income_statement']. */
  types?: string[];
  /** System category identifiers, e.g. ['OE']. */
  identifiers?: string[];
  /** true: only monetary ledgers; false: only non-monetary ones. */
  monetary?: boolean;
}

interface AccountPickerProps {
  organizationId: number;
  value: number | null;
  onChange: (accountId: number | null) => void;
  label: string;
  helperText?: string;
  error?: boolean;
  disabled?: boolean;
  required?: boolean;
  filter?: AccountPickerFilter;
  /** Accounts that can't be chosen (e.g. the account being edited). */
  excludeIds?: number[];
}

/** Searchable account selector, labelled "full code - name". */
export const AccountPicker = ({
  organizationId,
  value,
  onChange,
  label,
  helperText,
  error,
  disabled,
  required,
  filter,
  excludeIds,
}: AccountPickerProps) => {
  const { data: accounts = [], isLoading: loadingAccounts } = useGetAccountsQuery(organizationId, { skip: !organizationId });
  const { data: ledgers = [] } = useGetLedgersQuery(organizationId, { skip: !organizationId });
  const { data: categories = [] } = useGetAccountCategoriesQuery(organizationId, { skip: !organizationId });

  const options = useMemo(() => {
    const ledgerById = new Map(ledgers.map((l) => [l.id, l]));
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    return accounts
      .filter((account) => {
        if (excludeIds?.includes(account.id)) return false;
        const ledger = ledgerById.get(account.ledger_id);
        const category = ledger ? categoryById.get(ledger.account_category_id) : undefined;
        if (!ledger || !category) return !filter;
        if (filter?.types && !filter.types.includes(category.type)) return false;
        if (filter?.identifiers && !filter.identifiers.includes(category.identifier ?? '')) return false;
        if (filter?.monetary !== undefined && ledger.is_monetary !== filter.monetary) return false;
        return true;
      })
      .sort((a, b) => a.full_code.localeCompare(b.full_code));
  }, [accounts, ledgers, categories, filter, excludeIds]);

  const selected = useMemo(() => accounts.find((a) => a.id === value) ?? null, [accounts, value]);

  return (
    <Autocomplete<Account>
      options={options}
      value={selected}
      loading={loadingAccounts}
      disabled={disabled}
      onChange={(_, account) => onChange(account?.id ?? null)}
      getOptionLabel={(account) => `${account.full_code} - ${account.name}`}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      renderInput={(params) => (
        <TextField {...params} label={label} helperText={helperText} error={error} required={required} size="small" />
      )}
      fullWidth
    />
  );
};
