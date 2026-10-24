import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useTranslation } from 'react-i18next';
import type { GridColDef } from '@mui/x-data-grid';
import { ExtendedDataGrid } from '../../../components/shared/ExtendedDataGrid';
import { useTabLoading } from '../../../components/tabs/TabLoadingContext';
import { useOpenPage } from '../../../components/tabs/useOpenPage';
import { apiErrorMessage } from '../../../utils/apiErrorMessage';
import { excelAmountFormat, formatAmount, toNumber } from '../../reporting/amounts';
import { centerFilter, entryFilter, journalEntryItemsPath } from '../../reporting/entryDrill';
import { useDefaultReportPeriod } from '../../reporting/useDefaultReportPeriod';
import { useRunTrialBalanceQuery } from './trialBalanceApi';
import type { ReportSummary } from '../../reporting/types';
import type { TrialBalanceAmounts, TrialBalanceLevel, TrialBalanceParams, TrialBalanceRow } from './types';
import { ReportExportBar } from '../../reporting/components/ReportExportBar';
import { ReportPeriodFields } from '../../reporting/components/ReportPeriodFields';

const AMOUNT_FIELDS = ['opening_debit', 'opening_credit', 'debit', 'credit', 'closing_debit', 'closing_credit'] as const;
const TOTAL_ID = '__total__';

/** The totals, shown as the grid's last row. */
interface TotalRow extends TrialBalanceAmounts {
  id: typeof TOTAL_ID;
  total: true;
  name: string;
}
type GridRow = TrialBalanceRow | TotalRow;
const isTotal = (row: GridRow): row is TotalRow => 'total' in row;

