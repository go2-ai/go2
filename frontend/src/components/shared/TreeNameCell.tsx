import { Box, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { ReactNode } from 'react';

interface TreeNameCellProps {
  level: number;
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  indent?: number;
}

/** Name cell of a tree row: indentation, expand toggle, content. */
export const TreeNameCell = ({ level, hasChildren, expanded, onToggle, children, indent = 20 }: TreeNameCellProps) => (
  <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', gap: 0.5, minWidth: 0 }}>
    <Box sx={{ width: level * indent, flexShrink: 0 }} />
    <Box sx={{ width: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {hasChildren && (
        <IconButton
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          sx={{ p: 0.5 }}
        >
          {expanded ? (
            <ExpandMoreIcon fontSize="small" />
          ) : (
            <ChevronRightIcon fontSize="small" sx={{ transform: (theme) => (theme.direction === 'rtl' ? 'scaleX(-1)' : 'none') }} />
          )}
        </IconButton>
      )}
    </Box>
    <Box sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</Box>
  </Box>
);
