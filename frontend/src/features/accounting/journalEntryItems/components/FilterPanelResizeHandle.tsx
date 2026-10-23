import { Box } from '@mui/material';
import { Separator } from 'react-resizable-panels';

/** The handle between a page's grid and its filter panel. */
export const FilterPanelResizeHandle = () => (
  <Separator>
    <Box
      sx={{
        width: 4,
        height: '100%',
        mx: 0.5,
        backgroundColor: 'divider',
        transition: 'background-color 0.2s',
        cursor: 'col-resize',
        '&:hover': { backgroundColor: 'primary.main', opacity: 0.5 },
      }}
    />
  </Separator>
);
