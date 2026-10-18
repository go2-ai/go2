// frontend/src/components/editableGrid/EditableGrid.tsx
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Paper, Button, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  CELL_DISPLAY_ATTR,
  CELL_FOCUSABLE_SELECTOR,
  GRID_CELL_ATTR,
  type ColumnDef,
  type EditableGridProps,
  type GridRow,
} from './types';
import { useEditableGrid } from './useEditableGrid';
import { RowHeader, ROW_HEADER_WIDTH } from './RowHeader';
import { RowContextMenu, type ContextMenuAction } from './RowContextMenu';
import { ResizableColumnHeader } from './ResizableColumnHeader';
import { alpha, useTheme } from '@mui/material/styles';
import { creditColor, debitColor } from '../../theme/amountColors';
import './editableGrid.css';

/** Rows rendered above/below the viewport. */
const OVERSCAN = 3;

interface GridCellProps<T extends GridRow> {
  row: T;
  rowIndex: number;
  col: ColumnDef<T>;
  width: number;
  readOnly: boolean;
  isActive: boolean;
  isBlinking: boolean;
  onCellMouseDown: (rowId: string, colKey: string, e: React.MouseEvent) => void;
  onCellFocus: (rowId: string, colKey: string) => void;
}

/**
 * A cell. With `col.renderDisplay` it shows a cheap read-only view and only
 * mounts the editor (`col.renderCell`) while it is the active cell; focus is
 * then moved into the editor.
 */
const GridCell = <T extends GridRow>({
  row,
  rowIndex,
  col,
  width,
  readOnly,
  isActive,
  isBlinking,
  onCellMouseDown,
  onCellFocus,
}: GridCellProps<T>) => {
  const ref = useRef<HTMLDivElement | null>(null);
  // Set when the user activates this cell (click/Tab), so the editor that
  // mounts next takes the focus.
  const wantsFocus = useRef(false);

  const hasDisplay = !!col.renderDisplay;
  const editable = !readOnly && (col.isEditable?.(row) ?? true);
  const editing = !hasDisplay || (isActive && editable);

  useLayoutEffect(() => {
    if (!hasDisplay || !editing || !wantsFocus.current) return;
    wantsFocus.current = false;
    const target = ref.current?.querySelector(CELL_FOCUSABLE_SELECTOR) as HTMLElement | null;
    if (!target || target.hasAttribute(CELL_DISPLAY_ATTR)) return;
    target.focus({ preventScroll: true });
    if (target instanceof HTMLInputElement) target.select();
  }, [hasDisplay, editing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (hasDisplay && !editing && editable && e.button === 0) {
      // We move the focus into the editor ourselves once it is mounted; the
      // default focus would land on the display, which is replaced.
      e.preventDefault();
      wantsFocus.current = true;
    }
    onCellMouseDown(row.id, col.key, e);
  };

  const handleFocus = () => {
    if (hasDisplay && !editing && editable) wantsFocus.current = true;
    onCellFocus(row.id, col.key);
  };

  const className = [
    'eg-cell',
    `eg-cell--${col.align ?? 'left'}`,
    readOnly && 'eg-cell--readonly',
    isActive && 'eg-cell--active',
    isBlinking && 'eg-cell--blink',
  ].filter(Boolean).join(' ');

  let content: React.ReactNode;
  if (editing) {
    content = col.renderCell ? col.renderCell(row) : String(row[col.key] ?? '');
  } else {
    content = (
      <div
        {...{ [CELL_DISPLAY_ATTR]: '' }}
        className={`eg-display${editable ? '' : ' eg-display--disabled'}`}
        tabIndex={editable ? 0 : -1}
        aria-disabled={editable ? undefined : true}
      >
        {col.renderDisplay!(row)}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      {...{ [GRID_CELL_ATTR]: '' }}
      data-row-id={row.id}
      data-row-index={rowIndex}
      data-col-key={col.key}
      className={className}
      style={{ width }}
      onMouseDown={handleMouseDown}
      onFocus={handleFocus}
    >
      {content}
    </div>
  );
};

interface GridRowViewProps<T extends GridRow> {
  row: T;
  rowIndex: number;
  start: number;
  rowHeight: number;
  columns: ColumnDef<T>[];
  columnWidths: Record<string, number>;
  readOnly: boolean;
  errorMessage: string | null;
  isSelected: boolean;
  /** Key of the active cell when it is in this row, otherwise null. */
  activeCellKey: string | null;
  /** Comma-separated keys of blinking cells in this row ('' if none). */
  blinkingKeys: string;
  onCellMouseDown: (rowId: string, colKey: string, e: React.MouseEvent) => void;
  onCellFocus: (rowId: string, colKey: string) => void;
  onHeaderMouseDown: (rowId: string, e: React.MouseEvent) => void;
  onRowContextMenu: (rowId: string, e: React.MouseEvent) => void;
}

/**
 * One grid row. Memoized so that a change to one row (or to the active cell)
 * only re-renders the rows it affects. All props must be primitives, stable
 * callbacks, or objects whose identity only changes when their content does.
 */
const GridRowViewInner = <T extends GridRow>({
  row,
  rowIndex,
  start,
  rowHeight,
  columns,
  columnWidths,
  readOnly,
  errorMessage,
  isSelected,
  activeCellKey,
  blinkingKeys,
  onCellMouseDown,
  onCellFocus,
  onHeaderMouseDown,
  onRowContextMenu,
}: GridRowViewProps<T>) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const blinking = blinkingKeys ? blinkingKeys.split(',') : [];

  return (
    <div
      className={`eg-row${isSelected ? ' eg-row--selected' : ''}`}
      // Position via inline style: as an `sx` value every scroll offset
      // would generate (and keep) a new CSS rule.
      style={{ transform: `translateY(${start}px)`, height: rowHeight }}
    >
      <div
        ref={setNodeRef}
        className="eg-row-inner"
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.4 : 1,
        }}
        {...attributes}
        // Focusable on click (so the row can be the target of row-level
        // shortcuts) but kept out of the Tab order.
        tabIndex={-1}
        data-grid-row={row.id}
      >
        <RowHeader
          rowIndex={rowIndex}
          hasError={!!errorMessage}
          errorMessage={errorMessage}
          isSelected={isSelected}
          onContextMenu={(e) => onRowContextMenu(row.id, e)}
          onMouseDown={(e) => onHeaderMouseDown(row.id, e)}
          dragHandleProps={listeners}
        />
        {columns.map((col) => (
          <GridCell
            key={col.key}
            row={row}
            rowIndex={rowIndex}
            col={col}
            width={columnWidths[col.key] ?? col.width}
            readOnly={readOnly}
            isActive={activeCellKey === col.key}
            isBlinking={blinking.includes(col.key)}
            onCellMouseDown={onCellMouseDown}
            onCellFocus={onCellFocus}
          />
        ))}
      </div>
    </div>
  );
};

