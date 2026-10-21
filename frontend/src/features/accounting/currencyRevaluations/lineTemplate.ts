import {
  LINE_TEMPLATE_MAX_LENGTH,
  LINE_TEMPLATE_VARIABLES,
  type LineTemplate,
  type LineTemplateKind,
  type RevaluationLineTemplateKind,
} from './currencyRevaluationsApi';

const TOKEN = /\{([^{}]*)\}/g;

export type LineTemplateProblem =
  | { key: 'tooLong'; count: number }
  | { key: 'unbalancedBraces' }
  | { key: 'unknownVariables'; variables: string };

/**
 * Same rules as Accounting::Revaluation::LineDescriptions.problems: known
 * variables only, every { closed, at most LINE_TEMPLATE_MAX_LENGTH characters.
 * Blank templates are fine (the default is used).
 */
export const lineTemplateProblems = (template: string | undefined, kind: LineTemplateKind): LineTemplateProblem[] => {
  const text = template ?? '';
  if (!text.trim()) return [];
  const problems: LineTemplateProblem[] = [];
  if (text.length > LINE_TEMPLATE_MAX_LENGTH) problems.push({ key: 'tooLong', count: LINE_TEMPLATE_MAX_LENGTH });
  if (/[{}]/.test(text.replace(TOKEN, ''))) problems.push({ key: 'unbalancedBraces' });
  const used = [...text.matchAll(TOKEN)].map((m) => m[1].trim());
  const unknown = [...new Set(used)].filter((v) => !LINE_TEMPLATE_VARIABLES[kind].includes(v));
  if (unknown.length) problems.push({ key: 'unknownVariables', variables: unknown.map((v) => `{${v}}`).join(', ') });
  return problems;
};

/**
 * What to store for a revaluation: locales equal to the default (or blank)
 * are left empty so they keep following the organization default.
 */
export const ownTemplates = (edited: LineTemplate, defaults: LineTemplate): LineTemplate =>
  Object.fromEntries(
    Object.entries(edited).map(([locale, text]) => [locale, text.trim() === (defaults[locale] ?? '').trim() ? '' : text])
  );

/** The template shown for editing: the revaluation's own, else the default. */
export const effectiveTemplates = (own: LineTemplate | undefined, defaults: LineTemplate | undefined): LineTemplate => {
  const locales = new Set([...Object.keys(defaults ?? {}), ...Object.keys(own ?? {})]);
  return Object.fromEntries([...locales].map((locale) => [locale, own?.[locale]?.trim() ? own[locale] : (defaults?.[locale] ?? '')]));
};

/** Values of one line, by variable name (missing variables render empty). */
export type LineTemplateValues = Record<string, string>;

/** Client-side example of a template; the server renders the real descriptions. */
export const renderLineTemplate = (template: string, values: LineTemplateValues): string =>
  template.replace(TOKEN, (_match, name: string) => values[name.trim()] ?? '').replace(/\s+/g, ' ').trim();

/** Variables offered for insertion: centers only for the levels in use. */
export const insertableVariables = (kind: LineTemplateKind, centerLevels: number): string[] =>
  LINE_TEMPLATE_VARIABLES[kind].filter((variable) => {
    const level = variable.match(/^center(\d)_/)?.[1];
    return !level || Number(level) <= centerLevels;
  });

/** A line to show the examples with. */
interface SampleLine {
  as_of_date: string;
  account_code: string;
  account_name: string;
  currency: string;
  currency_balance: string;
  book_balance: string;
  rate: string;
  rate_date: string;
  revalued_balance: string;
  difference: string;
  centers: Array<{ code: string; name: string } | null>;
  gain_loss_account_code: string;
  gain_loss_account_name: string;
}

/** Template values of a sample revalued balance line and its gain/loss line. */
export const lineSamples = (line: SampleLine): Record<RevaluationLineTemplateKind, LineTemplateValues> => {
  const centers = Object.fromEntries(
    line.centers.flatMap((center, index) => [
      [`center${index + 1}_code`, center?.code ?? ''],
      [`center${index + 1}_name`, center?.name ?? ''],
    ])
  );
  const { gain_loss_account_code, gain_loss_account_name, centers: _centers, ...item } = line;
  void _centers;
  return {
    item: { ...item, ...centers },
    counter: {
      as_of_date: line.as_of_date,
      account_code: gain_loss_account_code,
      account_name: gain_loss_account_name,
      difference: line.difference,
      ...centers,
    },
  };
};
