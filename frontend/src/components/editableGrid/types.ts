// frontend/src/components/editableGrid/types.ts
export interface GridRow {
  id: string;
  [key: string]: any;
}

export type CellType = 'text' | 'number' | 'select' | 'autocomplete' | 'custom';

export interface ColumnDef<T extends GridRow = GridRow> {
  key: string;
  title: string;
  width: number;
  cellType: CellType;
  editable?: boolean;
  required?: boolean;
  align?: 'left' | 'right' | 'center';
  options?: Array<{ value: any; label: string }>;
  formatNumber?: (value: number | null) => string;
  parseNumber?: (input: string) => number | null;
  renderCell?: (row: T) => React.ReactNode;
  onCellChange?: (row: T, value: any) => Partial<T>;
  validator?: (row: T, value: any) => string | null;
}

export interface RowError {
  rowId: string;
  columnKey: string;
  message: string;
}

export interface EditableGridProps<T extends GridRow = GridRow> {
  rows: T[];
  columns: ColumnDef<T>[];
  onChange: (rows: T[]) => void;
  onRowContextMenu?: (row: T) => Array<{
    label: string;
    onClick: () => void;
  }>;
  rowHeight?: number;
  headerHeight?: number;
  readOnly?: boolean;
  getRowError?: (row: T) => string | null;
  // event is optional so existing callers that don't need modifier keys keep working unchanged
  onCellClick?: (rowId: string, columnKey: string, event?: React.MouseEvent) => void;
  // Fires when a cell's underlying input receives focus (e.g. via Tab/Shift+Tab
  // or programmatic focus) — updates ONLY the active cell, never the multi-row
  // selection set, mirroring the semantics of keyboard-driven selection.
  onActiveCellChange?: (rowId: string, columnKey: string) => void;
  blinkingCells?: Set<string>;
  // Custom row operation overrides
  onAddRowAfter?: (rowId: string) => void;
  onAddRowBefore?: (rowId: string) => void;
  onDuplicateRow?: (rowId: string) => void;
  onDeleteRow?: (rowId: string) => void;
  // Called when the grid has zero rows and the user wants to add the first one
  onAddRow?: () => void;
  emptyStateLabel?: string;
  selectedRowId?: string | null;
  selectedCellKey?: string | null;
  // Full multi-row selection set (used for shift/ctrl selection highlighting).
  // Falls back to selectedRowId-only highlighting if omitted.
  selectedRowIds?: Set<string>;
  // Fixed content rendered below the rows, outside the vertical scroll area
  footer?: React.ReactNode;
}