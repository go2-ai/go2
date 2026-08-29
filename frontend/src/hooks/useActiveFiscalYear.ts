import { useState, useEffect, useCallback } from 'react';
import { useGetFiscalYearsQuery } from '../features/fiscalYears/fiscalYearsApi';

const STORAGE_KEY = 'active_fiscal_year_id';

export const useActiveFiscalYear = (organizationId: number) => {
  const { data: fiscalYears } = useGetFiscalYearsQuery(organizationId, {
    skip: !organizationId || organizationId === 0,
  });

  const [activeFiscalYearId, setActiveFiscalYearId] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? parseInt(stored, 10) : null;
    } catch {
      return null;
    }
  });

  // Auto-select the last fiscal year if no stored value
  useEffect(() => {
    if (fiscalYears && fiscalYears.length > 0 && !activeFiscalYearId) {
      const lastFiscalYear = fiscalYears[fiscalYears.length - 1];
      setActiveFiscalYearId(lastFiscalYear.id);
      try {
        localStorage.setItem(STORAGE_KEY, String(lastFiscalYear.id));
      } catch {
        // localStorage unavailable
      }
    }
  }, [fiscalYears, activeFiscalYearId]);

  const setActiveFiscalYear = useCallback((fiscalYearId: number) => {
    setActiveFiscalYearId(fiscalYearId);
    try {
      localStorage.setItem(STORAGE_KEY, String(fiscalYearId));
    } catch {
      // localStorage unavailable
    }
  }, []);

  const activeFiscalYear = fiscalYears?.find(f => f.id === activeFiscalYearId) ?? null;

  return {
    fiscalYears: fiscalYears ?? [],
    activeFiscalYearId,
    activeFiscalYear,
    setActiveFiscalYear,
  };
};