import { Menu, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ChartOfAccountsNode } from '../utils/buildChartOfAccountsTree';

interface ChartOfAccountsActionsMenuProps {
  anchorEl: HTMLElement | null;
  node: ChartOfAccountsNode | null;
  onClose: () => void;
  onDelete: () => void;
  onChangeLog: () => void;
}

export const ChartOfAccountsActionsMenu = ({
  anchorEl,
  node,
  onClose,
  onDelete,
  onChangeLog,
}: ChartOfAccountsActionsMenuProps) => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');

  if (!node) return null;

  const canDelete = !(node.type === 'category' && node.isSystem);

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <MenuItem onClick={onChangeLog}>{t('changeLog')}</MenuItem>
      {canDelete && (
        <MenuItem onClick={onDelete} sx={{ color: 'error.main' }}>
          {t('commonActions.delete')}
        </MenuItem>
      )}
    </Menu>
  );
};