import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Box, InputBase, alpha } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, DataGridProps } from '@mui/x-data-grid';

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
}

export function ExtendedDataGrid({
  rows,
  columns,
  showHeaderSearchRow = false,
  excludeSearchFields = ['actions'],
  filterDebounceMs = 200,
  headerHeightWithSearch = 76,
  ...dataGridProps
}: ExtendedDataGridProps) {
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

  const columnsWithSearch = useMemo(() => {
    if (!showHeaderSearchRow) return columns;
    return columns.map((col) => {
      if (excludeSearchFields.includes(col.field) || col.type === 'actions') {
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
            value={draftFilters[col.field] || ''}
            onChange={handleFilterChange}
            onClear={handleFilterClear}
          />
        ),
      };
    });
  }, [columns, showHeaderSearchRow, excludeSearchFields, draftFilters, handleFilterChange, handleFilterClear]);

  return (
    <DataGrid
      rows={filteredRows}
      columns={columnsWithSearch}
      columnHeaderHeight={showHeaderSearchRow ? headerHeightWithSearch : undefined}
      {...dataGridProps}
      sx={{
        '& .MuiDataGrid-columnHeader': {
          // let our two-row layout use the full cell height instead of
          // being vertically centered by the grid's default alignment
          alignItems: 'stretch',
        },
        '& .MuiDataGrid-columnHeaderTitleContainer': {
          alignItems: 'stretch',
          height: '100%',
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
  value,
  onChange,
  onClear,
}: {
  headerName: string;
  renderOriginalHeader?: (params: any) => React.ReactNode;
  headerParams: any;
  field: string;
  value: string;
  onChange: (field: string, value: string) => void;
  onClear: (field: string) => void;
}) {
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
          fontSize: '0.8125rem',
          fontWeight: 600,
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={headerName}
      >
        {renderOriginalHeader ? renderOriginalHeader(headerParams) : headerName}
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
          borderColor: (theme) => alpha(theme.palette.text.primary, 0.15),
          bgcolor: (theme) => alpha(theme.palette.text.primary, 0.03),
          transition: 'border-color 0.15s ease, background-color 0.15s ease',
          '&:hover': {
            borderColor: (theme) => alpha(theme.palette.text.primary, 0.28),
          },
          '&:focus-within': {
            borderColor: 'primary.main',
            bgcolor: 'background.paper',
            boxShadow: (theme) => `0 0 0 3px ${alpha(theme.palette.primary.main, 0.15)}`,
          },
        }}
      >
        <SearchRoundedIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0 }} />
        <InputBase
          value={value}
          onChange={(e) => onChange(field, e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Filter"
          sx={{
            flex: 1,
            fontSize: '0.8125rem',
            '& .MuiInputBase-input': { p: 0 },
          }}
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