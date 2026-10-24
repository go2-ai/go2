import type { EntrySelection, RunColumn, DrillRow } from './types';

/** One filter of the journal entry items page (as the explorer writes them). */
export interface EntryItemsFilter {
  dimension: string;
  ids: number[];
  items: Array<{ code: string; name: string }>;
}

export const entryFilter = (dimension: string, id: number, code: string | null, name: string | null): EntryItemsFilter => ({
  dimension,
  ids: [id],
  items: [{ code: code ?? '', name: name ?? '' }],
});

export const accountFilter = (account: {
  account_id: number;
  account_code: string | null;
  account_name: string | null;
}): EntryItemsFilter => entryFilter('account', account.account_id, account.account_code, account.account_name);

export const centerFilter = (
  level: number,
  center: { center_id: number; center_code: string | null; center_name: string | null }
): EntryItemsFilter => entryFilter(`center${level}`, center.center_id, center.center_code, center.center_name);

/**
 * Path of the journal entry items page for a selection of entries (period
 * and entry types), narrowed by filters. The items page reads the same
 * parameters as the explorer.
 */
export const journalEntryItemsPath = (selection: EntrySelection, filters: EntryItemsFilter[]): string => {
  const params = new URLSearchParams();
  params.set('from', selection.from);
  params.set('to', selection.to);
  params.set('types', selection.entry_types.join(','));
  params.set('mode', 'date');
  params.set('filters', JSON.stringify(filters));
  return `accounting/journal-entry-items?${params.toString()}`;
};

/** The entries of a column behind a balance of the given period (balance sheets split prior / current years). */
export const columnEntries = (column: RunColumn, period: DrillRow['period']): EntrySelection =>
  (period === 'prior' && column.entries_prior) || (period === 'current' && column.entries_current) || column.entries;

/**
 * Path of the journal entry items page for the entries behind a drill row:
 * its column's period and entry types, filtered to the row's account (and
 * center).
 */
export const entryItemsPath = (column: RunColumn, row: DrillRow, centerLevel: number | null): string => {
  const filters = [accountFilter(row)];
  if (centerLevel && row.center_id) {
    filters.push(centerFilter(centerLevel, { ...row, center_id: row.center_id }));
  }
  return journalEntryItemsPath(columnEntries(column, row.period), filters);
};
