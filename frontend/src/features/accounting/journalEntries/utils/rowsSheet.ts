// Journal entry rows in Excel and CSV files.
//
// Exports have codes and names: Account code | Account name | Center N code |
// Center N name … | Description | Debit | Credit | Currency | Currency amount | Rate.
// The import template has the same columns without the names. Imports find
// the columns by their titles (in any of the app's languages), so both an
// export and a filled template can be imported; names are ignored. A file
// without recognizable titles is read in the template's column order. For
// foreign-currency rows, the missing one of amount, currency amount and rate
// is calculated from the other two.
import type { SheetCell, SheetColumn } from '../../../../utils/spreadsheet';
import type { JournalEntryRow } from '../components/types';
import { parseRowCells, type ClipboardContext, type PasteResult } from './clipboard';

type Translate = (key: string, options?: Record<string, unknown>) => string;

type Kind = 'text' | 'longText' | 'amount' | 'number';

interface FieldDef {
  /** accountCode, accountName, center1Code, center1Name, …, description, debit, credit, currency, currencyAmount, rate */
  field: string;
  kind: Kind;
  /** The first one is written; all are recognized when importing. */
  titles: (t: Translate) => string[];
}

const fieldDefs = (centerLevels: number, withNames: boolean): FieldDef[] => [
  { field: 'accountCode', kind: 'text', titles: (t) => [t('accountCode')] },
  ...(withNames ? [{ field: 'accountName', kind: 'longText' as const, titles: (t: Translate) => [t('accountName')] }] : []),
  ...Array.from({ length: centerLevels }, (_, i) => {
    const level = i + 1;
    return [
      {
        field: `center${level}Code`,
        kind: 'text' as const,
        titles: (t: Translate) => [t('rowsImport.centerCode', { level }), t('center', { level })],
      },
      ...(withNames
        ? [{ field: `center${level}Name`, kind: 'longText' as const, titles: (t: Translate) => [t('rowsImport.centerName', { level })] }]
        : []),
    ];
  }).flat(),
  { field: 'description', kind: 'longText', titles: (t) => [t('journalEntryDescription')] },
  { field: 'debit', kind: 'amount', titles: (t) => [t('debit')] },
  { field: 'credit', kind: 'amount', titles: (t) => [t('credit')] },
  { field: 'currency', kind: 'text', titles: (t) => [t('rowsImport.currency'), t('currencies')] },
  { field: 'currencyAmount', kind: 'amount', titles: (t) => [t('rowsImport.currencyAmount'), t('amount')] },
  { field: 'rate', kind: 'number', titles: (t) => [t('rate')] },
];

const sheetColumns = (defs: FieldDef[], t: Translate): SheetColumn[] =>
  defs.map((def) => {
    const header = def.titles(t)[0];
    return {
      header,
      width: def.kind === 'longText' ? 36 : Math.max(12, header.length + 4),
      // Codes stay text so Excel keeps leading zeros.
      text: def.kind === 'text',
      numFmt: def.kind === 'amount' ? '#,##0.00' : undefined,
    };
  });

/** Columns of an export: codes and names. */
export const exportSheetColumns = (centerLevels: number, t: Translate) => sheetColumns(fieldDefs(centerLevels, true), t);

/** Columns of the import template: codes only. */
export const templateSheetColumns = (centerLevels: number, t: Translate) => sheetColumns(fieldDefs(centerLevels, false), t);

const sheetNumber = (value: number | null | undefined) =>
  value === null || value === undefined || value === 0 ? null : value;

const cleanText = (value: string) => value.replace(/[\t\r\n]+/g, ' ').trim();

/** Rows in the export's column order. */
export const rowsToExportCells = (rows: JournalEntryRow[], ctx: ClipboardContext): SheetCell[][] =>
  rows.map((row) => {
    const account = ctx.accounts.find((a) => a.id === row.accountId);
    const centers = Array.from({ length: ctx.centerLevels }, (_, i) => {
      const id = row[`center${i + 1}Id` as keyof JournalEntryRow] as number | null;
      const center = id ? ctx.centers.find((c) => c.id === id) : undefined;
      return [center?.code ?? '', center ? cleanText(center.name ?? '') : ''];
    }).flat();
    const currency = ctx.currencies.find((c) => c.id === row.currencyId);
    const isMain = row.currencyId === ctx.mainCurrencyId;
    const description = row.description[ctx.primaryLocale]
      ?? Object.values(row.description).find((v) => v?.trim())
      ?? '';

    return [
      account ? account.full_code || account.code : '',
      account ? cleanText(account.name ?? '') : '',
      ...centers,
      cleanText(description),
      sheetNumber(row.debit),
      sheetNumber(row.credit),
      currency?.abr ?? '',
      isMain ? null : sheetNumber(row.currencyAmount),
      isMain ? null : sheetNumber(row.rate),
    ];
  });

// ── Import ───────────────────────────────────────────────────────────────

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Titles compare case-, spacing-, digit- and Arabic/Persian-letter-insensitively. */
const normalizeTitle = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/[\u200c\u200e\u200f]/g, ' ')
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/ك/g, 'ک')
    .replace(/[يى]/g, 'ی')
    .replace(/[:.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** The cells in the clipboard's column order, which parseRowCells reads. */
const toClipboardOrder = (line: string[], index: Map<string, number>, centerLevels: number): string[] => {
  const cell = (field: string) => {
    const i = index.get(field);
    return i === undefined ? '' : line[i] ?? '';
  };
  return [
    cell('accountCode'),
    '',
    ...Array.from({ length: centerLevels }, (_, i) => cell(`center${i + 1}Code`)),
    cell('description'),
    cell('debit'),
    cell('credit'),
    cell('currency'),
    cell('currencyAmount'),
    cell('rate'),
  ];
};

/**
 * Rows from the cells of an imported file. `translators` give the column
 * titles in each of the app's languages.
 */
export const parseImportCells = (cells: string[][], ctx: ClipboardContext, translators: Translate[]): PasteResult => {
  const defs = fieldDefs(ctx.centerLevels, true);
  const titleToField = new Map<string, string>();
  for (const t of translators) {
    for (const def of defs) {
      for (const title of def.titles(t)) titleToField.set(normalizeTitle(title), def.field);
    }
  }

  // The first line is a header when it names the account code and an amount.
  const header = cells[0] ?? [];
  const headerIndex = new Map<string, number>();
  header.forEach((title, i) => {
    const field = titleToField.get(normalizeTitle(title));
    if (field && !headerIndex.has(field)) headerIndex.set(field, i);
  });
  const hasHeader = headerIndex.has('accountCode') && (headerIndex.has('debit') || headerIndex.has('credit'));

  // Lines with nothing in the imported columns (e.g. only names) are skipped.
  const withData = (lines: string[][]) => lines.filter((line) => line.some((cell) => cell.trim() !== ''));

  if (hasHeader) {
    const lines = cells.slice(1).map((line) => toClipboardOrder(line, headerIndex, ctx.centerLevels));
    return parseRowCells(withData(lines), ctx, { skipTitleLine: false, completeAmounts: true });
  }

  // No recognizable titles: the template's column order.
  const templateIndex = new Map(fieldDefs(ctx.centerLevels, false).map((def, i) => [def.field, i]));
  return parseRowCells(withData(cells.map((line) => toClipboardOrder(line, templateIndex, ctx.centerLevels))), ctx, {
    completeAmounts: true,
  });
};
