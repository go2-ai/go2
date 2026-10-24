import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddLinkIcon from '@mui/icons-material/AddLink';
import { useTranslation } from 'react-i18next';
import type { GridColDef } from '@mui/x-data-grid';
import { ExtendedDataGrid } from '../../../../components/shared/ExtendedDataGrid';
import { BaseDatePicker } from '../../../../components/shared/BaseDatePicker';
import { useOpenPage } from '../../../../components/tabs/useOpenPage';
import { apiErrorMessage } from '../../../../utils/apiErrorMessage';
import { formatAmount, toNumber } from '../../../reporting/amounts';
import { accountFilter, columnEntries, journalEntryItemsPath } from '../../../reporting/entryDrill';
import { ReportPeriodFields } from '../../../reporting/components/ReportPeriodFields';
import { useGetInspectionQuery } from '../statementLayoutApi';
import type { InspectionRow, LayoutLine, LayoutRule } from '../types';

type Filter = 'all' | 'unmapped' | 'overridden' | 'reclassified' | 'out_of_scope' | 'changed';

interface Props {
  organizationId: number;
  reportId: number;
  isBalanceSheet: boolean;
  lines: LayoutLine[];
  rules: LayoutRule[];
  defaultDate: string | null;
  defaultFrom: string | null;
  canDrillToEntries: boolean;
  /** JSON of proposed rules: adds the "Reflected in (proposed)" column. */
  proposedRules?: string;
  /** Offers to create a rule for an unmapped or chosen balance. */
  onMapRow?: (row: InspectionRow) => void;
}

/**
 * Every balance the statement reads, with the line it is reflected in, the
 * rule that decided it and the rules it overrode: to audit the mapping.
 */
