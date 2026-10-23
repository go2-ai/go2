// The journal entry items page's applied scope (what the grid shows) and the
// filter panel's draft. It starts from the tab's URL (the scope the page was
// opened with); changes stay in the page and aren't saved. The defaults are
// those of the linked fiscal year (fiscal_year_id), else the active one.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useActiveFiscalYear } from '../../../hooks/useActiveFiscalYear';
import { parseId } from '../../../components/tabs/useTabSearchParams';
import {
  type ExplorerScopeState,
  type ScopeChange,
  defaultScope,
  normalizeScope,
  resetChange,
  sameScope,
  scopeFromSearchParams,
  validateScope,
} from './explorerScope';

export const useJournalEntryItemsScope = (organizationId: number, searchParams: URLSearchParams) => {
  const { fiscalYears, activeFiscalYear } = useActiveFiscalYear(organizationId);

  const linkedYearId = parseId(searchParams.get('fiscal_year_id'));
  const fiscalYear = fiscalYears.find((fy) => fy.id === linkedYearId) ?? activeFiscalYear;
  const defaults = useMemo(() => (fiscalYear ? defaultScope(fiscalYear) : null), [fiscalYear]);

  const [applied, setApplied] = useState<ExplorerScopeState | null>(null);
  const [draft, setDraft] = useState<ExplorerScopeState | null>(null);

  // Initial scope: the URL's (zero-balance rows don't apply to items).
  useEffect(() => {
    if (applied || !defaults || fiscalYears.length === 0) return;
    const fromUrl = scopeFromSearchParams(searchParams);
    let initial: ExplorerScopeState = fromUrl ? { ...defaults, ...fromUrl, hideZeroBalance: false } : defaults;
    if (validateScope(initial, fiscalYears)) initial = defaults;
    initial = normalizeScope(initial, fiscalYears);
    setApplied(initial);
    setDraft(initial);
  }, [applied, defaults, fiscalYears, searchParams]);

  const updateDraft = useCallback((patch: Partial<ExplorerScopeState>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // Valid changes apply right away; an invalid draft keeps the last valid scope.
  useEffect(() => {
    if (!draft || validateScope(draft, fiscalYears)) return;
    const next = normalizeScope(draft, fiscalYears);
    setApplied((prev) => (prev && sameScope(prev, next) ? prev : next));
  }, [draft, fiscalYears]);

  const resetDraft = useCallback(() => {
    if (defaults) setDraft(defaults);
  }, [defaults]);

  /** Sets one change back to its default and applies it right away. */
  const clearChange = useCallback(
    (change: ScopeChange) => {
      if (!applied || !defaults) return;
      const next = normalizeScope(resetChange(applied, change, defaults), fiscalYears);
      setApplied(next);
      setDraft(next);
    },
    [applied, defaults, fiscalYears]
  );

  const draftError = draft ? validateScope(draft, fiscalYears) : null;
  const isDefault = !!draft && !!defaults && sameScope(normalizeScope(draft, fiscalYears), defaults);

  return {
    applied,
    draft,
    defaults,
    fiscalYears,
    activeFiscalYear,
    draftError,
    isDefault,
    updateDraft,
    resetDraft,
    clearChange,
  };
};
