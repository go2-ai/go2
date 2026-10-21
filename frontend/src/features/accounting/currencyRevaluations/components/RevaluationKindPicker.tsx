import { Box, FormControlLabel, Radio, RadioGroup, Typography, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { RevaluationKind } from '../currencyRevaluationsApi';

const KINDS: RevaluationKind[] = ['temporary', 'permanent'];

interface Props {
  value: RevaluationKind;
  onChange: (kind: RevaluationKind) => void;
  disabled?: boolean;
}

/**
 * Temporary or permanent, as two cards with one sentence each, so the
 * choice explains itself.
 */
export const RevaluationKindPicker = ({ value, onChange, disabled }: Props) => {
  const { t: tAccounting } = useTranslation('accounting');

  return (
    <Box>
      <Typography id="revaluation-kind-label" variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
        {tAccounting('revaluations.kind')}
      </Typography>
      <RadioGroup
        aria-labelledby="revaluation-kind-label"
        value={value}
        onChange={(e) => onChange(e.target.value as RevaluationKind)}
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}
      >
        {KINDS.map((kind) => {
          const selected = value === kind;
          return (
            <FormControlLabel
              key={kind}
              value={kind}
              disabled={disabled}
              control={<Radio size="small" sx={{ mt: -0.25 }} />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>{tAccounting(`revaluations.kinds.${kind}`)}</Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {tAccounting(`revaluations.kindHints.${kind}`)}
                  </Typography>
                </Box>
              }
              sx={(theme) => ({
                m: 0,
                p: 1,
                pr: 1.5,
                alignItems: 'flex-start',
                border: 1,
                borderRadius: 1,
                borderColor: selected ? 'primary.main' : 'divider',
                bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
              })}
            />
          );
        })}
      </RadioGroup>
    </Box>
  );
};