export const InspectionPanel = ({
  organizationId,
  reportId,
  isBalanceSheet,
  lines,
  rules,
  defaultDate,
  defaultFrom,
  canDrillToEntries,
  proposedRules,
  onMapRow,
}: Props) => {
  const { t, i18n } = useTranslation('reporting');
  const { openPage } = useOpenPage(organizationId);
  const [date, setDate] = useState<string | null>(defaultDate);
  const [from, setFrom] = useState<string | null>(defaultFrom);
  const [to, setTo] = useState<string | null>(defaultDate);
  // The default period may arrive after mount (fiscal years still loading):
  // apply it to the dates not set yet.
  useEffect(() => {
    if (defaultDate) {
      setDate((current) => current ?? defaultDate);
      setTo((current) => current ?? defaultDate);
    }
    if (defaultFrom) setFrom((current) => current ?? defaultFrom);
  }, [defaultDate, defaultFrom]);
  const [column, setColumn] = useState('current');
  const [filter, setFilter] = useState<Filter>(proposedRules ? 'changed' : 'all');
  const [lineKey, setLineKey] = useState('');
  const [ruleId, setRuleId] = useState<number | ''>('');

  const params = {
    ...(isBalanceSheet ? { date: date ?? undefined } : { from: from ?? undefined, to: to ?? undefined }),
    column,
    proposed_rules: proposedRules,
  };
  const { data, isFetching, isError, error } = useGetInspectionQuery({ organizationId, reportId, params });
  const digits = data?.currency.decimal_digits ?? 2;
  const centerLevels = data?.center_levels ?? 0;
  const locale = i18n.language;

  const rows = useMemo(
    () =>
      (data?.rows ?? []).filter((row) => {
        if (filter === 'unmapped' && !row.unmapped) return false;
        if (filter === 'overridden' && row.overridden_rule_numbers.length === 0) return false;
        if (filter === 'reclassified' && !row.reclassified) return false;
        if (filter === 'out_of_scope' && !row.out_of_scope) return false;
        if (filter === 'changed' && !row.changed) return false;
        if (lineKey && row.line_key !== lineKey && row.proposed_line_key !== lineKey) return false;
        if (ruleId !== '' && row.rule_id !== ruleId && !row.overridden_rule_ids.includes(ruleId)) return false;
        return true;
      }),
    [data, filter, lineKey, ruleId]
  );

  const openItems = (row: InspectionRow) => {
    if (!data) return;
    const path = journalEntryItemsPath(columnEntries(data.column, row.period), [accountFilter(row)]);
    openPage('journal-entry-items', t('viewer.itemsTabTitle', { name: row.account_name ?? '' }), path);
  };

  const columns: GridColDef<InspectionRow>[] = [
    { field: 'category_name', headerName: t('inspection.category'), width: 150 },
    { field: 'ledger', headerName: t('inspection.ledger'), width: 180, valueGetter: (_v, row) => `${row.ledger_code ?? ''} ${row.ledger_name ?? ''}` },
    { field: 'account', headerName: t('inspection.account'), width: 220, valueGetter: (_v, row) => `${row.account_code ?? ''} ${row.account_name ?? ''}` },
    ...Array.from({ length: centerLevels }, (_, i): GridColDef<InspectionRow> => ({
      field: `center${i + 1}`,
      headerName: t('inspection.center', { level: i + 1 }),
      width: 150,
      valueGetter: (_v, row) => (row.centers[i] ? `${row.centers[i]!.code} ${row.centers[i]!.name}` : ''),
    })),
    { field: 'currency', headerName: t('inspection.currency'), width: 80 },
    {
      field: 'balance',
      headerName: t('inspection.balance'),
      width: 140,
      type: 'number',
      valueGetter: (value: string) => toNumber(value),
      renderCell: (cell) => (
        <Tooltip title={cell.row.group_total && cell.row.group_total !== cell.row.balance ? t('inspection.groupTotal', { amount: formatAmount(toNumber(cell.row.group_total), digits, locale) }) : ''}>
          <span>{formatAmount(cell.value as number | null, digits, locale)}</span>
        </Tooltip>
      ),
    },
    {
      field: 'line_label',
      headerName: t('inspection.reflectedIn'),
      width: 220,
      renderCell: (cell) => {
        const row = cell.row;
        if (row.out_of_scope) return <Chip size="small" variant="outlined" label={t('inspection.outOfScope')} />;
        if (row.unmapped) return <Chip size="small" color="error" label={t('inspection.unmapped')} />;
        return (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ height: '100%' }}>
            <Typography variant="body2">{row.line_label}</Typography>
            {row.reclassified && <Chip size="small" color="warning" variant="outlined" label={t('viewer.reclassified')} />}
          </Stack>
        );
      },
    },
    ...(proposedRules
      ? [
          {
            field: 'proposed_line_label',
            headerName: t('inspection.reflectedInProposed'),
            width: 220,
            renderCell: (cell: { row: InspectionRow }) => (
              <Typography variant="body2" fontWeight={cell.row.changed ? 600 : 400} color={cell.row.changed ? 'primary' : 'text.primary'}>
                {cell.row.proposed_line_label ?? (cell.row.out_of_scope ? '' : t('inspection.unmapped'))}
              </Typography>
            ),
          } as GridColDef<InspectionRow>,
        ]
      : []),
    {
      field: 'rule_number',
      headerName: t('inspection.rule'),
      width: 90,
      valueGetter: (value: number | null) => (value ? t('inspection.ruleNumber', { number: value }) : ''),
    },
    {
      field: 'overridden',
      headerName: t('inspection.overridden'),
      width: 150,
      valueGetter: (_v, row) => row.overridden_rule_numbers.map((n) => t('inspection.ruleNumber', { number: n })).join(', '),
    },
    { field: 'period', headerName: t('inspection.period'), width: 110, valueGetter: (value: string | null) => (value ? t(`editor.periods.${value}`) : '') },
    {
      field: 'actions',
      headerName: '',
      width: 90,
      sortable: false,
      renderCell: (cell) => (
        <Box>
          {onMapRow && !cell.row.out_of_scope && (
            <Tooltip title={t('inspection.mapRow')}>
              <IconButton size="small" onClick={() => onMapRow(cell.row)}>
                <AddLinkIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canDrillToEntries && (
            <Tooltip title={t('viewer.openItems')}>
              <IconButton size="small" onClick={() => openItems(cell.row)}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ];

  const counts = useMemo(() => {
    const list = data?.rows ?? [];
    return {
      unmapped: list.filter((r) => r.unmapped).length,
      overridden: list.filter((r) => r.overridden_rule_numbers.length > 0).length,
      reclassified: list.filter((r) => r.reclassified).length,
      out_of_scope: list.filter((r) => r.out_of_scope).length,
      changed: list.filter((r) => r.changed).length,
    };
  }, [data]);

  const filters: Filter[] = ['all', 'unmapped', 'overridden', 'reclassified', 'out_of_scope', ...(proposedRules ? (['changed'] as Filter[]) : [])];
  const checks = proposedRules ? data?.proposed_checks ?? [] : data?.checks ?? [];

  return (
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
      <Paper sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', flexShrink: 0 }}>
        {isBalanceSheet ? (
          <Box sx={{ width: 180 }}>
            <BaseDatePicker label={t('viewer.date')} value={date} onChange={setDate} size="small" fullWidth />
          </Box>
        ) : (
          <ReportPeriodFields from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        )}
        <TextField select size="small" label={t('inspection.column')} value={column} onChange={(e) => setColumn(e.target.value)} sx={{ width: 160 }}>
          <MenuItem value="current">{t('inspection.columns.current')}</MenuItem>
          <MenuItem value="previous">{t('inspection.columns.previous')}</MenuItem>
        </TextField>
        <TextField select size="small" label={t('inspection.line')} value={lineKey} onChange={(e) => setLineKey(e.target.value)} sx={{ width: 220 }}>
          <MenuItem value="">{t('catalog.all')}</MenuItem>
          {lines
            .filter((l) => l.kind === 'mapped')
            .map((l) => (
              <MenuItem key={l.key} value={l.key}>
                {l.label}
              </MenuItem>
            ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('inspection.rule')}
          value={ruleId}
          onChange={(e) => setRuleId(e.target.value === '' ? '' : Number(e.target.value))}
          sx={{ width: 140 }}
        >
          <MenuItem value="">{t('catalog.all')}</MenuItem>
          {rules.map((r) => (
            <MenuItem key={r.id} value={r.id}>
              {t('inspection.ruleNumber', { number: r.number })}
            </MenuItem>
          ))}
        </TextField>
        <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, value) => value && setFilter(value)}>
          {filters.map((value) => (
            <ToggleButton key={value} value={value}>
              {t(`inspection.filters.${value}`)}
              {value !== 'all' && ` (${counts[value as Exclude<Filter, 'all'>]})`}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Paper>

      {isError && <Alert severity="error">{apiErrorMessage(error) || t('viewer.loadFailed')}</Alert>}
      {checks
        .filter((check) => check.severity === 'error')
        .map((check, index) => (
          <Alert key={`${check.code}-${index}`} severity="error">
            {t(`checks.${check.code}`, { ...check.details, column: '', defaultValue: check.code })}
          </Alert>
        ))}

      <Paper sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ExtendedDataGrid
          rows={rows}
          columns={columns}
          loading={isFetching}
          showHeaderSearchRow
          excludeSearchFields={['actions', 'balance']}
          hideFooter
          hideFooterPagination
          disableColumnMenu
          disableRowSelectionOnClick
          rowHeight={38}
          getRowClassName={(row) => (row.row.changed ? 'inspection-changed' : row.row.unmapped ? 'inspection-unmapped' : '')}
          sx={{
            '& .inspection-changed': { backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08) },
            '& .inspection-unmapped': { backgroundColor: (theme) => alpha(theme.palette.error.main, 0.06) },
          }}
          localeText={{ noRowsLabel: t('inspection.empty') }}
        />
      </Paper>
    </Stack>
  );
};
