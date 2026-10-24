import type { TFunction } from 'i18next';
import type { LayoutChart, LayoutLine, LayoutRule } from './types';

const names = <T extends { id: number; code: string; name: string }>(list: T[], ids: number[] = []) =>
  ids
    .map((id) => list.find((item) => item.id === id))
    .filter(Boolean)
    .map((item) => `${item!.code} ${item!.name}`)
    .join(', ');

/** "Ledger: 111 Receivables · center level 1 ∈ ... · USD" */
export const describeRule = (rule: LayoutRule, chart: LayoutChart, t: TFunction): string => {
  const s = rule.selector;
  let what: string;
  switch (rule.selector_type) {
    case 'category': {
      const byIdentifier = (s.identifiers ?? [])
        .map((identifier) => chart.categories.find((c) => c.identifier === identifier))
        .filter(Boolean)
        .map((c) => `${c!.code} ${c!.name}`);
      what = [...byIdentifier, names(chart.categories, s.ids)].filter(Boolean).join(', ');
      break;
    }
    case 'ledger':
      what = names(chart.ledgers, s.ids);
      break;
    case 'account':
      what = [names(chart.accounts, s.ids), ...(s.settings ?? []).map((name) => t(`editor.settingAccounts.${name}`))]
        .filter(Boolean)
        .join(', ');
      break;
    case 'account_range':
      what = `${s.from} – ${s.to}`;
      break;
    case 'profit_or_loss':
      what = t(`editor.periods.${s.period ?? 'current'}`);
      break;
    default:
      what = '';
  }
  const parts = [`${t(`editor.selectorTypes.${rule.selector_type}`)}: ${what}`];
  if (rule.center_level && (rule.center_ids.length || rule.center_type_ids.length)) {
    const filter = [
      names(chart.centers, rule.center_ids),
      rule.center_type_ids.map((id) => chart.center_types.find((c) => c.id === id)?.name).filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .join(', ');
    parts.push(t('editor.centerFilter', { level: rule.center_level, centers: filter }));
  }
  if (rule.currency_ids.length) {
    parts.push(rule.currency_ids.map((id) => chart.currencies.find((c) => c.id === id)?.abr).join(', '));
  }
  return parts.join(' · ');
};

export const lineName = (lines: LayoutLine[], id: number | null) => {
  const line = lines.find((l) => l.id === id);
  return line ? line.label || line.key : '';
};

/** "Account and center level 2" for the grain "account_center2". */
export const grainLabel = (grain: string, t: TFunction) =>
  t(`editor.grains.${grain.replace(/\d$/, 'N')}`, { level: grain.slice(-1) });

/** "Debit movement" for the measure "debit_movement". */
export const measureLabel = (measure: string, t: TFunction) => t(`editor.measures.${measure}`, { defaultValue: measure });
