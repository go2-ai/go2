import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { metaFor } from './../dimensionConfig';
import { DimensionStripContainer, DimensionPill } from './DimensionStrip';
import { DimensionItemsChips } from './DimensionItemsChips';
import type { ExplorerFilter } from './../journalEntryItemsApi';

export const AppliedFilters = ({ filters }: { filters: ExplorerFilter[] }) => {
  const { t: tAccounting } = useTranslation('accounting');
  if (!filters.length) return null;

  return (
    <DimensionStripContainer>
      {filters.map((filter, i) => {
        const meta = metaFor(filter.dimension);
        return (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
            <DimensionPill label={tAccounting(meta.labelKey, { defaultValue: meta.fallbackLabel })} />
            <DimensionItemsChips items={filter.items ?? []} />
          </Box>
        );
      })}
    </DimensionStripContainer>
  );
};