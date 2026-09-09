// frontend/src/components/editableGrid/EditableGrid.tsx
import { useMemo, useState, useRef } from 'react';
import { Box, Paper, Button, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ColumnDef, EditableGridProps, GridRow } from './types';
import { useEditableGrid } from './useEditableGrid';
import { RowHeader } from './RowHeader';
import { RowContextMenu, type ContextMenuAction } from './RowContextMenu';
import { ResizableColumnHeader } from './ResizableColumnHeader';
import { useTheme } from '@mui/material/styles';
import { keyframes } from '@mui/material/styles';

interface SortableRowProps {
  row: GridRow;
  rowIndex: number;
  hasError: boolean;
  errorMessage?: string | null;
  isSelected?: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
  onRowMouseDown?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

const SortableRow = ({
  row,
  rowIndex,
  hasError,
  errorMessage,
  isSelected,
  onContextMenu,
  onRowMouseDown,
  children,
}: SortableRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    display: 'flex',
    height: '100%',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <RowHeader
        rowIndex={rowIndex}
        hasError={hasError}
        errorMessage={errorMessage}
        isSelected={isSelected}
        onContextMenu={onContextMenu}
        onMouseDown={onRowMouseDown}
        dragHandleProps={listeners}
      />
      {children}
    </div>
  );
};

