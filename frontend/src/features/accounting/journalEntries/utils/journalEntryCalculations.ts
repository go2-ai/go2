export type FinancialGroup = 'amount' | 'rate' | 'currencyAmount';

export interface FinancialFields {
  debit: number | null;
  credit: number | null;
  rate: number | null;
  currencyAmount: number | null;
  // Recency stack of the three financial groups, oldest first, most-recently
  // edited last. Used to resolve the "all three filled" ambiguity in
  // applyFieldChange (see below).
  financialEditOrder?: FinancialGroup[];
}

export type FinancialKey = 'debit' | 'credit' | 'rate' | 'currencyAmount';

const EPSILON = 0.000000000001;

const isZero = (val: number | null | undefined): boolean => {
  return val === null || val === undefined || Math.abs(val) < EPSILON;
};

const ALL_GROUPS: FinancialGroup[] = ['amount', 'rate', 'currencyAmount'];

const keyToGroup = (key: FinancialKey): FinancialGroup =>
  key === 'debit' || key === 'credit' ? 'amount' : key;

const pushEditOrder = (prevOrder: FinancialGroup[], group: FinancialGroup): FinancialGroup[] =>
  [...prevOrder.filter(g => g !== group), group];

// Orders `groups` oldest-first based on prevOrder (a recency stack,
// oldest -> newest). Any group never seen in prevOrder is treated as older
// than anything that has been touched.
const orderOldestFirst = (prevOrder: FinancialGroup[], groups: FinancialGroup[]): FinancialGroup[] => {
  const tracked = prevOrder.filter(g => groups.includes(g));
  const untracked = groups.filter(g => !tracked.includes(g));
  return [...untracked, ...tracked];
};

/**
 * Applies a single field edit and recomputes dependent fields, based on which
 * field was just edited.
 *
 * Model: debit/credit "amount" = rate * currencyAmount (one equation, two
 * degrees of freedom among the three groups: amount, rate, currencyAmount).
 *
 * - If fewer than all three groups are currently filled, there's only one
 *   sensible thing to recompute (the classic 2-variable case): edit one,
 *   recompute whichever of the remaining two already has a value.
 *
 * - If all three groups are filled and the user edits one of them, we can no
 *   longer satisfy the equation by recomputing an arbitrary field — we need
 *   to know which of the OTHER two fields to treat as the anchor (leave
 *   unchanged) and which to recompute. The rule: the field edited
 *   *second-most-recently* (relative to the two other groups) stays fixed as
 *   the anchor; the field edited *least recently* (the "oldest" of the two)
 *   gets recalculated from the anchor plus the field just edited.
 */
