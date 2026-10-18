import { Menu, MenuItem, ListItemText, Typography } from '@mui/material';

export interface ContextMenuAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Keyboard shortcut hint shown on the right, e.g. "F6". */
  shortcut?: string;
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
          dense
        >
          <ListItemText>{action.label}</ListItemText>
          {action.shortcut && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontFamily: 'monospace' }}>
              {action.shortcut}
            </Typography>
          )}
        </MenuItem>
      ))}
    </Menu>
  );
};
