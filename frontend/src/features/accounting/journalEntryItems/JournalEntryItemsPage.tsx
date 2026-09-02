// src/pages/accounting/explorer/JournalEntryItemsPage.tsx
import { useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import type { GridColDef, GridRowSelectionModel, GridRowId } from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';
import { ExtendedDataGrid } from '../../../components/shared/ExtendedDataGrid';
import { useActiveFiscalYear } from '../../../hooks/useActiveFiscalYear';
import {
  useGetJournalEntryItemsQuery,
  type ExplorerFilter,
  type JournalEntryItem,
} from './journalEntryItemsApi';
import { AppliedFilters } from './components/AppliedFilters';
import { Box, Typography, alpha, IconButton, Tooltip } from '@mui/material';
import CurrencyExchangeRoundedIcon from '@mui/icons-material/CurrencyExchangeRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { FooterStat } from './components/FooterStat';
import { useTabManager } from '../../../components/tabs/useTabManager';

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined
    ? ''
    : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const JournalEntryItemsPage = () => {
  const { t: tAccounting } = useTranslation('accounting');
  const { t } = useTranslation('shared');
  const { organizationId } = useParams<{ organizationId: string }>();
  const [searchParams] = useSearchParams();
  const orgId = parseInt(organizationId || '0', 10);

  const { activeFiscalYearId } = useActiveFiscalYear(orgId);
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
    { organizationId: orgId, fiscalYearId: activeFiscalYearId!, filters },
    { skip: !orgId || !activeFiscalYearId }
  );

  const rows = items ?? [];

  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set<GridRowId>(),
  });

  const selectedIds = Array.from(selectionModel.ids) as number[];
  const hasMultiSelection = selectedIds.length > 1;
  const activeRows = hasMultiSelection ? rows.filter((r) => selectedIds.includes(r.id)) : rows;

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

    const no = row.journal_entry?.no || journalEntryId;
    const path = `/app/organizations/${orgId}/accounting/journal-entries/${journalEntryId}?focus_item_id=${row.id}`;

    openTab('journal-entry-edit', `Journal Entry #${no}`, path);
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
        valueGetter: (_, row) => row.journal_entry?.no ?? '',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <span>{params.row.journal_entry?.no ?? ''}</span>
            <Tooltip
              title={tAccounting('items.openJournalEntry', {
                defaultValue: 'Open Journal Entry',
              })}
            >
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenJournalEntry(params.row);
                }}
                sx={{ p: 0.25 }}
              >
                <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
      {
        field: 'journal_entry.ref',
        headerName: tAccounting('items.ref', { defaultValue: 'Ref' }),
        width: 80,
        valueGetter: (_, row) => row.journal_entry?.ref ?? '',
      },
      { field: 'row', headerName: tAccounting('items.row', { defaultValue: 'Row' }), width: 70 },
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
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => params.value === 0 ? '' : fmt(params.value),
      },
      {
        field: 'credit',
        headerName: tAccounting('items.credit', { defaultValue: 'Credit' }),
        width: 130,
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
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => fmt(params.value),
      },
      {
        field: 'rate',
        headerName: tAccounting('items.rate', { defaultValue: 'Rate' }),
        width: 100,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => fmt(params.value),
      },
    ],
    [tAccounting, t, orgId]
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {tAccounting('items.title', { defaultValue: 'Journal Entry Items' })}
      </Typography>

      <AppliedFilters filters={filters} />

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
            '& .MuiDataGrid-cell': { borderRight: 1, borderColor: 'divider' },
            '& .MuiDataGrid-columnHeaders': { borderBottom: 1, borderColor: 'divider' },
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
};