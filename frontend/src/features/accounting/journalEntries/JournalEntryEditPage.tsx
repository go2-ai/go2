import { useParams, useSearchParams } from 'react-router-dom';
import { JournalEntryEditor } from './JournalEntryEditor';

export const JournalEntryEditPage = () => {
  const { journalEntryId } = useParams<{ journalEntryId: string }>();
  const [searchParams] = useSearchParams();
  const parsedId = journalEntryId ? Number(journalEntryId) : undefined;

  const rawFocusItemId = searchParams.get('focus_item_id');
  const focusItemId = rawFocusItemId ? Number(rawFocusItemId) : undefined;

  return <JournalEntryEditor journalEntryId={parsedId} focusItemId={focusItemId} />;
};