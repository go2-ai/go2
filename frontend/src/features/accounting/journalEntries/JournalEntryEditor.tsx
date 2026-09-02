// frontend/src/features/accounting/journalEntries/JournalEntryEditor.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Chip,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DraftsIcon from '@mui/icons-material/Drafts';
import { useTranslation } from 'react-i18next';
import { JournalEntryGrid } from './components/JournalEntryGrid';
import { JournalEntryFooter } from './components/JournalEntryFooter';
import type { JournalEntryRow } from './components/types';
import {
  useCreateJournalEntryMutation,
  useUpdateJournalEntryMutation,
  useGetJournalEntryQuery,
} from './journalEntriesApi';
import { useGetAccountsQuery } from '../accounts/accountsApi';
import { useGetCentersQuery } from '../centers/centersApi';
import { useGetCurrenciesQuery } from '../currencies/currenciesApi';
import { useGetAccountingSettingsQuery } from '../settings/settingsApi';
import { useActiveFiscalYear } from '../../../hooks/useActiveFiscalYear';
import {
  applyFieldChange,
  balanceRow,
  swapDebitCredit,
  swapRate,
  type FinancialKey,
} from './utils/journalEntryCalculations';
import { useJournalEntryKeyboard } from './hooks/useJournalEntryKeyboard';
import { useToast } from '../../../contexts/ToastContext';
import { BaseDatePicker } from '../../../components/shared/BaseDatePicker';
import MultiLocaleInput from '../../../components/shared/MultiLocaleInput';

const FINANCIAL_KEYS: readonly string[] = ['debit', 'credit', 'rate', 'currencyAmount'];

const createEmptyRow = (rowNumber: number, defaultCurrencyId: number | null): JournalEntryRow => ({
  id: `row-${Date.now()}-${Math.random()}`,
  row: rowNumber,
  accountId: null,
  center1Id: null,
  center2Id: null,
  center3Id: null,
  center4Id: null,
  center5Id: null,
  center6Id: null,
  debit: null,
  credit: null,
  currencyId: defaultCurrencyId,
  rate: null,
  currencyAmount: null,
  description: {},
  errors: {},
  financialEditOrder: [],
});

interface JournalEntryEditorProps {
  journalEntryId?: number;
  focusItemId?: number;
}

