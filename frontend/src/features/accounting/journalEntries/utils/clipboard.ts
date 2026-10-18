// Copy/paste of journal entry rows as tab-separated text.
//
// The text format is what Excel/Google Sheets put on the clipboard, so rows
// can go to a spreadsheet and back. Column order (one row per line):
//
//   Account code | Account name | Center 1 … Center N | Description |
//   Debit | Credit | Currency | Currency amount | Rate
//
// When copying inside the app we also remember the exact rows, so pasting
// into another journal entry of the same organization is lossless (all
// description translations, exact ids).
import type { Account } from '../../accounts/accountsApi';
import type { Center } from '../../centers/centersApi';
import type { AccountingCurrency } from '../../currencies/currenciesApi';
import type { JournalEntryRow } from '../components/types';
import { allowedCenterTypeIds } from './accountSelection';

export interface ClipboardContext {
  organizationId: number;
  accounts: Account[];
  centers: Center[];
  currencies: AccountingCurrency[];
  centerLevels: number;
  mainCurrencyId: number | null;
  primaryLocale: string;
}

/**
 * Row data without the grid's local identity. (Listed explicitly: `Omit` on a
 * type with an index signature would drop all named fields.)
 */
export type RowData = Pick<JournalEntryRow,
  | 'accountId' | 'center1Id' | 'center2Id' | 'center3Id' | 'center4Id' | 'center5Id' | 'center6Id'
  | 'debit' | 'credit' | 'currencyId' | 'rate' | 'currencyAmount'
  | 'description' | 'errors' | 'financialEditOrder'>;

const columnCount = (centerLevels: number) => 2 + centerLevels + 6;

const accountCode = (a: Account) => a.full_code || a.code;

const cleanText = (value: string) => value.replace(/[\t\r\n]+/g, ' ').trim();

const numberText = (value: number | null | undefined) =>
  value === null || value === undefined || value === 0 ? '' : String(value);

// ── Copy ──────────────────────────────────────────────────────────────

export const rowsToTsv = (rows: JournalEntryRow[], ctx: ClipboardContext): string =>
  rows.map((row) => {
    const account = ctx.accounts.find(a => a.id === row.accountId);
    const centerCodes = Array.from({ length: ctx.centerLevels }, (_, i) => {
      const id = row[`center${i + 1}Id` as keyof JournalEntryRow] as number | null;
      return ctx.centers.find(c => c.id === id)?.code ?? '';
    });
    const currency = ctx.currencies.find(c => c.id === row.currencyId);
    const isMain = row.currencyId === ctx.mainCurrencyId;
    const description = row.description[ctx.primaryLocale]
      ?? Object.values(row.description).find(v => v?.trim())
      ?? '';

    return [
      account ? accountCode(account) : '',
      account ? cleanText(account.name ?? '') : '',
      ...centerCodes,
      cleanText(description),
      numberText(row.debit),
      numberText(row.credit),
      currency?.abr ?? '',
      isMain ? '' : numberText(row.currencyAmount),
      isMain ? '' : numberText(row.rate),
    ].join('\t');
  }).join('\n');

let richClipboard: { text: string; organizationId: number; rows: RowData[] } | null = null;

const toRowData = (row: JournalEntryRow): RowData => ({
  accountId: row.accountId,
  center1Id: row.center1Id,
  center2Id: row.center2Id,
  center3Id: row.center3Id,
  center4Id: row.center4Id,
  center5Id: row.center5Id,
  center6Id: row.center6Id,
  debit: row.debit,
  credit: row.credit,
  currencyId: row.currencyId,
  rate: row.rate,
  currencyAmount: row.currencyAmount,
  description: { ...row.description },
  errors: {},
  financialEditOrder: [...(row.financialEditOrder ?? [])],
});

/** Builds the clipboard text and remembers the exact rows for in-app pastes. */
export const copyRows = (rows: JournalEntryRow[], ctx: ClipboardContext): string => {
  const text = rowsToTsv(rows, ctx);
  richClipboard = { text, organizationId: ctx.organizationId, rows: rows.map(toRowData) };
  return text;
};

// ── Paste ─────────────────────────────────────────────────────────────

/** True when pasted text should become rows rather than go into one input. */
export const looksLikeRows = (text: string): boolean => /[\t\n]/.test(text.replace(/\r?\n$/, ''));

/** Splits spreadsheet text into cells, honouring Excel's "quoted" cells. */
export const parseTsvCells = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let atCellStart = true;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else { inQuotes = false; }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && atCellStart) { inQuotes = true; atCellStart = false; continue; }
    if (ch === '\t') { row.push(cell); cell = ''; atCellStart = true; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; atCellStart = true; continue; }
    cell += ch;
    atCellStart = false;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }

  return rows.filter(r => r.some(c => c.trim() !== ''));
};

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

const normalizeDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, d => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, d => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/٫/g, '.')
    .trim();

/** Parses a spreadsheet number: '' → null, 'abc' → NaN, '1,234.5' → 1234.5. */
export const parseSheetNumber = (value: string | undefined): number | null => {
  const raw = normalizeDigits(value ?? '').replace(/[,٬\s]/g, '');
  if (raw === '') return null;
  // Accounting negatives: (123)
  const negative = /^\(.*\)$/.test(raw);
  const num = Number(negative ? raw.slice(1, -1) : raw);
  if (Number.isNaN(num)) return NaN;
  return negative ? -num : num;
};

