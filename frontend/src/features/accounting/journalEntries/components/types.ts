import type { GridRow } from '../../../../components/editableGrid/types';
import type { FinancialGroup } from '../utils/journalEntryCalculations';

export interface JournalEntryRow extends GridRow {
  id: string; // local grid id
  serverId?: number; // server-side journal_entry_item id (present when editing existing)
  row: number;
  accountId: number | null;
  center1Id: number | null;
  center2Id: number | null;
  center3Id: number | null;
  center4Id: number | null;
  center5Id: number | null;
  center6Id: number | null;
  debit: number | null;
  credit: number | null;
  currencyId: number | null;
  rate: number | null;
  currencyAmount: number | null;
  description: Record<string, string>;
  errors: RowErrors;
  financialEditOrder?: FinancialGroup[];
}

export interface RowErrors {
  account?: boolean;
  centers?: Record<number, boolean>;
  debitCredit?: boolean;
  rate?: boolean;
  currencyAmount?: boolean;
}