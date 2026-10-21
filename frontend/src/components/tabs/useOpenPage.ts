// src/components/tabs/useOpenPage.ts
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTabManager } from './useTabManager';

/**
 * Opens organization pages in a tab and navigates to them. Paths are
 * relative to /app/organizations/:orgId/ (e.g. 'accounting/journal-entries').
 */
export const useOpenPage = (orgId: number) => {
  const navigate = useNavigate();
  const { openTab } = useTabManager();
  const { t: tAccounting } = useTranslation('accounting');

  const openPage = useCallback(
    (pageId: string, title: string, path: string) => {
      const full = `/app/organizations/${orgId}/${path}`;
      openTab(pageId, title, full);
      navigate(full);
    },
    [orgId, openTab, navigate]
  );

  /** A journal entry, titled with its reference like the journal entries list does. */
  const openJournalEntry = useCallback(
    (entry: { id: number; ref?: string | null }) =>
      openPage('journal-entry-edit', tAccounting('journalEntryTabTitle', { ref: entry.ref || entry.id }),
        `accounting/journal-entries/${entry.id}`),
    [openPage, tAccounting]
  );

  return { openPage, openJournalEntry };
};
