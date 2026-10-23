// Excel and CSV files in the browser: writing a sheet, downloading it, and
// reading the cells of an uploaded .xlsx or .csv file. exceljs is loaded on
// demand: it's large and only needed here.

export type SheetCell = string | number | null;

export interface SheetColumn {
  header: string;
  /** In Excel character widths. */
  width?: number;
  /** Excel number format, e.g. '#,##0.00'. */
  numFmt?: string;
  /** Keep typed values as text (e.g. codes with leading zeros). */
  text?: boolean;
}

export interface SheetOptions {
  /** File name without the extension; also the sheet name. */
  title: string;
  columns: SheetColumn[];
  rows: SheetCell[][];
  /** Right-to-left sheet (e.g. Persian). */
  rtl?: boolean;
}

/** Excel's own limits and forbidden characters for sheet names. */
const sheetName = (name: string) => name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet1';

/** Characters not allowed in file names on common systems. */
const fileName = (name: string) => name.replace(/[<>:"/\\|?*]/g, ' ').trim() || 'export';

const loadExcelJs = async () => (await import('exceljs')).default;

export const downloadBlob = (blob: Blob, name: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

/** Builds an .xlsx file with one sheet (bold, frozen header) and downloads it. */
export const downloadExcel = async ({ title, columns, rows, rtl = false }: SheetOptions) => {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName(title), {
    views: [{ state: 'frozen', ySplit: 1, rightToLeft: rtl }],
  });

  sheet.columns = columns.map((column) => ({
    header: column.header,
    width: column.width ?? 14,
    style: column.text ? { numFmt: '@' } : column.numFmt ? { numFmt: column.numFmt } : {},
  }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${fileName(title)}.xlsx`
  );
};

const csvCell = (value: SheetCell) => {
  const text = value === null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Downloads a comma-separated file, UTF-8 with a BOM so Excel reads non-Latin text. */
export const downloadCsv = (title: string, rows: SheetCell[][]) => {
  const text = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  downloadBlob(new Blob(['\uFEFF', text], { type: 'text/csv;charset=utf-8' }), `${fileName(title)}.csv`);
};

// ── Reading ──────────────────────────────────────────────────────────────

export type SpreadsheetReadError = 'unsupported' | 'legacyExcel' | 'tooLarge' | 'unreadable';

export class SpreadsheetError extends Error {
  readonly reason: SpreadsheetReadError;
  constructor(reason: SpreadsheetReadError) {
    super(reason);
    this.reason = reason;
  }
}

export const MAX_SPREADSHEET_BYTES = 5 * 1024 * 1024;

export const SPREADSHEET_ACCEPT = '.xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const extension = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

/** The text of an exceljs cell value (numbers unformatted, formulas by their result). */
const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as { richText?: { text: string }[]; result?: unknown; text?: unknown; error?: unknown };
    if (Array.isArray(v.richText)) return v.richText.map((part) => part.text).join('');
    if ('result' in v) return cellText(v.result);
    if ('text' in v) return cellText(v.text);
  }
  return '';
};

const readXlsx = async (file: File): Promise<string[][]> => {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let col = 1; col <= sheet.columnCount; col++) cells.push(cellText(row.getCell(col).value).trim());
    if (cells.some((cell) => cell !== '')) rows.push(cells);
  });
  return rows;
};

/** UTF-8 when valid (Excel's "CSV UTF-8"), else Windows Arabic/Persian (Excel's plain "CSV" on Persian Windows). */
const decodeText = (buffer: ArrayBuffer): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('windows-1256').decode(buffer);
  }
};

/** The separator of the first line: Excel uses ';' in locales with a decimal comma. */
const detectDelimiter = (text: string): string => {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
  const counts = ['\t', ';', ','].map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length - 1 }));
  return counts.reduce((best, item) => (item.count > best.count ? item : best), { delimiter: ',', count: 0 }).delimiter;
};

/**
 * The cells of the first sheet of an .xlsx file, or of a .csv/.txt file,
 * as text, without empty lines. `parseDelimited` splits CSV text into cells.
 */
export const readSpreadsheetFile = async (
  file: File,
  parseDelimited: (text: string, delimiter: string) => string[][]
): Promise<string[][]> => {
  const ext = extension(file.name);
  if (ext === 'xls') throw new SpreadsheetError('legacyExcel');
  if (!['xlsx', 'csv', 'txt'].includes(ext)) throw new SpreadsheetError('unsupported');
  if (file.size > MAX_SPREADSHEET_BYTES) throw new SpreadsheetError('tooLarge');

  try {
    if (ext === 'xlsx') return await readXlsx(file);
    const text = decodeText(await file.arrayBuffer());
    return parseDelimited(text, detectDelimiter(text));
  } catch {
    throw new SpreadsheetError('unreadable');
  }
};
