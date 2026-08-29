import { useState, useCallback } from 'react';
import type { GridRow } from './types';

export const useEditableGrid = <T extends GridRow>(
  rows: T[],
  onChange: (rows: T[]) => void
) => {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; columnKey: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowId: string } | null>(null);
  const [clipboard, setClipboard] = useState<Record<string, any> | null>(null);

  const updateCell = useCallback((rowId: string, columnKey: string, value: any) => {
    onChange(rows.map(row =>
      row.id === rowId ? { ...row, [columnKey]: value } : row
    ));
  }, [rows, onChange]);

  const duplicateRow = useCallback((rowId: string) => {
    const index = rows.findIndex(r => r.id === rowId);
    if (index === -1) return;
    const newRow = { ...rows[index], id: `row-${Date.now()}-${Math.random()}` };
    const newRows = [...rows];
    newRows.splice(index + 1, 0, newRow);
    onChange(newRows.map((r, i) => ({ ...r, row: i + 1 })));
  }, [rows, onChange]);

  const addRowAfter = useCallback((rowId: string, template: Partial<T>) => {
    const index = rows.findIndex(r => r.id === rowId);
    if (index === -1) return;
    const newRow = { id: `row-${Date.now()}-${Math.random()}`, ...template } as T;
    const newRows = [...rows];
    newRows.splice(index + 1, 0, newRow);
    onChange(newRows.map((r, i) => ({ ...r, row: i + 1 })));
  }, [rows, onChange]);

  const addRowBefore = useCallback((rowId: string, template: Partial<T>) => {
    const index = rows.findIndex(r => r.id === rowId);
    if (index === -1) return;
    const newRow = { id: `row-${Date.now()}-${Math.random()}`, ...template } as T;
    const newRows = [...rows];
    newRows.splice(index, 0, newRow);
    onChange(newRows.map((r, i) => ({ ...r, row: i + 1 })));
  }, [rows, onChange]);

  const deleteRow = useCallback((rowId: string) => {
    const newRows = rows.filter(r => r.id !== rowId);
    onChange(newRows.map((r, i) => ({ ...r, row: i + 1 })));
  }, [rows, onChange]);

  const moveRow = useCallback((fromId: string, toId: string) => {
    const fromIndex = rows.findIndex(r => r.id === fromId);
    const toIndex = rows.findIndex(r => r.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const newRows = [...rows];
    const [moved] = newRows.splice(fromIndex, 1);
    newRows.splice(toIndex, 0, moved);
    onChange(newRows.map((r, i) => ({ ...r, row: i + 1 })));
  }, [rows, onChange]);

  return {
    selectedRowId,
    setSelectedRowId,
    selectedCell,
    setSelectedCell,
    contextMenu,
    setContextMenu,
    clipboard,
    setClipboard,
    updateCell,
    duplicateRow,
    addRowAfter,
    addRowBefore,
    deleteRow,
    moveRow,
  };
};