// src/pages/accounting/explorer/JournalEntryItemsPage.tsx
import { useEffect, useId, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGridApiRef, type GridColDef, type GridRowSelectionModel, type GridRowId } from '@mui/x-data-grid';
import { Group, Panel } from 'react-resizable-panels';
import { useTranslation } from 'react-i18next';
import { ExtendedDataGrid } from '../../../components/shared/ExtendedDataGrid';
import {
  useGetJournalEntryItemsQuery,
  type ExplorerFilter,
  type JournalEntryItem,
} from './journalEntryItemsApi';
import { AppliedFilters } from './components/AppliedFilters';
import { ExplorerScopeChips } from './components/ExplorerScopeChips';
import { ExplorerFilterPanel, PERIOD_CALENDAR_ID } from './components/ExplorerFilterPanel';
import { FilterPanelResizeHandle } from './components/FilterPanelResizeHandle';
import { FiltersToggleButton } from './components/FiltersToggleButton';
import { TableActionsMenu } from './components/TableActionsMenu';
import { convertPeriod, scopeChanges } from './explorerScope';
import { useJournalEntryItemsScope } from './useJournalEntryItemsScope';
import { useExcelExport } from './useExcelExport';
import { useTabSearchParams } from '../../../components/tabs/useTabSearchParams';
import { useCalendarPreference } from '../../../components/shared/calendarUtils';
import { Box, Typography, alpha, IconButton, Tooltip } from '@mui/material';
import CurrencyExchangeRoundedIcon from '@mui/icons-material/CurrencyExchangeRounded';
import { FooterStat } from './components/FooterStat';
import { useTabManager } from '../../../components/tabs/useTabManager';
import { useTabLoading } from '../../../components/tabs/TabLoadingContext';
import { ReportSplitButton } from '../../reports/components/ReportSplitButton';
import { journalEntryItemsPrintSource } from './explorerPrintSource';

