// ExplorerPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Button, Typography, alpha, Fade } from '@mui/material';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import TrendingFlatRoundedIcon from '@mui/icons-material/TrendingFlatRounded';
import type { GridColDef, GridRowSelectionModel, GridRowId } from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';
import { ExtendedDataGrid } from '../../../components/shared/ExtendedDataGrid';
import { useActiveFiscalYear } from '../../../hooks/useActiveFiscalYear';
import { useGetAccountingSettingsQuery } from '../settings/settingsApi';
import {
  useGetExplorerGroupedSummaryQuery,
  type ExplorerDimension,
  type ExplorerFilter,
  type ExplorerRow,
  type ExplorerQueryArgs
} from './journalEntryItemsApi';
import { DIMENSION_META } from './dimensionConfig';
import { DrillTrail, type TrailStep } from './components/DrillTrail';
import { useToast } from '../../../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { IconButton, Tooltip } from '@mui/material';
import { useTabManager } from '../../../components/tabs/useTabManager';
import { FooterStat } from './components/FooterStat';


const fmt = (n: number | null | undefined) =>
  n === null || n === undefined
    ? ''
    : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ExplorerPage = () => {
  const { t: tAccounting } = useTranslation('accounting');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const { showError } = useToast();

  const { activeFiscalYearId } = useActiveFiscalYear(orgId);
  const { data: settings } = useGetAccountingSettingsQuery(orgId, { skip: !orgId });
  const centerLevels = settings?.center_levels ?? 3;

  const visibleDimensions = useMemo(
    () => DIMENSION_META.filter((m) => !m.centerLevel || m.centerLevel <= centerLevels),
    [centerLevels]
  );

  const [path, setPath] = useState<TrailStep[]>([]);
  const [pathFilters, setPathFilters] = useState<ExplorerFilter[]>([]);
  const [currentDimension, setCurrentDimension] = useState<ExplorerDimension | null>(null);
  const [rows, setRows] = useState<ExplorerRow[]>([]);
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set<GridRowId>(),
  });

  const [queryArgs, setQueryArgs] = useState<ExplorerQueryArgs | null>(null);
  const { data, isFetching, isError, error } = useGetExplorerGroupedSummaryQuery(queryArgs!, { skip: !queryArgs });

  const { openTab } = useTabManager();
  const navigate = useNavigate();

  const handleOpenItems = (row: ExplorerRow) => {
    const filters: ExplorerFilter[] = currentDimension
      ? [...pathFilters, { dimension: currentDimension, ids: [row.id], items: [{ code: row.code, name: row.name }] }]
      : pathFilters;

    const filtersJson = encodeURIComponent(JSON.stringify(filters));
    const path = `/app/organizations/${orgId}/accounting/journal-entry-items?fiscal_year_id=${activeFiscalYearId}&filters=${filtersJson}`;
    openTab('journal-entry-items', tAccounting('items.title', { defaultValue: 'Journal Entry Items' }), path);
    navigate(path);
  };

  // Sync rows from query response and handle errors
  useEffect(() => {
    if (data) {
      setRows(data.rows);
    }
  }, [data]);

  useEffect(() => {
    if (isError) {
      showError(
        (error as any)?.data?.errors?.[0] ||
          tAccounting('explorer.loadFailed', { defaultValue: 'Could not load this view.' })
      );
    }
  }, [isError, error]);

  const usedDimensions = new Set([
    ...path.map((s) => s.dimension),
    ...(currentDimension ? [currentDimension] : []),
  ]);

  const runQuery = (groupBy: ExplorerDimension, filters: ExplorerFilter[]) => {
    if (!activeFiscalYearId) return;
    setCurrentDimension(groupBy);
    setRows([]); // Clear rows immediately for the new dimension
    setSelectionModel({ type: 'include', ids: new Set<GridRowId>() });
    setPathFilters(filters);
    setQueryArgs({
      organizationId: orgId,
      fiscalYearId: activeFiscalYearId,
      groupBy,
      filters,
    });
  };

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
    setPathFilters([]);
    setCurrentDimension(null);
    setRows([]);
    setQueryArgs(null);
    setSelectionModel({ type: 'include', ids: new Set<GridRowId>() });
  };

  // Footer sums — over the selection when one exists, otherwise over all rows
  const selectedIds = Array.from(selectionModel.ids) as number[];
  const hasMultiSelection = selectedIds.length > 1;
  const activeRows = hasMultiSelection ? rows.filter((r) => selectedIds.includes(r.id)) : rows;

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
      align: 'right',
      headerAlign: 'right',
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
      {
        field: 'actions',
        headerName: '',
        width: 50,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <Tooltip title={tAccounting('explorer.openItems', { defaultValue: 'Open Journal Entry Items' })}>
            <IconButton size="small" onClick={() => handleOpenItems(params.row)}>
              <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        ),
      },
    ];
  }, [currentDimension, pathFilters, activeFiscalYearId, orgId, tAccounting]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
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

        {currentDimension && (
          <Button
            onClick={handleReset}
            size="small"
            color="inherit"
            startIcon={<RestartAltRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{ ml: 'auto', textTransform: 'none', color: 'text.secondary' }}
          >
            {tAccounting('explorer.reset', { defaultValue: 'Reset' })}
          </Button>
        )}
      </Box>

      <DrillTrail steps={path} currentDimension={currentDimension} onStepClick={handleTrailStepClick} />

      {!currentDimension && (
        <Fade in>
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              color: 'text.secondary',
              border: (theme) => `1px dashed ${theme.palette.divider}`,
              borderRadius: 2,
            }}
          >
            <TrendingFlatRoundedIcon sx={{ fontSize: 32, opacity: 0.4 }} />
            <Typography variant="body2">
              {tAccounting('explorer.emptyState', {
                defaultValue: 'Choose a dimension above to start exploring the ledger.',
              })}
            </Typography>
          </Box>
        </Fade>
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
            showHeaderSearchRow
            hideFooterPagination
            hideFooter
            disableColumnMenu
            sx={{
              flex: 1,
              '& .MuiDataGrid-cell:focus': { outline: 'none' },
              '& .MuiDataGrid-row:hover': { cursor: 'pointer' },
              '& .MuiDataGrid-cell': {
                borderRight: 1,
                borderColor: 'divider',
              },
              '& .MuiDataGrid-columnHeaders': {
                borderBottom: 1,
                borderColor: 'divider',
              },
            }}
          />

          {/* Totals footer */}
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
};