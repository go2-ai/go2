// The explorer's period, entry types, states and row options: defaults,
// validation, presets and how they're kept in the URL and localStorage.
// Mirrors Accounting::Explorer::EntryScope on the server.
import type { FiscalYear } from '../../fiscalYears/fiscalYearsApi';
import type { ExplorerEntryType, ExplorerScope } from './journalEntryItemsApi';
import {
  type CalendarType,
  addMonths,
  endOfMonth,
  endOfQuarter,
  startOfMonth,
  startOfQuarter,
  todayIso,
} from '../../../components/shared/calendarUtils';

export type PeriodMode = 'date' | 'month' | 'fiscalYear';

export interface ExplorerScopeState extends ExplorerScope {
  hideZeroBalance: boolean;
  /** How the period is picked in the panel. */
  periodMode: PeriodMode;
}

/** In display order. */
export const ALL_ENTRY_TYPES: ExplorerEntryType[] = [
  'beginning',
  'normal',
  'revaluation',
  'closing_temp_accounts',
  'ending',
];
export const DEFAULT_ENTRY_TYPES: ExplorerEntryType[] = ['beginning', 'normal', 'revaluation'];
export const YEAR_END_TYPES: ExplorerEntryType[] = ['closing_temp_accounts', 'ending'];

const sortTypes = (types: ExplorerEntryType[]) => ALL_ENTRY_TYPES.filter((type) => types.includes(type));

const sameTypes = (a: ExplorerEntryType[], b: ExplorerEntryType[]) =>
  sortTypes(a).join(',') === sortTypes(b).join(',');

export const defaultScope = (fiscalYear: FiscalYear): ExplorerScopeState => ({
  from: fiscalYear.start_date,
  to: fiscalYear.finish_date,
  entryTypes: [...DEFAULT_ENTRY_TYPES],
  includeYearEnd: false,
  approvedOnly: false,
  hideZeroBalance: false,
  periodMode: 'fiscalYear',
});

export const periodOf = (scope: ExplorerScopeState) => ({
  from: scope.from,
  to: scope.to,
  periodMode: scope.periodMode,
});

/** The fiscal years a range overlaps, earliest first. */
export const fiscalYearsInRange = (from: string, to: string, fiscalYears: FiscalYear[]): FiscalYear[] =>
  fiscalYears
    .filter((fy) => fy.start_date <= to && fy.finish_date >= from)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

export const fiscalYearContaining = (date: string, fiscalYears: FiscalYear[]): FiscalYear | undefined =>
  fiscalYears.find((fy) => fy.start_date <= date && date <= fy.finish_date);

export const isMultiYear = (scope: Pick<ExplorerScope, 'from' | 'to'>, fiscalYears: FiscalYear[]) =>
  fiscalYearsInRange(scope.from, scope.to, fiscalYears).length > 1;

/** True when the range starts after its first fiscal year's start date. */
export const startsMidYear = (scope: Pick<ExplorerScope, 'from' | 'to'>, fiscalYears: FiscalYear[]) => {
  const first = fiscalYearsInRange(scope.from, scope.to, fiscalYears)[0];
  return !!first && scope.from > first.start_date;
};

/** The entry types that count for the range (year-end types only in one year). */
export const effectiveEntryTypes = (scope: ExplorerScope, multiYear: boolean): ExplorerEntryType[] =>
  multiYear ? sortTypes(scope.entryTypes.filter((type) => !YEAR_END_TYPES.includes(type))) : sortTypes(scope.entryTypes);

export type ScopeError = 'fromRequired' | 'toRequired' | 'invalidRange' | 'outOfRange' | 'noEntryTypes';

export const validateScope = (scope: ExplorerScope, fiscalYears: FiscalYear[]): ScopeError | null => {
  if (!scope.from) return 'fromRequired';
  if (!scope.to) return 'toRequired';
  if (scope.from > scope.to) return 'invalidRange';

  const bounds = fiscalYearBounds(fiscalYears);
  if (!bounds || scope.from < bounds.start || scope.to > bounds.finish) return 'outOfRange';

  const multiYear = isMultiYear(scope, fiscalYears);
  if (effectiveEntryTypes(scope, multiYear).length === 0 && !(multiYear && scope.includeYearEnd)) {
    return 'noEntryTypes';
  }
  return null;
};

