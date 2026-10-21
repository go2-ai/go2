import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { useTranslatableLocales } from '../../../../hooks/useTranslatableLocales';
import type { LineTemplate, LineTemplateKind } from '../currencyRevaluationsApi';
import {
  insertableVariables,
  lineTemplateProblems,
  renderLineTemplate,
  type LineTemplateValues,
} from '../lineTemplate';

interface Props {
  open: boolean;
  onClose: () => void;
  organizationId: number;
  kind: LineTemplateKind;
  value: LineTemplate;
  defaults: LineTemplate;
  /** Values of a sample line, for the live example. */
  sample: LineTemplateValues;
  centerLevels: number;
  onSave: (value: LineTemplate) => Promise<void>;
}

const languageName = (code: string, uiLanguage: string) => {
  try {
    return new Intl.DisplayNames([uiLanguage, 'en'], { type: 'language' }).of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
};

/**
 * Edits the template of an entry line description. Values are inserted from
 * a menu (at the cursor), and an example shows the result while typing.
 */
export const LineTemplateDialog = ({
  open, onClose, organizationId, kind, value, defaults, sample, centerLevels, onSave,
}: Props) => {
  const { t, i18n } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { primaryLocale, allLocales } = useTranslatableLocales({ organizationId });
  const locales = allLocales.length ? allLocales : [primaryLocale];
  const [draft, setDraft] = useState<LineTemplate>({});
  const [saving, setSaving] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [activeLocale, setActiveLocale] = useState(primaryLocale);
  const inputs = useRef<Record<string, HTMLTextAreaElement | HTMLInputElement | null>>({});

  useEffect(() => {
    if (open) {
      setDraft({ ...value });
      setActiveLocale(primaryLocale);
    }
  }, [open, value, primaryLocale]);

  const problemsOf = (locale: string) => lineTemplateProblems(draft[locale], kind).map((problem) =>
    tAccounting(`revaluations.lineTemplates.problems.${problem.key}`, { ...problem, language: locale.toUpperCase() }));
  const invalid = locales.some((locale) => problemsOf(locale).length > 0);
  const changed = locales.some((locale) => (draft[locale] ?? '') !== (value[locale] ?? ''));
  const variableLabel = (variable: string) =>
    tAccounting(`revaluations.lineTemplates.variableNames.${variable.replace(/^center\d_/, 'center_')}`, {
      level: variable.match(/^center(\d)/)?.[1],
    });

  const insert = (variable: string) => {
    setMenuAnchor(null);
    const locale = activeLocale;
    const input = inputs.current[locale];
    const text = draft[locale] ?? '';
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;
    const token = `{${variable}}`;
    const before = text.slice(0, start);
    const spacer = before && !before.endsWith(' ') ? ' ' : '';
    const next = `${before}${spacer}${token}${text.slice(end)}`;
    setDraft({ ...draft, [locale]: next });
    requestAnimationFrame(() => {
      const caret = before.length + spacer.length + token.length;
      input?.focus();
      input?.setSelectionRange(caret, caret);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{tAccounting(`revaluations.lineTemplates.${kind}`)}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">{tAccounting('revaluations.lineTemplates.dialogHint')}</Typography>
        {locales.map((locale) => {
          const problems = problemsOf(locale);
          return (
            <TextField
              key={locale}
              label={locales.length > 1 ? languageName(locale, i18n.language) : tAccounting('revaluations.lineTemplates.template')}
              value={draft[locale] ?? ''}
              onChange={(e) => setDraft({ ...draft, [locale]: e.target.value })}
              onFocus={() => setActiveLocale(locale)}
              inputRef={(element: HTMLTextAreaElement | null) => { inputs.current[locale] = element; }}
              error={problems.length > 0}
              helperText={problems.join(' ') || undefined}
              multiline
              minRows={2}
              fullWidth
              inputProps={{ dir: 'auto', spellCheck: false }}
              sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.875rem' } }}
            />
          );
        })}
        <Box>
          <Button size="small" startIcon={<AddIcon />} onClick={(e) => setMenuAnchor(e.currentTarget)}
            aria-haspopup="menu" aria-expanded={!!menuAnchor}>
            {tAccounting('revaluations.lineTemplates.insertValue')}
          </Button>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}
            slotProps={{ paper: { sx: { maxHeight: 360 } } }}>
            {insertableVariables(kind, centerLevels).map((variable) => (
              <MenuItem key={variable} onClick={() => insert(variable)} dense>
                <ListItemText primary={variableLabel(variable)} secondary={`{${variable}}`}
                  secondaryTypographyProps={{ fontFamily: 'monospace' }} />
              </MenuItem>
            ))}
          </Menu>
        </Box>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">{tAccounting('revaluations.lineTemplates.preview')}</Typography>
          {locales.map((locale) => (
            <Typography key={locale} variant="body2" dir="auto">
              {renderLineTemplate(draft[locale] ?? '', sample) || '—'}
            </Typography>
          ))}
        </Paper>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={() => setDraft({ ...defaults })} disabled={saving} sx={{ mr: 'auto' }}>
          {tAccounting('revaluations.lineTemplates.useDefault')}
        </Button>
        <Button onClick={onClose} disabled={saving}>{t('commonActions.cancel')}</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || invalid || !changed}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}>
          {t('commonActions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
