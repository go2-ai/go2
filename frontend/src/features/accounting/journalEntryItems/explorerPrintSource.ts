// What the explorer pages print, as a query string carried by the report tab
// ("source"): the scope (same params as the pages' URLs), the drill filters,
// for the explorer the grouping, and the selected rows when only those are
// printed. Report tabs load their data from it, so they keep working after a
// refresh.
import { DEFAULT_ENTRY_TYPES, scopeFromSearchParams, scopeToSearchParams, type ExplorerScopeState } from './explorerScope';
import type { ExplorerDimension, ExplorerFilter, ExplorerScope } from './journalEntryItemsApi';

export interface ExplorerPrintSource {
  scope: ExplorerScope;
  filters: ExplorerFilter[];
  /** Explorer only. */
  groupBy: ExplorerDimension | null;
  hideZeroBalance: boolean;
  /** Only these rows (item ids, or ids of the grouped records); null for all. */
  ids: number[] | null;
}

/** Filters without their display names: the server names the records in the template's language. */
const plainFilters = (filters: ExplorerFilter[]) => filters.map(({ dimension, ids }) => ({ dimension, ids }));

const setIds = (params: URLSearchParams, ids?: number[] | null) => {
  if (ids && ids.length > 0) params.set('ids', ids.join(','));
};

export const explorerPrintSource = (
  scope: ExplorerScopeState,
  groupBy: ExplorerDimension,
  filters: ExplorerFilter[],
  ids?: number[] | null
): string => {
  const params = scopeToSearchParams(scope, false);
  params.set('group_by', groupBy);
  params.set('filters', JSON.stringify(plainFilters(filters)));
  if (scope.hideZeroBalance) params.set('hide_zero', '1');
  setIds(params, ids);
  return params.toString();
};

export const journalEntryItemsPrintSource = (
  scope: ExplorerScopeState,
  filters: ExplorerFilter[],
  ids?: number[] | null
): string => {
  const params = scopeToSearchParams(scope, false);
  params.set('filters', JSON.stringify(plainFilters(filters)));
  setIds(params, ids);
  return params.toString();
};

const parseIds = (raw: string | null): number[] | null => {
  if (!raw) return null;
  const ids = raw
    .split(',')
    .map((value) => Number(value))
    .filter((id) => Number.isInteger(id) && id > 0);
  return ids.length > 0 ? ids : null;
};

/** The print source in a report tab, or null when it has no valid period. */
export const parseExplorerPrintSource = (source: string | null): ExplorerPrintSource | null => {
  if (!source) return null;
  const params = new URLSearchParams(source);
  const scope = scopeFromSearchParams(params);
  if (!scope?.from || !scope.to) return null;

  let filters: ExplorerFilter[] = [];
  try {
    const parsed = JSON.parse(params.get('filters') || '[]');
    if (Array.isArray(parsed)) filters = parsed;
  } catch {
    filters = [];
  }

  return {
    scope: {
      from: scope.from,
      to: scope.to,
      entryTypes: scope.entryTypes ?? [...DEFAULT_ENTRY_TYPES],
      includeYearEnd: scope.includeYearEnd ?? false,
      approvedOnly: scope.approvedOnly ?? false,
    },
    filters,
    groupBy: (params.get('group_by') as ExplorerDimension | null) || null,
    hideZeroBalance: params.get('hide_zero') === '1',
    ids: parseIds(params.get('ids')),
  };
};
