// src/components/tabs/PageRegistry.tsx

import { PAGE_DEFINITIONS } from './pageDefinitions';
import { TabIdContext } from './TabIdContext';
import { Box, Typography } from '@mui/material';

export const PAGE_REGISTRY: Record<string, React.ComponentType> = Object.fromEntries(
  PAGE_DEFINITIONS.map((def) => [def.pageId, def.component]),
);

export function PageContent({ pageId, tabId }: { pageId: string; tabId?: string }) {
  const Component = PAGE_REGISTRY[pageId];

  if (!Component) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.secondary">Page not found: {pageId}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', width: '100%', overflow: 'auto', bgcolor: 'background.default' }}>
      <TabIdContext.Provider value={tabId ?? null}>
        <Component />
      </TabIdContext.Provider>
    </Box>
  );
}