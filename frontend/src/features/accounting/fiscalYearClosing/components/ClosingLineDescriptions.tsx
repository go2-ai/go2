import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../contexts/ToastContext';
import { apiErrorMessage } from '../../../../utils/apiErrorMessage';
import { LineDescriptionsSection } from '../../currencyRevaluations/components/LineDescriptionsSection';
import { effectiveTemplates, ownTemplates, type LineTemplateValues } from '../../currencyRevaluations/lineTemplate';
import type { ClosingLineTemplateKind, LineTemplate } from '../../currencyRevaluations/currencyRevaluationsApi';
import { useUpdateClosingLineTemplateMutation, type ClosingLine, type ClosingState } from '../fiscalYearClosingApi';
import { formatAmount, useClosingLabels } from '../useClosingLabels';

interface Props {
  state: ClosingState;
  /** Kinds of line of this step, each with a line to show the example with. */
  kinds: Array<{ kind: ClosingLineTemplateKind; sample?: ClosingLine }>;
  /** Date of the entry (the year's last day, or the next year's first day). */
  date: string;
  nextFiscalYearName?: string;
}

/**
 * Line descriptions of a closing entry: an example per kind of line and an
 * editor for this closing's templates (blank languages use the defaults
 * from the accounting settings).
 */
export const ClosingLineDescriptions = ({ state, kinds, date, nextFiscalYearName }: Props) => {
  const { t: tAccounting } = useTranslation('accounting');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const { showSuccess, showError } = useToast();
  const { accountLabel, centerLabel, centerLevels, currencyAbr, currencyDigits, mainCurrencyId } = useClosingLabels(orgId);
  const [updateTemplate] = useUpdateClosingLineTemplateMutation();
  const { own, defaults } = state.line_templates;

  const templates = useMemo(
    () => Object.fromEntries(kinds.map(({ kind }) => [kind, effectiveTemplates(own[kind], defaults[kind])])),
    [kinds, own, defaults]
  );

  const samples = useMemo(() => Object.fromEntries(kinds.map(({ kind, sample }) => {
    const values: LineTemplateValues = {
      fiscal_year: state.fiscal_year.name,
      next_fiscal_year: nextFiscalYearName ?? '',
      date,
    };
    if (sample) {
      const [code, ...name] = accountLabel(sample.account_id).split(' - ');
      values.account_code = code;
      values.account_name = name.join(' - ');
      values.currency = currencyAbr(sample.currency_id);
      values.currency_amount = sample.currency_id !== mainCurrencyId && Number(sample.currency_amount)
        ? formatAmount(sample.currency_amount, currencyDigits(sample.currency_id))
        : '';
      sample.center_ids.forEach((centerId, index) => {
        const [centerCode, ...centerName] = centerLabel(centerId).split(' - ');
        values[`center${index + 1}_code`] = centerCode;
        values[`center${index + 1}_name`] = centerName.join(' - ');
      });
    }
    return [kind, values];
  })), [kinds, state.fiscal_year.name, nextFiscalYearName, date, accountLabel, centerLabel, currencyAbr, currencyDigits, mainCurrencyId]);

  // Text equal to the default is stored blank, so it keeps following it.
  const save = async (kind: string, value: LineTemplate) => {
    const closingKind = kind as ClosingLineTemplateKind;
    try {
      await updateTemplate({
        organizationId: orgId,
        fiscalYearId: state.fiscal_year.id,
        kind: closingKind,
        template: ownTemplates(value, defaults[closingKind] ?? {}),
      }).unwrap();
      showSuccess(tAccounting('revaluations.lineTemplates.saved'));
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('closing.actionFailed'));
      throw err;
    }
  };

  return (
    <LineDescriptionsSection
      organizationId={orgId}
      kinds={kinds.map(({ kind }) => kind)}
      templates={templates}
      defaults={defaults}
      samples={samples}
      centerLevels={centerLevels}
      editable
      onSave={save}
      hint={tAccounting('closing.lineTemplatesHint')}
    />
  );
};
