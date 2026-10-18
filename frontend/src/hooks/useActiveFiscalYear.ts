import { useState, useEffect, useCallback } from 'react';
import { useGetFiscalYearsQuery } from '../features/fiscalYears/fiscalYearsApi';

const STORAGE_KEY_PREFIX = 'active_fiscal_year_id';

// Scope the stored selection per organization so switching orgs (or creating
// a new one) never reuses a fiscal year id that belongs to another org.
const storageKey = (organizationId: number) => `${STORAGE_KEY_PREFIX}:${organizationId}`;

const readStored = (organizationId: number): number | null => {
  try {
    const stored = localStorage.getItem(storageKey(organizationId));
    return stored ? parseInt(stored, 10) : null;
  } catch {
    return null;
  }
};

const writeStored = (organizationId: number, fiscalYearId: number) => {
  try {
    localStorage.setItem(storageKey(organizationId), String(fiscalYearId));
  } catch {
    // localStorage unavailable
  }
};

export const useActiveFiscalYear = (organizationId: number) => {
  const { data: fiscalYears } = useGetFiscalYearsQuery(organizationId, {
    skip: !organizationId || organizationId === 0,
  });

  const [activeFiscalYearId, setActiveFiscalYearId] = useState<number | null>(() =>
    readStored(organizationId)
  );

  // Re-read the stored selection when the organization changes
  useEffect(() => {
    setActiveFiscalYearId(readStored(organizationId));
  }, [organizationId]);

  // Auto-select a fiscal year when none is selected or the selection is not
  // one of this organization's fiscal years. Prefers the one containing today,
  // otherwise the latest.
  useEffect(() => {
    if (!fiscalYears || fiscalYears.length === 0) return;
    if (activeFiscalYearId && fiscalYears.some(f => f.id === activeFiscalYearId)) return;

    const today = new Date().toISOString().slice(0, 10);
    const current = fiscalYears.find(f => f.start_date <= today && today <= f.finish_date);
    const selected = current ?? fiscalYears[fiscalYears.length - 1];

    setActiveFiscalYearId(selected.id);
    writeStored(organizationId, selected.id);
  }, [fiscalYears, activeFiscalYearId, organizationId]);

  const setActiveFiscalYear = useCallback((fiscalYearId: number) => {
    setActiveFiscalYearId(fiscalYearId);
    writeStored(organizationId, fiscalYearId);
  }, [organizationId]);

  const activeFiscalYear = fiscalYears?.find(f => f.id === activeFiscalYearId) ?? null;

  return {
    fiscalYears: fiscalYears ?? [],
    activeFiscalYearId,
    activeFiscalYear,
    setActiveFiscalYear,
  };
};
