// frontend/src/features/accounting/journalEntries/hooks/useJournalEntryKeyboard.ts
import { useEffect, useCallback, useRef } from 'react';
import type { JournalEntryRow } from '../components/types';

interface UseJournalEntryKeyboardProps {
  rows: JournalEntryRow[];
  selectedRowId: string | null;
  selectedCellKey: string | null;
  selectedRowIds: Set<string>;
  selectionAnchorId: string | null;
  onRowsChange: (rows: JournalEntryRow[]) => void;
  onCellChange: (rowId: string, key: string, value: any) => void;
  onSelectionChange: (ids: Set<string>, anchorId?: string | null) => void;
  // Updates which row/cell is "active" (focus ring, F-key target) WITHOUT
  // touching the multi-row selection set. Used by shift+arrow extension.
  onActiveCellChange: (rowId: string, cellKey: string) => void;
  onRowDuplicate: (rowId: string) => void;
  onRowAddAfter: (rowId: string) => void;
  onBalance: () => void;
  onSwapDebitCredit: (rowId: string) => void;
  onSwapRate: (rowId: string) => void;
}

export const useJournalEntryKeyboard = ({
  rows,
  selectedRowId,
  selectedCellKey,
  selectedRowIds,
  selectionAnchorId,
  onRowsChange,
  onCellChange,
  onSelectionChange,
  onActiveCellChange,
  onRowDuplicate,
  onRowAddAfter,
  onBalance,
  onSwapDebitCredit,
  onSwapRate,
}: UseJournalEntryKeyboardProps) => {
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

  // Internal clipboard for row copy/paste (Ctrl+C / Ctrl+V).
  const clipboardRef = useRef<JournalEntryRow[] | null>(null);

  const copyFromAboveCell = useCallback(() => {
    const rowId = selectedRowIdRef.current;
    const cellKey = selectedCellKeyRef.current;
    if (!rowId || !cellKey) return;

    const currentIndex = rowsRef.current.findIndex(r => r.id === rowId);
    if (currentIndex <= 0) return;

    const aboveRow = rowsRef.current[currentIndex - 1];
    const value = aboveRow[cellKey as keyof JournalEntryRow];
    onCellChange(rowId, cellKey, value);
  }, [onCellChange]);

  const copyFromAboveRow = useCallback(() => {
    const rowId = selectedRowIdRef.current;
    if (!rowId) return;

    const currentIndex = rowsRef.current.findIndex(r => r.id === rowId);
    if (currentIndex <= 0) return;

    const aboveRow = rowsRef.current[currentIndex - 1];

    onCellChange(rowId, 'accountId', aboveRow.accountId);
    for (let i = 1; i <= 6; i++) {
      onCellChange(rowId, `center${i}Id`, aboveRow[`center${i}Id` as keyof JournalEntryRow]);
    }
    onCellChange(rowId, 'description', { ...aboveRow.description });
    onCellChange(rowId, 'debit', aboveRow.debit);
    onCellChange(rowId, 'credit', aboveRow.credit);
    onCellChange(rowId, 'currencyId', aboveRow.currencyId);
    onCellChange(rowId, 'rate', aboveRow.rate);
  }, [onCellChange]);

  // Shift+ArrowUp / Shift+ArrowDown: extend the selection from the anchor
  // row toward the new active row, keeping every row between anchor and the
  // new active row selected (including the row the user was already on).
  const extendSelection = useCallback((direction: 1 | -1) => {
    const activeId = selectedRowIdRef.current;
    if (!activeId) return;

    const currentRows = rowsRef.current;
    const currentIndex = currentRows.findIndex(r => r.id === activeId);
    if (currentIndex === -1) return;

    const anchorId = selectionAnchorIdRef.current ?? activeId;
    const anchorIndex = currentRows.findIndex(r => r.id === anchorId);
    const resolvedAnchorIndex = anchorIndex === -1 ? currentIndex : anchorIndex;

    const newIndex = Math.min(Math.max(currentIndex + direction, 0), currentRows.length - 1);
    const [start, end] = resolvedAnchorIndex <= newIndex
      ? [resolvedAnchorIndex, newIndex]
      : [newIndex, resolvedAnchorIndex];

    const newSelection = new Set(currentRows.slice(start, end + 1).map(r => r.id));

    // Order matters: update the selection set first, then move the active
    // cell WITHOUT resetting the selection (onActiveCellChange never touches
    // selectedRowIds — that's the whole point of it existing separately
    // from the click handler).
    onSelectionChange(newSelection, currentRows[resolvedAnchorIndex].id);
    onActiveCellChange(currentRows[newIndex].id, selectedCellKeyRef.current ?? 'account');
  }, [onSelectionChange, onActiveCellChange]);

  const copySelectedRows = useCallback(() => {
    const ids = selectedRowIdsRef.current.size > 0
      ? selectedRowIdsRef.current
      : new Set(selectedRowIdRef.current ? [selectedRowIdRef.current] : []);
    if (ids.size === 0) return;

    const copied = rowsRef.current.filter(r => ids.has(r.id));
    if (copied.length > 0) {
      clipboardRef.current = copied.map(r => ({ ...r }));
    }
  }, []);

  const pasteRows = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip || clip.length === 0) return;

    const currentRows = rowsRef.current;
    const ids = selectedRowIdsRef.current;
    let insertAfterIndex = currentRows.length - 1;

    if (ids.size > 0) {
      const indices = currentRows
        .map((r, i) => (ids.has(r.id) ? i : -1))
        .filter(i => i !== -1);
      if (indices.length > 0) insertAfterIndex = Math.max(...indices);
    } else if (selectedRowIdRef.current) {
      const idx = currentRows.findIndex(r => r.id === selectedRowIdRef.current);
      if (idx !== -1) insertAfterIndex = idx;
    }

    const pasted = clip.map(r => ({
      ...r,
      id: `row-${Date.now()}-${Math.random()}`,
    }));

    const newRows = [...currentRows];
    newRows.splice(insertAfterIndex + 1, 0, ...pasted);
    const renumbered = newRows.map((r, i) => ({ ...r, row: i + 1 }));

    onRowsChange(renumbered);
    onSelectionChange(new Set(pasted.map(r => r.id)), pasted[0]?.id ?? null);
    if (pasted[0]) {
      onActiveCellChange(pasted[0].id, selectedCellKeyRef.current ?? 'account');
    }
  }, [onRowsChange, onSelectionChange, onActiveCellChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (isCtrlOrCmd && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      copySelectedRows();
      return;
    }
    if (isCtrlOrCmd && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      pasteRows();
      return;
    }
    if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      extendSelection(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }

    switch (e.key) {
      case 'F4':
        e.preventDefault();
        copyFromAboveCell();
        break;
      case 'F5':
        e.preventDefault();
        copyFromAboveRow();
        break;
      case 'F6':
        e.preventDefault();
        if (selectedRowIdRef.current) {
          onRowDuplicate(selectedRowIdRef.current);
        }
        break;
      case 'F8':
        e.preventDefault();
        onBalance();
        break;
      case 'F9':
        e.preventDefault();
        if (selectedRowIdRef.current) {
          onSwapRate(selectedRowIdRef.current);
        }
        break;
      case 'F10':
        e.preventDefault();
        if (selectedRowIdRef.current) {
          onSwapDebitCredit(selectedRowIdRef.current);
        }
        break;
    }
  }, [copyFromAboveCell, copyFromAboveRow, onRowDuplicate, onBalance, onSwapDebitCredit, onSwapRate, copySelectedRows, pasteRows, extendSelection]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);
};