const GridRowView = memo(GridRowViewInner) as typeof GridRowViewInner;

export const EditableGrid = <T extends GridRow = GridRow>(props: EditableGridProps<T>) => {
  const {
    rows,
    columns,
    onChange,
    onRowContextMenu,
    rowHeight = 36,
    headerHeight = 36,
    readOnly = false,
    getRowError,
    blinkingCells,
    onAddRowAfter,
    onAddRowBefore,
    onDuplicateRow,
    onDeleteRow,
    onAddRow,
    emptyStateLabel,
    selectedRowId,
    selectedCellKey,
    selectedRowIds,
    footer,
    contextMenuActions,
    apiRef,
    onSelectAll,
    selectAllLabel,
  } = props;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const {
    contextMenu,
    setContextMenu,
    duplicateRow,
    addRowAfter,
    addRowBefore,
    deleteRow,
  } = useEditableGrid(rows as T[], onChange as (rows: T[]) => void);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();

  // Latest props for the stable callbacks handed to memoized rows.
  const latest = useRef(props);
  latest.current = props;

  const getColumnWidth = (col: ColumnDef<T>): number => columnWidths[col.key] ?? col.width;

  const totalWidth = useMemo(
    () => ROW_HEADER_WIDTH + columns.reduce((sum, col) => sum + (columnWidths[col.key] ?? col.width), 0),
    [columns, columnWidths]
  );

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
    // The sticky header sits above the rows inside the scroll container
    scrollMargin: headerHeight,
    scrollPaddingStart: headerHeight,
  });

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      scrollToRow: (index: number) => rowVirtualizer.scrollToIndex(index, { align: 'auto' }),
    };
    return () => { apiRef.current = null; };
  }, [apiRef, rowVirtualizer]);

  // dnd-kit recomputes its context whenever `items` changes identity, which
  // would re-render every row; only give it a new array when ids change.
  const idsKey = rows.map(r => r.id).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const itemIds = useMemo(() => rows.map(r => r.id), [idsKey]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rows.findIndex(r => r.id === active.id);
    const newIndex = rows.findIndex(r => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newRows = arrayMove(rows, oldIndex, newIndex).map((r, i) => ({ ...r, row: i + 1 }));
    onChange(newRows as T[]);
  };

  const buildDefaultActions = (row: T): ContextMenuAction[] => {
    const actions: ContextMenuAction[] = [
      { label: 'Duplicate', onClick: () => (onDuplicateRow ? onDuplicateRow(row.id) : duplicateRow(row.id)) },
      { label: 'Add Row After', onClick: () => (onAddRowAfter ? onAddRowAfter(row.id) : addRowAfter(row.id, {})) },
      { label: 'Add Row Before', onClick: () => (onAddRowBefore ? onAddRowBefore(row.id) : addRowBefore(row.id, {})) },
      { label: 'Delete Row', onClick: () => (onDeleteRow ? onDeleteRow(row.id) : deleteRow(row.id)) },
    ];

    const isMultiSelected = !!selectedRowIds && selectedRowIds.size > 1 && selectedRowIds.has(row.id);
    if (isMultiSelected) {
      actions.push({
        label: `Delete Selected Rows (${selectedRowIds!.size})`,
        onClick: () => {
          const newRows = rows.filter(r => !selectedRowIds!.has(r.id));
          onChange(newRows.map((r, i) => ({ ...r, row: i + 1 })) as T[]);
        },
      });
    }

    return onRowContextMenu ? [...onRowContextMenu(row), ...actions] : actions;
  };

  const contextActions = useMemo(() => {
    if (!contextMenu) return [];
    const row = rows.find(r => r.id === contextMenu.rowId);
    if (!row) return [];
    return contextMenuActions ? contextMenuActions(row) : buildDefaultActions(row);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextMenu, rows, selectedRowIds, contextMenuActions]);

  // ── Stable callbacks for memoized rows ────────────────────────────────
  const handleCellMouseDown = useCallback((rowId: string, colKey: string, e: React.MouseEvent) => {
    latest.current.onCellClick?.(rowId, colKey, e);
  }, []);

  const handleCellFocus = useCallback((rowId: string, colKey: string) => {
    latest.current.onActiveCellChange?.(rowId, colKey);
  }, []);

  const handleHeaderMouseDown = useCallback((rowId: string, e: React.MouseEvent) => {
    const { selectedRowIds: ids, selectedRowId: activeId, selectedCellKey: cellKey, columns: cols } = latest.current;
    if (e.button === 2) {
      const alreadySelected = ids ? ids.has(rowId) : activeId === rowId;
      if (alreadySelected) return;
    }
    if (latest.current.onRowHeaderMouseDown) {
      latest.current.onRowHeaderMouseDown(rowId, e);
      return;
    }
    latest.current.onCellClick?.(rowId, cellKey ?? cols[0]?.key ?? '', e);
  }, []);

  const handleRowContextMenu = useCallback((rowId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, rowId });
  }, [setContextMenu]);

  const isRowSelected = (rowId: string): boolean =>
    selectedRowIds ? selectedRowIds.has(rowId) : selectedRowId === rowId;

  // Theme colors for the plain-CSS rows/cells (editableGrid.css)
  const cssVars = useMemo(() => ({
    '--eg-divider': theme.palette.divider,
    '--eg-hover': theme.palette.action.hover,
    '--eg-active': theme.palette.secondary.main,
    '--eg-selected-bg': `${theme.palette.primary.dark}22`,
    '--eg-header-selected-bg': theme.palette.action.selected,
    '--eg-primary': theme.palette.primary.main,
    '--eg-error': theme.palette.error.main,
    '--eg-text': theme.palette.text.primary,
    '--eg-text-secondary': theme.palette.text.secondary,
    '--eg-text-disabled': theme.palette.text.disabled,
    '--eg-disabled-bg': theme.palette.action.disabledBackground,
    '--eg-icon': theme.palette.action.active,
    '--eg-debit': debitColor(theme),
    '--eg-credit': creditColor(theme),
    '--eg-paper': theme.palette.background.paper,
    // Font size of MUI inputs, so read-only cells can match the editors
    '--eg-input-font-size': theme.typography.body1.fontSize,
    '--eg-header-bg': alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.06 : 0.04),
    '--eg-scroll-thumb': alpha(theme.palette.text.secondary, 0.3),
    '--eg-scroll-thumb-hover': alpha(theme.palette.text.secondary, 0.5),
    '--eg-chip-bg': alpha(theme.palette.text.primary, 0.08),
  }) as React.CSSProperties, [theme]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <Paper style={cssVars} sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* One scroll container for both directions, so the vertical
              scrollbar is always visible; the header sticks to its top. */}
          <div ref={scrollRef} className="eg-scroll">
            <div className="eg-content" style={{ width: totalWidth }}>
              {/* Header */}
              <div className="eg-header" style={{ height: headerHeight }}>
                <div className="eg-header__corner" style={{ width: ROW_HEADER_WIDTH }}>
                  {onSelectAll && rows.length > 0 ? (
                    <button
                      type="button"
                      className="eg-select-all"
                      onClick={onSelectAll}
                      aria-label={selectAllLabel}
                      title={selectAllLabel}
                    >
                      #
                    </button>
                  ) : '#'}
                </div>
                {columns.map((col) => (
                  <div key={col.key} className="eg-header__cell" style={{ width: getColumnWidth(col) }}>
                    <ResizableColumnHeader
                      title={col.title}
                      width={getColumnWidth(col)}
                      align={col.align}
                      onResize={(newWidth) => {
                        setColumnWidths(prev => ({ ...prev, [col.key]: newWidth }));
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Rows */}
              {rows.length === 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => onAddRow?.()}
                    disabled={!onAddRow}
                  >
                    {emptyStateLabel ?? 'Add Row'}
                  </Button>
                </Box>
              ) : (
                <>
                  <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const row = rows[virtualRow.index];
                      const blinkingKeys = blinkingCells && blinkingCells.size > 0
                        ? columns.filter(c => blinkingCells.has(`${row.id}-${c.key}`)).map(c => c.key).join(',')
                        : '';

                      return (
                        <GridRowView
                          key={row.id}
                          row={row}
                          rowIndex={virtualRow.index}
                          // Offsets include the header (scrollMargin)
                          start={virtualRow.start - headerHeight}
                          rowHeight={rowHeight}
                          columns={columns}
                          columnWidths={columnWidths}
                          readOnly={readOnly}
                          errorMessage={getRowError?.(row) ?? null}
                          isSelected={isRowSelected(row.id)}
                          activeCellKey={selectedRowId === row.id ? (selectedCellKey ?? null) : null}
                          blinkingKeys={blinkingKeys}
                          onCellMouseDown={handleCellMouseDown}
                          onCellFocus={handleCellFocus}
                          onHeaderMouseDown={handleHeaderMouseDown}
                          onRowContextMenu={handleRowContextMenu}
                        />
                      );
                    })}
                  </div>

                  {/* Permanent "add row" affordance */}
                  {!readOnly && onAddRow && (
                    <Box
                      onClick={() => onAddRow()}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        height: rowHeight,
                        paddingInlineStart: '8px',
                        color: 'text.secondary',
                        cursor: 'pointer',
                        borderBottom: 1,
                        borderColor: 'divider',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          bgcolor: 'action.hover',
                          color: 'primary.main',
                          paddingInlineStart: '10px',
                        },
                      }}
                    >
                      <AddIcon fontSize="small" />
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                        {emptyStateLabel ?? 'Add Row'}
                      </Typography>
                    </Box>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          {footer && (
            <Box sx={{ flexShrink: 0, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
              {footer}
            </Box>
          )}
        </Paper>
      </SortableContext>

      <RowContextMenu
        anchorPoint={contextMenu}
        actions={contextActions}
        onClose={() => setContextMenu(null)}
      />
    </DndContext>
  );
};
