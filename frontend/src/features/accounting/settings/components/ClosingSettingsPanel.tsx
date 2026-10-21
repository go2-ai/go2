import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, MenuItem, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../contexts/ToastContext';
import { apiErrorMessage } from '../../../../utils/apiErrorMessage';
import { AccountPicker } from '../../accounts/components/AccountPicker';
import { useUpdateAccountingSettingsMutation, type AccountingSetting, type ClosingMethod } from '../settingsApi';
import { LineDescriptionsSection } from '../../currencyRevaluations/components/LineDescriptionsSection';
import { effectiveTemplates, lineSamples, ownTemplates } from '../../currencyRevaluations/lineTemplate';
import type { ClosingLineTemplateKind, LineTemplate, LineTemplateKind } from '../../currencyRevaluations/currencyRevaluationsApi';

const CLOSING_KINDS: ClosingLineTemplateKind[] = ['closing', 'closing_offset', 'ending', 'beginning'];

const CLOSING_METHODS: ClosingMethod[] = ['direct', 'income_summary', 'current_year_profit'];
const EQUITY = { identifiers: ['OE'] };
const INCOME_STATEMENT = { types: ['income_statement'] };
// Income summary: outside the income statement and not monetary.
const INCOME_SUMMARY = { types: ['balance_sheet', 'other'], monetary: false };

type FormState = Pick<
  AccountingSetting,
  | 'closing_method'
  | 'retained_earnings_account_id'
  | 'income_summary_account_id'
  | 'current_year_profit_account_id'
  | 'default_fx_gain_account_id'
  | 'default_fx_loss_account_id'
>;

const pick = (s: AccountingSetting): FormState => ({
  closing_method: s.closing_method,
  retained_earnings_account_id: s.retained_earnings_account_id,
  income_summary_account_id: s.income_summary_account_id,
  current_year_profit_account_id: s.current_year_profit_account_id,
  default_fx_gain_account_id: s.default_fx_gain_account_id,
  default_fx_loss_account_id: s.default_fx_loss_account_id,
});

interface Props {
  organizationId: number;
  settings: AccountingSetting;
}

