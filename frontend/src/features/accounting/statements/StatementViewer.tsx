import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FunctionsIcon from '@mui/icons-material/Functions';
import { useTranslation } from 'react-i18next';
import type { GridColDef } from '@mui/x-data-grid';
import { ExtendedDataGrid } from '../../../components/shared/ExtendedDataGrid';
import { BaseDatePicker } from '../../../components/shared/BaseDatePicker';
import { useTreeRows } from '../../../components/shared/treeRows';
import { TreeNameCell } from '../../../components/shared/TreeNameCell';
import { useTabLoading } from '../../../components/tabs/TabLoadingContext';
import { useOpenPage } from '../../../components/tabs/useOpenPage';
import { apiErrorMessage } from '../../../utils/apiErrorMessage';
import { useLazyDrillStatementQuery, useRunStatementQuery } from '../../reporting/reportingApi';
import { excelAmountFormat, formatAmount, formatPercent, toNumber, variance } from '../../reporting/amounts';
import { entryItemsPath } from '../../reporting/entryDrill';
import { useDefaultReportPeriod } from '../../reporting/useDefaultReportPeriod';
import type {
  DrillRow,
  ReportSummary,
  RunCheck,
  RunColumn,
  StatementLineResult,
  StatementRunParams,
} from '../../reporting/types';
import { ReportExportBar } from '../../reporting/components/ReportExportBar';
import { ReportPeriodFields } from '../../reporting/components/ReportPeriodFields';

type ViewerItem =
  | { type: 'line'; id: string; parent: string | null; line: StatementLineResult }
  | { type: 'account'; id: string; parent: string; lineKey: string; row: DrillRow }
  | { type: 'center'; id: string; parent: string; lineKey: string; row: DrillRow };

const getId = (item: ViewerItem) => item.id;
const getParent = (item: ViewerItem) => item.parent;
const lineId = (key: string) => `l:${key}`;
const accountId = (lineKey: string, row: DrillRow) => `a:${lineKey}:${row.id}`;

type CellRow = { item: ViewerItem; expanded: boolean; hasChildren: boolean };

interface StatementViewerProps {
  organizationId: number;
  report: ReportSummary;
}

/**
 * Interactive financial statement: period and comparison, expandable lines,
 * the accounts and centers behind each line, and the journal entry items
 * behind those for members who may read journal entries.
 */
