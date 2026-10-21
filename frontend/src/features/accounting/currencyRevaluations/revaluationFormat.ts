const formats = new Map<number, Intl.NumberFormat>();

/** Amount with a fixed number of decimals and thousands separators. */
export const formatRevaluationAmount = (value: number, digits: number) => {
  let format = formats.get(digits);
  if (!format) {
    format = new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    formats.set(digits, format);
  }
  return format.format(value);
};
