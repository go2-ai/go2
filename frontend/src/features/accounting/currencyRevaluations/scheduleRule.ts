/**
 * Builder state for the common recurrence rules, converted to and from
 * RRULE strings. Anything else is edited as a raw ("custom") rule; the
 * server validates rules and computes the run times.
 */
export type RuleFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';

export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface RuleState {
  frequency: RuleFrequency;
  weekdays: Weekday[];
  /** 1..28, or -1 for the last day of the month. */
  monthDay: number;
  custom: string;
}

export const DEFAULT_RULE: RuleState = { frequency: 'monthly', weekdays: ['FR'], monthDay: -1, custom: '' };

export const ruleToRRule = (rule: RuleState): string => {
  switch (rule.frequency) {
    case 'daily':
      return 'FREQ=DAILY';
    case 'weekly':
      return `FREQ=WEEKLY;BYDAY=${(rule.weekdays.length ? rule.weekdays : ['MO']).join(',')}`;
    case 'monthly':
      return `FREQ=MONTHLY;BYMONTHDAY=${rule.monthDay}`;
    default:
      return rule.custom.trim();
  }
};

/** Builder state for a stored rule; unknown shapes become "custom". */
export const rruleToRule = (rrule: string): RuleState => {
  const value = rrule.trim().toUpperCase().replace(/^RRULE:/, '');
  if (value === 'FREQ=DAILY') return { ...DEFAULT_RULE, frequency: 'daily' };

  const weekly = value.match(/^FREQ=WEEKLY;BYDAY=((?:MO|TU|WE|TH|FR|SA|SU)(?:,(?:MO|TU|WE|TH|FR|SA|SU))*)$/);
  if (weekly) return { ...DEFAULT_RULE, frequency: 'weekly', weekdays: weekly[1].split(',') as Weekday[] };

  const monthly = value.match(/^FREQ=MONTHLY;BYMONTHDAY=(-1|[1-9]|1\d|2[0-8])$/);
  if (monthly) return { ...DEFAULT_RULE, frequency: 'monthly', monthDay: Number(monthly[1]) };

  return { ...DEFAULT_RULE, frequency: 'custom', custom: value };
};

/** "2026-10-31T23:00:00+03:30" → "2026-10-31 23:00" (the organization's local time as sent). */
export const formatLocalDateTime = (iso: string | null | undefined): string =>
  iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : '';

/** "HH:MM" of an ISO date-time in the organization's time zone. */
export const timeOfDay = (iso: string | null | undefined): string => (iso ? iso.slice(11, 16) : '23:00');

/** True for rules that run at least weekly (warned about for permanent runs). */
export const isFrequent = (rrule: string): boolean => /FREQ=(DAILY|WEEKLY)/i.test(rrule);
