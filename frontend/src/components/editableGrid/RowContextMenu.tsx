import { Menu, MenuItem } from '@mui/material';

export interface ContextMenuAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface RowContextMenuProps {
  anchorPoint: { x: number; y: number } | null;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export const RowContextMenu = ({ anchorPoint, actions, onClose }: RowContextMenuProps) => {
  return (
    <Menu
      open={!!anchorPoint}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPoint ? { top: anchorPoint.y, left: anchorPoint.x } : undefined}
    >
      {actions.map((action, index) => (
        <MenuItem
          key={index}
          disabled={action.disabled}
          onClick={() => { action.onClick(); onClose(); }}
        >
          {action.label}
        </MenuItem>
      ))}
    </Menu>
  );
};