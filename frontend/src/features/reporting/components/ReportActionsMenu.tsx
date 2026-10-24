import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import StarIcon from '@mui/icons-material/Star';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EditNoteIcon from '@mui/icons-material/EditNote';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/confirmContext';
import { useOpenPage } from '../../../components/tabs/useOpenPage';
import { apiErrorMessage } from '../../../utils/apiErrorMessage';
import {
  useArchiveReportMutation,
  useCopyReportMutation,
  useDeleteReportMutation,
  useUpdateReportMutation,
} from '../reportingApi';
import { ReportAccessDialog } from './ReportAccessDialog';
import type { ReportSummary } from '../types';

interface Props {
  organizationId: number;
  report: ReportSummary;
  /** Called with the new report after a copy. */
  onCopied?: (report: ReportSummary) => void;
  /** Called after the report was deleted. */
  onDeleted?: () => void;
}

/** Copy, rename, make primary, archive, delete, edit layout and manage access, as far as allowed. */
export const ReportActionsMenu = ({ organizationId, report, onCopied, onDeleted }: Props) => {
  const { t, i18n } = useTranslation('reporting');
  const { showError, showSuccess } = useToast();
  const confirm = useConfirm();
  const { openPage } = useOpenPage(organizationId);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [accessOpen, setAccessOpen] = useState(false);
  const [copyReport] = useCopyReportMutation();
  const [updateReport] = useUpdateReportMutation();
  const [archiveReport] = useArchiveReportMutation();
  const [deleteReport] = useDeleteReportMutation();
  const { can_copy, can_edit, can_manage, can_manage_access } = report.permissions;
  if (!can_copy && !can_edit && !can_manage_access) return null;

  const run = async (action: () => Promise<unknown>, success: string) => {
    setAnchor(null);
    try {
      await action();
      showSuccess(success);
    } catch (err) {
      showError(apiErrorMessage(err) || t('reportActions.failed'));
    }
  };

  const copy = () =>
    run(async () => {
      const copied = await copyReport({ organizationId, id: report.id }).unwrap();
      onCopied?.(copied);
    }, t('reportActions.copied'));

  const remove = async () => {
    setAnchor(null);
    const ok = await confirm({
      title: t('reportActions.deleteTitle'),
      message: t('reportActions.deleteMessage', { name: report.name }),
      confirmText: t('reportActions.delete'),
      confirmColor: 'error',
    });
    if (!ok) return;
    await run(async () => {
      await deleteReport({ organizationId, id: report.id }).unwrap();
      onDeleted?.();
    }, t('reportActions.deleted'));
  };

  const saveName = () => {
    setRenaming(false);
    void run(
      () => updateReport({ organizationId, id: report.id, data: { name: { [i18n.language]: name } } }).unwrap(),
      t('reportActions.renamed')
    );
  };

  return (
    <>
      <Tooltip title={t('reportActions.menu')}>
        <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {can_copy && (
          <MenuItem onClick={copy}>
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('reportActions.copy')}</ListItemText>
          </MenuItem>
        )}
        {can_edit && report.report_type === 'accounting.statement' && (
          <MenuItem
            onClick={() => {
              setAnchor(null);
              openPage('statement-layout-editor', t('editor.tabTitle', { name: report.name }), `reporting/reports/${report.id}/layout`);
            }}
          >
            <ListItemIcon>
              <EditNoteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('reportActions.editLayout')}</ListItemText>
          </MenuItem>
        )}
        {can_edit && (
          <MenuItem
            onClick={() => {
              setAnchor(null);
              setName(report.names[i18n.language] ?? report.name);
              setRenaming(true);
            }}
          >
            <ListItemIcon>
              <DriveFileRenameOutlineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('reportActions.rename')}</ListItemText>
          </MenuItem>
        )}
        {can_manage && report.statement_type && !report.primary && !report.archived_at && (
          <MenuItem
            onClick={() =>
              run(() => updateReport({ organizationId, id: report.id, data: { primary: true } }).unwrap(), t('reportActions.madePrimary'))
            }
          >
            <ListItemIcon>
              <StarIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('reportActions.makePrimary')}</ListItemText>
          </MenuItem>
        )}
        {can_manage_access && (
          <MenuItem
            onClick={() => {
              setAnchor(null);
              setAccessOpen(true);
            }}
          >
            <ListItemIcon>
              <LockOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('reportActions.access')}</ListItemText>
          </MenuItem>
        )}
        {can_manage && (
          <MenuItem
            onClick={() =>
              run(
                () => archiveReport({ organizationId, id: report.id, archived: !report.archived_at }).unwrap(),
                report.archived_at ? t('reportActions.unarchived') : t('reportActions.archived')
              )
            }
          >
            <ListItemIcon>
              {report.archived_at ? <UnarchiveOutlinedIcon fontSize="small" /> : <ArchiveOutlinedIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText>{report.archived_at ? t('reportActions.unarchive') : t('reportActions.archive')}</ListItemText>
          </MenuItem>
        )}
        {can_manage && (
          <MenuItem onClick={remove}>
            <ListItemIcon>
              <DeleteOutlineIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>{t('reportActions.delete')}</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <Dialog open={renaming} onClose={() => setRenaming(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('reportActions.rename')}</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth margin="dense" label={t('catalog.name')} value={name} onChange={(e) => setName(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenaming(false)}>{t('reportActions.cancel')}</Button>
          <Button variant="contained" onClick={saveName} disabled={!name.trim()}>
            {t('reportActions.save')}
          </Button>
        </DialogActions>
      </Dialog>
      {accessOpen && (
        <ReportAccessDialog organizationId={organizationId} report={report} open={accessOpen} onClose={() => setAccessOpen(false)} />
      )}
    </>
  );
};
