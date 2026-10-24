import { useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { grainLabel } from '../ruleText';
import type { LayoutChart, LayoutLine, LayoutRule, RulePayload, SelectorType } from '../types';

const SELECTOR_TYPES: SelectorType[] = ['category', 'ledger', 'account', 'account_range', 'profit_or_loss'];

interface Props {
  open: boolean;
  lines: LayoutLine[];
  chart: LayoutChart;
  centerLevels: number;
  /** Editing an existing rule, or defaults for a new one. */
  rule?: LayoutRule | null;
  initial?: Partial<RulePayload>;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (payload: RulePayload) => void;
}

type Option = { id: number; label: string };

const MultiSelect = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: number[];
  onChange: (ids: number[]) => void;
}) => (
  <Autocomplete
    multiple
    size="small"
    options={options}
    value={options.filter((o) => value.includes(o.id))}
    onChange={(_, selected) => onChange(selected.map((o) => o.id))}
    getOptionLabel={(o) => o.label}
    isOptionEqualToValue={(a, b) => a.id === b.id}
    renderInput={(params) => <TextField {...params} label={label} />}
  />
);

const initialForm = (lines: LayoutLine[], rule?: LayoutRule | null, initial?: Partial<RulePayload>): RulePayload =>
  rule
    ? {
        statement_line_id: rule.statement_line_id,
        opposite_line_id: rule.opposite_line_id,
        selector_type: rule.selector_type,
        selector: rule.selector,
        center_level: rule.center_level,
        center_ids: rule.center_ids,
        center_type_ids: rule.center_type_ids,
        currency_ids: rule.currency_ids,
        grain: rule.grain,
        measure: rule.measure,
        priority: rule.priority,
        note: rule.note,
      }
    : { ...blank(lines), ...initial };

/**
 * Create or change a mapping rule: what it selects, filters, sign split and
 * priority. The form starts from the props at mount: the parent remounts
 * the dialog (with a new `key`) each time it opens it.
 */