export const StatementViewer = ({ organizationId, report }: StatementViewerProps) => {
  const { t, i18n } = useTranslation('reporting');
  const { openPage } = useOpenPage(organizationId);
  const defaultPeriod = useDefaultReportPeriod(organizationId);
  const isBalanceSheet = report.statement_type === 'balance_sheet';

  const [date, setDate] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [comparison, setComparison] = useState(true);
  const [approvedOnly, setApprovedOnly] = useState(false);
  const [centerLevel, setCenterLevel] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [accounts, setAccounts] = useState<Record<string, DrillRow[]>>({});
  const [centers, setCenters] = useState<Record<string, DrillRow[]>>({});
  const [drillError, setDrillError] = useState<string | null>(null);

  // Default period: the active fiscal year, up to today.
  useEffect(() => {
    if (!defaultPeriod) return;
    setDate((current) => current ?? defaultPeriod.end);
    setFrom((current) => current ?? defaultPeriod.start);
    setTo((current) => current ?? defaultPeriod.end);
  }, [defaultPeriod]);

  const params: StatementRunParams = useMemo(
    () => ({
      ...(isBalanceSheet ? { date: date ?? undefined } : { from: from ?? undefined, to: to ?? undefined }),
      comparison,
      approved_only: approvedOnly || undefined,
    }),
    [isBalanceSheet, date, from, to, comparison, approvedOnly]
  );

  const { data, isFetching, isError, error } = useRunStatementQuery({ organizationId, id: report.id, params });
  const [drill] = useLazyDrillStatementQuery();
  useTabLoading(isFetching);

  // Only the center levels the organization uses can be chosen.
  useEffect(() => {
    if (data && centerLevel > data.center_levels) setCenterLevel(1);
  }, [data, centerLevel]);

  // New figures: the loaded breakdowns no longer apply, and breakdowns
  // still on their way (asked for with the old params) are dropped.
  const paramsVersion = useRef(0);
  useEffect(() => {
    paramsVersion.current += 1;
    setAccounts({});
    setCenters({});
    setExpanded(new Set());
  }, [params, centerLevel]);

  const digits = data?.currency.decimal_digits ?? 2;
  const columns = useMemo(() => data?.columns ?? [], [data]);
  const canDrillToEntries = report.permissions.can_drill_to_entries;

  const items: ViewerItem[] = useMemo(() => {
    if (!data) return [];
    const list: ViewerItem[] = data.lines
      .filter((line) => !line.style.hidden && !(line.style.hide_if_zero && Object.values(line.values).every((v) => !toNumber(v))))
      .map((line) => ({ type: 'line', id: lineId(line.key), parent: line.parent_key ? lineId(line.parent_key) : null, line }));
    Object.entries(accounts).forEach(([lineKey, rows]) =>
      rows.forEach((row) => list.push({ type: 'account', id: accountId(lineKey, row), parent: lineId(lineKey), lineKey, row }))
    );
    Object.entries(centers).forEach(([parent, rows]) => {
      const lineKey = parent.split(':')[1];
      rows.forEach((row) => list.push({ type: 'center', id: `c:${parent}:${row.id}`, parent, lineKey, row }));
    });
    return list;
  }, [data, accounts, centers]);

  const expandable = useCallback(
    (item: ViewerItem) =>
      item.type === 'line'
        ? item.line.has_contributions
        : item.type === 'account' && (item.row.center_levels ?? []).includes(centerLevel),
    [centerLevel]
  );
  const treeRows = useTreeRows(items, getId, getParent, expanded, expandable);

  const load = useCallback(
    async (item: ViewerItem) => {
      const version = paramsVersion.current;
      const current = () => version === paramsVersion.current;
      setDrillError(null);
      try {
        if (item.type === 'line' && item.line.has_contributions && !accounts[item.line.key]) {
          const result = await drill({ organizationId, id: report.id, params: { ...params, line: item.line.key } }).unwrap();
          if (current()) setAccounts((loaded) => ({ ...loaded, [item.line.key]: result.rows }));
        } else if (item.type === 'account' && !centers[item.id]) {
          const result = await drill({
            organizationId,
            id: report.id,
            params: { ...params, line: item.lineKey, account_id: item.row.account_id, center_level: centerLevel },
          }).unwrap();
          if (current()) setCenters((loaded) => ({ ...loaded, [item.id]: result.rows }));
        }
      } catch (err) {
        if (current()) setDrillError(apiErrorMessage(err) || t('viewer.drillFailed'));
      }
    },
    [accounts, centers, drill, organizationId, report.id, params, centerLevel, t]
  );

  const toggle = useCallback(
    (item: ViewerItem) => {
      const willExpand = !expanded.has(item.id);
      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
      if (willExpand) void load(item);
    },
    [expanded, load]
  );

  const openItems = useCallback(
    (column: RunColumn, item: ViewerItem) => {
      if (item.type === 'line') return;
      const path = entryItemsPath(column, item.row, item.type === 'center' ? centerLevel : null);
      openPage('journal-entry-items', t('viewer.itemsTabTitle', { name: item.row.account_name ?? '' }), path);
    },
    [centerLevel, openPage, t]
  );

  const columnTitle = useCallback(
    (column: RunColumn) =>
      column.as_of ? t('viewer.asOf', { date: column.as_of }) : t('viewer.period', { from: column.from, to: column.to }),
    [t]
  );

  // Headings have no amount of their own; collapsed, they show the total
  // of their lines (formula lines left out: they restate their siblings).
  const headingTotals = useMemo(() => {
    const totals: Record<string, Record<string, number | null>> = {};
    if (!data) return totals;
    const children = new Map<string, StatementLineResult[]>();
    data.lines.forEach((line) => {
      if (line.parent_key) children.set(line.parent_key, [...(children.get(line.parent_key) ?? []), line]);
    });
    const total = (line: StatementLineResult): { side: string; values: Record<string, number | null> } => {
      if (line.kind !== 'heading') {
        return { side: line.normal_side, values: Object.fromEntries(columns.map((c) => [c.key, toNumber(line.values[c.key])])) };
      }
      const parts = (children.get(line.key) ?? []).filter((child) => child.kind !== 'formula' && !child.style.hidden).map(total);
      const side = parts[0]?.side ?? line.normal_side;
      const values = Object.fromEntries(
        columns.map((c) => {
          const amounts = parts.map((part) => part.values[c.key]).filter((v) => v !== null);
          if (amounts.length === 0) return [c.key, null];
          return [c.key, parts.reduce((sum, part) => sum + (part.values[c.key] ?? 0) * (part.side === side ? 1 : -1), 0)];
        })
      );
      totals[line.key] = values;
      return { side, values };
    };
    data.lines.filter((line) => line.kind === 'heading').forEach(total);
    return totals;
  }, [data, columns]);

  const cellValue = useCallback(
    (row: CellRow, columnKey: string) => {
      const { item } = row;
      if (item.type === 'line' && item.line.kind === 'heading') {
        return row.hasChildren && !row.expanded ? headingTotals[item.line.key]?.[columnKey] ?? null : null;
      }
      return toNumber((item.type === 'line' ? item.line.values : item.row.values)[columnKey]);
    },
    [headingTotals]
  );
  const locale = i18n.language;

  const gridColumns: GridColDef[] = useMemo(() => {
    const valueColumn = (column: RunColumn): GridColDef => ({
      field: `value_${column.key}`,
      headerName: columnTitle(column),
      width: 170,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      valueGetter: (_value, row) => cellValue(row, column.key),
      renderCell: (cell) => (
        <Typography variant="body2" fontWeight={cell.row.item.type === 'line' && cell.row.item.line.style.bold ? 600 : 400}>
          {formatAmount(cell.value as number | null, digits, locale)}
        </Typography>
      ),
    });

    const result: GridColDef[] = [
      {
        field: 'name',
        headerName: t('viewer.line'),
        flex: 1,
        minWidth: 320,
        sortable: false,
        renderCell: (cell) => {
          const tree = cell.row;
          const item: ViewerItem = tree.item;
          return (
            <TreeNameCell level={tree.level} hasChildren={tree.hasChildren} expanded={tree.expanded} onToggle={() => toggle(item)}>
              {item.type === 'line' ? (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography
                    variant="body2"
                    fontWeight={item.line.style.bold || item.line.kind === 'heading' ? 600 : 400}
                    sx={{ textDecoration: item.line.style.underline ? 'underline' : 'none' }}
                  >
                    {item.line.label}
                  </Typography>
                  {item.line.kind === 'formula' && item.line.formula && (
                    <Tooltip title={t('viewer.formula', { formula: item.line.formula })}>
                      <FunctionsIcon fontSize="inherit" color="action" />
                    </Tooltip>
                  )}
                </Stack>
              ) : (
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    {item.type === 'account'
                      ? `${item.row.account_code ?? ''} ${item.row.account_name ?? ''}`
                      : item.row.center_id
                        ? `${item.row.center_code ?? ''} ${item.row.center_name ?? ''}`
                        : t('viewer.noCenter')}
                  </Typography>
                  {item.row.period === 'prior' && <Chip size="small" variant="outlined" label={t('viewer.priorYears')} />}
                  {item.row.reclassified && (
                    <Tooltip title={t('viewer.reclassifiedHint')}>
                      <Chip size="small" color="warning" variant="outlined" label={t('viewer.reclassified')} />
                    </Tooltip>
                  )}
                </Stack>
              )}
            </TreeNameCell>
          );
        },
      },
      ...columns.map(valueColumn),
    ];

    if (columns.length === 2) {
      const [current, previous] = columns;
      const diff = (row: CellRow) =>
        variance(cellValue(row, current.key), cellValue(row, previous.key));
      result.push(
        {
          field: 'variance',
          headerName: t('viewer.variance'),
          width: 150,
          align: 'right',
          headerAlign: 'right',
          sortable: false,
          valueGetter: (_value, row) => diff(row).amount,
          renderCell: (cell) => formatAmount(cell.value as number | null, digits, locale),
        },
        {
          field: 'variance_percent',
          headerName: t('viewer.variancePercent'),
          width: 110,
          align: 'right',
          headerAlign: 'right',
          sortable: false,
          valueGetter: (_value, row) => diff(row).percent,
          renderCell: (cell) => formatPercent(cell.value as number | null, locale),
        }
      );
    }

    if (canDrillToEntries) {
      result.push({
        field: 'actions',
        headerName: '',
        width: 56,
        sortable: false,
        renderCell: (cell) =>
          cell.row.item.type !== 'line' && columns[0] ? (
            <Tooltip title={t('viewer.openItems')}>
              <IconButton size="small" onClick={() => openItems(columns[0], cell.row.item)}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null,
      });
    }
    return result;
  }, [columns, digits, locale, canDrillToEntries, t, columnTitle, cellValue, toggle, openItems]);

  return (
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
      <Paper sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', flexShrink: 0 }}>
        {isBalanceSheet ? (
          <Box sx={{ width: 200 }}>
            <BaseDatePicker label={t('viewer.date')} value={date} onChange={setDate} size="small" fullWidth />
          </Box>
        ) : (
          <ReportPeriodFields from={from} to={to} onFromChange={setFrom} onToChange={setTo} width={200} />
        )}
        <FormControlLabel
          control={<Switch checked={comparison} onChange={(e) => setComparison(e.target.checked)} />}
          label={t('viewer.comparison')}
        />
        <FormControlLabel
          control={<Switch checked={approvedOnly} onChange={(e) => setApprovedOnly(e.target.checked)} />}
          label={t('viewer.approvedOnly')}
        />
        <TextField
          select
          size="small"
          label={t('viewer.centerLevel')}
          value={centerLevel}
          onChange={(e) => setCenterLevel(Number(e.target.value))}
          sx={{ width: 160 }}
        >
          {Array.from({ length: data?.center_levels ?? 1 }, (_, i) => i + 1).map((level) => (
            <MenuItem key={level} value={level}>
              {t('viewer.centerLevelOption', { level })}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ ml: 'auto' }}>
          <ReportExportBar
            report={report}
            params={params}
            sheet={() =>
              data
                ? {
                    title: report.name,
                    columns: [
                      { header: t('viewer.line'), width: 50 },
                      ...data.columns.map((column) => ({ header: columnTitle(column), width: 18, numFmt: excelAmountFormat(digits, { parentheses: true }) })),
                    ],
                    rows: data.lines
                      .filter((line) => !line.style.hidden)
                      .map((line) => [
                        `${'   '.repeat(line.depth)}${line.label}`,
                        ...data.columns.map((column) => toNumber(line.values[column.key])),
                      ]),
                  }
                : null
            }
          />
        </Box>
      </Paper>

      {isError && <Alert severity="error">{apiErrorMessage(error) || t('viewer.loadFailed')}</Alert>}
      {drillError && (
        <Alert severity="error" onClose={() => setDrillError(null)}>
          {drillError}
        </Alert>
      )}
      {data && <ChecksBanner checks={data.checks} columns={data.columns} />}

      <Paper sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ExtendedDataGrid
          rows={treeRows}
          getRowId={(row) => row.id}
          columns={gridColumns}
          loading={isFetching}
          hideFooter
          hideFooterPagination
          disableColumnMenu
          disableRowSelectionOnClick
          showCellVerticalBorder
          density="compact"
          getRowClassName={(row) => (row.row.item.type === 'line' ? `statement-line-${row.row.item.line.kind}` : 'statement-detail')}
          sx={{
            '& .statement-line-heading': { bgcolor: 'action.hover' },
            '& .statement-detail': { bgcolor: 'background.default' },
          }}
        />
      </Paper>
    </Stack>
  );
};

/** Problems found while computing the statement (unmapped balances, not balanced, ...). */
const ChecksBanner = ({ checks, columns }: { checks: RunCheck[]; columns: RunColumn[] }) => {
  const { t } = useTranslation('reporting');
  const columnName = (key: string) => {
    const column = columns.find((c) => c.key === key);
    if (!column) return key;
    return column.as_of ? t('viewer.asOf', { date: column.as_of }) : t('viewer.period', { from: column.from, to: column.to });
  };
  const visible = checks.filter((check) => check.severity !== 'info' || check.column === 'current');
  if (visible.length === 0) return null;
  return (
    <Stack spacing={1} sx={{ flexShrink: 0 }}>
      {visible.map((check, index) => (
        <Alert key={`${check.code}-${check.column}-${index}`} severity={check.severity}>
          {t(`checks.${check.code}`, { ...check.details, column: columnName(check.column), defaultValue: check.code })}
        </Alert>
      ))}
    </Stack>
  );
};
