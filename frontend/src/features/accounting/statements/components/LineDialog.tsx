import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import MultiLocaleInput from '../../../../components/shared/MultiLocaleInput';
import type { LayoutLine, LinePayload } from '../types';

interface Props {
  open: boolean;
  lines: LayoutLine[];
  line?: LayoutLine | null;
  parentId?: number | null;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (payload: LinePayload) => void;
}

const initialForm = (lines: LayoutLine[], line?: LayoutLine | null, parentId?: number | null): LinePayload => {
  if (line) {
    return { parent_id: line.parent_id, kind: line.kind, normal_side: line.normal_side, formula: line.formula, label: line.labels, style: line.style };
  }
  const parent = lines.find((l) => l.id === parentId);
  return { key: '', parent_id: parentId ?? null, kind: 'mapped', normal_side: parent?.normal_side ?? 'debit', formula: '', label: {}, style: {} };
};

/**
 * Create or change a statement line: key (new lines only), labels, kind,
 * side, formula, style. The form starts from the props at mount: the
 * parent remounts the dialog (with a new `key`) each time it opens it.
 */
export const LineDialog = ({ open, lines, line, parentId, saving, error, onClose, onSave }: Props) => {
  const { t } = useTranslation('reporting');
  const [form, setForm] = useState<LinePayload>(() => initialForm(lines, line, parentId));

  const set = (patch: LinePayload) => setForm((current) => ({ ...current, ...patch }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{line ? t('editor.editLine', { name: line.label }) : t('editor.addLine')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            size="small"
            label={t('editor.key')}
            value={line ? line.key : form.key ?? ''}
            disabled={!!line}
            helperText={t('editor.keyHint')}
            onChange={(e) => set({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
          />
          <MultiLocaleInput
            field={t('editor.label')}
            value={form.label ?? {}}
            onChange={(label) => set({ label: label as Record<string, string> })}
            required
          />
          <Stack direction="row" spacing={2}>
            <TextField select size="small" sx={{ flex: 1 }} label={t('editor.kind')} value={form.kind ?? 'mapped'} onChange={(e) => set({ kind: e.target.value as LinePayload['kind'] })}>
              {(['heading', 'mapped', 'formula'] as const).map((kind) => (
                <MenuItem key={kind} value={kind}>
                  {t(`editor.kinds.${kind}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              sx={{ flex: 1 }}
              label={t('editor.normalSide')}
              value={form.normal_side ?? 'debit'}
              onChange={(e) => set({ normal_side: e.target.value as LinePayload['normal_side'] })}
            >
              <MenuItem value="debit">{t('editor.sides.debit')}</MenuItem>
              <MenuItem value="credit">{t('editor.sides.credit')}</MenuItem>
            </TextField>
          </Stack>
          {form.kind === 'formula' && (
            <TextField
              size="small"
              label={t('editor.formula')}
              helperText={t('editor.formulaHint')}
              value={form.formula ?? ''}
              onChange={(e) => set({ formula: e.target.value })}
            />
          )}
          <Stack direction="row">
            {(['bold', 'underline', 'hide_if_zero', 'hidden'] as const).map((name) => (
              <FormControlLabel
                key={name}
                control={<Checkbox size="small" checked={!!form.style?.[name]} onChange={(e) => set({ style: { ...form.style, [name]: e.target.checked } })} />}
                label={t(`editor.styles.${name}`)}
              />
            ))}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('reportActions.cancel')}</Button>
        <Button variant="contained" disabled={saving || (!line && !form.key)} onClick={() => onSave(form)}>
          {t('reportActions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