const AMOUNT_FORMAT = '#,##0.00';

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined
    ? ''
    : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const JournalEntryItemsPage = () => {
  const { t: tAccounting } = useTranslation('accounting');
  const { t } = useTranslation('shared');
  const { organizationId } = useParams<{ organizationId: string }>();
  // This tab's own query string: hidden tabs stay mounted and must not follow
  // the browser URL of whichever tab is active.
  const searchParams = useTabSearchParams();
  const orgId = parseInt(organizationId || '0', 10);

  // The scope the tab was opened with; filter changes stay in the page.
  const {
    applied: scope,
    draft,
    defaults,
    fiscalYears,
    activeFiscalYear,
    draftError,
    isDefault,
    updateDraft,
    resetDraft,
    clearChange,
  } = useJournalEntryItemsScope(orgId, searchParams);
  const { calendar, setCalendar } = useCalendarPreference(PERIOD_CALENDAR_ID);

  // Months differ between calendars: keep a month range on whole months.
  const handleCalendarChange = (next: typeof calendar) => {
    setCalendar(next);
    if (draft?.periodMode === 'month') updateDraft(convertPeriod(draft, 'month', next, fiscalYears));
  };

  // Hidden whenever the page opens.
  const [panelOpen, setPanelOpen] = useState(false);
  const formId = useId();
  const changeCount = scope && defaults ? scopeChanges(scope, defaults, fiscalYears).length : 0;

  const navigate = useNavigate();
  const { openTab } = useTabManager();

  const filters = useMemo<ExplorerFilter[]>(() => {
    const raw = searchParams.get('filters');
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }, [searchParams]);

  const { data: items, isFetching } = useGetJournalEntryItemsQuery(
    { organizationId: orgId, scope: scope!, filters },
    { skip: !orgId || !scope }
  );
  useTabLoading(isFetching);
  const gridApiRef = useGridApiRef();
  const exportExcel = useExcelExport();

  const rows = items ?? [];

  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set<GridRowId>(),
  });

  // A new scope brings new rows: the old selection no longer applies.
  useEffect(() => {
    setSelectionModel({ type: 'include', ids: new Set<GridRowId>() });
  }, [scope]);

  const selectedIds = Array.from(selectionModel.ids) as number[];
  const hasMultiSelection = selectedIds.length > 1;
  const activeRows = hasMultiSelection ? rows.filter((r) => selectedIds.includes(r.id)) : rows;

  const handleExportExcel = () =>
    exportExcel({
      apiRef: gridApiRef,
      title: tAccounting('items.title', { defaultValue: 'Journal Entry Items' }),
      numberFormats: { debit: AMOUNT_FORMAT, credit: AMOUNT_FORMAT, currency_amount: AMOUNT_FORMAT },
      blankZeroFields: ['debit', 'credit'],
    });

  const totals = useMemo(
    () => {
      const sumDebit = activeRows.reduce((sum, r) => sum + r.debit, 0);
      const sumCredit = activeRows.reduce((sum, r) => sum + r.credit, 0);
      return {
        sumDebit,
        sumCredit,
        difference: sumDebit - sumCredit,
      };
    },
    [activeRows]
  );

  const currencyTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of activeRows) {
      if (!r.currency_amount) continue;
      const key = r.abr || '—';
      map.set(key, (map.get(key) ?? 0) + r.currency_amount);
    }
    return Array.from(map.entries());
  }, [activeRows]);

  const handleOpenJournalEntry = (row: JournalEntryItem) => {
    const journalEntryId = row.journal_entry?.id;
    if (!journalEntryId) return;

    const ref = row.journal_entry?.ref || journalEntryId;
    const path = `/app/organizations/${orgId}/accounting/journal-entries/${journalEntryId}?focus_item_id=${row.id}`;

    openTab('journal-entry-edit', tAccounting('journalEntryTabTitle', { ref }), path);
    navigate(path);
  };

  const columns: GridColDef<JournalEntryItem>[] = useMemo(
    () => [
      {
        field: 'journal_entry.date',
        headerName: tAccounting('items.date', { defaultValue: 'Date' }),
        width: 110,
        valueGetter: (_, row) => row.journal_entry?.date ?? '',
      },
      {
        field: 'journal_entry.no',
        headerName: tAccounting('items.no', { defaultValue: 'No' }),
        width: 100,
        type: 'number',
        valueGetter: (_, row) => row.journal_entry?.no ?? '',
      },
      {
        field: 'journal_entry.ref',
        headerName: tAccounting('items.ref', { defaultValue: 'Ref' }),
        width: 80,
        type: 'number',
        valueGetter: (_, row) => row.journal_entry?.ref ?? '',
      },
      { field: 'row', headerName: tAccounting('items.row', { defaultValue: 'Row' }), width: 70, type: 'number' },
      {
        field: 'description',
        headerName: t('description'),
        flex: 1,
        minWidth: 180,
      },
      {
        field: 'debit',
        headerName: tAccounting('items.debit', { defaultValue: 'Debit' }),
        width: 130,
        type: 'number',
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => params.value === 0 ? '' : fmt(params.value),
      },
      {
        field: 'credit',
        headerName: tAccounting('items.credit', { defaultValue: 'Credit' }),
        width: 130,
        type: 'number',
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => params.value === 0 ? '' : fmt(params.value),
      },
      {
        field: 'abr',
        headerName: tAccounting('items.abr', { defaultValue: 'Currency' }),
        width: 130,
        align: 'center',
        headerAlign: 'center',
      },
      {
        field: 'currency_amount',
        headerName: tAccounting('items.currencyAmount', { defaultValue: 'Currency Amount' }),
        width: 150,
        type: 'number',
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => fmt(params.value),
      },
      {
        field: 'rate',
        headerName: tAccounting('items.rate', { defaultValue: 'Rate' }),
        width: 100,
        type: 'number',
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => fmt(params.value),
      },
    ],
    [tAccounting, t]
  );

  const main = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="h6" sx={{ mr: 'auto' }}>
          {tAccounting('items.title', { defaultValue: 'Journal Entry Items' })}
        </Typography>
        {/* Prints this tab's items (its scope and filters); only the selected ones when several are. */}
        {scope && (
          <ReportSplitButton
            reportKey="journal_entry_items"
            source={journalEntryItemsPrintSource(scope, filters, hasMultiSelection ? selectedIds : null)}
            reportTitle={t('menu.journalEntryItems', { defaultValue: 'Journal Entry Items' })}
            disabled={isFetching}
          />
        )}
        <FiltersToggleButton open={panelOpen} onToggle={setPanelOpen} changeCount={changeCount} controls={formId} />
        <TableActionsMenu onExportExcel={handleExportExcel} disabled={isFetching || !scope} />
      </Box>

      {scope && defaults && (
        <ExplorerScopeChips
          scope={scope}
          defaults={defaults}
          fiscalYears={fiscalYears}
          calendar={calendar}
          onClick={() => setPanelOpen(true)}
          onDelete={clearChange}
        />
      )}

      <AppliedFilters filters={filters} />

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ExtendedDataGrid
          rows={rows}
          columns={columns}
          loading={isFetching}
          checkboxSelection
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={setSelectionModel}
          apiRef={gridApiRef}
          onRowOpen={handleOpenJournalEntry}
          rowOpenLabel={tAccounting('openJournalEntry')}
          showHeaderSearchRow
          hideFooterPagination
          hideFooter
          disableColumnMenu
          showCellVerticalBorder
          sx={{
            flex: 1,
            '& .MuiDataGrid-cell:focus': { outline: 'none' },
          }}
        />

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 3,
            px: 2,
            py: 1,
            mt: 1,
            borderRadius: 2,
            bgcolor: (theme) => alpha(theme.palette.primary.main, hasMultiSelection ? 0.1 : 0.03),
            border: (theme) => `1px solid ${hasMultiSelection ? theme.palette.primary.main : theme.palette.divider}`,
            transition: 'background-color 0.15s ease, border-color 0.15s ease',
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mr: 'auto' }}>
            {hasMultiSelection
              ? tAccounting('explorer.selectedTotal', { defaultValue: 'Selected total ({{count}})', count: selectedIds.length })
              : tAccounting('explorer.total', { defaultValue: 'Total' })}
          </Typography>

          {currencyTotals.length > 0 && (
            <Tooltip
              title={
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, py: 0.25 }}>
                  {currencyTotals.map(([abr, amount]) => (
                    <Box key={abr} sx={{ fontSize: 12 }}>
                      {abr}: {fmt(amount)}
                    </Box>
                  ))}
                </Box>
              }
            >
              <IconButton size="small">
                <CurrencyExchangeRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}

          <FooterStat
            label={tAccounting('items.totalDebit', { defaultValue: 'Total Debit' })}
            value={fmt(totals.sumDebit)}
          />
          <FooterStat
            label={tAccounting('items.totalCredit', { defaultValue: 'Total Credit' })}
            value={fmt(totals.sumCredit)}
          />
          <FooterStat
            label={tAccounting('difference', { defaultValue: 'Difference' })}
            value={fmt(totals.difference)}
            highlight
          />
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ height: '100%', overflow: 'hidden', p: 2 }}>
      <Group orientation="horizontal" id="journal-entry-items-layout">
        <Panel id="journal-entry-items-main" minSize="40">
          {main}
        </Panel>

        {panelOpen && draft && activeFiscalYear && (
          <>
            <FilterPanelResizeHandle />
            <Panel id="journal-entry-items-filters" defaultSize="320px" minSize="260px" maxSize="45">
              <ExplorerFilterPanel
                draft={draft}
                onChange={updateDraft}
                fiscalYears={fiscalYears}
                activeFiscalYear={activeFiscalYear}
                calendar={calendar}
                onCalendarChange={handleCalendarChange}
                error={draftError}
                isDefault={isDefault}
                onReset={resetDraft}
                onClose={() => setPanelOpen(false)}
                showRowOptions={false}
                formId={formId}
              />
            </Panel>
          </>
        )}
      </Group>
    </Box>
  );
};