export const JournalEntryEditor = ({ journalEntryId, focusItemId }: JournalEntryEditorProps) => {
  const { t } = useTranslation('shared');
  const { t: tJE } = useTranslation('accounting');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const { showSuccess, showError } = useToast();

  const { activeFiscalYearId, activeFiscalYear } = useActiveFiscalYear(orgId);

  const { data: accounts } = useGetAccountsQuery(orgId, { skip: !orgId });
  const { data: centers } = useGetCentersQuery({ organizationId: orgId }, { skip: !orgId });
  const { data: currencies } = useGetCurrenciesQuery(orgId, { skip: !orgId });
  const { data: settings } = useGetAccountingSettingsQuery(orgId, { skip: !orgId });

  const {
    data: fetchedJournalEntry,
    isLoading: isLoadingJournalEntry,
    error: journalEntryFetchError,
  } = useGetJournalEntryQuery(
    { organizationId: orgId, id: journalEntryId! },
    { skip: !journalEntryId }
  );

  const [createJournalEntry] = useCreateJournalEntryMutation();
  const [updateJournalEntry] = useUpdateJournalEntryMutation();

  const [rows, setRows] = useState<JournalEntryRow[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [description, setDescription] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<number | null>(journalEntryId ?? null);
  const [editingState, setEditingState] = useState<'draft' | 'booked' | 'approved' | null>(null);
  const [saving, setSaving] = useState(false);
  const [blinkingCells, setBlinkingCells] = useState<Set<string>>(new Set());
  const [originalItemIds, setOriginalItemIds] = useState<Set<number>>(new Set());

  const mainCurrency = useMemo(
    () => currencies?.find(c => c.id === settings?.main_currency_id) ?? null,
    [currencies, settings]
  );
  const mainCurrencyDecimalDigits = mainCurrency?.decimal_digits ?? 2;
  const centerLevels = settings?.center_levels ?? 3;

  useEffect(() => {
    if (rows.length === 0 && settings?.main_currency_id && !journalEntryId) {
      setRows([createEmptyRow(1, settings.main_currency_id)]);
    }
  }, [settings?.main_currency_id]);

  useEffect(() => {
    if (!fetchedJournalEntry) return;

    setEditingId(fetchedJournalEntry.id);
    setEditingState(fetchedJournalEntry.state);
    setDate(fetchedJournalEntry.date);
    setDescription({
      en: fetchedJournalEntry.t?.description?.en ?? '',
      fa: fetchedJournalEntry.t?.description?.fa ?? '',
    });

    const serverIds = (fetchedJournalEntry.items ?? [])
      .map(item => item.id)
      .filter((id): id is number => id != null);
      
    setOriginalItemIds(new Set(serverIds));

    const mappedRows: JournalEntryRow[] = (fetchedJournalEntry.items ?? []).map((item) => ({
      id: `row-${Date.now()}-${Math.random()}-${item.row}`,
      serverId: item.id,
      row: item.row,
      accountId: item.account_id,
      center1Id: item.center1_id,
      center2Id: item.center2_id,
      center3Id: item.center3_id,
      center4Id: item.center4_id,
      center5Id: item.center5_id,
      center6Id: item.center6_id,
      debit: item.debit ?? null,
      credit: item.credit ?? null,
      currencyId: item.currency_id,
      rate: item.rate ?? null,
      currencyAmount: item.currency_amount != null ? Math.abs(item.currency_amount) : null,
      description: {
        en: item.t?.description?.en ?? '',
        fa: item.t?.description?.fa ?? '',
      },
      errors: {},
      financialEditOrder: [],
    }));

    setRows(mappedRows);

    // Select the focused item (when opened from JournalEntryItemsPage)
    if (focusItemId) {
      const targetRow = mappedRows.find(r => r.serverId === focusItemId);
      if (targetRow) {
        setSelectedRowId(targetRow.id);
        setSelectedCellKey('account');
        setSelectedRowIds(new Set([targetRow.id]));
        setSelectionAnchorId(targetRow.id);
      }
    }
  }, [fetchedJournalEntry, focusItemId]);

  const triggerBlink = useCallback((rowId: string, key: string) => {
    const cellId = `${rowId}-${key}`;
    setBlinkingCells(prev => new Set(prev).add(cellId));
    setTimeout(() => {
      setBlinkingCells(prev => {
        const next = new Set(prev);
        next.delete(cellId);
        return next;
      });
    }, 3000);
  }, []);

  const handleRowsChange = useCallback((newRows: JournalEntryRow[]) => {
    setRows(newRows);
  }, []);

  const handleCellChange = useCallback((rowId: string, key: string, value: any) => {
    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      if (FINANCIAL_KEYS.includes(key)) {
        return applyFieldChange(row, key as FinancialKey, value);
      }
      return { ...row, [key]: value };
    }));
  }, []);

  const handleRowSelect = useCallback((rowId: string, cellKey: string, event?: React.MouseEvent) => {
    const isCtrl = !!(event && (event.ctrlKey || event.metaKey));
    setSelectedRowIds(prev => {
      if (isCtrl) {
        const next = new Set(prev);
        if (next.has(rowId)) next.delete(rowId); else next.add(rowId);
        return next;
      }
      return new Set([rowId]);
    });
    setSelectionAnchorId(rowId);
    setSelectedRowId(rowId);
    setSelectedCellKey(cellKey);
  }, []);

  const handleActiveCellChange = useCallback((rowId: string, cellKey: string) => {
    setSelectedRowId(rowId);
    setSelectedCellKey(cellKey);
  }, []);

  const handleSelectionChange = useCallback((ids: Set<string>, anchorId?: string | null) => {
    setSelectedRowIds(ids);
    if (anchorId !== undefined) setSelectionAnchorId(anchorId);
  }, []);

  const handleAddRow = useCallback(() => {
    setRows(prev => {
      if (prev.length === 0) {
        return [createEmptyRow(1, settings?.main_currency_id ?? null)];
      }
      return [...prev, createEmptyRow(prev.length + 1, settings?.main_currency_id ?? null)];
    });
  }, [settings?.main_currency_id]);

  const handleRowDuplicate = useCallback((rowId: string) => {
    setRows(prev => {
      const index = prev.findIndex(r => r.id === rowId);
      if (index === -1) return prev;
      const newRow = { ...prev[index], id: `row-${Date.now()}-${Math.random()}`, row: prev.length + 1 };
      const newRows = [...prev];
      newRows.splice(index + 1, 0, newRow);
      return newRows.map((r, i) => ({ ...r, row: i + 1 }));
    });
  }, []);

  const handleRowAddAfter = useCallback((rowId: string) => {
    setRows(prev => {
      const index = prev.findIndex(r => r.id === rowId);
      if (index === -1) return prev;
      const newRow = createEmptyRow(prev.length + 1, settings?.main_currency_id ?? null);
      const newRows = [...prev];
      newRows.splice(index + 1, 0, newRow);
      return newRows.map((r, i) => ({ ...r, row: i + 1 }));
    });
  }, [settings?.main_currency_id]);

  const handleBalance = useCallback(() => {
    if (rows.length === 0) return;
    const lastRow = rows[rows.length - 1];
    const otherRows = rows.slice(0, -1);
    const totalDebitWithoutLast = otherRows.reduce((sum, r) => sum + (r.debit ?? 0), 0);
    const totalCreditWithoutLast = otherRows.reduce((sum, r) => sum + (r.credit ?? 0), 0);

    const balancedRow = balanceRow(lastRow, totalDebitWithoutLast, totalCreditWithoutLast);
    setRows(prev => {
      const updated = [...prev];
      updated[updated.length - 1] = { ...lastRow, ...balancedRow };
      return updated;
    });
  }, [rows]);

  const handleSwapDebitCredit = useCallback((rowId: string) => {
    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const swapped = swapDebitCredit({
        debit: row.debit,
        credit: row.credit,
        rate: row.rate,
        currencyAmount: row.currencyAmount,
      });
      triggerBlink(rowId, 'debit');
      triggerBlink(rowId, 'credit');
      return { ...row, debit: swapped.debit, credit: swapped.credit };
    }));
  }, [triggerBlink]);

  const handleSwapRate = useCallback((rowId: string) => {
    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const newRate = swapRate(row.rate);
      triggerBlink(rowId, 'rate');
      return { ...row, rate: newRate };
    }));
  }, [triggerBlink]);

  useJournalEntryKeyboard({
    rows,
    selectedRowId,
    selectedCellKey,
    selectedRowIds,
    selectionAnchorId,
    onRowsChange: handleRowsChange,
    onCellChange: handleCellChange,
    onSelectionChange: handleSelectionChange,
    onActiveCellChange: handleActiveCellChange,
    onRowDuplicate: handleRowDuplicate,
    onRowAddAfter: handleRowAddAfter,
    onBalance: handleBalance,
    onSwapDebitCredit: handleSwapDebitCredit,
    onSwapRate: handleSwapRate,
  });

  const getRowError = useCallback((row: JournalEntryRow): string | null => {
    const errors: string[] = [];

    if (!row.accountId) {
      errors.push(tJE('accountRequired'));
    }

    const account = accounts?.find(a => a.id === row.accountId);
    if (account) {
      for (let i = 1; i <= centerLevels; i++) {
        const allowedTypes = account[`allowed_center_types_${i}` as keyof typeof account];
        if (allowedTypes && Array.isArray(allowedTypes) && allowedTypes.length > 0) {
          const centerId = row[`center${i}Id` as keyof JournalEntryRow] as number | null;
          if (!centerId) {
            errors.push(tJE('centerRequired', { level: i }));
          }
        }
      }
    }

    if (row.debit && row.credit) {
      errors.push(tJE('debitXorCredit'));
    }
    if (!row.debit && !row.credit) {
      errors.push(tJE('debitCreditRequired'));
    }

    const selectedCurrency = currencies?.find(c => c.id === row.currencyId);
    if (selectedCurrency && selectedCurrency.id !== settings?.main_currency_id) {
      if (!row.rate || row.rate <= 0) {
        errors.push(tJE('rateRequired'));
      }
    }

    if (row.rate && row.currencyAmount !== null) {
      const expected = Math.abs((row.debit ?? 0) - (row.credit ?? 0)) / row.rate;
      if (Math.abs(expected - row.currencyAmount) > 0.000001) {
        errors.push(tJE('currencyAmountMismatch'));
      }
    }

    return errors.length > 0 ? errors.join(', ') : null;
  }, [accounts, centerLevels, currencies, settings?.main_currency_id, tJE]);

  const totals = useMemo(() => {
    const totalDebit = rows.reduce((sum, r) => sum + (r.debit ?? 0), 0);
    const totalCredit = rows.reduce((sum, r) => sum + (r.credit ?? 0), 0);
    return {
      debit: totalDebit,
      credit: totalCredit,
      difference: totalDebit - totalCredit,
      balanced: Math.abs(totalDebit - totalCredit) < 0.000001,
    };
  }, [rows]);

  const firstSelectedRow = useMemo(() => {
    const firstId = selectedRowIds.size > 0 ? Array.from(selectedRowIds)[0] : selectedRowId;
    return rows.find(r => r.id === firstId) ?? null;
  }, [rows, selectedRowIds, selectedRowId]);

  const canSave = useMemo(() => {
    if (rows.length === 0) return false;
    if (!date) return false;
    if (!activeFiscalYearId) return false;
    if (!totals.balanced) return false;

    if (date && activeFiscalYear) {
      const d = new Date(date);
      const start = new Date(activeFiscalYear.start_date);
      const end = new Date(activeFiscalYear.finish_date);
      if (d < start || d > end) {
        return false;
      }
    }

    return rows.every(row => getRowError(row) === null);
  }, [rows, date, activeFiscalYearId, totals.balanced, getRowError, activeFiscalYear]);

  const buildPayload = (state: 'draft' | 'booked') => {
    if (!activeFiscalYearId) {
      throw new Error('No active fiscal year');
    }

    // Current server IDs from the grid
    const currentServerIds = new Set(
      rows
        .map(row => row.serverId)
        .filter((id): id is number => id != null)
    );

    // Deleted items = original IDs not in current rows
    const deletedItemIds = Array.from(originalItemIds).filter(
      id => !currentServerIds.has(id)
    );

    const itemsAttributes = [
      ...rows.map((row) => {
        const isMainCurrency = row.currencyId === settings?.main_currency_id;
        return {
          ...(row.serverId != null ? { id: row.serverId } : {}),
          row: row.row,
          account_id: row.accountId ?? undefined,
          center1_id: row.center1Id ?? undefined,
          center2_id: row.center2Id ?? undefined,
          center3_id: row.center3Id ?? undefined,
          center4_id: row.center4Id ?? undefined,
          center5_id: row.center5Id ?? undefined,
          center6_id: row.center6Id ?? undefined,
          debit: row.debit ?? 0,
          credit: row.credit ?? 0,
          currency_id: row.currencyId ?? undefined,
          rate: isMainCurrency ? null : (row.rate ?? null),
          currency_amount: isMainCurrency ? null : (row.credit ? -Math.abs(row.currencyAmount ?? 0) : Math.abs(row.currencyAmount ?? 0)),
          description_en: row.description['en'] || '',
          description_fa: row.description['fa'] || '',
        }
      }),
      // Mark deleted items
      ...deletedItemIds.map(id => ({
        id,
        _destroy: true,
      })),
    ];


    return {
      date: date ?? '',
      effective_date: date ?? '',
      fiscal_year_id: activeFiscalYearId,
      state,
      entry_type: 'normal' as const,
      description_en: description['en'] || '',
      description_fa: description['fa'] || '',
      items_attributes: itemsAttributes
    };
  };

  const handleSaveAsDraft = async () => {
    setSaving(true);
    try {
      const payload = buildPayload('draft');
      if (editingId) {
        await updateJournalEntry({ organizationId: orgId, id: editingId, data: payload }).unwrap();
      } else {
        const result = await createJournalEntry({ organizationId: orgId, data: payload }).unwrap();
        setEditingId(result.id);
      }
      setEditingState('draft');
      showSuccess(tJE('journalEntrySavedAsDraft'));
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tJE('journalEntrySaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = buildPayload('booked');
      console.log(payload);
      if (editingId) {
        await updateJournalEntry({ organizationId: orgId, id: editingId, data: payload }).unwrap();
      } else {
        const result = await createJournalEntry({ organizationId: orgId, data: payload }).unwrap();
        setEditingId(result.id);
      }
      setEditingState('booked');
      showSuccess(tJE('journalEntrySaved'));
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tJE('journalEntrySaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (journalEntryId && isLoadingJournalEntry) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (journalEntryId && journalEntryFetchError) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">
          {tJE('failedToLoadJournalEntry')}
        </Alert>
      </Container>
    );
  }

  if (!accounts || !centers || !currencies || !settings) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container
      maxWidth={false}
      sx={{
        height: '100dvh',
        maxHeight: 'calc(100dvh - 100px)',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        py: 1,
        mx: 0,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {editingId ? tJE('journalEntryNumber', { id: editingId }) : tJE('newJournalEntry')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button variant="outlined" startIcon={<DraftsIcon />} onClick={handleSaveAsDraft} disabled={saving}>
            {tJE('saveAsDraft')}
          </Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={!canSave || saving}>
            {tJE('saveJournalEntry')}
          </Button>
        </Box>
      </Box>

      <Box sx={{ mb: 1, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <BaseDatePicker
          label={tJE('journalEntryDate')}
          value={date}
          onChange={setDate}
          required
        />

        <Box sx={{ flex: 1, minWidth: 250 }}>
          <MultiLocaleInput
            field={tJE('journalEntryDescription')}
            value={description}
            onChange={setDescription}
          />
        </Box>

        {editingId && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {tJE('status')}:
            </Typography>
            <Chip
              label={editingState ? tJE(editingState) : tJE('draft')}
              color={editingState === 'booked' ? 'primary' : 'default'}
              size="small"
            />
          </Box>
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <JournalEntryGrid
          rows={rows}
          accounts={accounts}
          centers={centers}
          currencies={currencies}
          centerLevels={centerLevels}
          mainCurrencyId={settings?.main_currency_id ?? null}
          mainCurrencyDecimalDigits={mainCurrencyDecimalDigits}
          onChange={handleRowsChange}
          onFieldChange={handleCellChange}
          getRowError={getRowError}
          onCellClick={handleRowSelect}
          onActiveCellChange={handleActiveCellChange}
          blinkingCells={blinkingCells}
          organizationId={orgId}
          selectedRowId={selectedRowId}
          selectedCellKey={selectedCellKey}
          selectedRowIds={selectedRowIds}
          onAddRow={handleAddRow}
          footer={
            <JournalEntryFooter
              row={firstSelectedRow}
              accounts={accounts}
              centers={centers}
              centerLevels={centerLevels}
              totals={totals}
            />
          }
        />
      </Box>
    </Container>
  );
};