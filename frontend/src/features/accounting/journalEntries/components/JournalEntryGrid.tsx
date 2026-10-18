// frontend/src/features/accounting/journalEntries/components/JournalEntryGrid.tsx
import { useMemo, useCallback } from 'react';
import type { EditableGridApi } from '../../../../components/editableGrid/types';
import type { ContextMenuAction } from '../../../../components/editableGrid/RowContextMenu';
import { EditableGrid } from '../../../../components/editableGrid/EditableGrid';
import type { ColumnDef } from '../../../../components/editableGrid/types';
import type { JournalEntryRow } from './types';
import type { Account } from '../../accounts/accountsApi';
import type { Center } from '../../centers/centersApi';
import type { AccountingCurrency } from '../../currencies/currenciesApi';
import { useTranslation } from 'react-i18next';
import { AccountCell } from './cells/AccountCell';
import { CenterCell } from './cells/CenterCell';
import { DebitCreditCell } from './cells/DebitCreditCell';
import { CurrencyCell } from './cells/CurrencyCell';
import { RateCell } from './cells/RateCell';
import { CurrencyAmountCell } from './cells/CurrencyAmountCell';
import { DescriptionCell } from './cells/DescriptionCell';
import { accountSelectionUpdates, allowedCenterTypeIds } from '../utils/accountSelection';
import { useTranslatableLocales } from '../../../../hooks/useTranslatableLocales';
import './cells/cellDisplay.css';

// Intl.NumberFormat is expensive to create; reuse one per number of decimals.
const numberFormats = new Map<number, Intl.NumberFormat>();
const formatAmount = (value: number | null | undefined, digits: number): string => {
  if (value === null || value === undefined || value === 0) return '';
  let format = numberFormats.get(digits);
  if (!format) {
    format = new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    numberFormats.set(digits, format);
  }
  return format.format(value);
};

type FinancialKey = 'debit' | 'credit' | 'rate' | 'currencyAmount';

interface JournalEntryGridProps {
  rows: JournalEntryRow[];
  accounts: Account[];
  centers: Center[];
  currencies: AccountingCurrency[];
  centerLevels: number;
  mainCurrencyId: number | null;
  mainCurrencyDecimalDigits: number;
  readOnly?: boolean;
  /** Replaces all rows (drag & drop reordering). */
  onChange: (rows: JournalEntryRow[]) => void;
  /**
   * Applies a patch computed from the row's latest state. Must be stable
   * (it is captured by memoized cells).
   */
  onRowUpdate: (rowId: string, update: (row: JournalEntryRow) => Partial<JournalEntryRow>) => void;
  onFieldChange: (rowId: string, key: FinancialKey, value: number | null) => void;
  getRowError?: (row: JournalEntryRow) => string | null;
  onCellClick?: (rowId: string, columnKey: string, event?: React.MouseEvent) => void;
  onActiveCellChange?: (rowId: string, columnKey: string) => void;
  blinkingCells?: Set<string>;
  organizationId: number;
  selectedRowId?: string | null;
  selectedCellKey?: string | null;
  selectedRowIds?: Set<string>;
  onAddRow?: () => void;
  footer?: React.ReactNode;
  contextMenuActions?: (row: JournalEntryRow) => ContextMenuAction[];
  apiRef?: React.MutableRefObject<EditableGridApi | null>;
  onRowHeaderMouseDown?: (rowId: string, event: React.MouseEvent) => void;
  onSelectAll?: () => void;
  selectAllLabel?: string;
  /** Open the "add account" flow for a row, prefilled with the search text. */
  onAddAccount?: (rowId: string, searchText: string) => void;
  /** Open the "add center" flow for a row's center level. */
  onAddCenter?: (rowId: string, level: number, centerTypeIds: number[], searchText: string) => void;
}

