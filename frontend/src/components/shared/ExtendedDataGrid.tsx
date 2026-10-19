import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Box, IconButton, InputBase, Tooltip, alpha, darken, lighten, useTheme } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import {
  DataGrid,
  GRID_CHECKBOX_SELECTION_COL_DEF,
  useGridApiContext,
  useGridSelector,
  gridSortModelSelector,
} from '@mui/x-data-grid';
import type {
  GridColDef,
  DataGridProps,
  GridCellParams,
  GridCallbackDetails,
  MuiEvent,
} from '@mui/x-data-grid';

/** Field of the leading "open" column added when `onRowOpen` is provided. */
const OPEN_FIELD = '__open__';
const CHECKBOX_FIELD = GRID_CHECKBOX_SELECTION_COL_DEF.field;
const OPEN_BUTTON_CLASS = 'ExtendedDataGrid-openButton';
const OPEN_CELL_CLASS = 'ExtendedDataGrid-openCell';

interface ExtendedDataGridProps extends Omit<DataGridProps, 'rows' | 'columns'> {
  rows: any[];
  columns: GridColDef[];
  /** When true, renders a search input under each column header */
  showHeaderSearchRow?: boolean;
  /** Column fields to exclude from header search (defaults to ['actions']) */
  excludeSearchFields?: string[];
  /** Debounce delay (ms) before a keystroke is applied to filtering. Default 200 */
  filterDebounceMs?: number;
  /** Total header height (title row + filter row) when search row is enabled. Default 76 */
  headerHeightWithSearch?: number;
  /**
   * Opens the row's target page. When set, the grid gets a leading open-icon
   * column, and double-clicking a row or pressing Enter on a focused cell
   * triggers it too, so every grid opens rows the same way.
   */
  // Method syntax: lets callers pass handlers typed with their own row type
  onRowOpen?(row: unknown): void;
  /** Tooltip / accessible label of the open button. */
  rowOpenLabel?: string;
}