export const RuleDialog = ({ open, lines, chart, centerLevels, rule, initial, saving, error, onClose, onSave }: Props) => {
  const { t } = useTranslation('reporting');
  const [form, setForm] = useState<RulePayload>(() => initialForm(lines, rule, initial));

  const set = (patch: Partial<RulePayload>) => setForm((current) => ({ ...current, ...patch }));
  const setSelector = (patch: RulePayload['selector']) => set({ selector: { ...form.selector, ...patch } });

  const lineOptions = lines.filter((l) => l.kind !== 'heading');
  const categoryOptions = useMemo(() => chart.categories.map((c) => ({ id: c.id, label: `${c.code} ${c.name}` })), [chart]);
  const ledgerOptions = useMemo(() => chart.ledgers.map((l) => ({ id: l.id, label: `${l.code} ${l.name}` })), [chart]);
  const accountOptions = useMemo(() => chart.accounts.map((a) => ({ id: a.id, label: `${a.code} ${a.name}` })), [chart]);
  const centerOptions = useMemo(() => chart.centers.map((c) => ({ id: c.id, label: `${c.code} ${c.name}` })), [chart]);
  const centerTypeOptions = useMemo(() => chart.center_types.map((c) => ({ id: c.id, label: c.name })), [chart]);
  const currencyOptions = useMemo(() => chart.currencies.map((c) => ({ id: c.id, label: c.abr })), [chart]);
  const grains = ['account', 'row', 'account_currency', ...Array.from({ length: centerLevels }, (_, i) => `account_center${i + 1}`)];

  const changeType = (selector_type: SelectorType) =>
    set({ selector_type, selector: selector_type === 'profit_or_loss' ? { period: 'current' } : {} });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{rule ? t('editor.editRule', { number: rule.number }) : t('editor.addRule')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            select
            size="small"
            label={t('editor.targetLine')}
            value={form.statement_line_id || ''}
            onChange={(e) => set({ statement_line_id: Number(e.target.value) })}
          >
            {lineOptions.map((line) => (
              <MenuItem key={line.id} value={line.id}>
                {line.label} ({line.key})
              </MenuItem>
            ))}
          </TextField>

          <Stack direction="row" spacing={2}>
            <TextField
              select
              size="small"
              sx={{ width: 220 }}
              label={t('editor.selectorType')}
              value={form.selector_type}
              onChange={(e) => changeType(e.target.value as SelectorType)}
            >
              {SELECTOR_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {t(`editor.selectorTypes.${type}`)}
                </MenuItem>
              ))}
            </TextField>
            <Stack sx={{ flex: 1 }} spacing={1}>
              {form.selector_type === 'category' && (
                <MultiSelect
                  label={t('editor.categories')}
                  options={categoryOptions}
                  value={form.selector.ids ?? []}
                  onChange={(ids) => setSelector({ ids, identifiers: [] })}
                />
              )}
              {form.selector_type === 'category' && (form.selector.identifiers?.length ?? 0) > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {t('editor.systemCategories', { identifiers: form.selector.identifiers!.join(', ') })}
                </Typography>
              )}
              {form.selector_type === 'ledger' && (
                <MultiSelect label={t('editor.ledgers')} options={ledgerOptions} value={form.selector.ids ?? []} onChange={(ids) => setSelector({ ids })} />
              )}
              {form.selector_type === 'account' && (
                <>
                  <MultiSelect label={t('editor.accounts')} options={accountOptions} value={form.selector.ids ?? []} onChange={(ids) => setSelector({ ids })} />
                  <Autocomplete
                    multiple
                    size="small"
                    options={chart.setting_accounts}
                    value={form.selector.settings ?? []}
                    onChange={(_, settings) => setSelector({ settings })}
                    getOptionLabel={(name) => t(`editor.settingAccounts.${name}`)}
                    renderInput={(params) => <TextField {...params} label={t('editor.settingAccountsLabel')} />}
                  />
                </>
              )}
              {form.selector_type === 'account_range' && (
                <Stack direction="row" spacing={1}>
                  <TextField size="small" label={t('editor.rangeFrom')} value={form.selector.from ?? ''} onChange={(e) => setSelector({ from: e.target.value.trim() })} />
                  <TextField size="small" label={t('editor.rangeTo')} value={form.selector.to ?? ''} onChange={(e) => setSelector({ to: e.target.value.trim() })} />
                  <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                    {t('editor.rangeHint')}
                  </Typography>
                </Stack>
              )}
              {form.selector_type === 'profit_or_loss' && (
                <TextField
                  select
                  size="small"
                  label={t('editor.period')}
                  value={form.selector.period ?? 'current'}
                  onChange={(e) => setSelector({ period: e.target.value as 'prior' | 'current' })}
                >
                  <MenuItem value="current">{t('editor.periods.current')}</MenuItem>
                  <MenuItem value="prior">{t('editor.periods.prior')}</MenuItem>
                </TextField>
              )}
            </Stack>
          </Stack>

          <Typography variant="subtitle2">{t('editor.filters')}</Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              select
              size="small"
              sx={{ width: 160 }}
              label={t('editor.centerLevel')}
              value={form.center_level ?? ''}
              onChange={(e) => set({ center_level: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <MenuItem value="">{t('editor.none')}</MenuItem>
              {Array.from({ length: centerLevels }, (_, i) => (
                <MenuItem key={i + 1} value={i + 1}>
                  {t('viewer.centerLevelOption', { level: i + 1 })}
                </MenuItem>
              ))}
            </TextField>
            <Stack sx={{ flex: 1 }} spacing={1}>
              <MultiSelect label={t('editor.centerTypes')} options={centerTypeOptions} value={form.center_type_ids ?? []} onChange={(ids) => set({ center_type_ids: ids })} />
              <MultiSelect label={t('editor.centers')} options={centerOptions} value={form.center_ids ?? []} onChange={(ids) => set({ center_ids: ids })} />
            </Stack>
          </Stack>
          <MultiSelect label={t('editor.currencies')} options={currencyOptions} value={form.currency_ids ?? []} onChange={(ids) => set({ currency_ids: ids })} />

          <Typography variant="subtitle2">{t('editor.signSplit')}</Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              select
              size="small"
              sx={{ flex: 1 }}
              label={t('editor.oppositeLine')}
              helperText={t('editor.oppositeLineHint')}
              value={form.opposite_line_id ?? ''}
              onChange={(e) => set({ opposite_line_id: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <MenuItem value="">{t('editor.none')}</MenuItem>
              {lineOptions
                .filter((line) => line.id !== form.statement_line_id)
                .map((line) => (
                  <MenuItem key={line.id} value={line.id}>
                    {line.label} ({line.key})
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              select
              size="small"
              sx={{ width: 240 }}
              label={t('editor.grain')}
              helperText={t('editor.grainHint')}
              value={form.grain ?? 'account'}
              onChange={(e) => set({ grain: e.target.value })}
            >
              {grains.map((grain) => (
                <MenuItem key={grain} value={grain}>
                  {grainLabel(grain, t)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField
              size="small"
              type="number"
              sx={{ width: 160 }}
              label={t('editor.priority')}
              helperText={t('editor.priorityHint')}
              value={form.priority ?? ''}
              onChange={(e) => set({ priority: e.target.value === '' ? null : Number(e.target.value) })}
            />
            <TextField size="small" sx={{ flex: 1 }} label={t('editor.note')} value={form.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('reportActions.cancel')}</Button>
        <Button variant="contained" disabled={saving || !form.statement_line_id} onClick={() => onSave(form)}>
          {t('reportActions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const blank = (lines: LayoutLine[]): RulePayload => ({
  statement_line_id: lines.find((l) => l.kind !== 'heading')?.id ?? 0,
  opposite_line_id: null,
  selector_type: 'ledger',
  selector: {},
  center_level: null,
  center_ids: [],
  center_type_ids: [],
  currency_ids: [],
  grain: 'account',
  measure: 'balance',
  priority: null,
  note: null,
});
