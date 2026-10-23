// ExplorerPage.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, alpha } from '@mui/material';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import { useGridApiRef, type GridColDef, type GridRowSelectionModel, type GridRowId } from '@mui/x-data-grid';
import { Group, Panel } from 'react-resizable-panels';
import { useTranslation } from 'react-i18next';
import { ExtendedDataGrid } from '../../../components/shared/ExtendedDataGrid';
import { formatForDisplay, useCalendarPreference } from '../../../components/shared/calendarUtils';
import { useGetAccountingSettingsQuery } from '../settings/settingsApi';
import {
  useGetExplorerGroupedSummaryQuery,
  type ExplorerDimension,
  type ExplorerFilter,
  type ExplorerRow,
  type ExplorerQueryArgs,
} from './journalEntryItemsApi';
import { DIMENSION_META } from './dimensionConfig';
import { DrillTrail, type TrailStep } from './components/DrillTrail';
import { ExplorerFilterPanel, PERIOD_CALENDAR_ID } from './components/ExplorerFilterPanel';
import { ExplorerScopeChips } from './components/ExplorerScopeChips';
import { useExplorerScope } from './useExplorerScope';
import { convertPeriod, scopeChanges, scopeToSearchParams } from './explorerScope';
import { useToast } from '../../../contexts/ToastContext';
import { apiErrorMessage } from '../../../utils/apiErrorMessage';
import { useTabManager } from '../../../components/tabs/useTabManager';
import { FooterStat } from './components/FooterStat';
import { useTabLoading } from '../../../components/tabs/TabLoadingContext';
import { ReportSplitButton } from '../../reports/components/ReportSplitButton';
import { explorerPrintSource } from './explorerPrintSource';
import { FilterPanelResizeHandle } from './components/FilterPanelResizeHandle';
import { FiltersToggleButton } from './components/FiltersToggleButton';
import { TableActionsMenu } from './components/TableActionsMenu';
import { useExcelExport } from './useExcelExport';

const AMOUNT_FORMAT = '#,##0.00';
const AMOUNT_FIELDS = ['sum_debit', 'sum_credit', 'debit_balance', 'credit_balance'];

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined
    ? ''
    : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The dimension the explorer opens with. */
const INITIAL_DIMENSION: ExplorerDimension = 'account_category';

const panelStorageKey = (orgId: number) => `explorer_filter_panel_open:${orgId}`;

const readPanelOpen = (orgId: number): boolean => {
  try {
    return localStorage.getItem(panelStorageKey(orgId)) !== '0';
  } catch {
    return true;
  }
};

const writePanelOpen = (orgId: number, open: boolean) => {
  try {
    localStorage.setItem(panelStorageKey(orgId), open ? '1' : '0');
  } catch {
    // localStorage unavailable
  }
};

interface GroupQuery {
  groupBy: ExplorerDimension;
  filters: ExplorerFilter[];
}

