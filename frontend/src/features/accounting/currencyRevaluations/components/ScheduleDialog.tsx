import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { BaseDatePicker } from '../../../../components/shared/BaseDatePicker';
import { useToast } from '../../../../contexts/ToastContext';
import { apiErrorMessage } from '../../../../utils/apiErrorMessage';
import {
  useCreateRevaluationScheduleMutation,
  usePreviewRevaluationScheduleMutation,
  useUpdateRevaluationScheduleMutation,
  type OnUnapproved,
  type RevaluationKind,
  type RevaluationSchedule,
  type RevaluationScope,
  type SchedulePreview,
} from '../currencyRevaluationsApi';
import {
  DEFAULT_RULE,
  WEEKDAYS,
  formatLocalDateTime,
  isFrequent,
  ruleToRRule,
  rruleToRule,
  timeOfDay,
  type RuleFrequency,
  type RuleState,
  type Weekday,
} from '../scheduleRule';
import { RevaluationKindPicker } from './RevaluationKindPicker';
import { RevaluationScopeEditor } from './RevaluationScopeEditor';

const FREQUENCIES: RuleFrequency[] = ['daily', 'weekly', 'monthly', 'custom'];
const ON_UNAPPROVED: OnUnapproved[] = ['partial', 'skip', 'post_temporary'];
const MONTH_DAYS = [-1, ...Array.from({ length: 28 }, (_, i) => i + 1)];

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Props {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  mainCurrencyId: number | null;
  /** Edit this schedule; create a new one when null. */
  schedule: RevaluationSchedule | null;
}

