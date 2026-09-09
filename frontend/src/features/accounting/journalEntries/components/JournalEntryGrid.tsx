// frontend/src/features/accounting/journalEntries/components/JournalEntryGrid.tsx
import { useMemo, useCallback } from 'react';
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
  onChange: (rows: JournalEntryRow[]) => void;
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
}: JournalEntryGridProps) => {
  const { t: tJE } = useTranslation('accounting');
  const { t } = useTranslation('shared');

  const updateCell = useCallback((rowId: string, key: string, value: any) => {
    onChange(rows.map(r => r.id === rowId ? { ...r, [key]: value } : r));
  }, [rows, onChange]);

  const updateRow = useCallback((rowId: string, updates: Partial<JournalEntryRow>) => {
    onChange(rows.map(r => r.id === rowId ? { ...r, ...updates } : r));
  }, [rows, onChange]);

  // Immediate (non-blur) clear of the opposite debit/credit field. Deliberately
  // bypasses applyFieldChange — that recalculation still only runs on blur.
  const clearOppositeFinancial = useCallback((rowId: string, oppositeKey: 'debit' | 'credit') => {
    const row = rows.find(r => r.id === rowId);
    if (row && row[oppositeKey] != null) {
      updateCell(rowId, oppositeKey, null);
    }
  }, [rows, updateCell]);

  const getCenterTypeIds = (allowedTypes: number[] | null | undefined): number[] => {
    if (!allowedTypes || allowedTypes.length === 0) return [];
    return allowedTypes;
  };

  const columns = useMemo<ColumnDef<JournalEntryRow>[]>(() => {
    const cols: ColumnDef<JournalEntryRow>[] = [
      {
        key: 'account',
        title: tJE('account'),
        width: 100,
        cellType: 'custom',
        align: 'center',
        renderCell: (row) => (
          <AccountCell
            value={row.accountId}
            accounts={accounts}
            disabled={readOnly}
            onChange={(accountId) => {
              const selectedAccount = accounts.find(a => a.id === accountId);
              const acceptsOther = selectedAccount?.accepts_other_currencies ?? false;

              if (!acceptsOther) {
                updateRow(row.id, {
                  accountId,
                  currencyId: mainCurrencyId,
                  rate: null,
                  currencyAmount: null,
                  center1Id: null,
                  center2Id: null,
                  center3Id: null,
                  center4Id: null,
                  center5Id: null,
                  center6Id: null,
                });
              } else {
                updateRow(row.id, {
                  accountId,
                  currencyId: row.currencyId ?? mainCurrencyId,
                  center1Id: null,
                  center2Id: null,
                  center3Id: null,
                  center4Id: null,
                  center5Id: null,
                  center6Id: null,
                });
              }
            }}
            error={row.errors?.account}
          />
        ),
      },
    ];

    for (let i = 1; i <= centerLevels; i++) {
      const centerKey = `center${i}Id` as keyof JournalEntryRow;
      const allowedCenterTypesKey = `allowed_center_types_${i}`;

      cols.push({
        key: `center${i}`,
        title: tJE('center', { level: i }),
        width: 110,
        cellType: 'custom',
        align: 'center',
        renderCell: (row) => {
          const selectedAccount = accounts.find(a => a.id === row.accountId);
          const allowedTypes = getCenterTypeIds(
            selectedAccount?.[allowedCenterTypesKey as keyof Account] as number[] | null | undefined
          );
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
      renderCell: (row) => {
        const selectedAccount = accounts.find(a => a.id === row.accountId);
        const acceptsOther = selectedAccount?.accepts_other_currencies ?? false;

        return (
          <CurrencyCell
            value={row.currencyId}
            currencies={currencies}
            disabled={readOnly || !acceptsOther}
            onChange={(currencyId) => {
              updateRow(row.id, {
                currencyId,
                rate: null,
                currencyAmount: null,
              });
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
  }, [accounts, centers, currencies, centerLevels, mainCurrencyId, mainCurrencyDecimalDigits, readOnly, updateCell, updateRow, onFieldChange, clearOppositeFinancial, tJE, organizationId]);

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
      onAddRowAfter={(rowId) => {
        const index = rows.findIndex(r => r.id === rowId);
        if (index === -1) return;
        const newRow: JournalEntryRow = {
          id: `row-${Date.now()}-${Math.random()}`,
          row: rows.length + 1,
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
        };
        const newRows = [...rows];
        newRows.splice(index + 1, 0, newRow);
        onChange(newRows.map((r, i) => ({ ...r, row: i + 1 })));
      }}
      onDuplicateRow={(rowId) => {
        const index = rows.findIndex(r => r.id === rowId);
        if (index === -1) return;
        const newRow = { ...rows[index], id: `row-${Date.now()}-${Math.random()}`, row: rows.length + 1 };
        const newRows = [...rows];
        newRows.splice(index + 1, 0, newRow);
        onChange(newRows.map((r, i) => ({ ...r, row: i + 1 })));
      }}
      onDeleteRow={(rowId) => {
        const newRows = rows.filter(r => r.id !== rowId);
        onChange(newRows.map((r, i) => ({ ...r, row: i + 1 })));
      }}
    />
  );
};