export const fiscalYearBounds = (fiscalYears: FiscalYear[]) => {
  if (fiscalYears.length === 0) return null;
  return {
    start: fiscalYears.reduce((min, fy) => (fy.start_date < min ? fy.start_date : min), fiscalYears[0].start_date),
    finish: fiscalYears.reduce((max, fy) => (fy.finish_date > max ? fy.finish_date : max), fiscalYears[0].finish_date),
  };
};

/** Fits the current range to a period mode (whole months, whole fiscal years). */
export const convertPeriod = (
  scope: ExplorerScopeState,
  mode: PeriodMode,
  calendar: CalendarType,
  fiscalYears: FiscalYear[]
): Pick<ExplorerScopeState, 'from' | 'to' | 'periodMode'> => {
  if (!scope.from || !scope.to || mode === 'date') return { from: scope.from, to: scope.to, periodMode: mode };

  if (mode === 'month') {
    return { from: startOfMonth(scope.from, calendar), to: endOfMonth(scope.to, calendar), periodMode: mode };
  }

  const first = fiscalYearContaining(scope.from, fiscalYears);
  const last = fiscalYearContaining(scope.to, fiscalYears);
  return {
    from: first?.start_date ?? scope.from,
    to: last?.finish_date ?? scope.to,
    periodMode: mode,
  };
};

// ── Presets ──────────────────────────────────────────────────────────────

export type PeriodPreset = 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'yearToDate' | 'fiscalYear';

export const PERIOD_PRESETS: PeriodPreset[] = ['thisMonth', 'lastMonth', 'thisQuarter', 'yearToDate', 'fiscalYear'];

/** Months and quarters are those of `calendar`; year to date is the active fiscal year's. */
export const presetPeriod = (
  preset: PeriodPreset,
  calendar: CalendarType,
  activeFiscalYear: FiscalYear,
  today: string = todayIso()
): Pick<ExplorerScopeState, 'from' | 'to' | 'periodMode'> => {
  switch (preset) {
    case 'thisMonth':
      return { from: startOfMonth(today, calendar), to: endOfMonth(today, calendar), periodMode: 'month' };
    case 'lastMonth': {
      const start = addMonths(today, calendar, -1);
      return { from: start, to: endOfMonth(start, calendar), periodMode: 'month' };
    }
    case 'thisQuarter':
      return { from: startOfQuarter(today, calendar), to: endOfQuarter(today, calendar), periodMode: 'month' };
    case 'yearToDate': {
      const { start_date: start, finish_date: finish } = activeFiscalYear;
      const to = today < start ? start : today > finish ? finish : today;
      return { from: start, to, periodMode: 'date' };
    }
    case 'fiscalYear':
      return { from: activeFiscalYear.start_date, to: activeFiscalYear.finish_date, periodMode: 'fiscalYear' };
  }
};

// ── Differences from the defaults (chips and the badge) ──────────────────

export type ScopeChange = 'period' | 'entryTypes' | 'includeYearEnd' | 'approvedOnly' | 'hideZeroBalance';

export const scopeChanges = (
  scope: ExplorerScopeState,
  defaults: ExplorerScopeState,
  fiscalYears: FiscalYear[]
): ScopeChange[] => {
  const multiYear = isMultiYear(scope, fiscalYears);
  const changes: ScopeChange[] = [];

  if (scope.from !== defaults.from || scope.to !== defaults.to) changes.push('period');
  if (!sameTypes(effectiveEntryTypes(scope, multiYear), effectiveEntryTypes(defaults, multiYear))) {
    changes.push('entryTypes');
  }
  if (multiYear && scope.includeYearEnd) changes.push('includeYearEnd');
  if (scope.approvedOnly) changes.push('approvedOnly');
  if (scope.hideZeroBalance) changes.push('hideZeroBalance');
  return changes;
};