export const ScheduleDialog = ({ open, onClose, organizationId, mainCurrencyId, schedule }: Props) => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { showSuccess, showError } = useToast();
  const [createSchedule, { isLoading: creating }] = useCreateRevaluationScheduleMutation();
  const [updateSchedule, { isLoading: updating }] = useUpdateRevaluationScheduleMutation();
  const [previewSchedule] = usePreviewRevaluationScheduleMutation();
  const saving = creating || updating;

  const [name, setName] = useState('');
  const [rule, setRule] = useState<RuleState>(DEFAULT_RULE);
  const [time, setTime] = useState('23:00');
  const [startDate, setStartDate] = useState(todayIso());
  const [kind, setKind] = useState<RevaluationKind>('temporary');
  const [onUnapproved, setOnUnapproved] = useState<OnUnapproved>('partial');
  const [active, setActive] = useState(true);
  const [scope, setScope] = useState<RevaluationScope>({});
  const [preview, setPreview] = useState<SchedulePreview | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(schedule?.name ?? '');
    setRule(schedule ? rruleToRule(schedule.rrule) : DEFAULT_RULE);
    setTime(timeOfDay(schedule?.dtstart));
    setStartDate(schedule?.dtstart?.slice(0, 10) ?? todayIso());
    setKind(schedule?.default_kind ?? 'temporary');
    setOnUnapproved(schedule?.on_unapproved ?? 'partial');
    setActive(schedule?.active ?? true);
    setScope(schedule?.scope ?? {});
    setPreview(null);
  }, [open, schedule]);

  const rrule = ruleToRRule(rule);
  const dtstart = `${startDate}T${time}`;

  // Ask the server for the next runs whenever the rule changes (debounced).
  useEffect(() => {
    if (!open || !rrule) return;
    const timer = setTimeout(() => {
      previewSchedule({ organizationId, rrule, dtstart })
        .unwrap()
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [open, organizationId, rrule, dtstart, previewSchedule]);

  const toggleWeekday = (day: Weekday) =>
    setRule((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day) ? prev.weekdays.filter((d) => d !== day) : [...prev.weekdays, day],
    }));

  const canSave = name.trim() !== '' && !!rrule && preview?.valid !== false && !saving;

  const handleSave = async () => {
    const data = { name: name.trim(), rrule, dtstart, default_kind: kind, on_unapproved: onUnapproved, active, scope };
    try {
      if (schedule) {
        await updateSchedule({ organizationId, id: schedule.id, data }).unwrap();
      } else {
        await createSchedule({ organizationId, data }).unwrap();
      }
      showSuccess(tAccounting('revaluationSchedules.saved'));
      onClose();
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('revaluationSchedules.saveFailed'));
    }
  };

  const description = useMemo(() => {
    switch (rule.frequency) {
      case 'daily':
        return tAccounting('revaluationSchedules.describe.daily', { time });
      case 'weekly':
        return tAccounting('revaluationSchedules.describe.weekly', {
          time,
          days: rule.weekdays.map((d) => tAccounting(`revaluationSchedules.weekdays.${d}`)).join(', '),
        });
      case 'monthly':
        return rule.monthDay === -1
          ? tAccounting('revaluationSchedules.describe.monthlyLast', { time })
          : tAccounting('revaluationSchedules.describe.monthly', { time, day: rule.monthDay });
      default:
        return tAccounting('revaluationSchedules.describe.custom', { rule: rrule, time });
    }
  }, [rule, time, rrule, tAccounting]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {schedule ? tAccounting('revaluationSchedules.edit') : tAccounting('revaluationSchedules.new')}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label={t('name')} value={name} onChange={(e) => setName(e.target.value)} size="small" required fullWidth />

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
            <TextField
              select
              size="small"
              label={tAccounting('revaluationSchedules.repeat')}
              value={rule.frequency}
              onChange={(e) => setRule((prev) => ({ ...prev, frequency: e.target.value as RuleFrequency, custom: prev.custom || rrule }))}
            >
              {FREQUENCIES.map((f) => (
                <MenuItem key={f} value={f}>{tAccounting(`revaluationSchedules.frequencies.${f}`)}</MenuItem>
              ))}
            </TextField>
            <TextField
              type="time"
              size="small"
              label={tAccounting('revaluationSchedules.time')}
              value={time}
              onChange={(e) => setTime(e.target.value || '23:00')}
              helperText={tAccounting('revaluationSchedules.timeHint')}
              InputLabelProps={{ shrink: true }}
            />
            <BaseDatePicker
              label={tAccounting('revaluationSchedules.startDate')}
              value={startDate}
              onChange={(value) => setStartDate(value || todayIso())}
              size="small"
              fullWidth
            />
          </Box>

          {rule.frequency === 'weekly' && (
            <FormGroup row aria-label={tAccounting('revaluationSchedules.weekdaysLabel')}>
              {WEEKDAYS.map((day) => (
                <FormControlLabel
                  key={day}
                  control={<Checkbox checked={rule.weekdays.includes(day)} onChange={() => toggleWeekday(day)} size="small" />}
                  label={tAccounting(`revaluationSchedules.weekdays.${day}`)}
                />
              ))}
            </FormGroup>
          )}
          {rule.frequency === 'monthly' && (
            <TextField
              select
              size="small"
              label={tAccounting('revaluationSchedules.monthDay')}
              value={rule.monthDay}
              onChange={(e) => setRule((prev) => ({ ...prev, monthDay: Number(e.target.value) }))}
              sx={{ maxWidth: 260 }}
            >
              {MONTH_DAYS.map((day) => (
                <MenuItem key={day} value={day}>
                  {day === -1 ? tAccounting('revaluationSchedules.lastDay') : day}
                </MenuItem>
              ))}
            </TextField>
          )}
          {rule.frequency === 'custom' && (
            <TextField
              size="small"
              label={tAccounting('revaluationSchedules.customRule')}
              value={rule.custom}
              onChange={(e) => setRule((prev) => ({ ...prev, custom: e.target.value }))}
              helperText={tAccounting('revaluationSchedules.customRuleHint')}
              fullWidth
            />
          )}

          <Box>
            <Typography variant="body2">{description}</Typography>
            {preview && !preview.valid && <Alert severity="error" sx={{ mt: 1 }}>{preview.errors.join(' ')}</Alert>}
            {preview?.valid && preview.upcoming_runs.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary">{tAccounting('revaluationSchedules.nextRuns')}</Typography>
                <List dense disablePadding>
                  {preview.upcoming_runs.map((run) => (
                    <ListItem key={run} disableGutters sx={{ py: 0 }}>
                      <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={formatLocalDateTime(run)} />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </Box>

          <RevaluationKindPicker value={kind} onChange={setKind} />
          <Box sx={{ maxWidth: 360 }}>
            {kind === 'permanent' && (
              <TextField
                select
                size="small"
                fullWidth
                label={tAccounting('revaluationSchedules.onUnapproved')}
                value={onUnapproved}
                onChange={(e) => setOnUnapproved(e.target.value as OnUnapproved)}
                helperText={tAccounting(`revaluationSchedules.onUnapprovedHints.${onUnapproved}`)}
              >
                {ON_UNAPPROVED.map((option) => (
                  <MenuItem key={option} value={option}>{tAccounting(`revaluationSchedules.onUnapprovedOptions.${option}`)}</MenuItem>
                ))}
              </TextField>
            )}
          </Box>
          {kind === 'permanent' && isFrequent(rrule) && (
            <Alert severity="warning">{tAccounting('revaluationSchedules.frequentPermanentWarning')}</Alert>
          )}

          <Typography variant="body2" color="text.secondary">{tAccounting('revaluations.scopeHint')}</Typography>
          <RevaluationScopeEditor organizationId={organizationId} value={scope} onChange={setScope} mainCurrencyId={mainCurrencyId} />

          <FormControlLabel
            control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />}
            label={tAccounting('revaluationSchedules.active')}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} disabled={saving}>{t('commonActions.cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!canSave}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {t('commonActions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
