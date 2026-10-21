/** Rates are decimal strings; shown without trailing zeros. */
export const formatRate = (rate: string | number): string => {
  const value = Number(rate);
  if (!Number.isFinite(value)) return String(rate);
  return value.toLocaleString('en-US', { maximumSignificantDigits: 12, useGrouping: false });
};

/** 1 / rate, for "1 main currency = x foreign currency"; null for missing or zero rates. */
export const inverseRate = (rate: string | number | null | undefined): string | null => {
  if (rate === null || rate === undefined || rate === '') return null;
  const value = Number(rate);
  if (!Number.isFinite(value) || value === 0) return null;
  return (1 / value).toLocaleString('en-US', { maximumSignificantDigits: 8, useGrouping: false });
};
