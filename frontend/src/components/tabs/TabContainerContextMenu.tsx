// src/components/tabs/TabContainerContextMenu.tsx

import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { XCircle } from 'lucide-react';

export interface TabContainerContextMenuProps {
  anchorPoint: { x: number; y: number } | null;
  onClose: () => void;
  onCloseAll: () => void;
}

export function TabContainerContextMenu({
  anchorPoint,
  onClose,
  onCloseAll,
}: TabContainerContextMenuProps) {
  const handleMenuClose = () => onClose();

  const action = (fn: () => void) => () => {
    fn();
    handleMenuClose();
  };

  return (
    <Menu
      open={!!anchorPoint}
      onClose={handleMenuClose}
      anchorReference="anchorPosition"
      anchorPosition={
        anchorPoint ? { top: anchorPoint.y, left: anchorPoint.x } : undefined
      }
      slotProps={{
        paper: {
          sx: {
            minWidth: 180,
          },
        },
      }}
    >
      <MenuItem onClick={action(onCloseAll)}>
        <ListItemIcon>
          <XCircle size={16} />
        </ListItemIcon>
        <ListItemText>Close All Tabs</ListItemText>
      </MenuItem>
    </Menu>
  );
}