/** Fiscal year closing method, closing accounts and default FX gain/loss accounts. */
export const ClosingSettingsPanel = ({ organizationId, settings }: Props) => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { showSuccess, showError } = useToast();
  const [updateSettings, { isLoading: isSaving }] = useUpdateAccountingSettingsMutation();
  const [form, setForm] = useState<FormState>(() => pick(settings));

  useEffect(() => setForm(pick(settings)), [settings]);

  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const hasChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(pick(settings)),
    [form, settings]
  );

  const needs = {
    retained: form.closing_method !== 'current_year_profit',
    incomeSummary: form.closing_method === 'income_summary',
    currentYearProfit: form.closing_method === 'current_year_profit',
  };

  const builtIn = settings.built_in_revaluation_line_templates ?? { item: {}, counter: {} };
  const lineTemplates = {
    item: effectiveTemplates(settings.revaluation_line_description_template, builtIn.item),
    counter: effectiveTemplates(settings.revaluation_counter_line_description_template, builtIn.counter),
  };
  const samples = lineSamples({
    as_of_date: tAccounting('closingSettings.sample.date'),
    account_code: tAccounting('closingSettings.sample.accountCode'),
    account_name: tAccounting('closingSettings.sample.accountName'),
    currency: tAccounting('closingSettings.sample.currency'),
    currency_balance: '1,000.00',
    book_balance: '1,100.00',
    rate: '1.25',
    rate_date: tAccounting('closingSettings.sample.date'),
    revalued_balance: '1,250.00',
    difference: '150.00',
    centers: [{ code: '001', name: tAccounting('closingSettings.sample.centerName') }, null, null, null, null, null],
    gain_loss_account_code: tAccounting('closingSettings.sample.gainAccountCode'),
    gain_loss_account_name: tAccounting('closingSettings.sample.gainAccountName'),
  });

  // Saved on its own (the dialog has its own Save). Text equal to the
  // built-in template is stored blank, so it keeps following it.
  const saveLineTemplate = async (kind: LineTemplateKind, value: LineTemplate) => {
    const field = kind === 'item' ? 'revaluation_line_description_template' : 'revaluation_counter_line_description_template';
    try {
      await updateSettings({ organizationId, data: { [field]: ownTemplates(value, builtIn[kind as 'item' | 'counter']) } }).unwrap();
      showSuccess(tAccounting('settingsSaved'));
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('saveFailed'));
      throw err;
    }
  };

  const builtInClosing = settings.built_in_closing_line_templates ?? { closing: {}, closing_offset: {}, ending: {}, beginning: {} };
  const closingTemplates = Object.fromEntries(CLOSING_KINDS.map((kind) => [
    kind, effectiveTemplates(settings.closing_line_description_templates?.[kind], builtInClosing[kind]),
  ]));
  const closingSampleValues = {
    fiscal_year: tAccounting('closingSettings.sample.fiscalYear'),
    next_fiscal_year: tAccounting('closingSettings.sample.nextFiscalYear'),
    date: tAccounting('closingSettings.sample.date'),
    account_code: tAccounting('closingSettings.sample.accountCode'),
    account_name: tAccounting('closingSettings.sample.accountName'),
    currency: tAccounting('closingSettings.sample.currency'),
    currency_amount: '1,000.00',
    center1_code: '001',
    center1_name: tAccounting('closingSettings.sample.centerName'),
  };
  const closingSamples = {
    ...Object.fromEntries(CLOSING_KINDS.map((kind) => [kind, closingSampleValues])),
    closing_offset: { ...closingSampleValues, account_code: '30101', account_name: tAccounting('closingSettings.sample.retainedEarnings'), currency_amount: '' },
  };
  const saveClosingTemplate = async (kind: LineTemplateKind, value: LineTemplate) => {
    const closingKind = kind as ClosingLineTemplateKind;
    const next = { ...(settings.closing_line_description_templates ?? {}), [closingKind]: ownTemplates(value, builtInClosing[closingKind]) };
    try {
      await updateSettings({ organizationId, data: { closing_line_description_templates: next } }).unwrap();
      showSuccess(tAccounting('settingsSaved'));
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('saveFailed'));
      throw err;
    }
  };

  const handleSave = async () => {
    try {
      await updateSettings({ organizationId, data: form }).unwrap();
      showSuccess(tAccounting('settingsSaved'));
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('saveFailed'));
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 520 }}>
      <Typography variant="subtitle2" color="text.secondary">
        {tAccounting('closingSettings.closingSection')}
      </Typography>

      <TextField
        select
        label={tAccounting('closingSettings.closingMethod')}
        value={form.closing_method}
        onChange={(e) => set('closing_method')(e.target.value as ClosingMethod)}
        helperText={tAccounting(`closingSettings.methodHints.${form.closing_method}`)}
        size="small"
        fullWidth
      >
        {CLOSING_METHODS.map((method) => (
          <MenuItem key={method} value={method}>{tAccounting(`closingSettings.methods.${method}`)}</MenuItem>
        ))}
      </TextField>

      {needs.incomeSummary && (
        <AccountPicker
          organizationId={organizationId}
          label={tAccounting('closingSettings.incomeSummaryAccount')}
          helperText={tAccounting('closingSettings.incomeSummaryHint')}
          value={form.income_summary_account_id}
          onChange={set('income_summary_account_id')}
          filter={INCOME_SUMMARY}
          required
        />
      )}
      {needs.retained && (
        <AccountPicker
          organizationId={organizationId}
          label={tAccounting('closingSettings.retainedEarningsAccount')}
          value={form.retained_earnings_account_id}
          onChange={set('retained_earnings_account_id')}
          filter={EQUITY}
          required
        />
      )}
      {needs.currentYearProfit && (
        <AccountPicker
          organizationId={organizationId}
          label={tAccounting('closingSettings.currentYearProfitAccount')}
          helperText={tAccounting('closingSettings.currentYearProfitHint')}
          value={form.current_year_profit_account_id}
          onChange={set('current_year_profit_account_id')}
          filter={EQUITY}
          required
        />
      )}

      {!hasChanges && settings.closing_configuration_errors.length > 0 && (
        <Alert severity="warning">
          {settings.closing_configuration_errors.map((message) => <div key={message}>{message}</div>)}
        </Alert>
      )}

      <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
        {tAccounting('closingSettings.fxSection')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {tAccounting('closingSettings.fxHint')}
      </Typography>
      <AccountPicker
        organizationId={organizationId}
        label={tAccounting('closingSettings.defaultFxGainAccount')}
        value={form.default_fx_gain_account_id}
        onChange={set('default_fx_gain_account_id')}
        filter={INCOME_STATEMENT}
      />
      <AccountPicker
        organizationId={organizationId}
        label={tAccounting('closingSettings.defaultFxLossAccount')}
        value={form.default_fx_loss_account_id}
        onChange={set('default_fx_loss_account_id')}
        filter={INCOME_STATEMENT}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          startIcon={isSaving ? <CircularProgress size={20} /> : null}
        >
          {t('commonActions.save')}
        </Button>
      </Box>

      <LineDescriptionsSection
        organizationId={organizationId}
        title={tAccounting('closingSettings.lineTemplatesSection')}
        hint={tAccounting('closingSettings.lineTemplatesHint')}
        templates={lineTemplates}
        defaults={builtIn}
        samples={samples}
        centerLevels={settings.center_levels}
        editable
        onSave={saveLineTemplate}
      />

      <LineDescriptionsSection
        organizationId={organizationId}
        kinds={CLOSING_KINDS}
        title={tAccounting('closingSettings.closingLineTemplatesSection')}
        hint={tAccounting('closingSettings.closingLineTemplatesHint')}
        templates={closingTemplates}
        defaults={builtInClosing}
        samples={closingSamples}
        centerLevels={settings.center_levels}
        editable
        onSave={saveClosingTemplate}
      />
    </Box>
  );
};
