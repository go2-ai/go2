// frontend/src/features/accounting/journalEntries/JournalEntryEditor.tsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Chip,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  TextField,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Badge,
  IconButton,
  Tooltip,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DraftsIcon from '@mui/icons-material/Drafts';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import HistoryIcon from '@mui/icons-material/History';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { useTranslation } from 'react-i18next';
import { JournalEntryGrid } from './components/JournalEntryGrid';
import { HotkeysDialog } from './components/HotkeysDialog';
import { JournalEntryEditorSkeleton } from './components/JournalEntryEditorSkeleton';
import { useTabLoading } from '../../../components/tabs/TabLoadingContext';
import { accountSelectionUpdates, allowedCenterTypeIds } from './utils/accountSelection';
import { AccountModal } from '../chartOfAccounts/components/AccountModal';
import { CenterModal } from '../centers/components/CenterModal';
import type { Account } from '../accounts/accountsApi';
import type { Center } from '../centers/centersApi';
import { JournalEntryFooter } from './components/JournalEntryFooter';
import type { JournalEntryRow } from './components/types';
import type { EditableGridApi } from '../../../components/editableGrid/types';
import type { ContextMenuAction } from '../../../components/editableGrid/RowContextMenu';
import {
  useCreateJournalEntryMutation,
  useUpdateJournalEntryMutation,
  useDeleteJournalEntryMutation,
  useGetJournalEntryQuery,
  type JournalEntry,
} from './journalEntriesApi';
import { useGetAccountsQuery } from '../accounts/accountsApi';
import { useGetCentersQuery } from '../centers/centersApi';
import { useGetCurrenciesQuery } from '../currencies/currenciesApi';
import { useGetAccountingSettingsQuery } from '../settings/settingsApi';
import { useActiveFiscalYear } from '../../../hooks/useActiveFiscalYear';
import { useTranslatableLocales } from '../../../hooks/useTranslatableLocales';
import {
  applyFieldChange,
  swapRate,
  type FinancialKey,
} from './utils/journalEntryCalculations';
import { copyRows, looksLikeRows, rowsFromClipboardText, type ClipboardContext } from './utils/clipboard';
import {
  closestCell,
  editableColumnKeys,
  focusCellWhenRendered,
  isTextEntry,
  rowColumnKeys,
} from './utils/gridNavigation';
import { useJournalEntryKeyboard } from './hooks/useJournalEntryKeyboard';
import { useRowsHistory } from './hooks/useRowsHistory';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/confirmContext';
import { BaseDatePicker } from '../../../components/shared/BaseDatePicker';
import MultiLocaleInput from '../../../components/shared/MultiLocaleInput';
import { useGetDocumentsQuery } from '../../documents/documentsApi';
import { useTabManager, useCurrentTabId } from '../../../components/tabs';
import { ReportSplitButton } from '../../reports/components/ReportSplitButton';

const FINANCIAL_KEYS: readonly string[] = ['debit', 'credit', 'rate', 'currencyAmount'];
const EPSILON = 0.000001;

const newRowId = () => `row-${Date.now()}-${Math.random()}`;

const createEmptyRow = (rowNumber: number, defaultCurrencyId: number | null): JournalEntryRow => ({
  id: newRowId(),
  row: rowNumber,
  accountId: null,
  center1Id: null,
  center2Id: null,
  center3Id: null,
  center4Id: null,
  center5Id: null,
  center6Id: null,
  debit: null,
  credit: null,
  currencyId: defaultCurrencyId,
  rate: null,
  currencyAmount: null,
  description: {},
  errors: {},
  financialEditOrder: [],
});

const renumber = (rows: JournalEntryRow[]) =>
  rows.map((r, i) => (r.row === i + 1 ? r : { ...r, row: i + 1 }));

const CENTER_KEYS = [1, 2, 3, 4, 5, 6].map(i => `center${i}Id` as const);

const rowHasData = (row: JournalEntryRow) =>
  !!row.accountId
  || CENTER_KEYS.some(k => !!row[k])
  || !!row.debit || !!row.credit || !!row.rate || !!row.currencyAmount
  || Object.values(row.description ?? {}).some(v => !!v?.trim());

/** Content of the entry that matters for "unsaved changes". */
const entrySignature = (
  no: string,
  date: string | null,
  description: Record<string, string>,
  rows: JournalEntryRow[],
) => JSON.stringify({
  no,
  date,
  description,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rows: rows.map(({ id, serverId, errors, financialEditOrder, ...data }) => data),
});

const roundTo = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const hasTextSelection = (el: Element | null) => {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    try {
      return el.selectionStart !== el.selectionEnd;
    } catch {
      return false;
    }
  }
  return !!window.getSelection()?.toString();
};

const apiErrorMessage = (err: unknown): string | undefined =>
  (err as { data?: { errors?: string[] } } | undefined)?.data?.errors?.[0];

interface JournalEntryEditorProps {
  journalEntryId?: number;
  focusItemId?: number;
}