export const EditableGrid = <T extends GridRow = GridRow>({
  rows,
  columns,
  onChange,
  onRowContextMenu,
  rowHeight = 36,
  headerHeight = 36,
  readOnly = false,
  getRowError,
  onCellClick,
  onActiveCellChange,
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
}: EditableGridProps<T>) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const {
    contextMenu,
    setContextMenu,
    duplicateRow,
    addRowAfter,
    addRowBefore,
    deleteRow,
  } = useEditableGrid(rows as T[], onChange as any);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();

  const getColumnWidth = (col: ColumnDef<T>): number => {
    return columnWidths[col.key] ?? col.width;
  };

  const totalWidth = useMemo(
    () => 40 + columns.reduce((sum, col) => sum + getColumnWidth(col), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, columnWidths]
  );

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rows.findIndex(r => r.id === active.id);
    const newIndex = rows.findIndex(r => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newRows = arrayMove(rows, oldIndex, newIndex).map((r, i) => ({ ...r, row: i + 1 }));
    onChange(newRows as T[]);
  };

  const handleDuplicate = (rowId: string) => {
    if (onDuplicateRow) {
      onDuplicateRow(rowId);
    } else {
      duplicateRow(rowId);
    }
  };

  const handleAddAfter = (rowId: string) => {
    if (onAddRowAfter) {
      onAddRowAfter(rowId);
    } else {
      addRowAfter(rowId, {});
    }
  };

  const handleAddBefore = (rowId: string) => {
    if (onAddRowBefore) {
      onAddRowBefore(rowId);
    } else {
      addRowBefore(rowId, {});
    }
  };

  const handleDelete = (rowId: string) => {
    if (onDeleteRow) {
      onDeleteRow(rowId);
    } else {
      deleteRow(rowId);
    }
  };

  const handleDeleteMultiple = (ids: Set<string>) => {
    const newRows = rows.filter(r => !ids.has(r.id));
    onChange(newRows.map((r, i) => ({ ...r, row: i + 1 })) as T[]);
  };

  const buildContextActions = (row: T): ContextMenuAction[] => {
    const actions: ContextMenuAction[] = [
      { label: 'Duplicate', onClick: () => handleDuplicate(row.id) },
      { label: 'Add Row After', onClick: () => handleAddAfter(row.id) },
      { label: 'Add Row Before', onClick: () => handleAddBefore(row.id) },
      { label: 'Delete Row', onClick: () => handleDelete(row.id) },
    ];

    const isMultiSelected = !!selectedRowIds && selectedRowIds.size > 1 && selectedRowIds.has(row.id);
    if (isMultiSelected) {
      actions.push({
        label: `Delete Selected Rows (${selectedRowIds!.size})`,
        onClick: () => handleDeleteMultiple(selectedRowIds!),
      });
    }

    if (onRowContextMenu) {
      return [...onRowContextMenu(row), ...actions];
    }

    return actions;
  };

  const contextActions = useMemo(() => {
    if (!contextMenu) return [];
    const row = rows.find(r => r.id === contextMenu.rowId);
    if (!row) return [];
    return buildContextActions(row);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextMenu, rows, selectedRowIds]);


  const cellHighlight = keyframes`
    0% {
      background-color: rgba(255, 193, 7, 0.45);
      box-shadow: inset 0 0 0 2px rgba(255, 193, 7, 0.65);
    }
    100% {
      background-color: rgba(255, 193, 7, 0);
      box-shadow: inset 0 0 0 2px rgba(255, 193, 7, 0);
    }
  `;

  const isRowSelected = (rowId: string): boolean =>
    selectedRowIds ? selectedRowIds.has(rowId) : selectedRowId === rowId;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
        <Paper sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ width: totalWidth, flexShrink: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <Box sx={{
                display: 'flex',
                height: headerHeight,
                borderBottom: 1,
                borderColor: 'divider',
                fontWeight: 'bold',
                flexShrink: 0,
                bgcolor: 'background.paper',
              }}>
                <Box sx={{ width: 40, flexShrink: 0 }} />
                {columns.map((col) => (
                  <Box
                    key={col.key}
                    sx={{
                      width: getColumnWidth(col),
                      display: 'flex',
                      alignItems: 'center',
                      borderRight: 1,
                      borderColor: 'divider',
                      flexShrink: 0,
                    }}
                  >
                    <ResizableColumnHeader
                      title={col.title}
                      width={getColumnWidth(col)}
                      align={col.align}
                      onResize={(newWidth) => {
                        setColumnWidths(prev => ({ ...prev, [col.key]: newWidth }));
                      }}
                    />
                  </Box>
                ))}
              </Box>

              {/* Rows */}
              {rows.length === 0 ? (
                <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
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
                <Box ref={scrollRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
                  <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const row = rows[virtualRow.index];
                      const errorMessage = getRowError?.(row);
                      const selected = isRowSelected(row.id);

                      return (
                        <Box
                          key={row.id}
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                            display: 'flex',
                            height: rowHeight,
                            borderBottom: 1,
                            borderColor: 'divider',
                            backgroundColor: selected ? `${theme.palette.primary.dark}22` : 'transparent',
                          }}
                        >
                          <SortableRow
                            row={row}
                            rowIndex={virtualRow.index}
                            hasError={!!errorMessage}
                            errorMessage={errorMessage}
                            isSelected={selected}
                            onRowMouseDown={(e) => {
                              if (e.button === 2) {
                                const alreadySelected = selectedRowIds
                                  ? selectedRowIds.has(row.id)
                                  : selectedRowId === row.id;
                                if (alreadySelected) return;
                              }
                              onCellClick?.(row.id, selectedCellKey ?? columns[0]?.key ?? '', e);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setContextMenu({ x: e.clientX, y: e.clientY, rowId: row.id });
                            }}
                          >
                            {columns.map((col) => {
                              const cellId = `${row.id}-${col.key}`;
                              const isBlinking = blinkingCells?.has(cellId) ?? false;
                              const isSelectedCell = selectedRowId === row.id && selectedCellKey === col.key;
                              return (
                                <Box
                                  key={col.key}
                                  sx={{
                                    width: getColumnWidth(col),
                                    px: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
                                    borderRight: 1,
                                    borderColor: 'divider',
                                    cursor: readOnly ? 'default' : 'pointer',
                                    flexShrink: 0,
                                    overflow: 'hidden',
                                    transition: 'box-shadow 0.08s ease-in-out, background-color 0.08s ease-in-out',
                                    ...(isSelectedCell && {
                                      boxShadow: (theme) => `inset 0 0 0 2px ${theme.palette.secondary.main}`,
                                      bgcolor: 'action.hover',
                                    }),
                                    ...(isBlinking && {
                                      animation: `${cellHighlight} 1.4s ease-out`,
                                    }),
                                  }}
                                  onMouseDown={(e) => onCellClick?.(row.id, col.key, e)}
                                  onFocus={() => onActiveCellChange?.(row.id, col.key)}
                                >
                                  {col.renderCell ? col.renderCell(row) : String(row[col.key] ?? '')}
                                </Box>
                              );
                            })}
                          </SortableRow>
                        </Box>
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
                        pl: '8px',
                        color: 'text.secondary',
                        cursor: 'pointer',
                        borderBottom: 1,
                        borderColor: 'divider',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          bgcolor: 'action.hover',
                          color: 'primary.main',
                          pl: '10px',
                        },
                      }}
                    >
                      <AddIcon fontSize="small" />
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                        {emptyStateLabel ?? 'Add Row'}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Box>

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