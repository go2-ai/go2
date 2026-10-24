import { useMemo } from 'react';
import { useActiveFiscalYear } from '../../hooks/useActiveFiscalYear';
import { todayIso } from '../../components/shared/calendarUtils';

export interface ReportPeriod {
  start: string;
  end: string;
}

/**
 * Default period of a report: the active fiscal year, up to today. Null
 * until the fiscal years have loaded.
 */
export const useDefaultReportPeriod = (organizationId: number): ReportPeriod | null => {
  const { activeFiscalYear } = useActiveFiscalYear(organizationId);
  const start = activeFiscalYear?.start_date;
  const finish = activeFiscalYear?.finish_date;

  return useMemo(() => {
    if (!start || !finish) return null;
    const today = todayIso();
    return { start, end: finish < today ? finish : today };
  }, [start, finish]);
};