export interface PasteResult {
  rows: RowData[];
  /** Codes (account/center/currency) or numbers that could not be resolved. */
  unmatched: number;
}

const emptyRowData = (mainCurrencyId: number | null): RowData => ({
  accountId: null,
  center1Id: null,
  center2Id: null,
  center3Id: null,
  center4Id: null,
  center5Id: null,
  center6Id: null,
  debit: null,
  credit: null,
  currencyId: mainCurrencyId,
  rate: null,
  currencyAmount: null,
  description: {},
  errors: {},
  financialEditOrder: [],
});

export const parseRowsText = (text: string, ctx: ClipboardContext): PasteResult => {
  const cells = parseTsvCells(text);
  const result: RowData[] = [];
  let unmatched = 0;

  const centerStart = 2;
  const descIndex = centerStart + ctx.centerLevels;
  const debitIndex = descIndex + 1;

  cells.forEach((line, lineIndex) => {
    const cell = (i: number) => (line[i] ?? '').trim();

    // Skip a header line (e.g. "Debit" / "Credit" titles from a sheet).
    const debitNum = parseSheetNumber(cell(debitIndex));
    const creditNum = parseSheetNumber(cell(debitIndex + 1));
    if (lineIndex === 0 && (Number.isNaN(debitNum) || Number.isNaN(creditNum))) return;

    const data = emptyRowData(ctx.mainCurrencyId);

    const code = normalizeDigits(cell(0));
    const account = code ? ctx.accounts.find(a => accountCode(a) === code) : undefined;
    if (code && !account) unmatched++;
    data.accountId = account?.id ?? null;

    for (let level = 1; level <= ctx.centerLevels; level++) {
      const centerCode = normalizeDigits(cell(centerStart + level - 1));
      if (!centerCode) continue;
      const allowed = allowedCenterTypeIds(account, level);
      const center = allowed.length > 0
        ? ctx.centers.find(c => c.code === centerCode && allowed.includes(c.center_type.id))
        : undefined;
      if (center) {
        (data as Record<string, unknown>)[`center${level}Id`] = center.id;
      } else {
        unmatched++;
      }
    }

    const description = cell(descIndex);
    if (description) data.description = { [ctx.primaryLocale]: description };

    // Debit/credit; a negative debit is a credit and vice versa.
    const amounts = [debitNum, creditNum].map(n => (n === null || Number.isNaN(n) ? null : n));
    if ((debitNum !== null && Number.isNaN(debitNum)) || (creditNum !== null && Number.isNaN(creditNum))) unmatched++;
    let [debit, credit] = amounts;
    if (debit !== null && debit < 0) { credit = (credit ?? 0) + Math.abs(debit); debit = null; }
    if (credit !== null && credit < 0) { debit = (debit ?? 0) + Math.abs(credit); credit = null; }
    data.debit = debit || null;
    data.credit = credit || null;

    const abr = cell(debitIndex + 2);
    const acceptsOther = account?.accepts_other_currencies ?? false;
    let currencyId = ctx.mainCurrencyId;
    if (abr) {
      const currency = ctx.currencies.find(c => c.abr.toLowerCase() === abr.toLowerCase());
      if (!currency) unmatched++;
      else if (currency.id === ctx.mainCurrencyId || acceptsOther) currencyId = currency.id;
      else unmatched++;
    }
    data.currencyId = currencyId;

    if (currencyId !== ctx.mainCurrencyId) {
      const amount = parseSheetNumber(cell(debitIndex + 3));
      const rate = parseSheetNumber(cell(debitIndex + 4));
      data.currencyAmount = amount === null || Number.isNaN(amount) ? null : Math.abs(amount);
      data.rate = rate === null || Number.isNaN(rate) ? null : rate;
      if (Number.isNaN(amount) || Number.isNaN(rate)) unmatched++;
    }

    result.push(data);
  });

  return { rows: result, unmatched };
};

/**
 * Rows to insert for a paste. Uses the exact copied rows when the clipboard
 * still holds what was copied in this app for this organization.
 */
export const rowsFromClipboardText = (text: string, ctx: ClipboardContext): PasteResult => {
  if (
    richClipboard
    && richClipboard.organizationId === ctx.organizationId
    && richClipboard.text.replace(/\r/g, '').trim() === text.replace(/\r/g, '').trim()
  ) {
    return {
      rows: richClipboard.rows.map(r => ({ ...r, description: { ...r.description }, errors: {} })),
      unmatched: 0,
    };
  }
  return parseRowsText(text, ctx);
};

export const clipboardColumnTitles = (centerLevels: number, t: (key: string, opts?: Record<string, unknown>) => string) => [
  t('accountCode'),
  t('accountName'),
  ...Array.from({ length: centerLevels }, (_, i) => t('center', { level: i + 1 })),
  t('journalEntryDescription'),
  t('debit'),
  t('credit'),
  t('currencies'),
  t('amount'),
  t('rate'),
].slice(0, columnCount(centerLevels));
