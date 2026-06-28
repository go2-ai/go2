// src/components/tabs/TabContextMenu.tsx

import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import {
  SplitSquareHorizontal,
  SplitSquareVertical,
  X,
  XCircle,
} from 'lucide-react';

export interface TabContextMenuProps {
  anchorPoint: { x: number; y: number } | null;
  tabId: string | null;
  onClose: () => void;
  // Actions
  onCloseTab: (id: string) => void;
  onCloseOthers: (id: string) => void;
  onCloseAll: () => void;
  onCloseToRight: (id: string) => void;
  onSplitRight: (id: string) => void;
  onSplitDown: (id: string) => void;
}

export function TabContextMenu({
  anchorPoint,
  tabId,
  onClose,
  onCloseTab,
  onCloseOthers,
  onCloseAll,
  onCloseToRight,
  onSplitRight,
  onSplitDown,
}: TabContextMenuProps) {
  const handleMenuClose = () => onClose();

  const action = (fn: () => void) => () => {
    fn();
    handleMenuClose();
  };

  if (!tabId) return null;

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
      <MenuItem onClick={action(() => onCloseTab(tabId))}>
        <ListItemIcon>
          <X size={16} />
        </ListItemIcon>
        <ListItemText>Close Tab</ListItemText>
      </MenuItem>
      
      <MenuItem onClick={action(() => onCloseOthers(tabId))}>
        <ListItemIcon>
          <XCircle size={16} />
        </ListItemIcon>
        <ListItemText>Close Others</ListItemText>
      </MenuItem>
      
      <MenuItem onClick={action(() => onCloseToRight(tabId))}>
        <ListItemIcon>
          <XCircle size={16} />
        </ListItemIcon>
        <ListItemText>Close Tabs to the Right</ListItemText>
      </MenuItem>
      
      <MenuItem onClick={action(onCloseAll)}>
        <ListItemIcon>
          <XCircle size={16} />
        </ListItemIcon>
        <ListItemText>Close All</ListItemText>
      </MenuItem>
      
      <Divider />
      
      <MenuItem onClick={action(() => onSplitRight(tabId))}>
        <ListItemIcon>
          <SplitSquareHorizontal size={16} />
        </ListItemIcon>
        <ListItemText>Split Right</ListItemText>
      </MenuItem>
      
      <MenuItem onClick={action(() => onSplitDown(tabId))}>
        <ListItemIcon>
          <SplitSquareVertical size={16} />
        </ListItemIcon>
        <ListItemText>Split Down</ListItemText>
      </MenuItem>
    </Menu>
  );
}