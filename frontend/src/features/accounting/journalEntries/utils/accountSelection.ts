import type { Account } from '../../accounts/accountsApi';
import type { JournalEntryRow } from '../components/types';

/**
 * Row changes to apply when an account is chosen: centers are reset, and the
 * currency falls back to the main currency unless the account accepts others.
 */
export const accountSelectionUpdates = (
  row: JournalEntryRow,
  account: Account | undefined,
  accountId: number | null,
  mainCurrencyId: number | null,
): Partial<JournalEntryRow> => {
  const clearedCenters = {
    center1Id: null,
    center2Id: null,
    center3Id: null,
    center4Id: null,
    center5Id: null,
    center6Id: null,
  };

  if (!(account?.accepts_other_currencies ?? false)) {
    return { accountId, currencyId: mainCurrencyId, rate: null, currencyAmount: null, ...clearedCenters };
  }
  return { accountId, currencyId: row.currencyId ?? mainCurrencyId, ...clearedCenters };
};

/** Center types allowed for a center level of an account (empty = level disabled). */
export const allowedCenterTypeIds = (account: Account | undefined, level: number): number[] => {
  const allowed = account?.[`allowed_center_types_${level}` as keyof Account] as number[] | null | undefined;
  return allowed ?? [];
};
