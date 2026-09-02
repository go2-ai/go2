import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { metaFor } from './../dimensionConfig';
import { DimensionStripContainer, DimensionPill } from './DimensionStrip';
import { DimensionItemsChips } from './DimensionItemsChips';
import type { ExplorerDimension } from './../journalEntryItemsApi';

export interface TrailStep {
  dimension: ExplorerDimension;
  items: { code: string; name: string }[];
}

interface DrillTrailProps {
  steps: TrailStep[];
  currentDimension: ExplorerDimension | null;
  onStepClick: (index: number) => void;
}

export const DrillTrail = ({ steps, currentDimension, onStepClick }: DrillTrailProps) => {
  const { t: tAccounting } = useTranslation('accounting');
  if (!currentDimension) return null;
  const currentMeta = metaFor(currentDimension);

  return (
    <DimensionStripContainer>
      {steps.map((step, i) => {
        const meta = metaFor(step.dimension);
        return (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <DimensionPill
              label={tAccounting(meta.labelKey, { defaultValue: meta.fallbackLabel })}
              onClick={() => onStepClick(i)}
            />
            <DimensionItemsChips items={step.items} />
            <ChevronRightRoundedIcon sx={{ fontSize: 16, color: 'text.disabled', ml: 0.5 }} />
          </Box>
        );
      })}
      <DimensionPill
        label={tAccounting(currentMeta.labelKey, { defaultValue: currentMeta.fallbackLabel })}
        variant="current"
      />
    </DimensionStripContainer>
  );
};