export const JournalEntryEditor = ({ journalEntryId, focusItemId }: JournalEntryEditorProps) => {
  const { t } = useTranslation('shared');
  const { t: tJE } = useTranslation('accounting');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  // Clipboard actions are local (nothing is saved), so they use neutral info toasts.
  const { showSuccess, showError, showInfo } = useToast();
  const confirm = useConfirm();

  const { activeFiscalYearId, activeFiscalYear } = useActiveFiscalYear(orgId);
  const { primaryLocale, allLocales } = useTranslatableLocales({ organizationId: orgId });

  // Translated fields are sent only for the organization's locales; the
  // server rejects others (and logged every rejected field, slowing saves).
  const descriptionFields = (value: Record<string, string>) => {
    const locales = allLocales.length > 0 ? allLocales : [primaryLocale];
    return Object.fromEntries(locales.map(locale => [`description_${locale}`, value[locale] || ''])) as
      Record<`description_${string}`, string>;
  };

  const { data: accounts } = useGetAccountsQuery(orgId, { skip: !orgId });
  const { data: centers } = useGetCentersQuery({ organizationId: orgId }, { skip: !orgId });
  const { data: currencies } = useGetCurrenciesQuery(orgId, { skip: !orgId });
  const { data: settings } = useGetAccountingSettingsQuery(orgId, { skip: !orgId });

  const {
    data: fetchedJournalEntry,
    isLoading: isLoadingJournalEntry,
    isFetching: isFetchingJournalEntry,
    error: journalEntryFetchError,
  } = useGetJournalEntryQuery(
    { organizationId: orgId, id: journalEntryId! },
    { skip: !journalEntryId }
  );

  // Show the page shell until everything the grid needs has arrived, and
  // mark the tab as loading (also while the entry is refetched).
  const isInitialLoading = (!!journalEntryId && isLoadingJournalEntry)
    || !accounts || !centers || !currencies || !settings;
  useTabLoading(isInitialLoading || (!!journalEntryId && isFetchingJournalEntry));

  const [createJournalEntry] = useCreateJournalEntryMutation();
  const [updateJournalEntry] = useUpdateJournalEntryMutation();
  const [deleteJournalEntry] = useDeleteJournalEntryMutation();

  const { rows, setRows, undo, redo, reset: resetRows, setRowsSilently } = useRowsHistory<JournalEntryRow>();
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [no, setNo] = useState<string>('');
  const [ref, setRef] = useState<string>('');
  const [date, setDate] = useState<string | null>(null);
  const [description, setDescription] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<number | null>(journalEntryId ?? null);
  const [editingState, setEditingState] = useState<'draft' | 'booked' | 'approved' | null>(null);
  const { openTab, closeTab, layout, updateTabTitle } = useTabManager();
  const tabId = useCurrentTabId();
  const navigate = useNavigate();

  // Which save is running (shown as a spinner in that button), or null
  const [savingKind, setSavingKind] = useState<'draft' | 'booked' | null>(null);
  const saving = savingKind !== null;
  // Guards against a second save starting before the first re-render
  const savingRef = useRef(false);
  const [blinkingCells, setBlinkingCells] = useState<Set<string>>(new Set());
  const [originalItemIds, setOriginalItemIds] = useState<Set<number>>(new Set());
  // Fiscal year and date as currently stored on the server. Used to make sure an
  // update never touches an entry outside the active fiscal year.
  const [persisted, setPersisted] = useState<{ fiscalYearId: number; date: string } | null>(null);

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [hotkeysOpen, setHotkeysOpen] = useState(false);

  // "Add account" / "Add center" opened from a grid dropdown with no matches.
  // After creation the new record is selected in the row that requested it.
  type QuickAdd =
    | { kind: 'account'; rowId: string; text: string }
    | { kind: 'center'; rowId: string; level: number; centerTypeIds: number[]; text: string };
  const [quickAdd, setQuickAdd] = useState<QuickAdd | null>(null);

  // Root element: keyboard and clipboard listeners are scoped to it.
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const gridApiRef = useRef<EditableGridApi | null>(null);

  // Latest values for event handlers that are registered once.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const selectedRowIdRef = useRef(selectedRowId);
  selectedRowIdRef.current = selectedRowId;
  const selectedCellKeyRef = useRef(selectedCellKey);
  selectedCellKeyRef.current = selectedCellKey;
  const selectedRowIdsRef = useRef(selectedRowIds);
  selectedRowIdsRef.current = selectedRowIds;
  const selectionAnchorIdRef = useRef(selectionAnchorId);
  selectionAnchorIdRef.current = selectionAnchorId;

  // Signature of the entry as last loaded/saved (null = new, never saved).
  const savedSignatureRef = useRef<string | null>(null);

  const { data: documents } = useGetDocumentsQuery(
    {
      organizationId: orgId,
      documentableType: 'Accounting::JournalEntry',
      documentableId: editingId || 0,
    },
    { skip: !editingId }
  );

  const mainCurrencyId = settings?.main_currency_id ?? null;
  const mainCurrency = useMemo(
    () => currencies?.find(c => c.id === mainCurrencyId) ?? null,
    [currencies, mainCurrencyId]
  );
  const mainCurrencyDecimalDigits = mainCurrency?.decimal_digits ?? 2;
  const centerLevels = settings?.center_levels ?? 3;

  useEffect(() => {
    if (rows.length === 0 && mainCurrencyId && !journalEntryId) {
      resetRows([createEmptyRow(1, mainCurrencyId)]);
    }
    // only when settings arrive for a new entry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainCurrencyId]);

  // Tab title shows the reference once the entry has one (open and after save)
  useEffect(() => {
    if (tabId && ref) updateTabTitle(tabId, tJE('journalEntryTabTitle', { ref }));
  }, [tabId, ref, tJE, updateTabTitle]);

  // Set while this editor saves the entry it has loaded: the save puts the
  // response into the query cache, which must not reload the grid (the rows
  // are already up to date, and reloading would reset undo history).
  const skipNextLoadRef = useRef(false);

  useEffect(() => {
    if (!fetchedJournalEntry) return;
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }

    const entryNo = fetchedJournalEntry.no != null ? String(fetchedJournalEntry.no) : '';
    const entryDescription: Record<string, string> = { ...(fetchedJournalEntry.t?.description ?? {}) };

    setEditingId(fetchedJournalEntry.id);
    setEditingState(fetchedJournalEntry.state);
    setPersisted({ fiscalYearId: fetchedJournalEntry.fiscal_year_id, date: fetchedJournalEntry.date });
    setNo(entryNo);
    setRef(fetchedJournalEntry.ref != null ? String(fetchedJournalEntry.ref) : '');
    setDate(fetchedJournalEntry.date);
    setDescription(entryDescription);

    const serverIds = (fetchedJournalEntry.items ?? [])
      .map(item => item.id)
      .filter((id): id is number => id != null);

    setOriginalItemIds(new Set(serverIds));

    const sortedItems = [...(fetchedJournalEntry.items ?? [])].sort((a, b) => a.row - b.row);
    const mappedRows: JournalEntryRow[] = sortedItems.map((item) => ({
      id: `row-${Date.now()}-${Math.random()}-${item.row}`,
      serverId: item.id,
      row: item.row,
      accountId: item.account_id,
      center1Id: item.center1_id,
      center2Id: item.center2_id,
      center3Id: item.center3_id,
      center4Id: item.center4_id,
      center5Id: item.center5_id,
      center6Id: item.center6_id,
      debit: item.debit ? item.debit : null,
      credit: item.credit ? item.credit : null,
      currencyId: item.currency_id,
      rate: item.rate ?? null,
      currencyAmount: item.currency_amount != null ? Math.abs(item.currency_amount) : null,
      description: { ...(item.t?.description ?? {}) },
      errors: {},
      financialEditOrder: [],
    }));

    resetRows(mappedRows);
    savedSignatureRef.current = entrySignature(entryNo, fetchedJournalEntry.date, entryDescription, mappedRows);

    // Select the focused item (when opened from JournalEntryItemsPage)
    if (focusItemId) {
      const targetRow = mappedRows.find(r => r.serverId === focusItemId);
      if (targetRow) {
        setSelectedRowId(targetRow.id);
        setSelectedCellKey('account');
        setSelectedRowIds(new Set([targetRow.id]));
        setSelectionAnchorId(targetRow.id);
      }
    }
  }, [fetchedJournalEntry, focusItemId, resetRows]);

  const triggerBlink = useCallback((rowId: string, ...keys: string[]) => {
    const cellIds = keys.map(key => `${rowId}-${key}`);
    setBlinkingCells(prev => {
      const next = new Set(prev);
      cellIds.forEach(id => next.add(id));
      return next;
    });
    setTimeout(() => {
      setBlinkingCells(prev => {
        const next = new Set(prev);
        cellIds.forEach(id => next.delete(id));
        return next;
      });
    }, 1500);
  }, []);

  // ── Row updates (all functional, so they always see the latest rows) ──

  const handleRowsChange = useCallback((newRows: JournalEntryRow[]) => {
    setRows(newRows);
  }, [setRows]);

  const handleRowUpdate = useCallback((rowId: string, update: (row: JournalEntryRow) => Partial<JournalEntryRow>) => {
    setRows(prev => {
      const index = prev.findIndex(r => r.id === rowId);
      if (index === -1) return prev;
      const row = prev[index];
      const patch = update(row);
      const changed = (Object.keys(patch) as Array<keyof JournalEntryRow>)
        .some(key => !Object.is(row[key], patch[key]));
      if (!changed) return prev;
      const next = [...prev];
      next[index] = { ...row, ...patch };
      return next;
    });
  }, [setRows]);

  const handleCellChange = useCallback((rowId: string, key: string, value: unknown) => {
    handleRowUpdate(rowId, (row) => {
      if (FINANCIAL_KEYS.includes(key)) {
        return applyFieldChange(row, key as FinancialKey, value as number | null);
      }
      return { [key]: value } as Partial<JournalEntryRow>;
    });
  }, [handleRowUpdate]);

  // ── Selection ─────────────────────────────────────────────────────────

  const handleRowSelect = useCallback((rowId: string, cellKey: string, event?: React.MouseEvent) => {
    const isCtrl = !!(event && (event.ctrlKey || event.metaKey));
    setSelectedRowIds(prev => {
      if (isCtrl) {
        const next = new Set(prev);
        if (next.has(rowId)) next.delete(rowId); else next.add(rowId);
        return next;
      }
      return new Set([rowId]);
    });
    setSelectionAnchorId(rowId);
    setSelectedRowId(rowId);
    setSelectedCellKey(cellKey);
  }, []);

  // Row number pressed: select rows without activating (editing) a cell,
  // since this is for row actions like copy, delete or duplicate.
  // Shift extends from the anchor row, Ctrl/Cmd toggles.
  const handleRowHeaderMouseDown = useCallback((rowId: string, event: React.MouseEvent) => {
    const list = rowsRef.current;
    if (event.shiftKey) {
      const anchorId = selectionAnchorIdRef.current ?? selectedRowIdRef.current ?? rowId;
      const anchorIndex = list.findIndex(r => r.id === anchorId);
      const index = list.findIndex(r => r.id === rowId);
      if (anchorIndex !== -1 && index !== -1) {
        const [from, to] = [Math.min(anchorIndex, index), Math.max(anchorIndex, index)];
        setSelectedRowIds(new Set(list.slice(from, to + 1).map(r => r.id)));
      }
    } else if (event.ctrlKey || event.metaKey) {
      setSelectedRowIds(prev => {
        const next = new Set(prev);
        if (next.has(rowId)) next.delete(rowId); else next.add(rowId);
        return next;
      });
      setSelectionAnchorId(rowId);
    } else {
      setSelectedRowIds(new Set([rowId]));
      setSelectionAnchorId(rowId);
    }
    setSelectedRowId(rowId);
    setSelectedCellKey(null);
  }, []);

  const handleSelectAll = useCallback(() => {
    const list = rowsRef.current;
    if (list.length === 0) return;
    setSelectedRowIds(new Set(list.map(r => r.id)));
    setSelectionAnchorId(list[0].id);
    setSelectedRowId(list[0].id);
    setSelectedCellKey(null);
  }, []);

  const handleActiveCellChange = useCallback((rowId: string, cellKey: string) => {
    setSelectedRowId(rowId);
    setSelectedCellKey(cellKey);
  }, []);

  const selectSingleRow = useCallback((rowId: string, cellKey: string) => {
    setSelectedRowIds(new Set([rowId]));
    setSelectionAnchorId(rowId);
    setSelectedRowId(rowId);
    setSelectedCellKey(cellKey);
  }, []);

  /** Selected row ids in grid order (falls back to the active row). */
  const selectedIdsInOrder = useCallback((): string[] => {
    const ids = selectedRowIdsRef.current.size > 0
      ? selectedRowIdsRef.current
      : new Set(selectedRowIdRef.current ? [selectedRowIdRef.current] : []);
    return rowsRef.current.filter(r => ids.has(r.id)).map(r => r.id);
  }, []);

  /** Row/column of the focused cell, or the active cell. */
  const currentPosition = useCallback((): { rowId: string; colKey: string } | null => {
    const cell = closestCell(document.activeElement);
    if (cell && rootEl?.contains(cell) && cell.dataset.rowId && cell.dataset.colKey) {
      return { rowId: cell.dataset.rowId, colKey: cell.dataset.colKey };
    }
    if (selectedRowIdRef.current && rowsRef.current.some(r => r.id === selectedRowIdRef.current)) {
      return { rowId: selectedRowIdRef.current, colKey: selectedCellKeyRef.current ?? 'account' };
    }
    return null;
  }, [rootEl]);

  /** Scrolls a row into view and focuses one of its cells once rendered. */
  const focusRowCell = useCallback((rowId: string, colKey: string) => {
    if (!rootEl) return;
    requestAnimationFrame(() => {
      const index = rowsRef.current.findIndex(r => r.id === rowId);
      if (index !== -1) gridApiRef.current?.scrollToRow(index);
      focusCellWhenRendered(rootEl, rowId, colKey);
    });
  }, [rootEl]);

  /** Scrolls a row into view and focuses the row itself (row mode). */
  const focusRow = useCallback((rowId: string) => {
    if (!rootEl) return;
    requestAnimationFrame(() => {
      const index = rowsRef.current.findIndex(r => r.id === rowId);
      if (index !== -1) gridApiRef.current?.scrollToRow(index);
      requestAnimationFrame(() => {
        const rowEl = rootEl.querySelector(`[data-grid-row="${CSS.escape(rowId)}"]`) as HTMLElement | null;
        rowEl?.focus({ preventScroll: true });
      });
    });
  }, [rootEl]);

  // ── Keyboard actions ──────────────────────────────────────────────────

  const moveVertical = useCallback((direction: 1 | -1, extendSelection: boolean) => {
    const list = rowsRef.current;
    const pos = currentPosition();
    if (!pos) {
      if (list.length > 0) {
        selectSingleRow(list[0].id, 'account');
        focusRowCell(list[0].id, 'account');
      }
      return;
    }
    const index = list.findIndex(r => r.id === pos.rowId);
    const target = list[index + direction];
    if (!target) return;

    // Rows were selected via the row numbers: move the selection, don't
    // start editing a cell.
    const rowMode = selectedCellKeyRef.current === null && !closestCell(document.activeElement);
    if (rowMode) {
      if (extendSelection) {
        const anchorId = selectionAnchorIdRef.current ?? pos.rowId;
        const anchorIndex = Math.max(0, list.findIndex(r => r.id === anchorId));
        const [from, to] = [Math.min(anchorIndex, index + direction), Math.max(anchorIndex, index + direction)];
        setSelectedRowIds(new Set(list.slice(from, to + 1).map(r => r.id)));
        setSelectionAnchorId(list[anchorIndex].id);
      } else {
        setSelectedRowIds(new Set([target.id]));
        setSelectionAnchorId(target.id);
      }
      setSelectedRowId(target.id);
      focusRow(target.id);
      return;
    }

    if (extendSelection) {
      const anchorId = selectionAnchorIdRef.current ?? pos.rowId;
      const anchorIndex = Math.max(0, list.findIndex(r => r.id === anchorId));
      const [from, to] = [Math.min(anchorIndex, index + direction), Math.max(anchorIndex, index + direction)];
      setSelectedRowIds(new Set(list.slice(from, to + 1).map(r => r.id)));
      setSelectionAnchorId(list[anchorIndex].id);
      setSelectedRowId(target.id);
      setSelectedCellKey(pos.colKey);
    } else {
      selectSingleRow(target.id, pos.colKey);
    }
    focusRowCell(target.id, pos.colKey);
  }, [currentPosition, focusRowCell, focusRow, selectSingleRow]);

  const moveHorizontal = useCallback((direction: 1 | -1) => {
    if (!rootEl) return;
    const pos = currentPosition();
    if (!pos) return;

    // Next editable cell in the same row
    const keys = rowColumnKeys(rootEl, pos.rowId);
    const editable = new Set(editableColumnKeys(rootEl, pos.rowId));
    let i = keys.indexOf(pos.colKey) + direction;
    while (i >= 0 && i < keys.length && !editable.has(keys[i])) i += direction;
    if (i >= 0 && i < keys.length) {
      setSelectedCellKey(keys[i]);
      focusRowCell(pos.rowId, keys[i]);
      return;
    }

    const list = rowsRef.current;
    const index = list.findIndex(r => r.id === pos.rowId);
    const nextIndex = index + direction;
    if (nextIndex < 0) return;

    if (nextIndex >= list.length) {
      // Enter on the last cell of the last row starts a new row
      const newRow = createEmptyRow(list.length + 1, mainCurrencyId);
      setRows(prev => renumber([...prev, newRow]));
      selectSingleRow(newRow.id, 'account');
      focusRowCell(newRow.id, 'account');
      return;
    }

    const target = list[nextIndex];
    const targetKeys = editableColumnKeys(rootEl, target.id);
    const colKey = direction > 0 ? 'account' : (targetKeys[targetKeys.length - 1] ?? 'account');
    selectSingleRow(target.id, colKey);
    focusRowCell(target.id, colKey);
  }, [rootEl, currentPosition, focusRowCell, selectSingleRow, setRows, mainCurrencyId]);

  const insertRow = useCallback(() => {
    const ids = selectedIdsInOrder();
    const lastId = ids[ids.length - 1];
    const newRow = createEmptyRow(0, mainCurrencyId);
    setRows(prev => {
      const index = lastId ? prev.findIndex(r => r.id === lastId) : -1;
      const next = [...prev];
      next.splice(index === -1 ? prev.length : index + 1, 0, newRow);
      return renumber(next);
    });
    selectSingleRow(newRow.id, 'account');
    focusRowCell(newRow.id, 'account');
  }, [selectedIdsInOrder, mainCurrencyId, setRows, selectSingleRow, focusRowCell]);

  // "Add row" button below the grid: always appends
  const appendRow = useCallback(() => {
    const newRow = createEmptyRow(0, mainCurrencyId);
    setRows(prev => renumber([...prev, newRow]));
    selectSingleRow(newRow.id, 'account');
    focusRowCell(newRow.id, 'account');
  }, [mainCurrencyId, setRows, selectSingleRow, focusRowCell]);

  const duplicateRows = useCallback(() => {
    const ids = selectedIdsInOrder();
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const copies = rowsRef.current
      .filter(r => idSet.has(r.id))
      .map(r => ({
        ...r,
        id: newRowId(),
        serverId: undefined,
        description: { ...r.description },
        errors: {},
      }));
    setRows(prev => {
      const index = prev.findIndex(r => r.id === ids[ids.length - 1]);
      if (index === -1) return prev;
      const next = [...prev];
      next.splice(index + 1, 0, ...copies);
      return renumber(next);
    });
    setSelectedRowIds(new Set(copies.map(c => c.id)));
    setSelectionAnchorId(copies[0].id);
    setSelectedRowId(copies[0].id);
    focusRowCell(copies[0].id, selectedCellKeyRef.current ?? 'account');
  }, [selectedIdsInOrder, setRows, focusRowCell]);

  const deleteRows = useCallback(() => {
    const ids = selectedIdsInOrder();
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const list = rowsRef.current;
    const firstIndex = list.findIndex(r => idSet.has(r.id));
    const remaining = list.filter(r => !idSet.has(r.id));
    setRows(prev => renumber(prev.filter(r => !idSet.has(r.id))));

    const nextRow = remaining[Math.min(firstIndex, remaining.length - 1)];
    if (nextRow) {
      const colKey = selectedCellKeyRef.current ?? 'account';
      selectSingleRow(nextRow.id, colKey);
      focusRowCell(nextRow.id, colKey);
    } else {
      setSelectedRowIds(new Set());
      setSelectedRowId(null);
      rootEl?.focus();
    }
  }, [selectedIdsInOrder, setRows, selectSingleRow, focusRowCell, rootEl]);

  // F3: copy every value of the row above into the current row
  const copyRowAbove = useCallback(() => {
    const pos = currentPosition();
    if (!pos) return;
    setRows(prev => {
      const index = prev.findIndex(r => r.id === pos.rowId);
      if (index <= 0) return prev;
      const above = prev[index - 1];
      const next = [...prev];
      next[index] = {
        ...above,
        id: prev[index].id,
        serverId: prev[index].serverId,
        row: prev[index].row,
        description: { ...above.description },
        errors: {},
        financialEditOrder: [...(above.financialEditOrder ?? [])],
      };
      return next;
    });
    triggerBlink(pos.rowId, 'account', 'debit', 'credit');
  }, [currentPosition, setRows, triggerBlink]);

  // F4: copy the value of the cell above into the current cell
  const copyCellAbove = useCallback(() => {
    const pos = currentPosition();
    if (!pos) return;
    const list = rowsRef.current;
    const index = list.findIndex(r => r.id === pos.rowId);
    if (index <= 0) return;
    const above = list[index - 1];
    const { colKey } = pos;

    handleRowUpdate(pos.rowId, (row) => {
      if (colKey === 'account') {
        const account = accounts?.find(a => a.id === above.accountId);
        return accountSelectionUpdates(row, account, above.accountId, mainCurrencyId);
      }
      const centerMatch = /^center(\d)$/.exec(colKey);
      if (centerMatch) {
        const level = Number(centerMatch[1]);
        const key = `center${level}Id` as const;
        const centerId = above[key];
        const account = accounts?.find(a => a.id === row.accountId);
        const center = centers?.find(c => c.id === centerId);
        const allowed = allowedCenterTypeIds(account, level);
        if (centerId && (!center || !allowed.includes(center.center_type.id))) return {};
        return { [key]: centerId };
      }
      if (colKey === 'description') return { description: { ...above.description } };
      if (colKey === 'currency') {
        const account = accounts?.find(a => a.id === row.accountId);
        if (!account?.accepts_other_currencies) return {};
        return { currencyId: above.currencyId, rate: null, currencyAmount: null };
      }
      if (FINANCIAL_KEYS.includes(colKey)) {
        return applyFieldChange(row, colKey as FinancialKey, above[colKey as FinancialKey]);
      }
      return {};
    });
    triggerBlink(pos.rowId, colKey);
  }, [currentPosition, handleRowUpdate, accounts, centers, mainCurrencyId, triggerBlink]);

  // F8: set the current row's debit/credit so the entry balances
  const balance = useCallback(() => {
    const pos = currentPosition();
    if (!pos) return;
    setRows(prev => {
      const index = prev.findIndex(r => r.id === pos.rowId);
      if (index === -1) return prev;
      const others = prev.filter((_, i) => i !== index);
      const diff = others.reduce((sum, r) => sum + (r.debit ?? 0) - (r.credit ?? 0), 0);
      if (Math.abs(diff) < EPSILON) return prev;
      const key = diff > 0 ? 'credit' : 'debit';
      const next = [...prev];
      next[index] = applyFieldChange(prev[index], key, roundTo(Math.abs(diff), mainCurrencyDecimalDigits));
      return next;
    });
    triggerBlink(pos.rowId, 'debit', 'credit');
  }, [currentPosition, setRows, mainCurrencyDecimalDigits, triggerBlink]);

  // F9: replace the exchange rate with its reciprocal (e.g. 50000 ↔ 0.00002)
  const swapRateOfCurrentRow = useCallback(() => {
    const pos = currentPosition();
    if (!pos) return;
    handleRowUpdate(pos.rowId, (row) => {
      const inverted = swapRate(row.rate);
      if (inverted === null) return {};
      return applyFieldChange(row, 'rate', Number(inverted.toPrecision(12)));
    });
    triggerBlink(pos.rowId, 'rate', 'currencyAmount', 'debit', 'credit');
  }, [currentPosition, handleRowUpdate, triggerBlink]);

  // F10: swap debit and credit of the selected rows
  const swapDebitCredit = useCallback(() => {
    const ids = new Set(selectedIdsInOrder());
    if (ids.size === 0) return;
    setRows(prev => prev.map(row => (
      ids.has(row.id) && (row.debit || row.credit)
        ? { ...row, debit: row.credit, credit: row.debit }
        : row
    )));
    ids.forEach(id => triggerBlink(id, 'debit', 'credit'));
  }, [selectedIdsInOrder, setRows, triggerBlink]);

  // ── Quick add (account / center from a dropdown) ──────────────────────

  const handleAddAccount = useCallback((rowId: string, text: string) => {
    setQuickAdd({ kind: 'account', rowId, text });
  }, []);

  const handleAddCenter = useCallback((rowId: string, level: number, centerTypeIds: number[], text: string) => {
    setQuickAdd({ kind: 'center', rowId, level, centerTypeIds, text });
  }, []);

  const handleAccountCreated = useCallback((account: Account) => {
    if (quickAdd?.kind !== 'account') return;
    handleRowUpdate(quickAdd.rowId, (row) => accountSelectionUpdates(row, account, account.id, mainCurrencyId));
  }, [quickAdd, handleRowUpdate, mainCurrencyId]);

  const handleCenterCreated = useCallback((center: Center) => {
    if (quickAdd?.kind !== 'center') return;
    const { level } = quickAdd;
    handleRowUpdate(quickAdd.rowId, () => ({ [`center${level}Id`]: center.id } as Partial<JournalEntryRow>));
  }, [quickAdd, handleRowUpdate]);

  // ── Validation ────────────────────────────────────────────────────────

  const getRowError = useCallback((row: JournalEntryRow): string | null => {
    const errors: string[] = [];

    if (!row.accountId) {
      errors.push(tJE('accountRequired'));
    }

    const account = accounts?.find(a => a.id === row.accountId);
    if (account) {
      for (let i = 1; i <= centerLevels; i++) {
        const allowedTypes = account[`allowed_center_types_${i}` as keyof typeof account];
        if (allowedTypes && Array.isArray(allowedTypes) && allowedTypes.length > 0) {
          const centerId = row[`center${i}Id` as keyof JournalEntryRow] as number | null;
          if (!centerId) {
            errors.push(tJE('centerRequired', { level: i }));
          }
        }
      }
    }

    if (row.debit && row.credit) {
      errors.push(tJE('debitXorCredit'));
    }
    if (!row.debit && !row.credit) {
      errors.push(tJE('debitCreditRequired'));
    }

    const selectedCurrency = currencies?.find(c => c.id === row.currencyId);
    if (selectedCurrency && selectedCurrency.id !== mainCurrencyId) {
      if (!row.rate || row.rate <= 0) {
        errors.push(tJE('rateRequired'));
      }
    }

    if (row.rate && row.currencyAmount !== null) {
      const expected = Math.abs((row.debit ?? 0) - (row.credit ?? 0)) / row.rate;
      if (Math.abs(expected - row.currencyAmount) > 0.000001) {
        errors.push(tJE('currencyAmountMismatch'));
      }
    }

    return errors.length > 0 ? errors.join(', ') : null;
  }, [accounts, centerLevels, currencies, mainCurrencyId, tJE]);

  const totals = useMemo(() => {
    const totalDebit = rows.reduce((sum, r) => sum + (r.debit ?? 0), 0);
    const totalCredit = rows.reduce((sum, r) => sum + (r.credit ?? 0), 0);
    return {
      debit: totalDebit,
      credit: totalCredit,
      difference: totalDebit - totalCredit,
      balanced: Math.abs(totalDebit - totalCredit) < EPSILON,
    };
  }, [rows]);

  const firstSelectedRow = useMemo(() => {
    const firstId = selectedRowIds.size > 0 ? Array.from(selectedRowIds)[0] : selectedRowId;
    return rows.find(r => r.id === firstId) ?? null;
  }, [rows, selectedRowIds, selectedRowId]);

  // Reason why this entry cannot be written in the active fiscal year, or null.
  // Mirrors the server-side rules: an entry may only be created/updated inside
  // the active fiscal year, and on update both old and new dates must be in it.
  const fiscalYearError = useMemo<string | null>(() => {
    if (!activeFiscalYear) return tJE('activeFiscalYearRequired');

    const range = { start: activeFiscalYear.start_date, finish: activeFiscalYear.finish_date };
    const inRange = (d: string) => {
      const day = d.slice(0, 10);
      return day >= activeFiscalYear.start_date && day <= activeFiscalYear.finish_date;
    };

    if (persisted) {
      if (persisted.fiscalYearId !== activeFiscalYear.id) {
        return tJE('journalEntryNotInActiveFiscalYear');
      }
      if (!inRange(persisted.date)) {
        return tJE('journalEntryOriginalDateOutsideActiveFiscalYear', { date: persisted.date, ...range });
      }
    }

    if (date && !inRange(date)) {
      return tJE('journalEntryDateOutsideActiveFiscalYear', range);
    }

    return null;
  }, [activeFiscalYear, persisted, date, tJE]);

  // Why "Save" is not possible right now (null = it is).
  const saveBlockReason = useMemo<string | null>(() => {
    if (fiscalYearError) return fiscalYearError;
    if (rows.length === 0) return tJE('saveBlocked.noRows');
    if (!date) return tJE('saveBlocked.dateRequired');
    if (!totals.balanced) return tJE('saveBlocked.notBalanced');
    if (!rows.every(row => getRowError(row) === null)) return tJE('saveBlocked.rowErrors');
    return null;
  }, [fiscalYearError, rows, date, totals.balanced, getRowError, tJE]);

  const canSave = saveBlockReason === null;

  // ── Saving ────────────────────────────────────────────────────────────

  const buildPayload = (state: 'draft' | 'booked') => {
    if (!activeFiscalYearId) {
      throw new Error('No active fiscal year');
    }

    // Current server IDs from the grid
    const currentServerIds = new Set(
      rows
        .map(row => row.serverId)
        .filter((id): id is number => id != null)
    );

    // Deleted items = original IDs not in current rows
    const deletedItemIds = Array.from(originalItemIds).filter(
      id => !currentServerIds.has(id)
    );

    const itemsAttributes = [
      ...rows.map((row) => {
        const isMainCurrency = row.currencyId === mainCurrencyId;
        return {
          ...(row.serverId != null ? { id: row.serverId } : {}),
          row: row.row,
          account_id: row.accountId ?? undefined,
          center1_id: row.center1Id ?? undefined,
          center2_id: row.center2Id ?? undefined,
          center3_id: row.center3Id ?? undefined,
          center4_id: row.center4Id ?? undefined,
          center5_id: row.center5Id ?? undefined,
          center6_id: row.center6Id ?? undefined,
          debit: row.debit ?? 0,
          credit: row.credit ?? 0,
          currency_id: row.currencyId ?? undefined,
          rate: isMainCurrency ? null : (row.rate ?? null),
          currency_amount: isMainCurrency ? null : (row.credit ? -Math.abs(row.currencyAmount ?? 0) : Math.abs(row.currencyAmount ?? 0)),
          ...descriptionFields(row.description),
        };
      }),
      // Mark deleted items
      ...deletedItemIds.map(id => ({
        id,
        _destroy: true,
      })),
    ];

    return {
      active_fiscal_year_id: activeFiscalYearId,
      date: date ?? '',
      effective_date: date ?? '',
      fiscal_year_id: activeFiscalYearId,
      state,
      entry_type: 'normal' as const,
      no: no || undefined,
      ...descriptionFields(description),
      items_attributes: itemsAttributes,
    };
  };

  // Create or update the entry and remember what is now stored on the server.
  const persistJournalEntry = async (state: 'draft' | 'booked') => {
    const payload = buildPayload(state);
    const savedRows = rows;
    // Only the entry this editor loaded has a cache entry it is subscribed to
    skipNextLoadRef.current = !!editingId && editingId === journalEntryId;
    let result: JournalEntry;
    try {
      result = editingId
        ? await updateJournalEntry({ organizationId: orgId, id: editingId, data: payload }).unwrap()
        : await createJournalEntry({ organizationId: orgId, data: payload }).unwrap();
    } catch (err) {
      skipNextLoadRef.current = false;
      throw err;
    }
    setEditingId(result.id);
    setPersisted({ fiscalYearId: result.fiscal_year_id, date: result.date });
    // Show the numbers the server assigned (or kept)
    const savedNo = result.no != null ? String(result.no) : '';
    setNo(savedNo);
    setRef(result.ref != null ? String(result.ref) : '');

    // Link grid rows to the saved items, so the next save updates them
    // instead of creating duplicates. Items are matched by row number.
    const itemIdByRow = new Map((result.items ?? []).map(item => [item.row, item.id]));
    setOriginalItemIds(new Set((result.items ?? []).map(item => item.id)));
    setRowsSilently(prev => {
      let changed = false;
      const next = prev.map(row => {
        const serverId = itemIdByRow.get(row.row);
        if (serverId === undefined || serverId === row.serverId) return row;
        changed = true;
        return { ...row, serverId };
      });
      return changed ? next : prev;
    });

    savedSignatureRef.current = entrySignature(savedNo, date, description, savedRows);
  };

  const handleSaveAsDraft = async () => {
    if (fiscalYearError) {
      showError(fiscalYearError);
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSavingKind('draft');
    try {
      await persistJournalEntry('draft');
      setEditingState('draft');
      showSuccess(tJE('journalEntrySavedAsDraft'));
    } catch (err) {
      showError(apiErrorMessage(err) || tJE('journalEntrySaveFailed'));
    } finally {
      savingRef.current = false;
      setSavingKind(null);
    }
  };

  const handleSave = async () => {
    if (!canSave || savingRef.current) return;
    savingRef.current = true;
    setSavingKind('booked');
    try {
      await persistJournalEntry('booked');
      setEditingState('booked');
      showSuccess(tJE('journalEntrySaved'));
    } catch (err) {
      showError(apiErrorMessage(err) || tJE('journalEntrySaveFailed'));
    } finally {
      savingRef.current = false;
      setSavingKind(null);
    }
  };

  // Ctrl+S / Ctrl+Alt+S: commit the focused cell first (cells commit on
  // blur), then save with the state of the next render.
  const saveRef = useRef({ handleSave, handleSaveAsDraft, saveBlockReason, saving });
  saveRef.current = { handleSave, handleSaveAsDraft, saveBlockReason, saving };

  const saveFromKeyboard = useCallback((draft: boolean) => {
    const focused = document.activeElement as HTMLElement | null;
    focused?.blur();
    setTimeout(() => {
      const current = saveRef.current;
      if (!current.saving) {
        if (draft) {
          current.handleSaveAsDraft();
        } else if (current.saveBlockReason) {
          showError(current.saveBlockReason);
        } else {
          current.handleSave();
        }
      }
      if (focused?.isConnected) focused.focus();
    }, 0);
  }, [showError]);

  // ── Unsaved changes ───────────────────────────────────────────────────

  const unsavedRef = useRef<() => boolean>(() => false);
  unsavedRef.current = () => {
    if (savedSignatureRef.current !== null) {
      return entrySignature(no, date, description, rows) !== savedSignatureRef.current;
    }
    return rows.some(rowHasData) || !!no || !!date || Object.values(description).some(v => !!v?.trim());
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!unsavedRef.current()) return;
      e.preventDefault();
      // Required by some browsers to show the confirmation
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ── Clipboard ─────────────────────────────────────────────────────────

  const clipboardContext = useCallback((): ClipboardContext | null => {
    if (!accounts || !centers || !currencies) return null;
    return {
      organizationId: orgId,
      accounts,
      centers,
      currencies,
      centerLevels,
      mainCurrencyId,
      primaryLocale,
    };
  }, [accounts, centers, currencies, centerLevels, mainCurrencyId, orgId, primaryLocale]);

  const copySelectedRowsText = useCallback((): { text: string; count: number } | null => {
    const ctx = clipboardContext();
    const ids = new Set(selectedIdsInOrder());
    if (!ctx || ids.size === 0) return null;
    const selected = rowsRef.current.filter(r => ids.has(r.id));
    return { text: copyRows(selected, ctx), count: selected.length };
  }, [clipboardContext, selectedIdsInOrder]);

  const pasteRowsText = useCallback((text: string) => {
    const ctx = clipboardContext();
    if (!ctx) return;
    const { rows: pasted, unmatched } = rowsFromClipboardText(text, ctx);
    if (pasted.length === 0) return;

    const ids = selectedIdsInOrder();
    const anchorId = ids[ids.length - 1];
    const anchor = rowsRef.current.find(r => r.id === anchorId);
    // Pasting onto an empty row (e.g. the first row of a new entry) fills it
    const replaceAnchor = !!anchor && !rowHasData(anchor);
    const newRows: JournalEntryRow[] = pasted.map(data => ({ ...data, id: newRowId(), row: 0 }));

    setRows(prev => {
      const index = anchorId ? prev.findIndex(r => r.id === anchorId) : -1;
      const next = [...prev];
      if (index === -1) next.push(...newRows);
      else next.splice(replaceAnchor ? index : index + 1, replaceAnchor ? 1 : 0, ...newRows);
      return renumber(next);
    });

    setSelectedRowIds(new Set(newRows.map(r => r.id)));
    setSelectionAnchorId(newRows[0].id);
    setSelectedRowId(newRows[0].id);
    setSelectedCellKey('account');
    focusRowCell(newRows[0].id, 'account');

    showInfo(tJE('rowsPasted', { count: newRows.length }));
    if (unmatched > 0) showError(tJE('pasteUnmatched', { count: unmatched }));
  }, [clipboardContext, selectedIdsInOrder, setRows, focusRowCell, showInfo, showError, tJE]);

  useEffect(() => {
    if (!rootEl) return;

    // Listening on the document (not the root): with no text selected the
    // browser may dispatch copy/paste to <body>. Only the editor that holds
    // the focus reacts (other journal entry tabs stay mounted but hidden).
    const ownsFocus = () => rootEl.contains(document.activeElement);

    const handleCopy = (e: ClipboardEvent) => {
      if (!ownsFocus()) return;
      const active = document.activeElement;
      const inCell = !!closestCell(active);
      const typing = isTextEntry(active);
      if (typing && !inCell) return;                       // header field: native copy
      const multipleRows = selectedRowIdsRef.current.size > 1;
      if (!multipleRows && typing && hasTextSelection(active)) return; // copy the selected text
      const copied = copySelectedRowsText();
      if (!copied || !e.clipboardData) return;
      e.clipboardData.setData('text/plain', copied.text);
      e.preventDefault();
      showInfo(tJE('rowsCopied', { count: copied.count }));
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (!ownsFocus()) return;
      const active = document.activeElement;
      const inCell = !!closestCell(active);
      const typing = isTextEntry(active);
      if (typing && !inCell) return;                       // header field: native paste
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (!text.trim()) return;
      // Plain text pasted into a cell stays a normal paste
      if (inCell && typing && !looksLikeRows(text)) return;
      e.preventDefault();
      pasteRowsText(text);
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  }, [rootEl, copySelectedRowsText, pasteRowsText, showSuccess, tJE]);

  const copyRowsFromMenu = useCallback(async () => {
    const copied = copySelectedRowsText();
    if (!copied) return;
    try {
      await navigator.clipboard.writeText(copied.text);
      showInfo(tJE('rowsCopied', { count: copied.count }));
    } catch {
      showError(tJE('clipboardUnavailable'));
    }
  }, [copySelectedRowsText, showSuccess, showError, tJE]);

  const contextMenuActions = useCallback((row: JournalEntryRow): ContextMenuAction[] => {
    const ids = selectedRowIdsRef.current;
    const count = ids.size > 1 && ids.has(row.id) ? ids.size : 1;
    return [
      { label: tJE('rowActions.insert'), shortcut: 'Insert', onClick: insertRow },
      { label: tJE('rowActions.duplicate', { count }), shortcut: 'F6', onClick: duplicateRows },
      { label: tJE('rowActions.copy', { count }), shortcut: 'Ctrl+C', onClick: copyRowsFromMenu },
      { label: tJE('rowActions.delete', { count }), shortcut: 'Delete', onClick: deleteRows },
    ];
  }, [tJE, insertRow, duplicateRows, copyRowsFromMenu, deleteRows]);

  // ── Hotkeys ───────────────────────────────────────────────────────────

  const handleUndo = useCallback(() => { undo(); }, [undo]);
  const handleRedo = useCallback(() => { redo(); }, [redo]);

  useJournalEntryKeyboard(rootEl, {
    copyCellAbove,
    copyRowAbove,
    duplicateRows,
    balance,
    swapRate: swapRateOfCurrentRow,
    swapDebitCredit,
    insertRow,
    deleteRows,
    undo: handleUndo,
    redo: handleRedo,
    save: () => saveFromKeyboard(false),
    saveDraft: () => saveFromKeyboard(true),
    openHelp: () => setHotkeysOpen(true),
    moveVertical,
    moveHorizontal,
  });

  // ── Delete the journal entry ──────────────────────────────────────────

  const isApproved = editingState === 'approved';
  const canDeleteEntry = !!editingId && !isApproved && !fiscalYearError;

  const closeAndGoToList = () => {
    const listPath = `/app/organizations/${orgId}/accounting/journal-entries`;
    const panel = tabId ? layout.panels.find(p => p.tabs.some(tab => tab.id === tabId)) : undefined;
    openTab('journal-entries', t('menu.journalEntries'), listPath);
    navigate(listPath);
    if (panel && tabId) closeTab(tabId, panel.id);
  };

  const handleDeleteEntry = async () => {
    setMenuAnchor(null);
    if (!editingId || !activeFiscalYearId) return;

    const confirmed = await confirm({
      title: tJE('deleteJournalEntryTitle'),
      message: tJE('deleteJournalEntryMessage', { ref: ref || editingId }),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });
    if (!confirmed) return;

    try {
      await deleteJournalEntry({ organizationId: orgId, id: editingId, activeFiscalYearId }).unwrap();
      // Nothing left to lose; don't warn about unsaved changes.
      unsavedRef.current = () => false;
      showSuccess(tJE('journalEntryDeleted'));
      closeAndGoToList();
    } catch (err) {
      showError(apiErrorMessage(err) || tJE('journalEntryDeleteFailed'));
    }
  };

  const handleOpenChangeLog = () => {
    setMenuAnchor(null);
    if (!editingId) return;
    const path = `/app/organizations/${orgId}/record-history?type=Accounting::JournalEntry&id=${editingId}`;
    openTab('record-history', `${t('changeLog')}: ${tJE('journalEntry')} #${ref || editingId}`, path);
    navigate(path);
  };

  const handleOpenAttachments = () => {
    if (!editingId) return;
    const path = `/app/organizations/${orgId}/documents?type=Accounting::JournalEntry&id=${editingId}`;
    openTab('documents', tJE('attachmentsTabTitle', { ref: ref || editingId }), path);
    navigate(path);
  };

  if (journalEntryId && journalEntryFetchError) {
    return (
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Alert severity="error">
          {tJE('failedToLoadJournalEntry')}
        </Alert>
      </Container>
    );
  }

  if (isInitialLoading || !accounts || !centers || !currencies || !settings) {
    return <JournalEntryEditorSkeleton />;
  }

  return (
    <Container
      ref={setRootEl}
      // Focusable so clicks on non-input areas keep keyboard focus (and
      // therefore the hotkeys) inside this editor.
      tabIndex={-1}
      maxWidth={false}
      sx={{
        height: '100dvh',
        maxHeight: 'calc(100dvh - 100px)',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        py: 1,
        mx: 0,
        overflow: 'hidden',
        outline: 'none',
      }}
    >
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="h4" sx={{ mb: 0 }}>
                {tJE('journalEntry')}
              </Typography>

              {editingId && (
                <>
                  <Tooltip title="Attachments">
                    <IconButton onClick={handleOpenAttachments} size="small">
                      <Badge badgeContent={documents?.length || 0} color="primary">
                        <AttachFileIcon fontSize="small" />
                      </Badge>
                    </IconButton>
                  </Tooltip>
                  <ReportSplitButton
                    reportKey="journal_entry"
                    recordId={editingId}
                    reportTitle={tJE('journalEntryTabTitle', { ref: ref || editingId })}
                  />
                </>
              )}
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title={`${tJE('saveAsDraft')} (Ctrl+Alt+S)`}>
            <span>
              <Button
                variant="outlined"
                startIcon={savingKind === 'draft' ? <CircularProgress size={16} color="inherit" /> : <DraftsIcon />}
                onClick={handleSaveAsDraft}
                disabled={saving || !!fiscalYearError}
                aria-busy={savingKind === 'draft' || undefined}
              >
                {tJE('saveAsDraft')}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={saveBlockReason ?? `${tJE('saveJournalEntry')} (Ctrl+S)`}>
            <span>
              <Button
                variant="contained"
                startIcon={savingKind === 'booked' ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                onClick={handleSave}
                disabled={!canSave || saving}
                aria-busy={savingKind === 'booked' || undefined}
              >
                {tJE('saveJournalEntry')}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={tJE('moreActions')}>
            <IconButton
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              aria-label={tJE('moreActions')}
              aria-haspopup="menu"
              aria-expanded={!!menuAnchor}
            >
              <MoreVertIcon />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={menuAnchor}
            open={!!menuAnchor}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={() => { setMenuAnchor(null); setHotkeysOpen(true); }}>
              <ListItemIcon><KeyboardIcon fontSize="small" /></ListItemIcon>
              <ListItemText>{tJE('hotkeys.title')}</ListItemText>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontFamily: 'monospace' }}>
                Ctrl+/
              </Typography>
            </MenuItem>
            <MenuItem onClick={handleOpenChangeLog} disabled={!editingId}>
              <ListItemIcon><HistoryIcon fontSize="small" /></ListItemIcon>
              <ListItemText
                primary={t('changeLog')}
                secondary={!editingId ? tJE('deleteNotSavedYet') : undefined}
              />
            </MenuItem>
            <MenuItem onClick={handleDeleteEntry} disabled={!canDeleteEntry} sx={{ color: 'error.main' }}>
              <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText
                primary={tJE('deleteJournalEntry')}
                secondary={isApproved ? tJE('unapproveBeforeDelete') : (!editingId ? tJE('deleteNotSavedYet') : undefined)}
              />
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {fiscalYearError && (
        <Alert severity="warning" sx={{ mb: 1, flexShrink: 0 }}>
          {fiscalYearError}
        </Alert>
      )}

      <Box sx={{ mb: 1, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <BaseDatePicker
          label={tJE('journalEntryDate')}
          value={date}
          onChange={setDate}
          required
        />

        <Box sx={{ flex: 1, minWidth: 250 }}>
          <MultiLocaleInput
            field={tJE('journalEntryDescription')}
            value={description}
            onChange={setDescription}
          />
        </Box>

        <TextField
          label={tJE('no')}
          value={no}
          onChange={(e) => setNo(e.target.value)}
          size="small"
          sx={{ width: 130 }}
        />

        {editingId && (
          // Assigned by the system; shown read-only next to the editable No
          <TextField
            label={tJE('ref')}
            value={ref || '—'}
            size="small"
            sx={{ width: 110, '& .MuiInputBase-root': { bgcolor: 'action.hover' } }}
            InputProps={{ readOnly: true }}
            inputProps={{ 'aria-readonly': true }}
          />
        )}

        {editingId && (
          <Chip
            label={editingState ? tJE(editingState) : tJE('draft')}
            color={editingState === 'approved' ? 'success' : editingState === 'booked' ? 'primary' : 'default'}
            size="small"
          />
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <JournalEntryGrid
          rows={rows}
          accounts={accounts}
          centers={centers}
          currencies={currencies}
          centerLevels={centerLevels}
          mainCurrencyId={mainCurrencyId}
          mainCurrencyDecimalDigits={mainCurrencyDecimalDigits}
          onChange={handleRowsChange}
          onRowUpdate={handleRowUpdate}
          onFieldChange={handleCellChange}
          getRowError={getRowError}
          onCellClick={handleRowSelect}
          onRowHeaderMouseDown={handleRowHeaderMouseDown}
          onSelectAll={handleSelectAll}
          selectAllLabel={tJE('selectAllRows')}
          onActiveCellChange={handleActiveCellChange}
          blinkingCells={blinkingCells}
          organizationId={orgId}
          selectedRowId={selectedRowId}
          selectedCellKey={selectedCellKey}
          selectedRowIds={selectedRowIds}
          onAddRow={appendRow}
          onAddAccount={handleAddAccount}
          onAddCenter={handleAddCenter}
          contextMenuActions={contextMenuActions}
          apiRef={gridApiRef}
          footer={
            <JournalEntryFooter
              row={firstSelectedRow}
              accounts={accounts}
              centers={centers}
              centerLevels={centerLevels}
              totals={totals}
            />
          }
        />
      </Box>
      <AccountModal
        open={quickAdd?.kind === 'account'}
        onClose={() => setQuickAdd(null)}
        organizationId={orgId}
        initialCode={quickAdd?.kind === 'account' && /^[0-9]+$/.test(quickAdd.text) ? quickAdd.text : undefined}
        initialName={quickAdd?.kind === 'account' && !/^[0-9]+$/.test(quickAdd.text) ? quickAdd.text : undefined}
        onCreated={handleAccountCreated}
      />
      <CenterModal
        open={quickAdd?.kind === 'center'}
        onClose={() => setQuickAdd(null)}
        organizationId={orgId}
        allowedCenterTypeIds={quickAdd?.kind === 'center' ? quickAdd.centerTypeIds : undefined}
        initialText={quickAdd?.kind === 'center' ? quickAdd.text : undefined}
        onCreated={handleCenterCreated}
      />
      <HotkeysDialog
        open={hotkeysOpen}
        onClose={() => setHotkeysOpen(false)}
        centerLevels={centerLevels}
      />
    </Container>
  );
};