/** The scope with one change set back to its default. */
export const resetChange = (
  scope: ExplorerScopeState,
  change: ScopeChange,
  defaults: ExplorerScopeState
): ExplorerScopeState => {
  switch (change) {
    case 'period':
      return { ...scope, ...periodOf(defaults) };
    case 'entryTypes':
      return { ...scope, entryTypes: [...defaults.entryTypes] };
    case 'includeYearEnd':
      return { ...scope, includeYearEnd: false };
    case 'approvedOnly':
      return { ...scope, approvedOnly: false };
    case 'hideZeroBalance':
      return { ...scope, hideZeroBalance: false };
  }
};

/** The year-end toggle only applies to ranges over several fiscal years. */
export const normalizeScope = (scope: ExplorerScopeState, fiscalYears: FiscalYear[]): ExplorerScopeState => ({
  ...scope,
  entryTypes: sortTypes(scope.entryTypes),
  includeYearEnd: scope.includeYearEnd && isMultiYear(scope, fiscalYears),
});

export const sameScope = (a: ExplorerScopeState, b: ExplorerScopeState) =>
  a.from === b.from &&
  a.to === b.to &&
  sameTypes(a.entryTypes, b.entryTypes) &&
  a.includeYearEnd === b.includeYearEnd &&
  a.approvedOnly === b.approvedOnly &&
  a.hideZeroBalance === b.hideZeroBalance &&
  a.periodMode === b.periodMode;

// ── URL ──────────────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_MODES: PeriodMode[] = ['date', 'month', 'fiscalYear'];

/** Query string params for a scope; row options only when `withRowOptions`. */
export const scopeToSearchParams = (scope: ExplorerScopeState, withRowOptions = true): URLSearchParams => {
  const params = new URLSearchParams();
  params.set('from', scope.from);
  params.set('to', scope.to);
  params.set('types', sortTypes(scope.entryTypes).join(','));
  if (scope.includeYearEnd) params.set('year_end', '1');
  if (scope.approvedOnly) params.set('approved', '1');
  if (withRowOptions) {
    if (scope.hideZeroBalance) params.set('hide_zero', '1');
    params.set('mode', scope.periodMode);
  }
  return params;
};

/** The scope in a query string, or null without a valid from/to. */
export const scopeFromSearchParams = (params: URLSearchParams): Partial<ExplorerScopeState> | null => {
  const from = params.get('from');
  const to = params.get('to');
  if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) return null;

  const scope: Partial<ExplorerScopeState> = {
    from,
    to,
    includeYearEnd: params.get('year_end') === '1',
    approvedOnly: params.get('approved') === '1',
    hideZeroBalance: params.get('hide_zero') === '1',
  };

  const types = params.get('types');
  if (types !== null) {
    scope.entryTypes = sortTypes(types.split(',') as ExplorerEntryType[]);
  }

  const mode = params.get('mode') as PeriodMode | null;
  scope.periodMode = mode && PERIOD_MODES.includes(mode) ? mode : 'date';
  return scope;
};

// ── localStorage ─────────────────────────────────────────────────────────

const storageKey = (organizationId: number) => `explorer_scope:${organizationId}`;

interface StoredScope {
  scope: ExplorerScopeState;
  /** The active fiscal year when it was saved; the period resets when it changes. */
  fiscalYearId: number;
}

export const readStoredScope = (organizationId: number): StoredScope | null => {
  try {
    const raw = localStorage.getItem(storageKey(organizationId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredScope;
    if (!parsed?.scope || typeof parsed.fiscalYearId !== 'number') return null;
    return {
      fiscalYearId: parsed.fiscalYearId,
      scope: { ...parsed.scope, entryTypes: sortTypes(parsed.scope.entryTypes ?? []) },
    };
  } catch {
    return null;
  }
};

export const writeStoredScope = (organizationId: number, value: StoredScope) => {
  try {
    localStorage.setItem(storageKey(organizationId), JSON.stringify(value));
  } catch {
    // localStorage unavailable
  }
};
