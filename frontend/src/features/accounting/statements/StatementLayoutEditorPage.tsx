import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  Link,
  MenuItem,
  Paper,
  TextField,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import type { Theme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { GridColDef } from '@mui/x-data-grid';
import { ExtendedDataGrid } from '../../../components/shared/ExtendedDataGrid';
import { useTreeRows, type TreeRow } from '../../../components/shared/treeRows';
import { TreeNameCell } from '../../../components/shared/TreeNameCell';
import { useTabLoading } from '../../../components/tabs/TabLoadingContext';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/confirmContext';
import { apiErrorMessage } from '../../../utils/apiErrorMessage';
import { useGetReportQuery } from '../../reporting/reportingApi';
import { useDefaultReportPeriod } from '../../reporting/useDefaultReportPeriod';
import { StatementViewer } from './StatementViewer';
import { LineDialog } from './components/LineDialog';
import { RuleDialog } from './components/RuleDialog';
import { InspectionPanel } from './components/InspectionPanel';
import { MappingAssistantPanel } from './components/MappingAssistantPanel';
import { describeRule, grainLabel, lineName } from './ruleText';
import {
  useCreateLineMutation,
  useCreateRuleMutation,
  useDeleteLineMutation,
  useDeleteRuleMutation,
  useGetStatementLayoutQuery,
  useMoveLineMutation,
  useUpdateLineMutation,
  useUpdateRuleMutation,
} from './statementLayoutApi';
import type { InspectionRow, LayoutLine, LayoutRule, LinePayload, RulePayload } from './types';

const getId = (line: LayoutLine) => String(line.id);
const getParent = (line: LayoutLine) => (line.parent_id ? String(line.parent_id) : null);
const flipInRtl = { transform: (theme: Theme) => (theme.direction === 'rtl' ? 'scaleX(-1)' : 'none') };

/** Lines, mapping rules, inspection list and preview of an organization's statement report. */
export const StatementLayoutEditorPage = () => {
  const { organizationId, reportId } = useParams<{ organizationId: string; reportId: string }>();
  const orgId = Number(organizationId);
  const id = Number(reportId);
  const { t } = useTranslation('reporting');
  const { showError } = useToast();
  const confirm = useConfirm();
  const defaultPeriod = useDefaultReportPeriod(orgId);
  const ids = { organizationId: orgId, reportId: id };

  const { data: report } = useGetReportQuery({ organizationId: orgId, id }, { skip: !orgId || !id });
  const { data: layout, isLoading, isFetching, isError, error } = useGetStatementLayoutQuery(ids, { skip: !orgId || !id });
  useTabLoading(isFetching);

  const [tab, setTab] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [lineDialog, setLineDialog] = useState<{ line?: LayoutLine | null; parentId?: number | null } | null>(null);
  const [ruleDialog, setRuleDialog] = useState<{ rule?: LayoutRule | null; initial?: Partial<RulePayload> } | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  // A new key per opening: the dialogs start their form from the props at mount.
  const [dialogKey, setDialogKey] = useState(0);

  const openLineDialog = (value: { line?: LayoutLine | null; parentId?: number | null }) => {
    setDialogError(null);
    setDialogKey((key) => key + 1);
    setLineDialog(value);
  };
  const openRuleDialog = (value: { rule?: LayoutRule | null; initial?: Partial<RulePayload> }) => {
    setDialogError(null);
    setDialogKey((key) => key + 1);
    setRuleDialog(value);
  };

  const [createLine, { isLoading: creatingLine }] = useCreateLineMutation();
  const [updateLine, { isLoading: updatingLine }] = useUpdateLineMutation();
  const [moveLine] = useMoveLineMutation();
  const [deleteLine] = useDeleteLineMutation();
  const [createRule, { isLoading: creatingRule }] = useCreateRuleMutation();
  const [updateRule, { isLoading: updatingRule }] = useUpdateRuleMutation();
  const [deleteRule] = useDeleteRuleMutation();

  const lines = useMemo(() => layout?.lines ?? [], [layout]);
  const rules = useMemo(() => layout?.rules ?? [], [layout]);
  // All lines start expanded; `collapsed` holds the closed ones.
  const expanded = useMemo(() => new Set(lines.map(getId).filter((key) => !collapsed.has(key))), [lines, collapsed]);
  const treeRows = useTreeRows(lines, getId, getParent, expanded);
  const canEdit = !!layout?.can_edit;
  // Rules and the inspection list show the whole ledger: they need more than an edit grant.
  const canEditMapping = !!layout?.can_edit_mapping;
  const canInspect = !!layout?.can_inspect;
  const isBalanceSheet = layout?.statement_type === 'balance_sheet';
  const selectedLine = lines.find((l) => l.id === selectedLineId) ?? null;
  const lineRules = selectedLine ? rules.filter((r) => r.statement_line_id === selectedLine.id || r.opposite_line_id === selectedLine.id) : rules;

  const fail = (err: unknown) => {
    const message = apiErrorMessage(err) || t('reportActions.failed');
    if (lineDialog || ruleDialog) setDialogError(message);
    else showError(message);
  };

  const saveLine = async (payload: LinePayload) => {
    try {
      if (lineDialog?.line) await updateLine({ ...ids, id: lineDialog.line.id, data: payload }).unwrap();
      else await createLine({ ...ids, data: payload }).unwrap();
      setLineDialog(null);
    } catch (err) {
      fail(err);
    }
  };

  const saveRule = async (payload: RulePayload) => {
    try {
      if (ruleDialog?.rule) await updateRule({ ...ids, id: ruleDialog.rule.id, data: payload }).unwrap();
      else await createRule({ ...ids, data: payload }).unwrap();
      setRuleDialog(null);
    } catch (err) {
      fail(err);
    }
  };

  const move = async (row: TreeRow<LayoutLine>, delta: number) => {
    const siblings = lines.filter((l) => l.parent_id === row.item.parent_id);
    const index = siblings.findIndex((l) => l.id === row.item.id) + delta;
    if (index < 0 || index >= siblings.length) return;
    try {
      await moveLine({ ...ids, id: row.item.id, parentId: row.item.parent_id, index }).unwrap();
    } catch (err) {
      fail(err);
    }
  };

  const removeLine = async (line: LayoutLine) => {
    const ok = await confirm({
      title: t('editor.deleteLineTitle'),
      message: t('editor.deleteLineMessage', { name: line.label }),
      confirmText: t('reportActions.delete'),
      confirmColor: 'error',
    });
    if (!ok) return;
    try {
      await deleteLine({ ...ids, id: line.id }).unwrap();
      if (selectedLineId === line.id) setSelectedLineId(null);
    } catch (err) {
      fail(err);
    }
  };

  const removeRule = async (rule: LayoutRule) => {
    const ok = await confirm({
      title: t('editor.deleteRuleTitle'),
      message: t('editor.deleteRuleMessage', { number: rule.number }),
      confirmText: t('reportActions.delete'),
      confirmColor: 'error',
    });
    if (!ok) return;
    try {
      await deleteRule({ ...ids, id: rule.id }).unwrap();
    } catch (err) {
      fail(err);
    }
  };

  // From the inspection list: a rule for that account (and its first center).
  const mapRow = (row: InspectionRow) => {
    openRuleDialog({
      initial: {
        statement_line_id: lines.find((l) => l.key === row.line_key)?.id ?? lines.find((l) => l.kind === 'mapped')?.id,
        selector_type: 'account',
        selector: { ids: [row.account_id] },
      },
    });
  };

  const lineColumns: GridColDef<TreeRow<LayoutLine>>[] = [
    {
      field: 'label',
      headerName: t('editor.line'),
      flex: 1,
      minWidth: 280,
      sortable: false,
      renderCell: (cell) => (
        <TreeNameCell
          level={cell.row.level}
          hasChildren={cell.row.hasChildren}
          expanded={cell.row.expanded}
          onToggle={() =>
            setCollapsed((current) => {
              const next = new Set(current);
              if (next.has(cell.row.id)) next.delete(cell.row.id);
              else next.add(cell.row.id);
              return next;
            })
          }
        >
          <Typography variant="body2" fontWeight={cell.row.item.style.bold || cell.row.item.kind === 'heading' ? 600 : 400}>
            {cell.row.item.label || cell.row.item.key}
          </Typography>
        </TreeNameCell>
      ),
    },
    { field: 'key', headerName: t('editor.key'), width: 200, sortable: false, valueGetter: (_v, row) => row.item.key },
    {
      field: 'kind',
      headerName: t('editor.kind'),
      width: 170,
      sortable: false,
      renderCell: (cell) =>
        cell.row.item.kind === 'formula' ? (
          <Tooltip title={cell.row.item.formula ?? ''}>
            <Chip size="small" label={t('editor.kinds.formula')} />
          </Tooltip>
        ) : (
          t(`editor.kinds.${cell.row.item.kind}`)
        ),
    },
    { field: 'side', headerName: t('editor.normalSide'), width: 100, sortable: false, valueGetter: (_v, row) => t(`editor.sides.${row.item.normal_side}`) },
    {
      field: 'rules',
      headerName: t('editor.rules'),
      width: 80,
      sortable: false,
      renderCell: (cell) => {
        const count = rules.filter((r) => r.statement_line_id === cell.row.item.id || r.opposite_line_id === cell.row.item.id).length;
        return count ? (
          <Link
            component="button"
            variant="body2"
            onClick={() => {
              setSelectedLineId(cell.row.item.id);
              setTab(1);
            }}
          >
            {count}
          </Link>
        ) : (
          ''
        );
      },
    },
    ...(canEdit
      ? [
          {
            field: 'actions',
            headerName: '',
            width: 190,
            sortable: false,
            renderCell: (cell: { row: TreeRow<LayoutLine> }) => (
              <Box onClick={(e) => e.stopPropagation()}>
                <Tooltip title={t('editor.moveUp')}>
                  <IconButton size="small" onClick={() => move(cell.row, -1)}>
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('editor.moveDown')}>
                  <IconButton size="small" onClick={() => move(cell.row, 1)}>
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('editor.addChild')}>
                  <IconButton size="small" onClick={() => openLineDialog({ parentId: cell.row.item.id })}>
                    <SubdirectoryArrowRightIcon fontSize="small" sx={flipInRtl} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('editor.editLineShort')}>
                  <IconButton size="small" onClick={() => openLineDialog({ line: cell.row.item })}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('reportActions.delete')}>
                  <IconButton size="small" color="error" onClick={() => removeLine(cell.row.item)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ),
          } as GridColDef<TreeRow<LayoutLine>>,
        ]
      : []),
  ];

  const ruleColumns: GridColDef<LayoutRule>[] = [
    { field: 'number', headerName: '#', width: 60 },
    { field: 'line', headerName: t('editor.targetLine'), width: 200, valueGetter: (_v, row) => lineName(lines, row.statement_line_id) },
    { field: 'selector', headerName: t('editor.selects'), flex: 1, minWidth: 260, valueGetter: (_v, row) => (layout ? describeRule(row, layout.chart, t) : '') },
    {
      field: 'opposite',
      headerName: t('editor.oppositeLine'),
      width: 200,
      valueGetter: (_v, row) => (row.opposite_line_id ? `${lineName(lines, row.opposite_line_id)} · ${grainLabel(row.grain, t)}` : ''),
    },
    { field: 'priority', headerName: t('editor.priority'), width: 90, valueGetter: (value: number | null) => value ?? '' },
    ...(canEditMapping
      ? [
          {
            field: 'actions',
            headerName: '',
            width: 90,
            sortable: false,
            renderCell: (cell: { row: LayoutRule }) => (
              <Box>
                <IconButton size="small" onClick={() => openRuleDialog({ rule: cell.row })}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => removeRule(cell.row)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            ),
          } as GridColDef<LayoutRule>,
        ]
      : []),
  ];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !layout) {
    return (
      <Container sx={{ py: 2 }}>
        <Alert severity="error">{apiErrorMessage(error) || t('viewer.loadFailed')}</Alert>
      </Container>
    );
  }

  const defaultDate = defaultPeriod?.end ?? null;
  const defaultFrom = defaultPeriod?.start ?? null;

  return (
    <Container maxWidth={false} sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 2, gap: 2 }}>
      <Box sx={{ flexShrink: 0 }}>
        <Typography variant="h4">{t('editor.title', { name: report?.name ?? '' })}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('editor.subtitle')}
        </Typography>
      </Box>
      {!canEdit && <Alert severity="info">{t('editor.readOnly')}</Alert>}
      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ flexShrink: 0 }}>
        <Tab label={t('editor.tabs.lines')} />
        <Tab label={t('editor.tabs.rules')} />
        <Tab label={t('editor.tabs.inspection')} disabled={!canInspect} />
        <Tab label={t('editor.tabs.preview')} />
        {canEditMapping && <Tab label={t('editor.tabs.assistant')} />}
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', p: 1 }}>
          <Stack direction="row" justifyContent="flex-end" alignItems="center" sx={{ mb: 1 }}>
            {canEdit && (
              <Button size="small" startIcon={<AddIcon />} onClick={() => openLineDialog({ parentId: null })}>
                {t('editor.addLine')}
              </Button>
            )}
          </Stack>
          <ExtendedDataGrid
            rows={treeRows}
            getRowId={(row) => row.id}
            columns={lineColumns}
            hideFooter
            hideFooterPagination
            disableColumnMenu
            disableRowSelectionOnClick
            rowHeight={40}
          />
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', p: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
            <TextField
              select
              size="small"
              label={t('editor.ruleLineFilter')}
              value={selectedLineId ?? ''}
              onChange={(e) => setSelectedLineId(e.target.value === '' ? null : Number(e.target.value))}
              sx={{ width: 320 }}
            >
              <MenuItem value="">{t('editor.allRules')}</MenuItem>
              {lines
                .filter((line) => line.kind !== 'heading')
                .map((line) => (
                  <MenuItem key={line.id} value={line.id}>
                    {line.label || line.key}
                  </MenuItem>
                ))}
            </TextField>
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              {t('editor.precedenceHint')}
            </Typography>
            {canEditMapping && (
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() =>
                  openRuleDialog({ initial: selectedLine && selectedLine.kind !== 'heading' ? { statement_line_id: selectedLine.id } : {} })
                }
              >
                {t('editor.addRule')}
              </Button>
            )}
          </Stack>
          <ExtendedDataGrid
            rows={lineRules}
            columns={ruleColumns}
            showHeaderSearchRow
            excludeSearchFields={['actions']}
            hideFooter
            hideFooterPagination
            disableColumnMenu
            disableRowSelectionOnClick
            localeText={{ noRowsLabel: t('editor.noRules') }}
          />
        </Paper>
      )}

      {tab === 2 && canInspect && (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <InspectionPanel
            organizationId={orgId}
            reportId={id}
            isBalanceSheet={isBalanceSheet}
            lines={lines}
            rules={rules}
            defaultDate={defaultDate}
            defaultFrom={defaultFrom}
            canDrillToEntries={!!report?.permissions.can_drill_to_entries}
            onMapRow={canEditMapping ? mapRow : undefined}
          />
        </Box>
      )}

      {tab === 3 && report && (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <StatementViewer organizationId={orgId} report={report} />
        </Box>
      )}

      {tab === 4 && canEditMapping && (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <MappingAssistantPanel
            organizationId={orgId}
            reportId={id}
            lines={lines}
            isBalanceSheet={isBalanceSheet}
            defaultDate={defaultDate}
            defaultFrom={defaultFrom}
          />
        </Box>
      )}

      <LineDialog
        key={`line-${dialogKey}`}
        open={!!lineDialog}
        lines={lines}
        line={lineDialog?.line}
        parentId={lineDialog?.parentId}
        saving={creatingLine || updatingLine}
        error={dialogError}
        onClose={() => setLineDialog(null)}
        onSave={saveLine}
      />
      <RuleDialog
        key={`rule-${dialogKey}`}
        open={!!ruleDialog}
        lines={lines}
        chart={layout.chart}
        centerLevels={layout.center_levels}
        rule={ruleDialog?.rule}
        initial={ruleDialog?.initial}
        saving={creatingRule || updatingRule}
        error={dialogError}
        onClose={() => setRuleDialog(null)}
        onSave={saveRule}
      />
    </Container>
  );
};