export const ExplorerPage = () => {
  const { t: tAccounting } = useTranslation('accounting');
  const { t } = useTranslation('shared');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const { showError } = useToast();

  const {
    applied,
    draft,
    defaults,
    fiscalYears,
    activeFiscalYear,
    draftError,
    isDefault,
    updateDraft,
    resetDraft,
    clearChange,
  } = useExplorerScope(orgId);
  const { calendar, setCalendar } = useCalendarPreference(PERIOD_CALENDAR_ID);

  // Months differ between calendars: keep a month range on whole months.
  const handleCalendarChange = (next: typeof calendar) => {
    setCalendar(next);
    if (draft?.periodMode === 'month') updateDraft(convertPeriod(draft, 'month', next, fiscalYears));
  };

  const { data: settings } = useGetAccountingSettingsQuery(orgId, { skip: !orgId });
  const centerLevels = settings?.center_levels ?? 3;

  const visibleDimensions = useMemo(
    () => DIMENSION_META.filter((m) => !m.centerLevel || m.centerLevel <= centerLevels),
    [centerLevels]
  );

  const [panelOpen, setPanelOpen] = useState(() => readPanelOpen(orgId));
  const togglePanel = (open: boolean) => {
    setPanelOpen(open);
    writePanelOpen(orgId, open);
  };

  const [path, setPath] = useState<TrailStep[]>([]);
  const [pathFilters, setPathFilters] = useState<ExplorerFilter[]>([]);
  const [currentDimension, setCurrentDimension] = useState<ExplorerDimension | null>(null);
  const [rows, setRows] = useState<ExplorerRow[]>([]);
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set<GridRowId>(),
  });

  // The grid's dimension and drill filters; the scope comes from the panel.
  const [groupQuery, setGroupQuery] = useState<GroupQuery | null>(null);
  const queryArgs = useMemo<ExplorerQueryArgs | null>(
    () =>
      groupQuery && applied
        ? {
            organizationId: orgId,
            scope: applied,
            groupBy: groupQuery.groupBy,
            filters: groupQuery.filters,
            hideZeroBalance: applied.hideZeroBalance,
          }
        : null,
    [groupQuery, applied, orgId]
  );
  const { data, isFetching, isError, error } = useGetExplorerGroupedSummaryQuery(queryArgs!, { skip: !queryArgs });
  useTabLoading(isFetching);
  const gridApiRef = useGridApiRef();
  const exportExcel = useExcelExport();

  const { openTab } = useTabManager();
  const navigate = useNavigate();

  const handleOpenItems = (row: ExplorerRow) => {
    if (!applied) return;
    const filters: ExplorerFilter[] = currentDimension
      ? [...pathFilters, { dimension: currentDimension, ids: [row.id], items: [{ code: row.code, name: row.name }] }]
      : pathFilters;

    const params = scopeToSearchParams(applied, false);
    // The items page's filter panel picks the period the same way.
    params.set('mode', applied.periodMode);
    params.set('filters', JSON.stringify(filters));
    const itemsPath = `/app/organizations/${orgId}/accounting/journal-entry-items?${params.toString()}`;
    openTab('journal-entry-items', tAccounting('items.title', { defaultValue: 'Journal Entry Items' }), itemsPath);
    navigate(itemsPath);
  };

  // Sync rows from query response and handle errors
  useEffect(() => {
    if (data) {
      setRows(data.rows);
    }
  }, [data]);

  // Shows the server's message, e.g. an invalid period.
  useEffect(() => {
    if (isError) {
      showError(
        apiErrorMessage(error) || tAccounting('explorer.loadFailed', { defaultValue: 'Could not load this view.' })
      );
    }
  }, [isError, error, showError, tAccounting]);

  // A new scope brings new rows: the old selection no longer applies.
  useEffect(() => {
    setSelectionModel({ type: 'include', ids: new Set<GridRowId>() });
  }, [applied]);

  const usedDimensions = new Set([
    ...path.map((s) => s.dimension),
    ...(currentDimension ? [currentDimension] : []),
  ]);

  const runQuery = (groupBy: ExplorerDimension, filters: ExplorerFilter[]) => {
    setCurrentDimension(groupBy);
    setRows([]); // Clear rows immediately for the new dimension
    setSelectionModel({ type: 'include', ids: new Set<GridRowId>() });
    setPathFilters(filters);
    setGroupQuery({ groupBy, filters });
  };

  // Open grouped by account category once the scope is known.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!applied || startedRef.current) return;
    startedRef.current = true;
    runQuery(INITIAL_DIMENSION, []);
  }, [applied]);

  const handleDimensionClick = (dimension: ExplorerDimension) => {
    if (usedDimensions.has(dimension)) return;

    if (currentDimension) {
      const selectedIds = Array.from(selectionModel.ids) as number[];
      const selectedRows = rows.filter((r) => selectedIds.includes(r.id));

      if (selectedRows.length) {
        // Only when specific rows were picked do we record a step: an "all rows"
        // drill isn't a real filter, so it shouldn't show in the breadcrumb and
        // the dimension should remain available to drill into again later.
        const items = selectedRows.map((r) => ({ code: r.code, name: r.name }));
        const newPath = [...path, { dimension: currentDimension, items }];
        setPath(newPath);

        runQuery(dimension, [
          ...pathFilters,
          {
            dimension: currentDimension,
            ids: selectedRows.map((r) => r.id),
            items,
          },
        ]);
      } else {
        runQuery(dimension, pathFilters);
      }
      return;
    }

    runQuery(dimension, []);
  };

  const handleTrailStepClick = (index: number) => {
    const newPath = path.slice(0, index);
    const newFilters = pathFilters.slice(0, index);
    setPath(newPath);
    runQuery(path[index].dimension, newFilters);
  };

  const handleReset = () => {
    setPath([]);
    runQuery(INITIAL_DIMENSION, []);
  };

  const canResetDrill = path.length > 0 || (currentDimension !== null && currentDimension !== INITIAL_DIMENSION);
  const changeCount = applied && defaults ? scopeChanges(applied, defaults, fiscalYears).length : 0;
  const meta = data?.meta;

  // Footer sums — over the selection when one exists, otherwise over all rows
  // shown (zero-balance rows the server left out don't count).
  const selectedIds = Array.from(selectionModel.ids) as number[];
  const hasMultiSelection = selectedIds.length > 1;
  const activeRows = hasMultiSelection ? rows.filter((r) => selectedIds.includes(r.id)) : rows;

  // Prints the grid as shown: the applied scope, the grouping and the drill
  // filters; only the selected rows when several are selected.
  const printSource =
    groupQuery && applied
      ? explorerPrintSource(applied, groupQuery.groupBy, groupQuery.filters, hasMultiSelection ? selectedIds : null)
      : null;

  const handleExportExcel = () =>
    exportExcel({
      apiRef: gridApiRef,
      title: t('menu.explorer', { defaultValue: 'Explorer' }),
      numberFormats: Object.fromEntries(AMOUNT_FIELDS.map((field) => [field, AMOUNT_FORMAT])),
    });

  const totals = useMemo(
    () => {
      const sumDebit = activeRows.reduce((sum, r) => sum + r.sum_debit, 0);
      const sumCredit = activeRows.reduce((sum, r) => sum + r.sum_credit, 0);
      const debitBalance = activeRows.reduce((sum, r) => sum + (r.debit_balance ?? 0), 0);
      const creditBalance = activeRows.reduce((sum, r) => sum + (r.credit_balance ?? 0), 0);
      return {
        sumDebit,
        sumCredit,
        debitBalance,
        creditBalance,
        difference: debitBalance - creditBalance,
      };
    },
    [activeRows]
  );

  const columns: GridColDef<ExplorerRow>[] = useMemo(() => {
    if (!currentDimension) return [];

    const numberColumn = (
      field: 'sum_debit' | 'sum_credit' | 'debit_balance' | 'credit_balance',
      headerName: string
    ): GridColDef<ExplorerRow> => ({
      field,
      headerName,
      width: 150,
      type: 'number',
      renderCell: (params) => fmt(params.value),
    });

    return [
      { field: 'code', headerName: tAccounting('explorer.code', { defaultValue: 'Code' }), width: 130 },
      {
        field: 'name',
        headerName: tAccounting('explorer.name', { defaultValue: 'Name' }),
        flex: 1,
        minWidth: 200,
      },
      numberColumn('sum_debit', tAccounting('explorer.sumDebit', { defaultValue: 'Sum Debit' })),
      numberColumn('sum_credit', tAccounting('explorer.sumCredit', { defaultValue: 'Sum Credit' })),
      numberColumn('debit_balance', tAccounting('explorer.debitBalance', { defaultValue: 'Debit Balance' })),
      numberColumn('credit_balance', tAccounting('explorer.creditBalance', { defaultValue: 'Credit Balance' })),
    ];
  }, [currentDimension, tAccounting]);

  const main = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Dimension rail */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        {visibleDimensions.map((meta) => {
          const isUsed = usedDimensions.has(meta.dimension);
          const isCurrent = currentDimension === meta.dimension;
          return (
            <Button
              key={meta.dimension}
              onClick={() => handleDimensionClick(meta.dimension)}
              disabled={isUsed}
              variant={isCurrent ? 'contained' : 'outlined'}
              size="small"
              sx={{
                borderRadius: 5,
                textTransform: 'none',
                fontWeight: 600,
                px: 1.75,
                ...(isUsed && !isCurrent && { opacity: 0.4 }),
              }}
            >
              {tAccounting(meta.labelKey, { defaultValue: meta.fallbackLabel })}
            </Button>
          );
        })}

        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          {printSource && (
            <ReportSplitButton
              reportKey="explorer"
              source={printSource}
              reportTitle={t('menu.explorer', { defaultValue: 'Explorer' })}
              disabled={isFetching}
            />
          )}
          {canResetDrill && (
            <Button
              onClick={handleReset}
              size="small"
              color="inherit"
              startIcon={<RestartAltRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{ textTransform: 'none', color: 'text.secondary' }}
            >
              {tAccounting('explorer.reset', { defaultValue: 'Reset' })}
            </Button>
          )}
          <FiltersToggleButton
            open={panelOpen}
            onToggle={togglePanel}
            changeCount={changeCount}
            controls="explorer-filters-form"
          />
          <TableActionsMenu onExportExcel={handleExportExcel} disabled={!currentDimension || isFetching} />
        </Box>
      </Box>

      {applied && defaults && (
        <ExplorerScopeChips
          scope={applied}
          defaults={defaults}
          fiscalYears={fiscalYears}
          calendar={calendar}
          onClick={() => togglePanel(true)}
          onDelete={clearChange}
        />
      )}

      <DrillTrail steps={path} currentDimension={currentDimension} onStepClick={handleTrailStepClick} />

      {meta?.prior_entries_excluded && (
        <Alert severity="warning" sx={{ mb: 1, py: 0 }}>
          {tAccounting('explorer.filters.priorEntriesExcluded', { from: formatForDisplay(meta.from, calendar) })}
        </Alert>
      )}

      {currentDimension && (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <ExtendedDataGrid
            rows={rows}
            columns={columns}
            loading={isFetching}
            checkboxSelection
            rowSelectionModel={selectionModel}
            onRowSelectionModelChange={setSelectionModel}
            apiRef={gridApiRef}
            onRowOpen={handleOpenItems}
            rowOpenLabel={tAccounting('explorer.openItems', { defaultValue: 'Open Journal Entry Items' })}
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

          {/* Totals footer */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
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
            <Box sx={{ typography: 'caption', color: 'text.secondary', fontWeight: 600, mr: 'auto' }}>
              {hasMultiSelection
                ? tAccounting('explorer.selectedTotal', { defaultValue: 'Selected total ({{count}})', count: selectedIds.length })
                : tAccounting('explorer.total', { defaultValue: 'Total' })}
            </Box>

            <FooterStat
              label={tAccounting('explorer.totalDebit', { defaultValue: 'Total Debit' })}
              value={fmt(totals.sumDebit)}
            />
            <FooterStat
              label={tAccounting('explorer.totalCredit', { defaultValue: 'Total Credit' })}
              value={fmt(totals.sumCredit)}
            />
            <FooterStat
              label={tAccounting('explorer.totalDebitBalance', { defaultValue: 'Total Debit Balance' })}
              value={fmt(totals.debitBalance)}
            />
            <FooterStat
              label={tAccounting('explorer.totalCreditBalance', { defaultValue: 'Total Credit Balance' })}
              value={fmt(totals.creditBalance)}
            />
            <FooterStat
              label={tAccounting('difference', { defaultValue: 'Difference' })}
              value={fmt(totals.difference)}
              highlight
            />
          </Box>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ height: '100%', overflow: 'hidden', p: 2 }}>
      <Group orientation="horizontal" id="explorer-layout">
        <Panel id="explorer-main" minSize="40">
          {main}
        </Panel>

        {panelOpen && draft && activeFiscalYear && (
          <>
            <FilterPanelResizeHandle />
            <Panel id="explorer-filters" defaultSize="320px" minSize="260px" maxSize="45">
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
                onClose={() => togglePanel(false)}
              />
            </Panel>
          </>
        )}
      </Group>
    </Box>
  );
};