export const JournalEntryGrid = ({
  rows,
  accounts,
  centers,
  currencies,
  centerLevels,
  mainCurrencyId,
  mainCurrencyDecimalDigits,
  readOnly,
  onChange,
  onRowUpdate,
  onFieldChange,
  getRowError,
  onCellClick,
  onActiveCellChange,
  blinkingCells,
  organizationId,
  selectedRowId,
  selectedCellKey,
  selectedRowIds,
  onAddRow,
  footer,
  onAddAccount,
  onAddCenter,
  contextMenuActions,
  apiRef,
  onRowHeaderMouseDown,
  onSelectAll,
  selectAllLabel,
}: JournalEntryGridProps) => {
  const { t: tJE } = useTranslation('accounting');
  const { t } = useTranslation('shared');
  const { primaryLocale } = useTranslatableLocales({ organizationId });

  // Lookups for the read-only cell views
  const accountsById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const centersById = useMemo(() => new Map(centers.map(c => [c.id, c])), [centers]);
  const currenciesById = useMemo(() => new Map(currencies.map(c => [c.id, c])), [currencies]);

  // These only depend on the stable onRowUpdate, so `columns` (and with it
  // every memoized row) is not rebuilt when row data changes.
  const updateCell = useCallback((rowId: string, key: string, value: unknown) => {
    onRowUpdate(rowId, () => ({ [key]: value } as Partial<JournalEntryRow>));
  }, [onRowUpdate]);

  // Immediate (non-blur) clear of the opposite debit/credit field. Deliberately
  // bypasses applyFieldChange — that recalculation still only runs on blur.
  const clearOppositeFinancial = useCallback((rowId: string, oppositeKey: 'debit' | 'credit') => {
    onRowUpdate(rowId, (row) => (row[oppositeKey] != null ? { [oppositeKey]: null } : {}));
  }, [onRowUpdate]);

  const columns = useMemo<ColumnDef<JournalEntryRow>[]>(() => {
    const cols: ColumnDef<JournalEntryRow>[] = [
      {
        key: 'account',
        title: tJE('account'),
        width: 100,
        cellType: 'custom',
        align: 'center',
        isEditable: () => !readOnly,
        renderDisplay: (row) => {
          const account = row.accountId ? accountsById.get(row.accountId) : undefined;
          return (
            <span className="je-display-code" title={account?.name}>
              {account ? (account.full_code || account.code) : ''}
            </span>
          );
        },
        renderCell: (row) => (
          <AccountCell
            value={row.accountId}
            accounts={accounts}
            disabled={readOnly}
            onChange={(accountId) => {
              const selectedAccount = accounts.find(a => a.id === accountId);
              onRowUpdate(row.id, (current) => (
                current.accountId === accountId
                  ? {}
                  : accountSelectionUpdates(current, selectedAccount, accountId, mainCurrencyId)
              ));
            }}
            onAddNew={onAddAccount && !readOnly ? (text) => onAddAccount(row.id, text) : undefined}
            error={row.errors?.account}
          />
        ),
      },
    ];

    for (let i = 1; i <= centerLevels; i++) {
      const centerKey = `center${i}Id` as keyof JournalEntryRow;

      cols.push({
        key: `center${i}`,
        title: tJE('center', { level: i }),
        width: 110,
        cellType: 'custom',
        align: 'center',
        isEditable: (row) => allowedCenterTypeIds(row.accountId ? accountsById.get(row.accountId) : undefined, i).length > 0,
        renderDisplay: (row) => {
          const centerId = row[centerKey] as number | null;
          const center = centerId ? centersById.get(centerId) : undefined;
          return <span className="je-display-code" title={center?.name}>{center?.code ?? ''}</span>;
        },
        renderCell: (row) => {
          const selectedAccount = accounts.find(a => a.id === row.accountId);
          const allowedTypes = allowedCenterTypeIds(selectedAccount, i);
          const availableCenters = allowedTypes.length > 0
            ? centers.filter(c => allowedTypes.includes(c.center_type.id))
            : [];
          const isEnabled = allowedTypes.length > 0;

          return (
            <CenterCell
              value={row[centerKey] as number | null}
              centers={availableCenters}
              disabled={readOnly || !isEnabled}
              onChange={(centerId) => updateCell(row.id, centerKey as string, centerId)}
              onAddNew={onAddCenter && !readOnly && isEnabled
                ? (text) => onAddCenter(row.id, i, allowedTypes, text)
                : undefined}
              error={row.errors?.centers?.[i]}
            />
          );
        },
      });
    }

    cols.push({
      key: 'description',
      title: tJE('journalEntryDescription'),
      width: 400,
      cellType: 'custom',
      align: 'center',
      renderDisplay: (row) => {
        const text = row.description?.[primaryLocale]
          || Object.values(row.description ?? {}).find(v => v?.trim())
          || '';
        return <span className="je-display-text" title={text || undefined}>{text}</span>;
      },
      renderCell: (row) => (
        <DescriptionCell
          value={row.description}
          organizationId={organizationId}
          onChange={(value) => updateCell(row.id, 'description', value)}
          disabled={readOnly}
        />
      ),
    });

    cols.push({
      key: 'debit',
      title: tJE('debit'),
      width: 130,
      align: 'center',
      cellType: 'custom',
      renderDisplay: (row) => (
        <span className="je-display-num je-display-num--strong je-display-num--debit">
          {formatAmount(row.debit, mainCurrencyDecimalDigits)}
        </span>
      ),
      renderCell: (row) => (
        <DebitCreditCell
          value={row.debit}
          onChange={(value) => onFieldChange(row.id, 'debit', value)}
          onTypingStart={() => clearOppositeFinancial(row.id, 'credit')}
          decimalDigits={mainCurrencyDecimalDigits}
          color="error"
          disabled={readOnly}
          error={row.errors?.debitCredit}
        />
      ),
    });

    cols.push({
      key: 'credit',
      title: tJE('credit'),
      width: 130,
      align: 'center',
      cellType: 'custom',
      renderDisplay: (row) => (
        <span className="je-display-num je-display-num--strong je-display-num--credit">
          {formatAmount(row.credit, mainCurrencyDecimalDigits)}
        </span>
      ),
      renderCell: (row) => (
        <DebitCreditCell
          value={row.credit}
          onChange={(value) => onFieldChange(row.id, 'credit', value)}
          onTypingStart={() => clearOppositeFinancial(row.id, 'debit')}
          decimalDigits={mainCurrencyDecimalDigits}
          color="primary"
          disabled={readOnly}
          error={row.errors?.debitCredit}
        />
      ),
    });

    cols.push({
      key: 'currency',
      title: tJE('currencies'),
      width: 100,
      align: 'center',
      cellType: 'custom',
      isEditable: (row) => !readOnly && (accountsById.get(row.accountId ?? -1)?.accepts_other_currencies ?? false),
      renderDisplay: (row) => (
        <span className="je-display-center">{currenciesById.get(row.currencyId ?? -1)?.abr ?? ''}</span>
      ),
      renderCell: (row) => {
        const selectedAccount = accounts.find(a => a.id === row.accountId);
        const acceptsOther = selectedAccount?.accepts_other_currencies ?? false;

        return (
          <CurrencyCell
            value={row.currencyId}
            currencies={currencies}
            disabled={readOnly || !acceptsOther}
            onChange={(currencyId) => {
              onRowUpdate(row.id, () => ({
                currencyId,
                rate: null,
                currencyAmount: null,
              }));
            }}
          />
        );
      },
    });

    cols.push({
      key: 'currencyAmount',
      title: tJE('amount'),
      width: 130,
      align: 'center',
      cellType: 'custom',
      isEditable: (row) => !readOnly && row.currencyId !== mainCurrencyId,
      renderDisplay: (row) => {
        const currency = currenciesById.get(row.currencyId ?? -1);
        const digits = currency?.decimal_digits ?? mainCurrencyDecimalDigits;
        const isCredit = row.credit != null;
        return (
          <span className={`je-display-num je-display-num--strong ${isCredit ? 'je-display-num--credit' : 'je-display-num--debit'}`}>
            {row.currencyAmount ? `${row.currencyAmount < 0 ? '-' : ''}${formatAmount(Math.abs(row.currencyAmount), digits)}` : ''}
          </span>
        );
      },
      renderCell: (row) => {
        const selectedCurrency = currencies.find(c => c.id === row.currencyId);
        const decimalDigits = selectedCurrency?.decimal_digits ?? mainCurrencyDecimalDigits;
        const isMainCurrency = selectedCurrency?.id === mainCurrencyId;

        return (
          <CurrencyAmountCell
            value={row.currencyAmount}
            decimalDigits={decimalDigits}
            isCredit={row.credit != null}
            disabled={readOnly || isMainCurrency}
            onChange={(value) => onFieldChange(row.id, 'currencyAmount', value)}
            error={row.errors?.currencyAmount}
          />
        );
      },
    });

    cols.push({
      key: 'rate',
      title: tJE('rate'),
      width: 100,
      align: 'center',
      cellType: 'custom',
      isEditable: (row) => !readOnly && row.currencyId !== mainCurrencyId,
      renderDisplay: (row) => (
        <span className="je-display-num">{row.rate === null || row.rate === undefined ? '' : String(row.rate)}</span>
      ),
      renderCell: (row) => {
        const selectedCurrency = currencies.find(c => c.id === row.currencyId);
        const isMainCurrency = selectedCurrency?.id === mainCurrencyId;

        return (
          <RateCell
            value={row.rate}
            onChange={(value) => onFieldChange(row.id, 'rate', value)}
            disabled={readOnly || isMainCurrency}
            error={row.errors?.rate}
          />
        );
      },
    });

    return cols;
  }, [accounts, centers, currencies, centerLevels, mainCurrencyId, mainCurrencyDecimalDigits, readOnly, updateCell, onRowUpdate, onFieldChange, clearOppositeFinancial, tJE, organizationId, onAddAccount, onAddCenter,
      accountsById, centersById, currenciesById, primaryLocale]);

  return (
    <EditableGrid
      rows={rows}
      columns={columns}
      onChange={onChange}
      getRowError={getRowError}
      readOnly={readOnly}
      rowHeight={40}
      headerHeight={40}
      onCellClick={onCellClick}
      onActiveCellChange={onActiveCellChange}
      blinkingCells={blinkingCells}
      selectedRowId={selectedRowId}
      selectedCellKey={selectedCellKey}
      selectedRowIds={selectedRowIds}
      onAddRow={onAddRow}
      emptyStateLabel={t('commonActions.addNewRow')}
      footer={footer}
      contextMenuActions={contextMenuActions}
      apiRef={apiRef}
      onRowHeaderMouseDown={onRowHeaderMouseDown}
      onSelectAll={onSelectAll}
      selectAllLabel={selectAllLabel}
    />
  );
};