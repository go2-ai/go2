// Exports what a DataGrid shows to an Excel file, in the browser: its visible
// columns (without the selection checkboxes, open buttons and actions) and its
// rows after the header search, in the grid's sort order. When more than one
// row is selected only those rows are exported.
import {
  GRID_CHECKBOX_SELECTION_COL_DEF,
  gridFilteredSortedRowEntriesSelector,
  gridRowSelectionIdsSelector,
  gridVisibleColumnDefinitionsSelector,
  type useGridApiRef,
} from '@mui/x-data-grid';
import { downloadExcel, type SheetCell } from './spreadsheet';

/** Grid columns that carry no data. */
const SKIPPED_FIELDS = new Set([GRID_CHECKBOX_SELECTION_COL_DEF.field, '__open__']);

export interface ExportGridToExcelOptions {
  apiRef: ReturnType<typeof useGridApiRef>;
  /** File name without the extension; also the sheet name. */
  title: string;
  /** Excel number formats per field; other number columns use the General format. */
  numberFormats?: Record<string, string>;
  /** Number fields whose zeros are left empty, as the grid shows them. */
  blankZeroFields?: string[];
  /** Right-to-left sheet (e.g. Persian). */
  rtl?: boolean;
}

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

/** Returns false when the grid isn't ready (nothing is exported). */
export const exportGridToExcel = async ({
  apiRef,
  title,
  numberFormats = {},
  blankZeroFields = [],
  rtl = false,
}: ExportGridToExcelOptions): Promise<boolean> => {
  const api = apiRef.current;
  if (!api) return false;

  const columns = gridVisibleColumnDefinitionsSelector(apiRef).filter(
    (column) => !SKIPPED_FIELDS.has(column.field) && column.type !== 'actions' && column.disableExport !== true
  );
  const selectedIds = gridRowSelectionIdsSelector(apiRef);
  const entries = gridFilteredSortedRowEntriesSelector(apiRef);
  const rows = (selectedIds.size > 1 ? entries.filter((entry) => selectedIds.has(entry.id)) : entries).map(
    (entry) => entry.model
  );

  const blankZeros = new Set(blankZeroFields);
  const cells: SheetCell[][] = rows.map((row) =>
    columns.map((column) => {
      if (column.type === 'number') {
        const raw = api.getRowValue(row, column);
        const number = toNumber(raw);
        // Text that isn't a number (e.g. an entry number with letters) stays text.
        if (number === null) return raw === null || raw === undefined || raw === '' ? null : String(raw);
        return number === 0 && blankZeros.has(column.field) ? null : number;
      }
      const value = api.getRowFormattedValue(row, column);
      return value === null || value === undefined ? '' : String(value);
    })
  );

  await downloadExcel({
    title,
    columns: columns.map((column) => ({
      header: column.headerName || column.field,
      // Grid pixels to Excel character widths, roughly.
      width: Math.max(8, Math.round((column.computedWidth || column.width || 100) / 7)),
      numFmt: column.type === 'number' ? numberFormats[column.field] : undefined,
    })),
    rows: cells,
    rtl,
  });
  return true;
};
