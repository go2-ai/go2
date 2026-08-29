import { useParams } from 'react-router-dom';
import { JournalEntryEditor } from './JournalEntryEditor';

export const JournalEntryEditPage = () => {
  const { journalEntryId } = useParams<{ journalEntryId: string }>();
  const parsedId = journalEntryId ? Number(journalEntryId) : undefined;

  return <JournalEntryEditor journalEntryId={parsedId} />;
};