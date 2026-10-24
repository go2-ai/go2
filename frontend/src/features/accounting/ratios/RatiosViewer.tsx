import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { GridColDef } from '@mui/x-data-grid';
import { ExtendedDataGrid } from '../../../components/shared/ExtendedDataGrid';
import { useTabLoading } from '../../../components/tabs/TabLoadingContext';
import { useOpenPage } from '../../../components/tabs/useOpenPage';
import { apiErrorMessage } from '../../../utils/apiErrorMessage';
import { formatAmount, formatPercent, toNumber } from '../../reporting/amounts';
import { useDefaultReportPeriod } from '../../reporting/useDefaultReportPeriod';
import type { ReportSummary } from '../../reporting/types';
import { ReportExportBar } from '../../reporting/components/ReportExportBar';
import { ReportPeriodFields } from '../../reporting/components/ReportPeriodFields';
import { useRunRatiosQuery, type RatioResult, type RatiosParams } from './ratiosApi';

/** Decimals of a ratio such as the current ratio (1.53). */
const RATIO_DIGITS = 2;

/** Financial ratios for a period and its comparison; each opens the figures behind it. */
export const RatiosViewer = ({ organizationId, report }: { organizationId: number; report: ReportSummary }) => {
  const { t, i18n } = useTranslation('reporting');
  const { openPage } = useOpenPage(organizationId);
  const defaultPeriod = useDefaultReportPeriod(organizationId);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [comparison, setComparison] = useState(true);
  const [selected, setSelected] = useState<RatioResult | null>(null);
  const locale = i18n.language;

  useEffect(() => {
    if (!defaultPeriod) return;
    setFrom((c) => c ?? defaultPeriod.start);
    setTo((c) => c ?? defaultPeriod.end);
  }, [defaultPeriod]);

  const params: RatiosParams = { from: from ?? undefined, to: to ?? undefined, comparison };
  const { data, isFetching, isError, error } = useRunRatiosQuery(
    { organizationId, id: report.id, params },
    { skip: !from || !to }
  );
  useTabLoading(isFetching);
  const digits = data?.currency?.decimal_digits ?? 2;

  const format = useCallback(
    (ratio: RatioResult, value?: string) => {
      const number = toNumber(value);
      if (number === null) return '';
      if (ratio.format === 'percent') return formatPercent(number, locale);
      if (ratio.format === 'days') return t('ratios.days', { value: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(number) });
      return new Intl.NumberFormat(locale, { minimumFractionDigits: RATIO_DIGITS, maximumFractionDigits: RATIO_DIGITS }).format(number);
    },
    [locale, t]
  );

  const columnTitle = useCallback(
    (key: string) => {
      const column = data?.columns.find((c) => c.key === key);
      return column ? t('viewer.period', { from: column.from, to: column.to }) : key;
    },
    [data, t]
  );

  const columns: GridColDef<RatioResult>[] = useMemo(
    () => [
      { field: 'group', headerName: t('ratios.group'), width: 150, valueGetter: (v: string) => t(`ratios.groups.${v}`) },
      {
        field: 'name',
        headerName: t('ratios.ratio'),
        flex: 1,
        minWidth: 220,
        renderCell: (cell) => (
          <Tooltip title={cell.row.description}>
            <Link component="button" variant="body2" onClick={() => setSelected(cell.row)}>
              {cell.row.name}
            </Link>
          </Tooltip>
        ),
      },
      ...(data?.columns ?? []).map(
        (column): GridColDef<RatioResult> => ({
          field: `value_${column.key}`,
          headerName: columnTitle(column.key),
          width: 190,
          align: 'right',
          headerAlign: 'right',
          sortable: false,
          renderCell: (cell) =>
            cell.row.reasons[column.key] ? (
              <Tooltip title={t(`ratios.reasons.${cell.row.reasons[column.key]}`)}>
                <Chip size="small" variant="outlined" label={t('ratios.na')} />
              </Tooltip>
            ) : (
              format(cell.row, cell.row.values[column.key])
            ),
        })
      ),
    ],
    [data, t, columnTitle, format]
  );

  const openLine = (reportId: number | null) => {
    if (!reportId) return;
    const source = Object.values(data?.sources ?? {}).find((s) => s?.id === reportId);
    openPage('report-viewer', source?.name ?? t('ratios.statement'), `reporting/reports/${reportId}`);
  };

  return (
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
      <Paper sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', flexShrink: 0 }}>
        <ReportPeriodFields from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <FormControlLabel control={<Switch checked={comparison} onChange={(e) => setComparison(e.target.checked)} />} label={t('viewer.comparison')} />
        {data &&
          Object.entries(data.sources).map(([prefix, source]) =>
            source ? (
              <Chip
                key={prefix}
                size="small"
                variant="outlined"
                color={source.accessible ? 'default' : 'warning'}
                label={source.accessible ? t('ratios.source', { name: source.name }) : t('ratios.sourceNoAccess')}
                onClick={source.accessible ? () => openLine(source.id) : undefined}
              />
            ) : null
          )}
        <Box sx={{ ml: 'auto' }}>
          <ReportExportBar
            report={report}
            params={params}
            sheet={() =>
              data
                ? {
                    title: report.name,
                    columns: [
                      { header: t('ratios.group'), width: 18 },
                      { header: t('ratios.ratio'), width: 36 },
                      { header: t('ratios.unit'), width: 18 },
                      ...data.columns.map((column) => ({ header: columnTitle(column.key), width: 22 })),
                    ],
                    rows: data.ratios.map((ratio) => [
                      t(`ratios.groups.${ratio.group}`),
                      ratio.name,
                      t(`ratios.units.${ratio.format}`),
                      ...data.columns.map((column) => (ratio.reasons[column.key] ? t('ratios.na') : toNumber(ratio.values[column.key]))),
                    ]),
                  }
                : null
            }
          />
        </Box>
      </Paper>
      {isError && <Alert severity="error">{apiErrorMessage(error) || t('viewer.loadFailed')}</Alert>}
      <Paper sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ExtendedDataGrid
          rows={data?.ratios ?? []}
          getRowId={(row) => row.key}
          columns={columns}
          loading={isFetching}
          hideFooter
          hideFooterPagination
          disableColumnMenu
          disableRowSelectionOnClick
          density="compact"
        />
      </Paper>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        {selected && data && (
          <>
            <DialogTitle>{selected.name}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {selected.description}
              </Typography>
              <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace', mb: 1 }}>
                {selected.formula}
              </Typography>
              {data.columns.map((column) => (
                <Box key={column.key} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">
                    {columnTitle(column.key)}: {selected.reasons[column.key] ? t(`ratios.reasons.${selected.reasons[column.key]}`) : format(selected, selected.values[column.key])}
                  </Typography>
                  <List dense>
                    {Object.entries(selected.component_lines).map(([variable, line]) => (
                      <ListItem
                        key={variable}
                        secondaryAction={formatAmount(toNumber(selected.components[column.key]?.[variable]), digits, locale)}
                      >
                        <ListItemText
                          primary={
                            line.report_id ? (
                              <Link component="button" variant="body2" onClick={() => openLine(line.report_id)}>
                                {line.label ?? line.line_key}
                              </Link>
                            ) : (
                              t('ratios.daysVariable')
                            )
                          }
                          secondary={line.opening ? t('ratios.opening') : undefined}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              ))}
            </DialogContent>
          </>
        )}
      </Dialog>
    </Stack>
  );
};
