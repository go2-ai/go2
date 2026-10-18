import { useGetJournalEntryForPrintQuery } from '../accounting/journalEntries/journalEntriesApi';

/**
 * Loads the data a report prints, by report key and record id. Reports fetch
 * their own data (instead of receiving it from the opening page), so report
 * tabs keep working after a page refresh and always show current data.
 *
 * The data is wrapped as { root: ... }: templates bind their data sources to
 * paths such as "root" and "root.items".
 *
 * To support a new report key, add its query here.
 */
export const useReportData = (reportKey: string, organizationId: number, recordId: number | null) => {
  const journalEntry = useGetJournalEntryForPrintQuery(
    { organizationId, id: recordId ?? 0 },
    { skip: reportKey !== 'journal_entry' || !organizationId || !recordId }
  );

  switch (reportKey) {
    case 'journal_entry':
      return {
        data: journalEntry.data ? { root: journalEntry.data } : undefined,
        isLoading: journalEntry.isLoading,
        isError: journalEntry.isError,
        supported: true,
      };
    default:
      return { data: undefined, isLoading: false, isError: false, supported: false };
  }
};
