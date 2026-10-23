import { skipToken } from '@reduxjs/toolkit/query/react';
import { useGetJournalEntryForPrintQuery } from '../accounting/journalEntries/journalEntriesApi';
import { useGetCurrencyRevaluationForPrintQuery } from '../accounting/currencyRevaluations/currencyRevaluationsApi';
import {
  useGetExplorerPrintQuery,
  useGetJournalEntryItemsPrintQuery,
} from '../accounting/journalEntryItems/journalEntryItemsApi';
import { parseExplorerPrintSource } from '../accounting/journalEntryItems/explorerPrintSource';
import type { ReportTarget } from './useOpenReport';

/**
 * Loads the data a report prints, by report key and target: a record id
 * (journal entry, revaluation) or a source query string (the explorer pages'
 * period and filters). Reports fetch their own data (instead of receiving it
 * from the opening page), so report tabs keep working after a page refresh
 * and always show current data.
 *
 * `locale` is the language of the printed template: translated names and
 * labels in the data come in it, whatever the user's language. Wait for the
 * template before loading, so the data is not fetched twice.
 *
 * The data is wrapped as { root: ... }: templates bind their data sources to
 * paths such as "root" and "root.items".
 *
 * To support a new report key, add its query here.
 */
export const useReportData = (reportKey: string, organizationId: number, target: ReportTarget, locale?: string) => {
  const recordId = target.recordId ?? null;
  const ready = !!organizationId && !!locale;
  const skipRecord = !ready || !recordId;

  const journalEntry = useGetJournalEntryForPrintQuery(
    { organizationId, id: recordId ?? 0, locale },
    { skip: reportKey !== 'journal_entry' || skipRecord }
  );
  const revaluation = useGetCurrencyRevaluationForPrintQuery(
    { organizationId, id: recordId ?? 0, locale },
    { skip: reportKey !== 'currency_revaluation' || skipRecord }
  );

  const source = ready ? parseExplorerPrintSource(target.source ?? null) : null;
  const explorer = useGetExplorerPrintQuery(
    reportKey === 'explorer' && source?.groupBy
      ? {
          organizationId,
          scope: source.scope,
          groupBy: source.groupBy,
          filters: source.filters,
          hideZeroBalance: source.hideZeroBalance,
          ids: source.ids,
          locale,
        }
      : skipToken
  );
  const items = useGetJournalEntryItemsPrintQuery(
    reportKey === 'journal_entry_items' && source
      ? { organizationId, scope: source.scope, filters: source.filters, ids: source.ids, locale }
      : skipToken
  );

  const wrap = <T,>(query: { data?: T; isLoading: boolean; isError: boolean }) => ({
    data: query.data ? { root: query.data } : undefined,
    isLoading: query.isLoading,
    isError: query.isError,
    supported: true,
  });

  switch (reportKey) {
    case 'journal_entry':
      return wrap(journalEntry);
    case 'currency_revaluation':
      return wrap(revaluation);
    case 'explorer':
      return wrap(explorer);
    case 'journal_entry_items':
      return wrap(items);
    default:
      return { data: undefined, isLoading: false, isError: false, supported: false };
  }
};
