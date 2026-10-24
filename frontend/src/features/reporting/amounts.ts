/** Statement amounts: decimal strings from the server, negatives in parentheses. */
export const toNumber = (value: string | null | undefined): number | null =>
  value === null || value === undefined || value === '' ? null : Number(value);

export const formatAmount = (value: number | null, digits: number, locale: string): string => {
  if (value === null || Number.isNaN(value)) return '';
  const text = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    Math.abs(value)
  );
  return value < 0 ? `(${text})` : text;
};

export const formatPercent = (value: number | null, locale: string): string => {
  if (value === null || !Number.isFinite(value)) return '';
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value);
};

/** Excel number format for amounts with the currency's decimals; negatives in parentheses if asked. */
export const excelAmountFormat = (digits: number, { parentheses = false }: { parentheses?: boolean } = {}): string => {
  const format = digits > 0 ? `#,##0.${'0'.repeat(digits)}` : '#,##0';
  return parentheses ? `${format};(${format})` : format;
};

/** Current − previous, and its share of |previous|. */
export const variance = (current: number | null, previous: number | null) => {
  if (current === null && previous === null) return { amount: null, percent: null };
  const amount = (current ?? 0) - (previous ?? 0);
  const percent = previous ? amount / Math.abs(previous) : null;
  return { amount, percent };
};
