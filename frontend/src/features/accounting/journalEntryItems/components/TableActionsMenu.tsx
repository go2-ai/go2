import { useState } from 'react';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { useTranslation } from 'react-i18next';

interface TableActionsMenuProps {
  onExportExcel: () => void;
  disabled?: boolean;
}

/** The ⋮ menu at the top right of the explorer pages. */
export const TableActionsMenu = ({ onExportExcel, disabled = false }: TableActionsMenuProps) => {
  const { t: tAccounting } = useTranslation('accounting');
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Tooltip title={tAccounting('moreActions')}>
        <IconButton
          size="small"
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label={tAccounting('moreActions')}
          aria-haspopup="menu"
          aria-expanded={!!anchor}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          disabled={disabled}
          onClick={() => {
            setAnchor(null);
            onExportExcel();
          }}
        >
          <ListItemIcon>
            <FileDownloadOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tAccounting('explorer.exportExcel')}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};