/** Opening, period and closing balances of every account, with drill-down to the items. */
export const TrialBalanceViewer = ({ organizationId, report }: { organizationId: number; report: ReportSummary }) => {
  const { t, i18n } = useTranslation('reporting');
  const { openPage } = useOpenPage(organizationId);
  const defaultPeriod = useDefaultReportPeriod(organizationId);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [level, setLevel] = useState<TrialBalanceLevel | null>(null);
  const [centerLevel, setCenterLevel] = useState<number | ''>('');
  const [hideZero, setHideZero] = useState(true);
  const [approvedOnly, setApprovedOnly] = useState(false);

  useEffect(() => {
    if (!defaultPeriod) return;
    setFrom((current) => current ?? defaultPeriod.start);
    setTo((current) => current ?? defaultPeriod.end);
  }, [defaultPeriod]);

  const params: TrialBalanceParams = {
    from: from ?? undefined,
    to: to ?? undefined,
    level: level ?? undefined,
    center_level: centerLevel === '' ? undefined : centerLevel,
    hide_zero: hideZero,
    approved_only: approvedOnly || undefined,
  };
  const { data, isFetching, isError, error } = useRunTrialBalanceQuery(
    { organizationId, id: report.id, params },
    { skip: !from || !to }
  );
  useTabLoading(isFetching);
  const digits = data?.currency.decimal_digits ?? 2;
  const locale = i18n.language;
  const shownLevel = data?.level ?? level ?? 'ledger';

  const rows = useMemo((): GridRow[] => {
    if (!data) return [];
    const total: TotalRow = { ...data.totals, id: TOTAL_ID, total: true, name: t('trialBalance.total') };
    return [...data.rows, total];
  }, [data, t]);

  const openItems = (row: TrialBalanceRow) => {
    if (!data || !row.level_id) return;
    const filters = [entryFilter(data.level === 'category' ? 'account_category' : data.level, row.level_id, row.code, row.name)];
    if (data.center_level && row.center_id) {
      filters.push(centerFilter(data.center_level, { ...row, center_id: row.center_id }));
    }
    openPage(
      'journal-entry-items',
      t('viewer.itemsTabTitle', { name: row.name ?? '' }),
      journalEntryItemsPath(data.entries.period, filters)
    );
  };

  const rowName = (row: GridRow) => (isTotal(row) ? row.name : row.prior_result ? t('trialBalance.priorResult') : row.name ?? '');

  const amountColumn = (field: (typeof AMOUNT_FIELDS)[number]): GridColDef<GridRow> => ({
    field,
    headerName: t(`trialBalance.columns.${field}`),
    width: 140,
    type: 'number',
    sortable: false,
    valueGetter: (value: string) => toNumber(value),
    renderCell: (cell) => (
      <Typography variant="body2" fontWeight={isTotal(cell.row) ? 700 : 400}>
        {cell.value ? formatAmount(cell.value as number, digits, locale) : ''}
      </Typography>
    ),
  });

  const columns: GridColDef<GridRow>[] = [
    { field: 'code', headerName: t('trialBalance.code'), width: 110, sortable: false },
    {
      field: 'name',
      headerName: t(`trialBalance.levels.${shownLevel}`),
      flex: 1,
      minWidth: 220,
      sortable: false,
      renderCell: (cell) => (
        <Typography variant="body2" fontWeight={isTotal(cell.row) ? 700 : 400} fontStyle={!isTotal(cell.row) && cell.row.prior_result ? 'italic' : 'normal'}>
          {rowName(cell.row)}
        </Typography>
      ),
    },
    ...(data?.center_level
      ? [
          {
            field: 'center',
            headerName: t('inspection.center', { level: data.center_level }),
            width: 180,
            sortable: false,
            valueGetter: (_v: unknown, row: GridRow) => (!isTotal(row) && row.center_code ? `${row.center_code} ${row.center_name ?? ''}` : ''),
          } as GridColDef<GridRow>,
        ]
      : []),
    ...AMOUNT_FIELDS.map(amountColumn),
    ...(report.permissions.can_drill_to_entries
      ? [
          {
            field: 'actions',
            headerName: '',
            width: 56,
            sortable: false,
            renderCell: ({ row }: { row: GridRow }) =>
              !isTotal(row) && row.level_id ? (
                <Tooltip title={t('viewer.openItems')}>
                  <IconButton size="small" onClick={() => openItems(row)}>
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null,
          } as GridColDef<GridRow>,
        ]
      : []),
  ];

  return (
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
      <Paper sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', flexShrink: 0 }}>
        <ReportPeriodFields from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <ToggleButtonGroup size="small" exclusive value={shownLevel} onChange={(_, value) => value && setLevel(value)}>
          {(['category', 'ledger', 'account'] as const).map((value) => (
            <ToggleButton key={value} value={value}>
              {t(`trialBalance.levels.${value}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField
          select
          size="small"
          label={t('viewer.centerLevel')}
          value={centerLevel}
          onChange={(e) => setCenterLevel(e.target.value === '' ? '' : Number(e.target.value))}
          sx={{ width: 160 }}
        >
          <MenuItem value="">{t('editor.none')}</MenuItem>
          {Array.from({ length: data?.center_levels ?? 0 }, (_, i) => i + 1).map((value) => (
            <MenuItem key={value} value={value}>
              {t('viewer.centerLevelOption', { level: value })}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel control={<Switch checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />} label={t('trialBalance.hideZero')} />
        <FormControlLabel control={<Switch checked={approvedOnly} onChange={(e) => setApprovedOnly(e.target.checked)} />} label={t('viewer.approvedOnly')} />
        <Box sx={{ ml: 'auto' }}>
          <ReportExportBar
            report={report}
            params={params}
            sheet={() =>
              data
                ? {
                    title: report.name,
                    columns: [
                      { header: t('trialBalance.code'), width: 14, text: true },
                      { header: t(`trialBalance.levels.${data.level}`), width: 40 },
                      ...AMOUNT_FIELDS.map((field) => ({
                        header: `${t(`trialBalance.groups.${field.startsWith('opening') ? 'opening' : field.startsWith('closing') ? 'closing' : 'period'}`)} – ${t(`trialBalance.columns.${field}`)}`,
                        width: 16,
                        numFmt: excelAmountFormat(digits),
                      })),
                    ],
                    rows: rows.map((row) => [
                      isTotal(row) ? '' : row.code ?? '',
                      rowName(row),
                      ...AMOUNT_FIELDS.map((field) => toNumber(row[field])),
                    ]),
                  }
                : null
            }
          />
        </Box>
      </Paper>
      {isError && <Alert severity="error">{apiErrorMessage(error) || t('viewer.loadFailed')}</Alert>}
      {data?.checks.map((check) => (
        <Alert key={check.column} severity="error">
          {t('checks.trial_balance_unbalanced', { column: t(`trialBalance.groups.${check.column}`), ...check.details })}
        </Alert>
      ))}
      <Paper sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ExtendedDataGrid
          rows={rows}
          columns={columns}
          loading={isFetching}
          hideFooter
          hideFooterPagination
          disableColumnMenu
          disableRowSelectionOnClick
          showCellVerticalBorder
          density="compact"
          getRowClassName={(params) => (isTotal(params.row) ? 'trial-balance-total' : '')}
          sx={{ '& .trial-balance-total': { bgcolor: 'action.hover' } }}
          columnGroupingModel={[
            { groupId: 'opening', headerName: t('trialBalance.groups.opening'), children: [{ field: 'opening_debit' }, { field: 'opening_credit' }] },
            { groupId: 'period', headerName: t('trialBalance.groups.period'), children: [{ field: 'debit' }, { field: 'credit' }] },
            { groupId: 'closing', headerName: t('trialBalance.groups.closing'), children: [{ field: 'closing_debit' }, { field: 'closing_credit' }] },
          ]}
        />
      </Paper>
    </Stack>
  );
};
