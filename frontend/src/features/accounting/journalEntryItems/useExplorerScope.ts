// The explorer's applied scope (what the grid shows) and the panel's draft.
// The applied scope is kept in the tab's URL and in localStorage per
// organization. It starts from the URL, then the stored scope, then the
// defaults (the active fiscal year). When the active fiscal year changes,
// the period resets to it; the other options are kept.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveFiscalYear } from '../../../hooks/useActiveFiscalYear';
import { useTabSearchParams } from '../../../components/tabs/useTabSearchParams';
import { useCurrentTabId } from '../../../components/tabs/TabIdContext';
import { useIsTabActive } from '../../../components/tabs/useIsTabActive';
import { useTabManager } from '../../../components/tabs/useTabManager';
import {
  type ExplorerScopeState,
  type ScopeChange,
  defaultScope,
  normalizeScope,
  periodOf,
  readStoredScope,
  resetChange,
  sameScope,
  scopeFromSearchParams,
  scopeToSearchParams,
  validateScope,
  writeStoredScope,
} from './explorerScope';

export const explorerPath = (organizationId: number, scope?: ExplorerScopeState) => {
  const base = `/app/organizations/${organizationId}/accounting/explorer`;
  return scope ? `${base}?${scopeToSearchParams(scope).toString()}` : base;
};

export const useExplorerScope = (organizationId: number) => {
  const { fiscalYears, activeFiscalYear } = useActiveFiscalYear(organizationId);
  const tabSearchParams = useTabSearchParams();
  const tabId = useCurrentTabId();
  const isTabActive = useIsTabActive();
  const { updateTabPath } = useTabManager();
  const navigate = useNavigate();

  const [applied, setApplied] = useState<ExplorerScopeState | null>(null);
  const [draft, setDraft] = useState<ExplorerScopeState | null>(null);
  // The active fiscal year the period was last set from.
  const periodFiscalYearIdRef = useRef<number | null>(null);

  const defaults = useMemo(() => (activeFiscalYear ? defaultScope(activeFiscalYear) : null), [activeFiscalYear]);

  // Initial scope
  useEffect(() => {
    if (applied || !defaults || !activeFiscalYear || fiscalYears.length === 0) return;

    const fromUrl = scopeFromSearchParams(tabSearchParams);
    const stored = readStoredScope(organizationId);
    let initial: ExplorerScopeState = defaults;

    if (fromUrl) {
      initial = { ...defaults, ...fromUrl };
    } else if (stored) {
      initial = { ...defaults, ...stored.scope };
      if (stored.fiscalYearId !== activeFiscalYear.id) initial = { ...initial, ...periodOf(defaults) };
    }

    // A stale period (e.g. a deleted fiscal year) falls back to the default;
    // anything still invalid falls back to the defaults altogether.
    if (validateScope(initial, fiscalYears)) initial = { ...initial, ...periodOf(defaults) };
    if (validateScope(initial, fiscalYears)) initial = defaults;

    initial = normalizeScope(initial, fiscalYears);
    periodFiscalYearIdRef.current = activeFiscalYear.id;
    setApplied(initial);
    setDraft(initial);
  }, [applied, defaults, activeFiscalYear, fiscalYears, tabSearchParams, organizationId]);

  // The active fiscal year changed: reset the period
  useEffect(() => {
    if (!defaults || !activeFiscalYear || periodFiscalYearIdRef.current === null) return;
    if (periodFiscalYearIdRef.current === activeFiscalYear.id) return;

    periodFiscalYearIdRef.current = activeFiscalYear.id;
    const period = periodOf(defaults);
    setApplied((prev) => (prev ? normalizeScope({ ...prev, ...period }, fiscalYears) : prev));
    setDraft((prev) => (prev ? { ...prev, ...period } : prev));
  }, [defaults, activeFiscalYear, fiscalYears]);

  // Persist the applied scope and keep it in the tab's URL
  const isTabActiveRef = useRef(isTabActive);
  isTabActiveRef.current = isTabActive;

  useEffect(() => {
    if (!applied || periodFiscalYearIdRef.current === null) return;

    writeStoredScope(organizationId, { scope: applied, fiscalYearId: periodFiscalYearIdRef.current });

    const path = explorerPath(organizationId, applied);
    if (tabId) updateTabPath(tabId, path);
    if (isTabActiveRef.current && window.location.pathname + window.location.search !== path) {
      navigate(path, { replace: true });
    }
  }, [applied, organizationId, tabId, updateTabPath, navigate]);

  const updateDraft = useCallback((patch: Partial<ExplorerScopeState>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // Changes apply as soon as they're valid. An invalid draft (e.g. a date
  // being typed, or the start after the end) stays in the panel with its
  // error, and the grid keeps the last valid scope.
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
