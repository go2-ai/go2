import { useMemo } from 'react';
import { Autocomplete, Box, Chip, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useGetAccountsQuery } from '../../accounts/accountsApi';
import { useGetLedgersQuery } from '../../ledgers/ledgersApi';
import { useGetCurrenciesQuery } from '../../currencies/currenciesApi';
import { useGetCentersQuery } from '../../centers/centersApi';
import { useGetAccountingSettingsQuery } from '../../settings/settingsApi';
import { allowedCenterTypeIds } from '../../journalEntries/utils/accountSelection';
import type { RevaluationScope } from '../currencyRevaluationsApi';

interface Option {
  id: number;
  label: string;
}

interface Props {
  organizationId: number;
  value: RevaluationScope;
  onChange: (scope: RevaluationScope) => void;
  mainCurrencyId: number | null;
  disabled?: boolean;
}

interface MultiSelectProps {
  label: string;
  options: Option[];
  value: number[] | undefined;
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  placeholder: string;
}

type CenterLevelKey = 'center1_ids' | 'center2_ids' | 'center3_ids' | 'center4_ids' | 'center5_ids' | 'center6_ids';

const MultiSelect = ({ label, options, value, onChange, disabled, placeholder }: MultiSelectProps) => {
  const selected = options.filter((o) => value?.includes(o.id));
  return (
    <Autocomplete
      multiple
      options={options}
      value={selected}
      disabled={disabled}
      onChange={(_, items) => onChange(items.map((i) => i.id))}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      renderTags={(items, getTagProps) =>
        items.map((item, index) => {
          const { key, ...tagProps } = getTagProps({ index });
          return <Chip key={key} label={item.label} size="small" {...tagProps} />;
        })
      }
      renderInput={(params) => (
        <TextField {...params} label={label} size="small" placeholder={selected.length ? undefined : placeholder} />
      )}
      fullWidth
    />
  );
};

/**
 * Which balances to revalue. Every filter is optional; blank means all
 * monetary accounts in currencies other than the main one. Centers are
 * filtered per center level (as many levels as the accounting settings use).
 */
export const RevaluationScopeEditor = ({ organizationId, value, onChange, mainCurrencyId, disabled }: Props) => {
  const { t: tAccounting } = useTranslation('accounting');
  const skip = { skip: !organizationId };
  const { data: accounts = [] } = useGetAccountsQuery(organizationId, skip);
  const { data: ledgers = [] } = useGetLedgersQuery(organizationId, skip);
  const { data: currencies = [] } = useGetCurrenciesQuery(organizationId, skip);
  const { data: centers = [] } = useGetCentersQuery({ organizationId }, skip);
  const { data: settings } = useGetAccountingSettingsQuery(organizationId, skip);
  const centerLevels = settings?.center_levels ?? 3;

  const options = useMemo(() => {
    const monetaryLedgerIds = new Set(ledgers.filter((l) => l.is_monetary).map((l) => l.id));
    const monetaryAccounts = accounts.filter((a) => monetaryLedgerIds.has(a.ledger_id));
    const centerOptions = (level: number): Option[] => {
      // Center types monetary accounts accept at this level; all centers when none says.
      const types = new Set(monetaryAccounts.flatMap((a) => allowedCenterTypeIds(a, level)));
      return centers
        .filter((c) => types.size === 0 || types.has(c.center_type.id))
        .map((c) => ({ id: c.id, label: `${c.code} - ${c.name}` }));
    };
    return {
      currencies: currencies
        .filter((c) => c.id !== mainCurrencyId)
        .map((c) => ({ id: c.id, label: `${c.abr} - ${c.name}` })),
      accounts: [...monetaryAccounts]
        .sort((a, b) => a.full_code.localeCompare(b.full_code))
        .map((a) => ({ id: a.id, label: `${a.full_code} - ${a.name}` })),
      centers: Array.from({ length: centerLevels }, (_, i) => centerOptions(i + 1)),
    };
  }, [currencies, mainCurrencyId, ledgers, accounts, centers, centerLevels]);

  // Ledger and any-level center filters (API only) are kept as they are.
  const set = (key: keyof RevaluationScope) => (ids: number[]) => onChange({ ...value, [key]: ids });
  const all = tAccounting('revaluations.scopeAll');

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      <MultiSelect label={tAccounting('revaluations.currencies')} options={options.currencies}
        value={value.currency_ids} onChange={set('currency_ids')} disabled={disabled} placeholder={all} />
      <MultiSelect label={tAccounting('revaluations.accounts')} options={options.accounts}
        value={value.account_ids} onChange={set('account_ids')} disabled={disabled} placeholder={all} />
      {options.centers.map((levelOptions, index) => {
        const key = `center${index + 1}_ids` as CenterLevelKey;
        return (
          <MultiSelect key={key} label={tAccounting('revaluations.centerLevel', { level: index + 1 })}
            options={levelOptions} value={value[key]} onChange={set(key)} disabled={disabled} placeholder={all} />
        );
      })}
    </Box>
  );
};