export function ExtendedDataGrid({
  rows,
  columns,
  showHeaderSearchRow = false,
  excludeSearchFields = ['actions'],
  filterDebounceMs = 200,
  headerHeightWithSearch = 64,
  onRowOpen,
  rowOpenLabel,
  ...dataGridProps
}: ExtendedDataGridProps) {
  const theme = useTheme();
  // Kept in a ref so an inline handler doesn't rebuild the columns every render
  const onRowOpenRef = useRef(onRowOpen);
  onRowOpenRef.current = onRowOpen;
  const hasRowOpen = Boolean(onRowOpen);

  // Committed filters drive the actual row filtering (debounced)
  const [filters, setFilters] = useState<Record<string, string>>({});
  // Draft filters drive what's rendered in the inputs (instant, no lag while typing)
  const [draftFilters, setDraftFilters] = useState<Record<string, string>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const handleFilterChange = useCallback(
    (field: string, value: string) => {
      setDraftFilters((prev) => ({ ...prev, [field]: value }));

      if (debounceTimers.current[field]) {
        clearTimeout(debounceTimers.current[field]);
      }
      debounceTimers.current[field] = setTimeout(() => {
        setFilters((prev) => ({ ...prev, [field]: value }));
      }, filterDebounceMs);
    },
    [filterDebounceMs],
  );

  const handleFilterClear = useCallback((field: string) => {
    if (debounceTimers.current[field]) {
      clearTimeout(debounceTimers.current[field]);
    }
    setDraftFilters((prev) => ({ ...prev, [field]: '' }));
    setFilters((prev) => ({ ...prev, [field]: '' }));
  }, []);

  const columnsByField = useMemo(() => {
    const map: Record<string, GridColDef> = {};
    columns.forEach((col) => {
      map[col.field] = col;
    });
    return map;
  }, [columns]);

  const getFilterableValue = useCallback(
    (row: any, field: string) => {
      const col = columnsByField[field];
      // Mirror how the grid itself resolves a cell's value: prefer the
      // column's valueGetter (needed for computed/nested fields such as
      // `center_type` or `metadata_${id}`), and fall back to the raw
      // row property only when no valueGetter is defined.
      if (col?.valueGetter) {
        return (col.valueGetter as any)(row[field], row, col, undefined);
      }
      return row[field];
    },
    [columnsByField],
  );

  const filteredRows = useMemo(() => {
    if (!showHeaderSearchRow) return rows;
    const activeFilters = Object.entries(filters).filter(([, v]) => v.trim());
    if (activeFilters.length === 0) return rows;
    return rows.filter((row) =>
      activeFilters.every(([field, filterValue]) => {
        const rawValue = getFilterableValue(row, field);
        const strValue = rawValue != null ? String(rawValue).toLowerCase() : '';
        return strValue.includes(filterValue.toLowerCase());
      }),
    );
  }, [rows, filters, showHeaderSearchRow, getFilterableValue]);

  const columnsWithOpen = useMemo<GridColDef[]>(() => {
    if (!hasRowOpen) return columns;
    const openColumn: GridColDef = {
      field: OPEN_FIELD,
      headerName: '',
      width: 44,
      minWidth: 44,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      filterable: false,
      resizable: false,
      hideable: false,
      disableColumnMenu: true,
      disableReorder: true,
      disableExport: true,
      // No padding, otherwise the button overflows the narrow cell and the
      // grid's text-overflow renders an ellipsis next to it.
      cellClassName: OPEN_CELL_CLASS,
      headerClassName: OPEN_CELL_CLASS,
      renderHeader: () => null,
      renderCell: (params) => (
        <Tooltip title={rowOpenLabel ?? ''} disableInteractive>
          <IconButton
            size="small"
            className={OPEN_BUTTON_CLASS}
            aria-label={rowOpenLabel}
            onClick={(e) => {
              e.stopPropagation();
              onRowOpenRef.current?.(params.row);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            sx={{ p: 0.5 }}
          >
            <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      ),
    };
    return [openColumn, ...columns];
  }, [columns, hasRowOpen, rowOpenLabel]);

  // The checkbox cell keeps its own click/keyboard semantics (selection)
  const isOpenTriggerField = (field: string) => field !== CHECKBOX_FIELD;

  const handleCellDoubleClick = (
    params: GridCellParams,
    event: MuiEvent<React.MouseEvent<HTMLElement>>,
    details: GridCallbackDetails,
  ) => {
    dataGridProps.onCellDoubleClick?.(params, event, details);
    if (onRowOpenRef.current && !event.defaultMuiPrevented && isOpenTriggerField(params.field)) {
      onRowOpenRef.current(params.row);
    }
  };

  const handleCellKeyDown = (
    params: GridCellParams,
    event: MuiEvent<React.KeyboardEvent<HTMLElement>>,
    details: GridCallbackDetails,
  ) => {
    dataGridProps.onCellKeyDown?.(params, event, details);
    if (
      onRowOpenRef.current &&
      event.key === 'Enter' &&
      !event.defaultMuiPrevented &&
      // A focused button handles Enter itself (would open twice otherwise)
      !(event.target as HTMLElement).closest('button') &&
      isOpenTriggerField(params.field)
    ) {
      event.defaultMuiPrevented = true;
      onRowOpenRef.current(params.row);
    }
  };

  const columnsWithSearch = useMemo(() => {
    if (!showHeaderSearchRow) return columnsWithOpen;
    return columnsWithOpen.map((col) => {
      if (col.field === OPEN_FIELD || excludeSearchFields.includes(col.field) || col.type === 'actions') {
        return col;
      }
      return {
        ...col,
        renderHeader: (params: any) => (
          <HeaderWithSearch
            headerName={col.headerName || col.field}
            renderOriginalHeader={col.renderHeader}
            headerParams={params}
            field={col.field}
            sortable={col.sortable !== false}
            value={draftFilters[col.field] || ''}
            onChange={handleFilterChange}
            onClear={handleFilterClear}
          />
        ),
      };
    });
  }, [columnsWithOpen, showHeaderSearchRow, excludeSearchFields, draftFilters, handleFilterChange, handleFilterClear]);

  // Same look as the journal entry editor grid (EditableGrid): a tinted header
  // and thin, rounded scrollbars on a transparent track. The header color is
  // kept opaque because the grid paints it under sticky/filler cells too.
  const isDark = theme.palette.mode === 'dark';
  const paper = theme.palette.background.paper;
  const headerBg = isDark ? lighten(paper, 0.08) : darken(paper, 0.06);
  // The theme divider (#1E1E32 on #14141F in dark mode) is nearly invisible,
  // so grid lines get their own color, opaque so overlapping lines don't stack.
  const gridLineColor = isDark ? lighten(paper, 0.16) : darken(paper, 0.16);
  const scrollThumb = alpha(theme.palette.text.secondary, 0.3);
  const scrollThumbHover = alpha(theme.palette.text.secondary, 0.5);
  // `.scrollDiv` is the probe the grid uses to measure the scrollbar size, so
  // styling it keeps the grid's layout math in sync with the thin scrollbars.
  const scrollContainers = '& .MuiDataGrid-scrollbar, & .MuiDataGrid-virtualScroller, & .scrollDiv';
  const scrollPart = (part: string) =>
    scrollContainers
      .split(', ')
      .map((selector) => `${selector}::-webkit-scrollbar${part}`)
      .join(', ');

  return (
    <DataGrid
      rows={filteredRows}
      columns={columnsWithSearch}
      columnHeaderHeight={showHeaderSearchRow ? headerHeightWithSearch : undefined}
      {...dataGridProps}
      onCellDoubleClick={hasRowOpen ? handleCellDoubleClick : dataGridProps.onCellDoubleClick}
      onCellKeyDown={hasRowOpen ? handleCellKeyDown : dataGridProps.onCellKeyDown}
      sx={{
        // `&&` doubles the class specificity: the grid sets its theme
        // variables in its own <style> tag (.MuiDataGridVariables-*), which
        // is injected later and would otherwise win at equal specificity.
        '&&': {
          '--DataGrid-t-header-background-base': headerBg,
          // Drives every grid line: row borders, vertical cell borders
          // (`showCellVerticalBorder`) and the header separators.
          '--DataGrid-t-color-border-base': gridLineColor,
        },
        [`& .${OPEN_CELL_CLASS}`]: {
          padding: 0,
          overflow: 'visible',
          textOverflow: 'clip',
        },
        '& .MuiDataGrid-columnHeaderTitle': {
          fontWeight: 600,
        },
        // The built-in separator is a fixed 24px SVG centered in the header,
        // leaving gaps above and below. Draw a full-height line instead; it
        // uses currentColor so the grid's hover/resizing accent still applies.
        '& .MuiDataGrid-columnSeparator': {
          top: 0,
          height: '100%',
          // The grid sizes this box from its SVG icon; with the icon hidden it
          // must get an explicit width. The grid anchors it at `right: -5px`,
          // so 10px makes it straddle the column edge (the drag target).
          width: 10,
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            bottom: 0,
            // 5px from the box's end = the column's last pixel, the same pixel
            // a cell's `border-right` paints, so header and body lines align.
            // Authored LTR; stylis-plugin-rtl mirrors it with the grid's own
            // `right` offset and the cells' border-right.
            right: 5,
            width: '1px',
            backgroundColor: 'currentColor',
            transition: theme.transitions.create('width', {
              duration: theme.transitions.duration.short,
            }),
          },
        },
        '& .MuiDataGrid-iconSeparator': {
          display: 'none',
        },
        '& .MuiDataGrid-columnSeparator--resizable:hover::after, & .MuiDataGrid-columnSeparator--resizing::after': {
          // Grow around the 1px line instead of only toward the column start
          right: 4,
          width: '3px',
        },
        [scrollContainers]: {
          scrollbarWidth: 'thin',
          scrollbarColor: `${scrollThumb} transparent`,
        },
        [scrollPart('')]: {
          width: 8,
          height: 8,
        },
        [`${scrollPart('-track')}, ${scrollPart('-corner')}`]: {
          backgroundColor: 'transparent',
        },
        [scrollPart('-thumb')]: {
          backgroundColor: scrollThumb,
          borderRadius: 4,
        },
        [scrollPart('-thumb:hover')]: {
          backgroundColor: scrollThumbHover,
        },
        ...(hasRowOpen && {
          [`& .${OPEN_BUTTON_CLASS}`]: {
            color: 'text.disabled',
            transition: 'color 0.15s ease',
          },
          [`& .MuiDataGrid-row:hover .${OPEN_BUTTON_CLASS}, & .MuiDataGrid-row.Mui-selected .${OPEN_BUTTON_CLASS}, & .${OPEN_BUTTON_CLASS}:focus-visible`]: {
            color: 'primary.main',
          },
          '& .MuiDataGrid-row': {
            cursor: 'pointer',
          },
        }),
        '& .MuiDataGrid-columnHeader': {
          alignItems: 'stretch',
        },
        '& .MuiDataGrid-columnHeaderTitleContainer': {
          alignItems: 'stretch',
          height: '100%',
        },
        '& .MuiDataGrid-columnHeaderTitleContainerContent': {
          flex: '1 1 auto',
          minWidth: 0,
          overflow: 'hidden',
        },
        // Remove the sort icon's column entirely
        '& .MuiDataGrid-iconButtonContainer': {
          display: 'none',
        },
        ...dataGridProps.sx,
      }}
    />
  );
}

function HeaderWithSearch({
  headerName,
  renderOriginalHeader,
  headerParams,
  field,
  sortable,
  value,
  onChange,
  onClear,
}: {
  headerName: string;
  renderOriginalHeader?: (params: any) => React.ReactNode;
  headerParams: any;
  field: string;
  sortable: boolean;
  value: string;
  onChange: (field: string, value: string) => void;
  onClear: (field: string) => void;
}) {
  const isActive = Boolean(value);

  const apiRef = useGridApiContext();
  const sortModel = useGridSelector(apiRef, gridSortModelSelector);
  const sortEntry = sortModel.find((item) => item.field === field);
  const sortIndex = sortModel.length > 1 ? sortModel.findIndex((item) => item.field === field) : -1;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        justifyContent: 'space-between',
        py: 0.75,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          fontSize: '0.8125rem',
          fontWeight: 600,
          lineHeight: 1.3,
          overflow: 'hidden',
        }}
      >
        <Box
          component="span"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
          title={headerName}
        >
          {renderOriginalHeader ? renderOriginalHeader(headerParams) : headerName}
        </Box>

        {sortable && sortEntry && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              color: 'primary.main',
            }}
          >
            {sortEntry.sort === 'asc' ? (
              <ArrowUpwardRoundedIcon sx={{ fontSize: 14 }} />
            ) : (
              <ArrowDownwardRoundedIcon sx={{ fontSize: 14 }} />
            )}
            {sortIndex > -1 && (
              <Box component="span" sx={{ fontSize: '0.6875rem', ml: 0.125, fontWeight: 700 }}>
                {sortIndex + 1}
              </Box>
            )}
          </Box>
        )}
      </Box>

      <Box
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          height: 30,
          px: 0.75,
          borderRadius: 1,
          border: '1px solid',
          borderColor: (theme) =>
            isActive ? alpha(theme.palette.primary.main, 0.5) : alpha(theme.palette.text.primary, 0.15),
          bgcolor: (theme) =>
            isActive ? alpha(theme.palette.primary.main, 0.06) : alpha(theme.palette.text.primary, 0.03),
          transition: 'border-color 0.15s ease, background-color 0.15s ease',
          '&:hover': {
            borderColor: (theme) =>
              isActive ? theme.palette.primary.main : alpha(theme.palette.text.primary, 0.28),
          },
          '&:focus-within': {
            borderColor: 'primary.main',
            bgcolor: 'background.paper',
            boxShadow: (theme) => `0 0 0 3px ${alpha(theme.palette.primary.main, 0.15)}`,
          },
        }}
      >
        <SearchRoundedIcon
          sx={{ fontSize: 15, color: isActive ? 'primary.main' : 'text.disabled', flexShrink: 0 }}
        />
        <InputBase
          value={value}
          onChange={(e) => onChange(field, e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          sx={{ flex: 1, fontSize: '0.8125rem', '& .MuiInputBase-input': { p: 0 } }}
        />
        {value && (
          <ClearRoundedIcon
            onClick={() => onClear(field)}
            sx={{
              fontSize: 15,
              color: 'text.disabled',
              cursor: 'pointer',
              flexShrink: 0,
              borderRadius: '50%',
              '&:hover': { color: 'text.primary' },
            }}
          />
        )}
      </Box>
    </Box>
  );
}