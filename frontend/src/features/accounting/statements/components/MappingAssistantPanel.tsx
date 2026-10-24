import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useTranslation } from 'react-i18next';
import type { GridColDef } from '@mui/x-data-grid';
import { AiChatPanel, useAiChatSession } from '../../../ai';
import { ExtendedDataGrid } from '../../../../components/shared/ExtendedDataGrid';
import { useToast } from '../../../../contexts/ToastContext';
import { apiErrorMessage } from '../../../../utils/apiErrorMessage';
import { formatAmount, toNumber } from '../../../reporting/amounts';
import { grainLabel, measureLabel } from '../ruleText';
import {
  mappingAiApi,
  useAcceptMappingMutation,
  useGetOrCreateMappingChatMutation,
  useLazyGetMappingPreviewQuery,
  usePostMappingMessageMutation,
  type MappingChange,
  type MappingPreview,
  type MappingProposal,
} from '../mappingAiApi';
import type { InspectionRow, LayoutLine } from '../types';

interface Props {
  organizationId: number;
  reportId: number;
  lines: LayoutLine[];
  isBalanceSheet: boolean;
  defaultDate: string | null;
  defaultFrom: string | null;
}

interface ProposalError {
  path: string;
  message: string;
}

const isProposalError = (value: unknown): value is ProposalError =>
  typeof value === 'object' &&
  value !== null &&
  'path' in value &&
  typeof value.path === 'string' &&
  'message' in value &&
  typeof value.message === 'string';

const proposalErrors = (raw: unknown): ProposalError[] => (Array.isArray(raw) ? raw.filter(isProposalError) : []);

const safeProposal = (raw: unknown): MappingProposal | null => {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<MappingProposal>;
  return Array.isArray(candidate.changes) ? { summary: String(candidate.summary ?? ''), changes: candidate.changes } : null;
};

/**
 * The AI mapping assistant: a chat on the left, its proposed rule changes
 * on the right. The user picks changes, previews where every balance
 * would land, and applies the picked ones.
 */