export const applyFieldChange = <T extends FinancialFields>(
  row: T,
  key: FinancialKey,
  value: number | null
): T => {
  const group = keyToGroup(key);
  const prevOrder = row.financialEditOrder ?? [];

  const updated: T = { ...row, [key]: value };

  // debit and credit are mutually exclusive
  if (key === 'debit' && value !== null) updated.credit = null;
  if (key === 'credit' && value !== null) updated.debit = null;

  const debit = updated.debit ?? 0;
  const credit = updated.credit ?? 0;
  const netAmount = Math.abs(debit - credit);
  const hasNetAmount = !isZero(netAmount);
  const rate = updated.rate;
  const hasRate = !isZero(rate);
  const currencyAmount = updated.currencyAmount;
  const hasCurrencyAmount = !isZero(currencyAmount);
  const wasCredit = !isZero(row.credit);

  const otherGroups = ALL_GROUPS.filter(g => g !== group);
  const wasFilled = (g: FinancialGroup): boolean => {
    if (g === 'amount') return !isZero(row.debit) || !isZero(row.credit);
    if (g === 'rate') return !isZero(row.rate);
    return !isZero(row.currencyAmount);
  };
  const otherFilled = otherGroups.every(wasFilled);

  if (otherFilled) {
    const [oldestGroup, anchorGroup] = orderOldestFirst(prevOrder, otherGroups);
    void oldestGroup; // documents intent; the branches below encode which one it is

    if (group === 'amount') {
      if (anchorGroup === 'rate') {
        // rate is the anchor; currencyAmount (the oldest-touched field) is recomputed
        updated.currencyAmount = hasRate && hasNetAmount ? netAmount / (rate as number) : null;
      } else {
        // currencyAmount is the anchor; rate is recomputed
        updated.rate = hasCurrencyAmount && hasNetAmount ? netAmount / (currencyAmount as number) : null;
      }
    } else if (group === 'rate') {
      if (anchorGroup === 'amount') {
        // amount (debit/credit) is the anchor; currencyAmount is recomputed
        updated.currencyAmount = hasRate && hasNetAmount ? netAmount / (rate as number) : null;
      } else {
        // currencyAmount is the anchor; amount is recomputed, preserving debit/credit side
        const newAmount = hasRate && hasCurrencyAmount ? (currencyAmount as number) * (rate as number) : null;
        if (wasCredit) {
          updated.credit = newAmount;
          updated.debit = null;
        } else {
          updated.debit = newAmount;
          updated.credit = null;
        }
      }
    } else {
      // group === 'currencyAmount'
      if (anchorGroup === 'amount') {
        // amount is the anchor; rate is recomputed
        updated.rate = hasCurrencyAmount && hasNetAmount ? netAmount / (currencyAmount as number) : null;
      } else {
        // rate is the anchor; amount is recomputed, preserving debit/credit side
        const newAmount = hasRate && hasCurrencyAmount ? (currencyAmount as number) * (rate as number) : null;
        if (wasCredit) {
          updated.credit = newAmount;
          updated.debit = null;
        } else {
          updated.debit = newAmount;
          updated.credit = null;
        }
      }
    }
  } else {
    // Fewer than 3 groups filled — simple single-degree-of-freedom behavior.
    switch (key) {
      case 'debit':
      case 'credit': {
        if (hasRate) {
          updated.currencyAmount = hasNetAmount ? netAmount / (rate as number) : null;
        } else if (hasCurrencyAmount) {
          updated.rate = hasNetAmount ? netAmount / (currencyAmount as number) : null;
        }
        break;
      }
      case 'rate': {
        if (hasNetAmount) {
          updated.currencyAmount = hasRate ? netAmount / (rate as number) : null;
        } else if (hasCurrencyAmount) {
          updated.debit = hasRate ? (currencyAmount as number) * (rate as number) : null;
          updated.credit = null;
        }
        break;
      }
      case 'currencyAmount': {
        if (hasRate) {
          updated.debit = hasCurrencyAmount ? (currencyAmount as number) * (rate as number) : null;
          updated.credit = null;
        } else if (hasNetAmount) {
          updated.rate = hasCurrencyAmount ? netAmount / (currencyAmount as number) : null;
        }
        break;
      }
    }
  }

  updated.financialEditOrder = pushEditOrder(prevOrder, group);
  return updated;
};

/**
 * Swap debit and credit values (F10)
 */
export const swapDebitCredit = (row: FinancialFields): FinancialFields => {
  const { debit, credit } = row;
  return {
    ...row,
    debit: credit,
    credit: debit,
  };
};

/**
 * Swap rate to its reciprocal (F9)
 * e.g. 5 → 0.2
 */
export const swapRate = (rate: number | null): number | null => {
  if (rate === null || isZero(rate)) return null;
  return 1 / rate;
};

/**
 * Balance the journal entry by adjusting the currently selected row (F8)
 * The difference between total debit and total credit is added to the selected row
 */
export const balanceRow = (
  row: FinancialFields,
  totalDebitWithoutRow: number,
  totalCreditWithoutRow: number
): FinancialFields => {
  const diff = totalDebitWithoutRow - totalCreditWithoutRow;

  if (Math.abs(diff) < EPSILON) {
    return row; // already balanced
  }

  if (diff > 0) {
    return {
      ...row,
      credit: Math.abs(diff),
      debit: null,
    };
  } else {
    return {
      ...row,
      debit: Math.abs(diff),
      credit: null,
    };
  }
};

/**
 * Format a number with thousand separators and decimal digits
 */
export const formatNumber = (value: number | null, decimalDigits: number): string => {
  if (value === null || value === undefined) return '';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimalDigits,
    maximumFractionDigits: decimalDigits,
  });
};

/**
 * Parse a number from a string with thousand separators
 */
export const parseNumber = (input: string): number | null => {
  const raw = input.replace(/,/g, '').trim();
  if (raw === '') return null;
  const num = parseFloat(raw);
  return isNaN(num) ? null : num;
};