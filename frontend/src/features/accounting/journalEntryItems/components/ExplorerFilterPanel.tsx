import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import { useTranslation } from 'react-i18next';
import { BaseDatePicker } from '../../../../components/shared/BaseDatePicker';
import { BaseMonthPicker } from '../../../../components/shared/BaseMonthPicker';
import { type CalendarType, formatForDisplay } from '../../../../components/shared/calendarUtils';
import type { FiscalYear } from '../../../fiscalYears/fiscalYearsApi';
import type { ExplorerEntryType } from '../journalEntryItemsApi';
import {
  type ExplorerScopeState,
  type PeriodMode,
  type PeriodPreset,
  type ScopeError,
  ALL_ENTRY_TYPES,
  PERIOD_PRESETS,
  YEAR_END_TYPES,
  convertPeriod,
  fiscalYearBounds,
  fiscalYearContaining,
  fiscalYearsInRange,
  presetPeriod,
  startsMidYear,
} from '../explorerScope';

export const PERIOD_CALENDAR_ID = 'explorer-period';

interface ExplorerFilterPanelProps {
  draft: ExplorerScopeState;
  onChange: (patch: Partial<ExplorerScopeState>) => void;
  fiscalYears: FiscalYear[];
  activeFiscalYear: FiscalYear;
  calendar: CalendarType;
  onCalendarChange: (calendar: CalendarType) => void;
  error: ScopeError | null;
  /** The filters are already the defaults. */
  isDefault: boolean;
  onReset: () => void;
  onClose: () => void;
  /** The Rows section (hide zero-balance rows); grouped views only. Default true. */
  showRowOptions?: boolean;
  /** Id of the form, for the toggle button's aria-controls. */
  formId?: string;
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
    <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.5, fontWeight: 600 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

export const ExplorerFilterPanel = ({
  draft,
  onChange,
  fiscalYears,
  activeFiscalYear,
  calendar,
  onCalendarChange,
  error,
  isDefault,
  onReset,
  onClose,
  showRowOptions = true,
  formId = 'explorer-filters-form',
}: ExplorerFilterPanelProps) => {
  const { t: tAccounting } = useTranslation('accounting');
  const tf = (key: string, options?: Record<string, unknown>) => tAccounting(`explorer.filters.${key}`, options);

  const yearsInRange = draft.from && draft.to ? fiscalYearsInRange(draft.from, draft.to, fiscalYears) : [];
  const multiYear = yearsInRange.length > 1;
  const midYear = !!draft.from && !!draft.to && !error && startsMidYear(draft, fiscalYears);
  const sortedYears = [...fiscalYears].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const bounds = fiscalYearBounds(fiscalYears);

  const errorText = error
    ? tf(`errors.${error}`, {
        start: bounds ? formatForDisplay(bounds.start, calendar) : '',
        finish: bounds ? formatForDisplay(bounds.finish, calendar) : '',
      })
    : undefined;
  const periodError = error && error !== 'noEntryTypes' ? errorText : undefined;

  const handleModeChange = (mode: PeriodMode | null) => {
    if (mode) onChange(convertPeriod(draft, mode, calendar, fiscalYears));
  };

  const toggleType = (type: ExplorerEntryType, checked: boolean) => {
    onChange({
      entryTypes: checked ? [...draft.entryTypes, type] : draft.entryTypes.filter((t) => t !== type),
    });
  };

  const fromYearId = draft.from ? fiscalYearContaining(draft.from, fiscalYears)?.id ?? '' : '';
  const toYearId = draft.to ? fiscalYearContaining(draft.to, fiscalYears)?.id ?? '' : '';

  const handleFromYear = (id: number) => {
    const fy = fiscalYears.find((f) => f.id === id);
    if (!fy) return;
    onChange({ from: fy.start_date, ...(draft.to && draft.to < fy.start_date ? { to: fy.finish_date } : {}) });
  };

  const handleToYear = (id: number) => {
    const fy = fiscalYears.find((f) => f.id === id);
    if (!fy) return;
    onChange({ to: fy.finish_date, ...(draft.from && draft.from > fy.finish_date ? { from: fy.start_date } : {}) });
  };

  // The preset the current range matches, if any.
  const presetPeriods = PERIOD_PRESETS.map((preset) => ({
    preset,
    period: presetPeriod(preset, calendar, activeFiscalYear),
  }));
  const currentPreset =
    presetPeriods.find(({ period }) => period.from === draft.from && period.to === draft.to)?.preset ?? '';

  const handlePreset = (preset: PeriodPreset | '') => {
    const match = presetPeriods.find((p) => p.preset === preset);
    if (match) onChange(match.period);
  };

  const typeLabel = (type: ExplorerEntryType) =>
    multiYear && type === 'beginning' ? tf('beginningFirstYear') : tAccounting(type);
  const visibleTypes = multiYear ? ALL_ENTRY_TYPES.filter((type) => !YEAR_END_TYPES.includes(type)) : ALL_ENTRY_TYPES;

  return (
    <Paper
      component="aside"
      aria-label={tf('title')}
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TuneRoundedIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" fontWeight={600} component="h2">
            {tf('title')}
          </Typography>
        </Box>
        <Tooltip title={tf('close')}>
          <IconButton size="small" onClick={onClose} aria-label={tf('close')}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Body: every change applies right away */}
      <Box
        id={formId}
        role="group"
        aria-label={tf('title')}
        sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Section title={tf('period')}>
          <ToggleButtonGroup
            value={draft.periodMode}
            exclusive
            size="small"
            fullWidth
            onChange={(_, mode) => handleModeChange(mode)}
            aria-label={tf('period')}
          >
            {(['date', 'month', 'fiscalYear'] as PeriodMode[]).map((mode) => (
              <ToggleButton key={mode} value={mode} sx={{ textTransform: 'none', py: 0.5 }}>
                {tf(`periodModes.${mode}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {draft.periodMode === 'date' && (
            <Stack spacing={1.5} sx={{ pt: 0.5 }}>
              <BaseDatePicker
                label={tf('from')}
                value={draft.from || null}
                onChange={(value) => onChange({ from: value ?? '' })}
                identifier={PERIOD_CALENDAR_ID}
                calendar={calendar}
                onCalendarChange={onCalendarChange}
                error={!!periodError}
              />
              <BaseDatePicker
                label={tf('to')}
                value={draft.to || null}
                onChange={(value) => onChange({ to: value ?? '' })}
                identifier={PERIOD_CALENDAR_ID}
                calendar={calendar}
                onCalendarChange={onCalendarChange}
                error={!!periodError}
              />
            </Stack>
          )}

          {draft.periodMode === 'month' && (
            <Stack spacing={1.5} sx={{ pt: 0.5 }}>
              <BaseMonthPicker
                label={tf('fromMonth')}
                edge="start"
                value={draft.from || null}
                onChange={(value) => onChange({ from: value })}
                identifier={PERIOD_CALENDAR_ID}
                calendar={calendar}
                onCalendarChange={onCalendarChange}
                error={!!periodError}
              />
              <BaseMonthPicker
                label={tf('toMonth')}
                edge="end"
                value={draft.to || null}
                onChange={(value) => onChange({ to: value })}
                identifier={PERIOD_CALENDAR_ID}
                calendar={calendar}
                onCalendarChange={onCalendarChange}
                error={!!periodError}
              />
            </Stack>
          )}

          {draft.periodMode === 'fiscalYear' && (
            <Stack spacing={1.5} sx={{ pt: 0.5 }}>
              <FormControl size="small" fullWidth error={!!periodError}>
                <InputLabel id="explorer-from-year">{tf('fromYear')}</InputLabel>
                <Select
                  labelId="explorer-from-year"
                  label={tf('fromYear')}
                  value={fromYearId}
                  onChange={(e) => handleFromYear(Number(e.target.value))}
                >
                  {sortedYears.map((fy) => (
                    <MenuItem key={fy.id} value={fy.id}>
                      {fy.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth error={!!periodError}>
                <InputLabel id="explorer-to-year">{tf('toYear')}</InputLabel>
                <Select
                  labelId="explorer-to-year"
                  label={tf('toYear')}
                  value={toYearId}
                  onChange={(e) => handleToYear(Number(e.target.value))}
                >
                  {sortedYears.map((fy) => (
                    <MenuItem key={fy.id} value={fy.id}>
                      {fy.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}

          {periodError && (
            <FormHelperText error role="alert">
              {periodError}
            </FormHelperText>
          )}

          <TextField
            select
            size="small"
            fullWidth
            label={tf('presets.label')}
            value={currentPreset}
            onChange={(e) => handlePreset(e.target.value as PeriodPreset | '')}
            slotProps={{
              inputLabel: { shrink: true },
              select: {
                displayEmpty: true,
                renderValue: (value) =>
                  value ? tf(`presets.${value as PeriodPreset}`) : tf('presets.custom'),
              },
            }}
          >
            {PERIOD_PRESETS.map((preset) => (
              <MenuItem key={preset} value={preset}>
                {tf(`presets.${preset}`)}
              </MenuItem>
            ))}
          </TextField>

          {midYear && (
            <Alert severity="warning" variant="outlined" sx={{ py: 0, '& .MuiAlert-message': { fontSize: 12 } }}>
              {tf('priorEntriesExcludedHint')}
            </Alert>
          )}
        </Section>

        <Divider />

        <Section title={tf('entryTypes')}>
          <FormGroup>
            {visibleTypes.map((type) => (
              <FormControlLabel
                key={type}
                control={
                  <Checkbox
                    size="small"
                    checked={draft.entryTypes.includes(type)}
                    onChange={(e) => toggleType(type, e.target.checked)}
                  />
                }
                label={<Typography variant="body2">{typeLabel(type)}</Typography>}
              />
            ))}
          </FormGroup>

          {multiYear && (
            <>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={draft.includeYearEnd}
                    onChange={(e) => onChange({ includeYearEnd: e.target.checked })}
                  />
                }
                label={<Typography variant="body2">{tf('includeYearEnd')}</Typography>}
              />
              <Typography variant="caption" color="text.secondary">
                {tf('multiYearHint', { count: yearsInRange.length })}
              </Typography>
            </>
          )}

          {error === 'noEntryTypes' && (
            <FormHelperText error role="alert">
              {errorText}
            </FormHelperText>
          )}
        </Section>

        <Divider />

        <Section title={tf('state')}>
          <RadioGroup
            value={draft.approvedOnly ? 'approved' : 'bookedAndApproved'}
            onChange={(e) => onChange({ approvedOnly: e.target.value === 'approved' })}
            aria-label={tf('state')}
          >
            <FormControlLabel
              value="bookedAndApproved"
              control={<Radio size="small" />}
              label={<Typography variant="body2">{tf('bookedAndApproved')}</Typography>}
            />
            <FormControlLabel
              value="approved"
              control={<Radio size="small" />}
              label={<Typography variant="body2">{tf('approvedOnly')}</Typography>}
            />
          </RadioGroup>
        </Section>

        <Divider />

        {showRowOptions && (
          <Section title={tf('rows')}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={draft.hideZeroBalance}
                  onChange={(e) => onChange({ hideZeroBalance: e.target.checked })}
                />
              }
              label={<Typography variant="body2">{tf('hideZeroBalance')}</Typography>}
            />
          </Section>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Button
          size="small"
          color="inherit"
          fullWidth
          onClick={onReset}
          disabled={isDefault}
          startIcon={<RestartAltRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{ textTransform: 'none' }}
        >
          {tf('reset')}
        </Button>
      </Box>
    </Paper>
  );
};
