import { Box, Chip } from '@mui/material';
import DateRangeRoundedIcon from '@mui/icons-material/DateRangeRounded';
import { useTranslation } from 'react-i18next';
import { type CalendarType, formatForDisplay } from '../../../../components/shared/calendarUtils';
import type { FiscalYear } from '../../../fiscalYears/fiscalYearsApi';
import {
  type ExplorerScopeState,
  type ScopeChange,
  effectiveEntryTypes,
  isMultiYear,
  scopeChanges,
} from '../explorerScope';

interface ExplorerScopeChipsProps {
  scope: ExplorerScopeState;
  fiscalYears: FiscalYear[];
  calendar: CalendarType;
  /** Show only what differs from these; without them every option is shown. */
  defaults?: ExplorerScopeState | null;
  /** Clicking a chip (e.g. opens the filter panel). */
  onClick?: () => void;
  /** Deleting a chip resets that option. */
  onDelete?: (change: ScopeChange) => void;
}

/** The period, entry types and other options of an explorer scope, as chips. */
export const ExplorerScopeChips = ({
  scope,
  fiscalYears,
  calendar,
  defaults,
  onClick,
  onDelete,
}: ExplorerScopeChipsProps) => {
  const { t: tAccounting } = useTranslation('accounting');
  const tf = (key: string, options?: Record<string, unknown>) => tAccounting(`explorer.filters.${key}`, options);

  const multiYear = isMultiYear(scope, fiscalYears);
  const changes: ScopeChange[] = defaults
    ? scopeChanges(scope, defaults, fiscalYears)
    : (['period', 'entryTypes', 'includeYearEnd', 'approvedOnly', 'hideZeroBalance'] as ScopeChange[]).filter(
        (change) =>
          (change !== 'includeYearEnd' || (multiYear && scope.includeYearEnd)) &&
          (change !== 'approvedOnly' || scope.approvedOnly) &&
          (change !== 'hideZeroBalance' || scope.hideZeroBalance)
      );

  if (changes.length === 0) return null;

  const types = effectiveEntryTypes(scope, multiYear);
  const labels: Record<ScopeChange, string> = {
    period: tf('periodChip', { from: formatForDisplay(scope.from, calendar), to: formatForDisplay(scope.to, calendar) }),
    entryTypes: tf('typesChip', {
      types: types.length ? types.map((type) => tAccounting(type)).join(', ') : tf('noTypes'),
    }),
    includeYearEnd: tf('yearEndChip'),
    approvedOnly: tf('approvedOnly'),
    hideZeroBalance: tf('zeroHiddenChip'),
  };

  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mb: 1 }}
      aria-label={tf('activeFilters')}
      role="list"
    >
      {changes.map((change) => (
        <Chip
          key={change}
          role="listitem"
          size="small"
          color="primary"
          variant="outlined"
          icon={change === 'period' ? <DateRangeRoundedIcon /> : undefined}
          label={labels[change]}
          onClick={onClick}
          onDelete={onDelete ? () => onDelete(change) : undefined}
        />
      ))}
    </Box>
  );
};
