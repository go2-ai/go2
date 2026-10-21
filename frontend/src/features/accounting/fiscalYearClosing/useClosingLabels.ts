import { useMemo } from 'react';
import { useGetAccountsQuery } from '../accounts/accountsApi';
import { useGetCentersQuery } from '../centers/centersApi';
import { useGetCurrenciesQuery } from '../currencies/currenciesApi';
import { useResolveExchangeRatesQuery } from '../exchangeRates/exchangeRatesApi';
import { useGetAccountingSettingsQuery } from '../settings/settingsApi';
import { formatRevaluationAmount } from '../currencyRevaluations/revaluationFormat';

/** Decimal string from the API, formatted like the revaluation amounts. */
export const formatAmount = (value: string | null, digits = 2) =>
  value === null ? '' : formatRevaluationAmount(Number(value), digits);

/** Labels for the account / center / currency ids of closing previews. */
export const useClosingLabels = (orgId: number) => {
  const skip = { skip: !orgId };
  const { data: accounts = [] } = useGetAccountsQuery(orgId, skip);
  const { data: currencies = [] } = useGetCurrenciesQuery(orgId, skip);
  const { data: centers = [] } = useGetCentersQuery({ organizationId: orgId }, skip);
  const { data: resolved } = useResolveExchangeRatesQuery({ organizationId: orgId }, skip);
  const { data: settings } = useGetAccountingSettingsQuery(orgId, skip);

  return useMemo(() => {
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const currencyById = new Map(currencies.map((c) => [c.id, c]));
    const centerById = new Map(centers.map((c) => [c.id, c]));
    const mainCurrencyId = resolved?.main_currency_id ?? null;
    return {
      /** Center levels in use (accounting settings): one column each. */
      centerLevels: Math.min(Math.max(settings?.center_levels ?? 3, 0), 6),
      /** "code - name" of a center; '' when none. */
      centerLabel: (id: number | null | undefined) => {
        if (id === null || id === undefined) return '';
        const center = centerById.get(id);
        return center ? `${center.code} - ${center.name}` : `#${id}`;
      },
      mainCurrencyId,
      mainDigits: (mainCurrencyId !== null ? currencyById.get(mainCurrencyId)?.decimal_digits : undefined) ?? 2,
      accountLabel: (id: number) => {
        const account = accountById.get(id);
        return account ? `${account.full_code} - ${account.name}` : `#${id}`;
      },
      centersLabel: (ids: Array<number | null>) =>
        ids.filter((c): c is number => c !== null).map((c) => centerById.get(c)?.code ?? `#${c}`).join(' / '),
      currencyAbr: (id: number) => currencyById.get(id)?.abr ?? '',
      currencyDigits: (id: number) => currencyById.get(id)?.decimal_digits ?? 2,
    };
  }, [accounts, currencies, centers, resolved, settings]);
};
