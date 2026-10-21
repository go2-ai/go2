import { useState } from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useTranslation } from 'react-i18next';
import { useTranslatableLocales } from '../../../../hooks/useTranslatableLocales';
import type { LineTemplate, LineTemplateKind } from '../currencyRevaluationsApi';
import { renderLineTemplate, type LineTemplateValues } from '../lineTemplate';
import { LineTemplateDialog } from './LineTemplateDialog';


interface Props {
  organizationId: number;
  /** Templates as edited: { item: { locale => template }, counter: {...} }. */
  /** Kinds of line shown, in order. */
  kinds?: LineTemplateKind[];
  templates: Partial<Record<LineTemplateKind, LineTemplate>>;
  defaults: Partial<Record<LineTemplateKind, LineTemplate>>;
  /** Values of a sample line per kind, for the examples. */
  samples: Partial<Record<LineTemplateKind, LineTemplateValues>>;
  centerLevels: number;
  editable: boolean;
  onSave: (kind: LineTemplateKind, value: LineTemplate) => Promise<void>;
  /** Shown instead of the default heading. */
  title?: string;
  hint?: string;
}

/**
 * Journal entry line descriptions as examples ("what the line will say"),
 * each with an Edit button that opens the template editor.
 */
export const LineDescriptionsSection = ({
  organizationId, kinds = ['item', 'counter'], templates, defaults, samples, centerLevels, editable, onSave, title, hint,
}: Props) => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { primaryLocale } = useTranslatableLocales({ organizationId });
  const [editing, setEditing] = useState<LineTemplateKind | null>(null);

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box>
        <Typography variant="subtitle2">{title ?? tAccounting('revaluations.lineTemplates.title')}</Typography>
        <Typography variant="body2" color="text.secondary">{hint ?? tAccounting('revaluations.lineTemplates.hint')}</Typography>
      </Box>
      {kinds.map((kind) => {
        const own = templates[kind] ?? {};
        const template = own[primaryLocale] ?? Object.values(own)[0] ?? '';
        return (
          <Box key={kind} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">{tAccounting(`revaluations.lineTemplates.${kind}`)}</Typography>
              <Typography variant="body2" dir="auto" sx={{ wordBreak: 'break-word' }}>
                {renderLineTemplate(template, samples[kind] ?? {}) || '—'}
              </Typography>
            </Box>
            {editable && (
              <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => setEditing(kind)}>
                {t('commonActions.edit')}
              </Button>
            )}
          </Box>
        );
      })}
      {editing && (
        <LineTemplateDialog
          open
          onClose={() => setEditing(null)}
          organizationId={organizationId}
          kind={editing}
          value={templates[editing] ?? {}}
          defaults={defaults[editing] ?? {}}
          sample={samples[editing] ?? {}}
          centerLevels={centerLevels}
          onSave={(value) => onSave(editing, value)}
        />
      )}
    </Paper>
  );
};
