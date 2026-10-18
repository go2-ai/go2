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
  /** The cell editor. Without `renderDisplay` it is always mounted. */
  renderCell?: (row: T) => React.ReactNode;
  /**
   * Lightweight read-only view of the cell. When set, the editor
   * (`renderCell`) is only mounted for the active cell, which keeps rows
   * cheap to render. Should not use MUI components.
   */
  renderDisplay?: (row: T) => React.ReactNode;
  /** Whether the cell can be activated for editing (default: true). */
  isEditable?: (row: T) => boolean;
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
  /**
   * Replaces the built-in row context menu actions (which have English-only
   * labels). Receives the right-clicked row.
   */
  contextMenuActions?: (row: T) => Array<{
    label: string;
    onClick: () => void;
    disabled?: boolean;
    shortcut?: string;
  }>;
  /** Receives an imperative API (e.g. to scroll a row into view). */
  apiRef?: React.MutableRefObject<EditableGridApi | null>;
  /**
   * Row header (number) pressed. When set it replaces `onCellClick` for row
   * headers, e.g. to select rows without activating a cell.
   */
  onRowHeaderMouseDown?: (rowId: string, event: React.MouseEvent) => void;
  /** Makes the "#" header cell a "select all rows" button. */
  onSelectAll?: () => void;
  /** Accessible label of the "select all rows" button. */
  selectAllLabel?: string;
}

export interface EditableGridApi {
  /** Scrolls so the row at `index` is rendered and visible. */
  scrollToRow: (index: number) => void;
}

/** Data attributes put on every cell, used for keyboard navigation. */
export const GRID_CELL_ATTR = 'data-grid-cell';

/** Marks the read-only view of a cell (focusable when the cell is editable). */
export const CELL_DISPLAY_ATTR = 'data-cell-display';

/** Elements inside a cell that can take keyboard focus. */
export const CELL_FOCUSABLE_SELECTOR = [
  'input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"]):not([tabindex="-1"])',
  'textarea:not([disabled])',
  'div[role="combobox"][tabindex="0"]',
  `[${CELL_DISPLAY_ATTR}][tabindex="0"]`,
].join(', ');