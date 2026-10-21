import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import type { GridColDef, GridRenderCellParams, GridRowSelectionModel } from '@mui/x-data-grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import HistoryIcon from '@mui/icons-material/History';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import RestoreIcon from '@mui/icons-material/Restore';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { BaseDatePicker } from '../../../components/shared/BaseDatePicker';
import { ExtendedDataGrid } from '../../../components/shared/ExtendedDataGrid';
import { useTabManager } from '../../../components/tabs/useTabManager';
import { useOpenPage } from '../../../components/tabs/useOpenPage';
import { useTabLoading } from '../../../components/tabs/TabLoadingContext';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/confirmContext';
import { usePermissionCodes } from '../../../hooks/usePermissionCodes';
import { apiErrorMessage } from '../../../utils/apiErrorMessage';
import { PERMISSION_CODES } from '../../app/sidebarConfig';
import { ReportSplitButton } from '../../reports/components/ReportSplitButton';
import { useGetAccountsQuery } from '../accounts/accountsApi';
import { useGetLedgersQuery } from '../ledgers/ledgersApi';
import { useGetAccountCategoriesQuery } from '../accountCategories/accountCategoriesApi';
import { useGetCurrenciesQuery } from '../currencies/currenciesApi';
import { useGetCentersQuery } from '../centers/centersApi';
import { useGetAccountingSettingsQuery } from '../settings/settingsApi';
import { journalEntriesApi } from '../journalEntries/journalEntriesApi';
import { useResolveExchangeRatesQuery } from '../exchangeRates/exchangeRatesApi';
import { ExchangeRateModal } from '../exchangeRates/components/ExchangeRateModal';
import { RateWithInverse } from '../exchangeRates/components/RateWithInverse';
import {
  useDeleteCurrencyRevaluationMutation,
  useGetCurrencyRevaluationQuery,
  usePostCurrencyRevaluationMutation,
  useRebuildCurrencyRevaluationMutation,
  useUpdateCurrencyRevaluationMutation,
  useChangeRevaluationKindMutation,
  type LineTemplate,
  type LineTemplateKind,
  type RevaluationItem,
  type RevaluationKind,
} from './currencyRevaluationsApi';
import { RevaluationKindPicker } from './components/RevaluationKindPicker';
import { LineDescriptionsSection } from './components/LineDescriptionsSection';
import { BalanceAmount, DifferenceAmount, GainLossAccountCell } from './components/RevaluationAmountCells';
import { effectiveTemplates, lineSamples, ownTemplates } from './lineTemplate';
import { formatRevaluationAmount } from './revaluationFormat';
import { STATUS_COLORS } from './revaluationStatus';

const CENTER_FIELDS = ['center1_id', 'center2_id', 'center3_id', 'center4_id', 'center5_id', 'center6_id'] as const;
const EMPTY_SELECTION: GridRowSelectionModel = { type: 'include', ids: new Set() };

/**
 * One revaluation of foreign currency monetary items: every qualifying
 * account × centers × currency balance, its revalued amount and the
 * difference to post. Drafts can be adjusted (date, kind, gain/loss
 * accounts, combinations left out, line descriptions) and posted.
 */
