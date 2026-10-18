import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import { useTranslation } from 'react-i18next';
import { clipboardColumnTitles } from '../utils/clipboard';

interface HotkeysDialogProps {
  open: boolean;
  onClose: () => void;
  centerLevels: number;
}

/** [keys, translation key of the description] */
type Hotkey = [string[], string];

const GROUPS: Array<{ titleKey: string; items: Hotkey[] }> = [
  {
    titleKey: 'hotkeys.groups.navigation',
    items: [
      [['↑', '↓'], 'hotkeys.moveUpDown'],
      [['Shift+↑', 'Shift+↓'], 'hotkeys.extendSelection'],
      [['Enter'], 'hotkeys.nextCell'],
      [['Shift+Enter'], 'hotkeys.previousCell'],
      [['Tab', 'Shift+Tab'], 'hotkeys.tab'],
      [['Alt+↓'], 'hotkeys.openDropdown'],
      [['Esc'], 'hotkeys.cancelTyping'],
    ],
  },
  {
    titleKey: 'hotkeys.groups.rows',
    items: [
      [['Insert', 'Ctrl+Enter'], 'hotkeys.insertRow'],
      [['F6'], 'hotkeys.duplicateRows'],
      [['F3'], 'hotkeys.copyRowAbove'],
      [['F4'], 'hotkeys.copyCellAbove'],
      [['Delete'], 'hotkeys.deleteRowsRowMode'],
      [['Ctrl+Delete'], 'hotkeys.deleteRows'],
      [['Ctrl+C'], 'hotkeys.copyRows'],
      [['Ctrl+V'], 'hotkeys.pasteRows'],
    ],
  },
  {
    titleKey: 'hotkeys.groups.amounts',
    items: [
      [['F8'], 'hotkeys.balance'],
      [['F9'], 'hotkeys.swapRate'],
      [['F10'], 'hotkeys.swapDebitCredit'],
    ],
  },
  {
    titleKey: 'hotkeys.groups.general',
    items: [
      [['Ctrl+Z'], 'hotkeys.undo'],
      [['Ctrl+Y', 'Ctrl+Shift+Z'], 'hotkeys.redo'],
      [['Ctrl+S'], 'hotkeys.save'],
      [['Ctrl+Alt+S'], 'hotkeys.saveDraft'],
      [['Ctrl+/'], 'hotkeys.help'],
    ],
  },
];

const Key = ({ label }: { label: string }) => (
  <Box
    component="kbd"
    sx={{
      display: 'inline-block',
      px: 0.75,
      py: 0.25,
      mr: 0.5,
      mb: 0.5,
      borderRadius: 0.75,
      border: 1,
      borderColor: 'divider',
      bgcolor: 'action.hover',
      fontFamily: 'monospace',
      fontSize: '0.75rem',
      whiteSpace: 'nowrap',
      // Key names read left-to-right even in RTL layouts
      direction: 'ltr',
    }}
  >
    {label}
  </Box>
);

export const HotkeysDialog = ({ open, onClose, centerLevels }: HotkeysDialogProps) => {
  const { t } = useTranslation('accounting');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="hotkeys-dialog-title">
      <DialogTitle id="hotkeys-dialog-title" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <KeyboardIcon color="primary" fontSize="small" />
        <Box sx={{ flex: 1 }}>{t('hotkeys.title')}</Box>
        <IconButton size="small" onClick={onClose} aria-label={t('hotkeys.close')}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {GROUPS.map(group => (
          <Box key={group.titleKey} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 0.5 }}>
              {t(group.titleKey)}
            </Typography>
            <Table size="small">
              <TableBody>
                {group.items.map(([keys, descKey]) => (
                  <TableRow key={descKey}>
                    <TableCell sx={{ width: 180, verticalAlign: 'top', pl: 0 }}>
                      {keys.map(k => <Key key={k} label={k} />)}
                    </TableCell>
                    <TableCell sx={{ pr: 0 }}>{t(descKey)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ))}

        <Typography variant="subtitle2" color="primary" sx={{ mb: 0.5 }}>
          {t('hotkeys.groups.spreadsheet')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t('hotkeys.spreadsheetHelp')}
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {clipboardColumnTitles(centerLevels, t).join(' | ')}
        </Typography>
      </DialogContent>
    </Dialog>
  );
};