export const MappingAssistantPanel = ({ organizationId, reportId, lines, isBalanceSheet, defaultDate, defaultFrom }: Props) => {
  const { t, i18n } = useTranslation('reporting');
  const { showError, showSuccess } = useToast();
  const ids = { organizationId, reportId };
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [preview, setPreview] = useState<MappingPreview | null>(null);
  const [onlyChanged, setOnlyChanged] = useState(true);

  const [getOrCreate, { error: createError }] = useGetOrCreateMappingChatMutation();
  const [postMessage] = usePostMappingMessageMutation();
  const [loadPreview, { isFetching: previewing }] = useLazyGetMappingPreviewQuery();
  const [accept, { isLoading: accepting }] = useAcceptMappingMutation();

  const { chatId, chat, processing } = useAiChatSession({
    args: ids,
    getOrCreate,
    chatEndpoint: mappingAiApi.endpoints.getMappingChat,
    invalidateChat: (id) => mappingAiApi.util.invalidateTags([{ type: 'MappingChat', id }]),
  });

  const proposal = useMemo(() => safeProposal(chat?.state?.latest_proposal), [chat?.state?.latest_proposal]);
  const valid = chat?.state?.valid === true;
  // A new proposal: everything picked, nothing previewed.
  useEffect(() => {
    setSelected(new Set(proposal ? proposal.changes.map((_, index) => index) : []));
    setPreview(null);
  }, [proposal]);

  const lineLabel = (key?: string) => lines.find((l) => l.key === key)?.label ?? key ?? '';

  const describe = (change: MappingChange) => {
    const selector = change.selector ?? {};
    const parts = Object.entries(selector)
      .filter(([, value]) => value !== undefined && value !== null && (!Array.isArray(value) || value.length))
      .map(([key, value]) => `${t(`assistant.selectorKeys.${key}`, { defaultValue: key })}: ${Array.isArray(value) ? value.join(', ') : value}`);
    if (change.center_codes?.length) parts.push(t('assistant.centers', { codes: change.center_codes.join(', ') }));
    if (change.opposite_line_key) {
      parts.push(t('assistant.opposite', { line: lineLabel(change.opposite_line_key), grain: grainLabel(change.grain ?? 'account', t) }));
    }
    if (change.measure && change.measure !== 'balance') parts.push(measureLabel(change.measure, t));
    if (change.priority !== undefined && change.priority !== null) parts.push(t('assistant.priority', { priority: change.priority }));
    return parts.join(' · ');
  };

  const indexes = [...selected].sort((a, b) => a - b);
  const runParams = isBalanceSheet ? { date: defaultDate ?? undefined } : { from: defaultFrom ?? undefined, to: defaultDate ?? undefined };

  const openPreview = async () => {
    if (!chatId) return;
    try {
      setPreview(await loadPreview({ ...ids, chatId, indexes, ...runParams }).unwrap());
    } catch (err) {
      showError(apiErrorMessage(err) || t('assistant.previewFailed'));
    }
  };

  const apply = async () => {
    if (!chatId) return;
    try {
      await accept({ ...ids, chatId, indexes }).unwrap();
      setPreview(null);
      showSuccess(t('assistant.applied', { count: indexes.length }));
    } catch (err) {
      showError(apiErrorMessage(err) || t('assistant.applyFailed'));
    }
  };

  if (chatId === null) {
    return createError ? (
      <Alert severity="info">{apiErrorMessage(createError) || t('assistant.notAvailable')}</Alert>
    ) : (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const previewRows = (preview?.rows ?? []).filter((row) => !onlyChanged || row.changed);
  const digits = preview?.currency.decimal_digits ?? 2;
  const previewColumns: GridColDef<InspectionRow>[] = [
    { field: 'account', headerName: t('inspection.account'), flex: 1, minWidth: 200, valueGetter: (_v, r) => `${r.account_code ?? ''} ${r.account_name ?? ''}` },
    { field: 'center', headerName: t('inspection.center', { level: 1 }), width: 150, valueGetter: (_v, r) => (r.centers[0] ? `${r.centers[0].code} ${r.centers[0].name}` : '') },
    { field: 'balance', headerName: t('inspection.balance'), width: 130, valueGetter: (v: string) => toNumber(v), renderCell: (c) => formatAmount(c.value as number, digits, i18n.language) },
    { field: 'line_label', headerName: t('inspection.reflectedIn'), width: 200, valueGetter: (v: string | null, r) => (r.unmapped ? t('inspection.unmapped') : v ?? '') },
    {
      field: 'proposed_line_label',
      headerName: t('inspection.reflectedInProposed'),
      width: 220,
      renderCell: (c) => (
        <Typography variant="body2" fontWeight={c.row.changed ? 600 : 400} color={c.row.changed ? 'primary' : 'text.primary'}>
          {c.row.proposed_line_label ?? (c.row.out_of_scope ? '' : t('inspection.unmapped'))}
        </Typography>
      ),
    },
  ];
  const previewErrors = (preview?.proposed_checks ?? []).filter((check) => check.severity === 'error');

  return (
    <Box sx={{ display: 'flex', gap: 2, height: '100%', minHeight: 0 }}>
      <Paper sx={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <AiChatPanel
          messages={chat?.messages ?? []}
          processing={processing}
          emptyStateLabel={t('assistant.emptyState')}
          thinkingLabel={t('assistant.thinking')}
          inputDisabled={processing}
          inputPlaceholder={t('assistant.placeholder')}
          sendTooltip={t('assistant.send')}
          onSend={async (content) => {
            try {
              await postMessage({ ...ids, chatId, content }).unwrap();
            } catch (err) {
              showError(apiErrorMessage(err) || t('assistant.sendFailed'));
            }
          }}
          attachments={[]}
          onRemoveAttachment={() => undefined}
        />
      </Paper>
      <Paper sx={{ flex: 1.4, p: 2, display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0, overflow: 'auto' }}>
        <Typography variant="subtitle1">{t('assistant.proposal')}</Typography>
        {!proposal && <Typography color="text.secondary">{t('assistant.noProposal')}</Typography>}
        {proposal && !valid && !processing && (
          <Alert severity="warning">
            {t('assistant.invalidProposal')}
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {proposalErrors(chat?.state?.errors).map((error, index) => (
                <li key={index}>
                  {error.path}: {error.message}
                </li>
              ))}
            </Box>
          </Alert>
        )}
        {proposal && (
          <>
            {proposal.summary && <Typography variant="body2">{proposal.summary}</Typography>}
            <Stack spacing={1}>
              {proposal.changes.map((change, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Checkbox
                      size="small"
                      checked={selected.has(index)}
                      disabled={!valid}
                      onChange={(e) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (e.target.checked) next.add(index);
                          else next.delete(index);
                          return next;
                        })
                      }
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip size="small" color={change.action === 'remove' ? 'error' : change.action === 'add' ? 'success' : 'info'} label={t(`assistant.actions.${change.action}`)} />
                        {change.rule_number && <Typography variant="body2">{t('inspection.ruleNumber', { number: change.rule_number })}</Typography>}
                        {change.line_key && (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <ArrowForwardIcon
                              fontSize="small"
                              color="action"
                              sx={{ transform: (theme) => (theme.direction === 'rtl' ? 'scaleX(-1)' : 'none') }}
                            />
                            <Typography variant="body2" fontWeight={600}>
                              {lineLabel(change.line_key)}
                            </Typography>
                          </Stack>
                        )}
                        {typeof change.confidence === 'number' && (
                          <Chip size="small" variant="outlined" label={t('assistant.confidence', { value: Math.round(change.confidence * 100) })} />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" component="div">
                        {describe(change)}
                      </Typography>
                      {change.reason && <Typography variant="body2">{change.reason}</Typography>}
                    </Box>
                  </Stack>
                </Paper>
              ))}
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button variant="outlined" disabled={!valid || indexes.length === 0 || previewing} onClick={openPreview}>
                {t('assistant.preview')}
              </Button>
              <Button variant="contained" disabled={!valid || indexes.length === 0 || accepting} onClick={apply}>
                {t('assistant.apply', { count: indexes.length })}
              </Button>
            </Stack>
          </>
        )}
      </Paper>

      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="lg" fullWidth>
        <DialogTitle>{t('assistant.previewTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mb: 1 }}>
            {previewErrors.length === 0 ? (
              <Alert severity="success">{t('assistant.previewOk')}</Alert>
            ) : (
              previewErrors.map((check, i) => (
                <Alert key={i} severity="error">
                  {t(`checks.${check.code}`, { ...check.details, column: '', defaultValue: check.code })}
                </Alert>
              ))
            )}
            <FormControlLabel control={<Switch checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />} label={t('assistant.onlyChanged')} />
          </Stack>
          <Box sx={{ height: 420 }}>
            <ExtendedDataGrid rows={previewRows} columns={previewColumns} hideFooter hideFooterPagination disableColumnMenu density="compact" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview(null)}>{t('access.close')}</Button>
          <Button variant="contained" onClick={apply} disabled={accepting}>
            {t('assistant.apply', { count: indexes.length })}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