export const CurrencyRevaluationPage = () => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { organizationId, revaluationId } = useParams<{ organizationId: string; revaluationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const id = parseInt(revaluationId || '0', 10);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { openTab } = useTabManager();
  const { openJournalEntry } = useOpenPage(orgId);
  const { showSuccess, showError, showWarning } = useToast();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const confirm = useConfirm();
  const { has } = usePermissionCodes(orgId);
  const canRevalue = has(PERMISSION_CODES.ACCOUNTING_REVALUE_CURRENCIES);
  const canManageRates = has(PERMISSION_CODES.ACCOUNTING_MANAGE_EXCHANGE_RATES);

  const { data: revaluation, isLoading, isFetching, error } = useGetCurrencyRevaluationQuery(
    { organizationId: orgId, id }, { skip: !orgId || !id }
  );
  useTabLoading(isLoading);
  const skip = { skip: !orgId };
  const { data: accounts = [] } = useGetAccountsQuery(orgId, skip);
  const { data: ledgers = [] } = useGetLedgersQuery(orgId, skip);
  const { data: categories = [] } = useGetAccountCategoriesQuery(orgId, skip);
  const { data: currencies = [] } = useGetCurrenciesQuery(orgId, skip);
  const { data: centers = [] } = useGetCentersQuery({ organizationId: orgId }, skip);
  const { data: settings } = useGetAccountingSettingsQuery(orgId, skip);
  const { data: resolved } = useResolveExchangeRatesQuery({ organizationId: orgId }, skip);
  const centerLevels = Math.min(settings?.center_levels ?? 3, CENTER_FIELDS.length);

  const [updateRevaluation, { isLoading: updating }] = useUpdateCurrencyRevaluationMutation();
  const [rebuildRevaluation, { isLoading: rebuilding }] = useRebuildCurrencyRevaluationMutation();
  const [postRevaluation, { isLoading: posting }] = usePostCurrencyRevaluationMutation();
  const [deleteRevaluation, { isLoading: deleting }] = useDeleteCurrencyRevaluationMutation();
  const [changeKind, { isLoading: changingKind }] = useChangeRevaluationKindMutation();
  const busy = updating || rebuilding || posting || deleting || changingKind;

  const [asOf, setAsOf] = useState<string | null>(null);
  const [kind, setKind] = useState<RevaluationKind>('temporary');
  const [problemItemIds, setProblemItemIds] = useState<Set<number>>(new Set());
  const [selection, setSelection] = useState<GridRowSelectionModel>(EMPTY_SELECTION);
  const [rateFor, setRateFor] = useState<RevaluationItem | null>(null);

  useEffect(() => {
    if (revaluation) {
      setAsOf(revaluation.as_of_date);
      setKind(revaluation.kind);
    }
  }, [revaluation]);

  const isDraft = revaluation?.status === 'draft';
  const editable = isDraft && canRevalue;
  const mainCurrencyId = resolved?.main_currency_id ?? null;
  const mainCurrency = currencies.find((c) => c.id === mainCurrencyId);
  const mainDigits = mainCurrency?.decimal_digits ?? 2;

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const currencyById = useMemo(() => new Map(currencies.map((c) => [c.id, c])), [currencies]);
  const centerById = useMemo(() => new Map(centers.map((c) => [c.id, c])), [centers]);
  const accountLabel = (accountId: number) => {
    const account = accountById.get(accountId);
    return account ? `${account.full_code} - ${account.name}` : `#${accountId}`;
  };
  const centerLabel = (centerId: number | null) => {
    if (centerId === null) return '';
    const center = centerById.get(centerId);
    return center ? `${center.code} - ${center.name}` : `#${centerId}`;
  };
  const fxAccountOptions = useMemo(() => {
    const ledgerById = new Map(ledgers.map((l) => [l.id, l]));
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    return accounts
      .filter((a) => {
        const ledger = ledgerById.get(a.ledger_id);
        return ledger && categoryById.get(ledger.account_category_id)?.type === 'income_statement';
      })
      .sort((a, b) => a.full_code.localeCompare(b.full_code))
      .map((a) => ({ id: a.id, label: `${a.full_code} - ${a.name}` }));
  }, [accounts, ledgers, categories]);

  const changed = !!revaluation && (asOf !== revaluation.as_of_date || kind !== revaluation.kind);


  const items = useMemo(() => revaluation?.items ?? [], [revaluation]);
  const selectedIds = [...selection.ids].map(Number);
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const totals = useMemo(() => {
    const posted = items.filter((i) => !i.excluded && !i.removed && Number(i.difference) !== 0);
    const sum = (list: RevaluationItem[]) => list.reduce((acc, i) => acc + Number(i.difference), 0);
    return {
      gain: sum(posted.filter((i) => Number(i.difference) > 0)),
      loss: -sum(posted.filter((i) => Number(i.difference) < 0)),
      net: sum(posted),
    };
  }, [items]);

  const handleError = (err: unknown, fallback: string) => {
    const data = (err as { data?: { details?: { items?: Array<{ item_id: number }> } } })?.data;
    setProblemItemIds(new Set((data?.details?.items ?? []).map((i) => i.item_id)));
    showError(apiErrorMessage(err) || fallback);
  };

  // A changed date or kind is saved right away; the server rebuilds the
  // items from the balances and exchange rates of that date. Debounced so
  // typing a date doesn't save every keystroke.
  const saveSettings = async (date: string, newKind: RevaluationKind) => {
    try {
      await updateRevaluation({ organizationId: orgId, id, asOfDate: date, kind: newKind }).unwrap();
      setProblemItemIds(new Set());
    } catch (err) {
      handleError(err, tAccounting('revaluations.saveFailed'));
      // Back to the saved values (e.g. no fiscal year contains the date).
      if (revaluation) {
        setAsOf(revaluation.as_of_date);
        setKind(revaluation.kind);
      }
    }
  };
  const saveSettingsRef = useRef(saveSettings);
  saveSettingsRef.current = saveSettings;
  const savedDate = revaluation?.as_of_date;
  const savedKind = revaluation?.kind;
  useEffect(() => {
    if (!editable || !asOf || !savedDate || (asOf === savedDate && kind === savedKind)) return undefined;
    const timer = setTimeout(() => saveSettingsRef.current(asOf, kind), kind !== savedKind && asOf === savedDate ? 0 : 500);
    return () => clearTimeout(timer);
  }, [asOf, kind, savedDate, savedKind, editable]);

  // Balances and rates can also change elsewhere (an approved entry, a new
  // rate); this recomputes the preview with the same date.
  const refreshPreview = async () => {
    try {
      await rebuildRevaluation({ organizationId: orgId, id }).unwrap();
      setProblemItemIds(new Set());
    } catch (err) {
      handleError(err, tAccounting('revaluations.saveFailed'));
    }
  };

  const updateItems = async (changes: Array<{ id: number; gain_loss_account_id?: number | null; removed?: boolean }>) => {
    try {
      await updateRevaluation({ organizationId: orgId, id, items: changes }).unwrap();
      setSelection(EMPTY_SELECTION);
    } catch (err) {
      handleError(err, tAccounting('revaluations.saveFailed'));
    }
  };

  const setRemoved = (targets: RevaluationItem[], removed: boolean) =>
    updateItems(targets.filter((item) => item.removed !== removed).map((item) => ({ id: item.id, removed })));

  // Templates are stored per language; text equal to the default is kept
  // blank so it follows the organization default.
  const lineTemplates = revaluation && revaluation.default_line_templates ? {
    item: effectiveTemplates(revaluation.line_description_template, revaluation.default_line_templates.item),
    counter: effectiveTemplates(revaluation.counter_line_description_template, revaluation.default_line_templates.counter),
  } : null;
  const saveLineTemplate = async (templateKind: LineTemplateKind, value: LineTemplate) => {
    const own = ownTemplates(value, revaluation?.default_line_templates?.[templateKind] ?? {});
    try {
      await updateRevaluation({
        organizationId: orgId,
        id,
        ...(templateKind === 'item' ? { lineDescriptionTemplate: own } : { counterLineDescriptionTemplate: own }),
      }).unwrap();
      showSuccess(tAccounting('revaluations.lineTemplates.saved'));
    } catch (err) {
      handleError(err, tAccounting('revaluations.saveFailed'));
      throw err;
    }
  };

  // Example values: the first balance that will be posted (or any).
  const sampleItem = items.find((i) => !i.excluded && !i.removed && Number(i.difference) !== 0) ?? items[0];
  const samples = useMemo(() => {
    const amount = (value: string | null, digits: number) => (value === null ? '' : formatRevaluationAmount(Number(value), digits));
    const gainLoss = sampleItem?.gain_loss_account_id ? accountById.get(sampleItem.gain_loss_account_id) : undefined;
    const account = sampleItem ? accountById.get(sampleItem.account_id) : undefined;
    const currency = sampleItem ? currencyById.get(sampleItem.currency_id) : undefined;
    return lineSamples({
      as_of_date: revaluation?.as_of_date ?? '',
      account_code: account?.full_code ?? '',
      account_name: account?.name ?? '',
      currency: currency?.abr ?? '',
      currency_balance: sampleItem ? amount(sampleItem.currency_balance, currency?.decimal_digits ?? 2) : '',
      book_balance: sampleItem ? amount(sampleItem.book_base_balance, mainDigits) : '',
      rate: sampleItem?.rate ? Number(sampleItem.rate).toString() : '',
      rate_date: sampleItem?.rate_date ?? '',
      revalued_balance: sampleItem ? amount(sampleItem.revalued_base_balance, mainDigits) : '',
      difference: sampleItem ? amount(sampleItem.difference, mainDigits) : '',
      centers: CENTER_FIELDS.map((field) => {
        const center = sampleItem?.[field] ? centerById.get(sampleItem[field] as number) : undefined;
        return center ? { code: center.code, name: center.name } : null;
      }),
      gain_loss_account_code: gainLoss?.full_code ?? '',
      gain_loss_account_name: gainLoss?.name ?? '',
    });
  }, [sampleItem, accountById, currencyById, centerById, revaluation?.as_of_date, mainDigits]);

  const handleRateSaved = async () => {
    try {
      await rebuildRevaluation({ organizationId: orgId, id }).unwrap();
    } catch (err) {
      handleError(err, tAccounting('revaluations.saveFailed'));
    }
  };

  const handlePost = async () => {
    const ok = await confirm({
      title: tAccounting('revaluations.postTitle'),
      message: tAccounting('revaluations.postMessage', { date: revaluation?.as_of_date }),
      confirmText: tAccounting('revaluations.post'),
      confirmColor: 'primary',
    });
    if (!ok) return;
    try {
      await postRevaluation({ organizationId: orgId, id }).unwrap();
      dispatch(journalEntriesApi.util.invalidateTags(['JournalEntry']));
      showSuccess(tAccounting('revaluations.posted'));
    } catch (err) {
      if ((err as { status?: number })?.status === 409) {
        // Balances or rates changed since the preview: show the current one.
        await refreshPreview();
        showWarning(tAccounting('revaluations.previewUpdated'));
        return;
      }
      handleError(err, tAccounting('revaluations.postFailed'));
    }
  };

  const handleToggleKind = async () => {
    if (!revaluation) return;
    const target: RevaluationKind = revaluation.kind === 'temporary' ? 'permanent' : 'temporary';
    const ok = await confirm({
      title: tAccounting(`revaluations.make.${target}`),
      message: tAccounting(`revaluations.makeMessage.${target}`),
      confirmText: tAccounting(`revaluations.make.${target}`),
      confirmColor: 'primary',
    });
    if (!ok) return;
    try {
      await changeKind({ organizationId: orgId, id, kind: target }).unwrap();
      dispatch(journalEntriesApi.util.invalidateTags(['JournalEntry']));
      showSuccess(tAccounting('revaluations.kindChanged'));
    } catch (err) {
      handleError(err, tAccounting('revaluations.saveFailed'));
    }
  };

  const handleOpenChangeLog = () => {
    setMenuAnchor(null);
    const path = `/app/organizations/${orgId}/record-history?type=Accounting::CurrencyRevaluation&id=${id}`;
    openTab('record-history', `${t('changeLog')}: ${tAccounting('revaluations.tabTitle', { date: revaluation?.as_of_date })}`, path);
    navigate(path);
  };

  const handleDelete = async () => {
    setMenuAnchor(null);
    const ok = await confirm({
      title: tAccounting('revaluations.deleteTitle'),
      message: tAccounting(isDraft ? 'revaluations.deleteDraftMessage' : 'revaluations.deletePostedMessage'),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });
    if (!ok) return;
    try {
      await deleteRevaluation({ organizationId: orgId, id }).unwrap();
      dispatch(journalEntriesApi.util.invalidateTags(['JournalEntry']));
      showSuccess(tAccounting('revaluations.deleted'));
      const path = `/app/organizations/${orgId}/accounting/currency-revaluations`;
      openTab('currency-revaluations', t('menu.currencyRevaluations'), path);
      navigate(path);
    } catch (err) {
      handleError(err, tAccounting('revaluations.deleteFailed'));
    }
  };

  const openEntry = () => {
    if (revaluation?.journal_entry_id) openJournalEntry({ id: revaluation.journal_entry_id, ref: revaluation.journal_entry_ref });
  };

  const amountColumn = (field: 'currency_balance' | 'book_base_balance' | 'revalued_base_balance', headerName: string,
    digits: (row: RevaluationItem) => number): GridColDef<RevaluationItem> => ({
    field,
    headerName,
    width: 150,
    align: 'right',
    headerAlign: 'right',
    type: 'number',
    valueGetter: (_v, row) => (row[field] === null ? null : Number(row[field])),
    renderCell: (params: GridRenderCellParams<RevaluationItem>) => (
      <BalanceAmount value={params.row[field]} digits={digits(params.row)} />
    ),
  });

  const columns: GridColDef<RevaluationItem>[] = [
    {
      field: 'account_id',
      headerName: tAccounting('revaluations.account'),
      flex: 1.4,
      minWidth: 200,
      valueGetter: (_v, row) => accountLabel(row.account_id),
    },
    ...CENTER_FIELDS.slice(0, centerLevels).map((field, index): GridColDef<RevaluationItem> => ({
      field,
      headerName: tAccounting('revaluations.centerLevel', { level: index + 1 }),
      flex: 1,
      minWidth: 140,
      valueGetter: (_v, row) => centerLabel(row[field]),
    })),
    {
      field: 'currency_id',
      headerName: tAccounting('revaluations.currency'),
      width: 90,
      valueGetter: (_v, row) => currencyById.get(row.currency_id)?.abr ?? '',
    },
    amountColumn('currency_balance', tAccounting('revaluations.foreignBalance'),
      (row) => currencyById.get(row.currency_id)?.decimal_digits ?? 2),
    amountColumn('book_base_balance', tAccounting('revaluations.balanceIn', { currency: mainCurrency?.abr ?? '' }), () => mainDigits),
    {
      field: 'rate',
      headerName: tAccounting('revaluations.rate'),
      width: 140,
      type: 'number',
      valueGetter: (_v, row) => (row.rate === null ? '' : Number(row.rate)),
      renderCell: (params: GridRenderCellParams<RevaluationItem>) => {
        const item = params.row;
        if (item.rate) {
          return (
            <RateWithInverse rate={item.rate} currency={currencyById.get(item.currency_id)?.abr ?? ''}
              quote={mainCurrency?.abr ?? ''} note={tAccounting('revaluations.rateOf', { date: item.rate_date })} />
          );
        }
        if (editable && canManageRates && !item.removed) {
          return (
            <Button size="small" startIcon={<AddIcon />} onClick={(e) => { e.stopPropagation(); setRateFor(item); }} disabled={busy}>
              {tAccounting('revaluations.addRate')}
            </Button>
          );
        }
        return <Typography variant="body2" color="warning.main">{tAccounting('revaluations.excludedReasons.missing_rate')}</Typography>;
      },
    },
    amountColumn('revalued_base_balance', tAccounting('revaluations.revaluedBalance'), () => mainDigits),
    {
      field: 'difference',
      headerName: tAccounting('revaluations.difference'),
      width: 130,
      align: 'right',
      headerAlign: 'right',
      type: 'number',
      valueGetter: (_v, row) => Number(row.difference),
      renderCell: (params: GridRenderCellParams<RevaluationItem>) => (
        <DifferenceAmount value={params.row.difference} digits={mainDigits} />
      ),
    },
    {
      field: 'gain_loss_account_id',
      headerName: tAccounting('revaluations.gainLossAccount'),
      flex: 1.4,
      minWidth: 220,
      sortable: false,
      valueGetter: (_v, row) => (row.gain_loss_account_id ? accountLabel(row.gain_loss_account_id) : ''),
      renderCell: (params: GridRenderCellParams<RevaluationItem>) => {
        const item = params.row;
        if (item.excluded_reason === 'missing_rate') return null;
        return (
          <GainLossAccountCell
            difference={item.difference}
            value={item.gain_loss_account_id}
            options={fxAccountOptions}
            label={accountLabel}
            editable={editable && !item.removed}
            disabled={busy}
            error={problemItemIds.has(item.id) || item.excluded_reason === 'missing_fx_account' || item.excluded_reason === 'center_mismatch'}
            onChange={(accountId) => updateItems([{ id: item.id, gain_loss_account_id: accountId }])}
          />
        );
      },
    },
    {
      field: 'excluded_reason',
      headerName: tAccounting('revaluations.note'),
      width: 190,
      valueGetter: (_v, row) => (row.removed
        ? tAccounting('revaluations.leftOut')
        : row.excluded_reason
          ? tAccounting(`revaluations.excludedReasons.${row.excluded_reason}`)
          : Number(row.difference) === 0 ? tAccounting('revaluations.noChange') : ''),
      renderCell: (params: GridRenderCellParams<RevaluationItem>) => {
        const item = params.row;
        if (item.removed) return <Chip size="small" variant="outlined" label={tAccounting('revaluations.leftOut')} />;
        if (item.excluded_reason) {
          return <Chip size="small" color="warning" label={tAccounting(`revaluations.excludedReasons.${item.excluded_reason}`)} />;
        }
        return Number(item.difference) === 0 ? <Chip size="small" variant="outlined" label={tAccounting('revaluations.noChange')} /> : null;
      },
    },
    ...(editable ? [{
      field: 'actions',
      headerName: '',
      width: 56,
      sortable: false,
      renderCell: (params: GridRenderCellParams<RevaluationItem>) => {
        const item = params.row;
        const label = tAccounting(item.removed ? 'revaluations.bringBack' : 'revaluations.leaveOut');
        return (
          <Tooltip title={label} disableInteractive>
            <IconButton size="small" aria-label={label} disabled={busy}
              onClick={(e) => { e.stopPropagation(); setRemoved([item], !item.removed); }}>
              {item.removed ? <RestoreIcon fontSize="small" /> : <RemoveCircleOutlineIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        );
      },
    } satisfies GridColDef<RevaluationItem>] : []),
  ];

  if (error) {
    return (
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Alert severity="error">{tAccounting('revaluations.loadFailed')}</Alert>
      </Container>
    );
  }
  if (isLoading || !revaluation) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const excluded = revaluation.excluded_count;
  const removedCount = revaluation.removed_count;
  // The date is in the form; the print and tab titles keep it.
  const reportTitle = tAccounting('revaluations.tabTitle', { date: revaluation.as_of_date });
  const canDelete = canRevalue && revaluation.status !== 'superseded';

  return (
    <Container maxWidth={false} sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 2, gap: 2, overflow: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" gutterBottom>{tAccounting('revaluations.detailTitle')}</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Posting state only; the kind is chosen in the form below. */}
            <Chip size="small" color={STATUS_COLORS[revaluation.status]}
              label={tAccounting(`revaluations.statusLabels.${revaluation.status}`)} />
            {revaluation.journal_entry_id && (
              <Chip size="small" clickable onClick={openEntry}
                label={tAccounting('revaluations.entryNo', { no: revaluation.journal_entry_no })} />
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <ReportSplitButton reportKey="currency_revaluation" recordId={revaluation.id} reportTitle={reportTitle} />
          {canRevalue && revaluation.status !== 'superseded' && (
            <>
              {isDraft && (
                <Tooltip title={tAccounting('revaluations.refreshPreviewHint')}>
                  <span>
                    <IconButton onClick={refreshPreview} disabled={busy} aria-label={tAccounting('revaluations.refreshPreview')}>
                      {rebuilding || updating ? <CircularProgress size={20} /> : <RefreshIcon />}
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              {isDraft && (
                <Tooltip title={changed ? tAccounting('revaluations.savingChanges') : ''}>
                  <span>
                    <Button variant="contained" startIcon={posting ? <CircularProgress size={16} color="inherit" /> : <DoneAllIcon />}
                      onClick={handlePost} disabled={busy || changed}>
                      {tAccounting('revaluations.post')}
                    </Button>
                  </span>
                </Tooltip>
              )}
              {revaluation.status === 'posted' && (
                <Button variant="outlined" onClick={handleToggleKind} disabled={busy}>
                  {tAccounting(`revaluations.make.${revaluation.kind === 'temporary' ? 'permanent' : 'temporary'}`)}
                </Button>
              )}
            </>
          )}
          <Tooltip title={tAccounting('moreActions')}>
            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label={tAccounting('moreActions')}
              aria-haspopup="menu" aria-expanded={!!menuAnchor}>
              <MoreVertIcon />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            <MenuItem onClick={handleOpenChangeLog}>
              <ListItemIcon><HistoryIcon fontSize="small" /></ListItemIcon>
              <ListItemText>{t('changeLog')}</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleDelete} disabled={!canDelete || busy} sx={{ color: 'error.main' }}>
              <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText>{t('commonActions.delete')}</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 2, flexShrink: 0 }}>
        <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ maxWidth: 260 }}>
            <BaseDatePicker label={tAccounting('revaluations.asOfDate')} value={asOf} onChange={setAsOf}
              disabled={!editable} size="small" fullWidth />
          </Box>
          <RevaluationKindPicker value={kind} onChange={setKind} disabled={!editable} />
          {Object.values(revaluation.scope ?? {}).some((ids) => ids?.length) && (
            <Typography variant="body2" color="text.secondary">{tAccounting('revaluations.limitedScope')}</Typography>
          )}
        </Paper>
        {lineTemplates && revaluation.default_line_templates && (
          <LineDescriptionsSection
            organizationId={orgId}
            templates={lineTemplates}
            defaults={revaluation.default_line_templates}
            samples={samples}
            centerLevels={centerLevels}
            editable={editable}
            onSave={saveLineTemplate}
          />
        )}
      </Box>

      {isDraft && excluded > 0 && (
        <Alert severity="warning" sx={{ flexShrink: 0 }}>{tAccounting('revaluations.excludedHint', { count: excluded })}</Alert>
      )}

      <Paper sx={{ flex: 1, minHeight: 420, display: 'flex', flexDirection: 'column' }}>
        {editable && (
          <Box sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {tAccounting('revaluations.leaveOutHint')}
            </Typography>
            <Button size="small" startIcon={<RemoveCircleOutlineIcon />} disabled={busy || !selectedItems.some((i) => !i.removed)}
              onClick={() => setRemoved(selectedItems, true)}>
              {tAccounting('revaluations.leaveOutSelected')}
            </Button>
            <Button size="small" startIcon={<RestoreIcon />} disabled={busy || !selectedItems.some((i) => i.removed)}
              onClick={() => setRemoved(selectedItems, false)}>
              {tAccounting('revaluations.bringBackSelected')}
            </Button>
            {removedCount > 0 && (
              <Button size="small" disabled={busy} onClick={() => setRemoved(items, false)}>
                {tAccounting('revaluations.bringBackAll', { count: removedCount })}
              </Button>
            )}
          </Box>
        )}
        <ExtendedDataGrid
          rows={items}
          columns={columns}
          loading={isFetching || rebuilding}
          showHeaderSearchRow
          excludeSearchFields={['actions']}
          checkboxSelection={editable}
          rowSelectionModel={selection}
          onRowSelectionModelChange={setSelection}
          disableRowSelectionOnClick
          disableColumnMenu
          showCellVerticalBorder
          hideFooter
          rowHeight={44}
          getRowClassName={(params) => [
            problemItemIds.has(params.row.id) ? 'row-problem' : '',
            params.row.removed ? 'row-removed' : '',
          ].join(' ')}
          localeText={{ noRowsLabel: tAccounting('revaluations.noItems') }}
          sx={(theme) => ({
            flex: 1,
            '& .MuiDataGrid-cell:focus': { outline: 'none' },
            '& .row-problem': { bgcolor: alpha(theme.palette.error.main, 0.08) },
            '& .row-removed .MuiDataGrid-cell:not([data-field="actions"]):not([data-field="__check__"])': {
              opacity: 0.5, textDecoration: 'line-through',
            },
          })}
        />
        <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'flex-end', gap: 3, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            {tAccounting('revaluations.counts', { items: revaluation.items_count, excluded, removed: removedCount })}
          </Typography>
          <Typography variant="subtitle2" color="success.main">
            {tAccounting('revaluations.totalGain')}: {formatRevaluationAmount(totals.gain, mainDigits)}
          </Typography>
          <Typography variant="subtitle2" color="error.main">
            {tAccounting('revaluations.totalLoss')}: {formatRevaluationAmount(totals.loss, mainDigits)}
          </Typography>
          {(() => {
            const net = Number(revaluation.total_difference);
            return (
              <Typography variant="subtitle2" color={net > 0 ? 'success.main' : net < 0 ? 'error.main' : 'text.primary'}>
                {tAccounting('revaluations.totalDifference')}: {formatRevaluationAmount(net, mainDigits)}
                {net !== 0 && ` (${tAccounting(net > 0 ? 'revaluations.gain' : 'revaluations.loss')})`}
              </Typography>
            );
          })()}
        </Box>
      </Paper>

      <ExchangeRateModal
        open={!!rateFor}
        onClose={() => setRateFor(null)}
        organizationId={orgId}
        currencies={currencies}
        mainCurrencyId={mainCurrencyId}
        defaultDate={revaluation.as_of_date}
        defaultCurrencyId={rateFor?.currency_id ?? null}
        onSaved={handleRateSaved}
      />
    </Container>
  );
};
