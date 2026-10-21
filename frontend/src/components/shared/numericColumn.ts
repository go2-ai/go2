import type { GridComparatorFn } from '@mui/x-data-grid';

// Persian (U+06F0..) and Arabic-Indic (U+0660..) digits → 0-9.
const toLatinDigits = (text: string) =>
  text.replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));

/**
 * Text of a number for searching: Latin digits, without thousands
 * separators or spaces, and "." as decimal separator, so "1,000", "1000"
 * and "۱٬۰۰۰" all match.
 */
export const normalizeNumberText = (value: unknown): string =>
  toLatinDigits(String(value ?? ''))
    .replace(/[,\u066C\u060C\s]/g, '')
    .replace(/\u066B/g, '.')
    .toLowerCase();

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(normalizeNumberText(value));
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Sorts numbers numerically (also numeric strings such as entry numbers:
 * 1, 2, 10 instead of 1, 10, 2). Values that aren't numbers (e.g. "A-12",
 * a "No rate" label) sort after the numbers, in natural text order; blanks
 * come last.
 */
export const numericComparator: GridComparatorFn = (a, b) => {
  const blankA = a === null || a === undefined || a === '';
  const blankB = b === null || b === undefined || b === '';
  if (blankA || blankB) return blankA === blankB ? 0 : blankA ? 1 : -1;
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na !== null && nb !== null) return na - nb;
  if (na !== null) return -1;
  if (nb !== null) return 1;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};
