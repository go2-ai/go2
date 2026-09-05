import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  TextField,
  CircularProgress,
  Divider,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DescriptionIcon from '@mui/icons-material/Description';
import { useTranslation } from 'react-i18next';
import {
  useGetReportTemplatesQuery,
  useUpdateReportTemplateMutation,
  useDeleteReportTemplateMutation,
  useCreateReportTemplateMutation,
  type ReportTemplate,
} from '../../reportTemplates/reportTemplatesApi';
import { useOpenReport } from '../useOpenReport';
import { useToast } from '../../../contexts/ToastContext';

interface ReportSettingsModalProps {
  open: boolean;
  onClose: () => void;
  reportKey: string;
  reportData: Record<string, any>;
  reportTitle: string;
}

export const ReportSettingsModal = ({
  open,
  onClose,
  reportKey,
  reportData,
  reportTitle,
}: ReportSettingsModalProps) => {
  const { t } = useTranslation('shared');
  const { t: tReports } = useTranslation('reports');
  const { i18n } = useTranslation();
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const { openReport } = useOpenReport();
  const { showSuccess, showError } = useToast();

  const { data: templates, isLoading } = useGetReportTemplatesQuery(orgId, {
    skip: !orgId,
  });

  const [updateTemplate] = useUpdateReportTemplateMutation();
  const [deleteTemplate] = useDeleteReportTemplateMutation();
  const [createTemplate] = useCreateReportTemplateMutation();

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameName, setRenameName] = useState('');

  const reportTemplates =
    templates?.filter((t) => t.report_key === reportKey) || [];

  const systemTemplate = reportTemplates.find((t) => t.system);
  const orgTemplates = reportTemplates.filter((t) => !t.system);

  const getLocalizedName = (template: ReportTemplate): string => {
    const name = template.name;
    if (typeof name === 'string') return name;
    if (name && typeof name === 'object') {
      return name[i18n.language] || name || Object.values(name)[0] || 'Untitled';
    }
    return 'Untitled';
  };

  const handlePrint = (template: ReportTemplate) => {
    openReport(reportKey, reportData, reportTitle, template.id);
    onClose();
  };

  const handleDesign = (template: ReportTemplate) => {
    // TODO: Open Stimulsoft Designer in Step 4
    console.log('Design template:', template.id);
  };

  const handleDuplicate = async (template: ReportTemplate) => {
    try {
      await createTemplate({
        organizationId: orgId,
        data: {
          report_key: reportKey,
          template_file: template.template_file,
          name: {
            en: `${getLocalizedName(template)} (Copy)`,
            fa: `${getLocalizedName(template)} (کپی)`,
          },
          parent_template_id: template.id,
          is_default: false,
        },
      }).unwrap();
      showSuccess(tReports('duplicateSuccess'));
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tReports('duplicateFailed'));
    }
  };

  const handleRename = async (template: ReportTemplate) => {
    if (!renameName.trim()) return;

    try {
      await updateTemplate({
        organizationId: orgId,
        id: template.id,
        data: {
          name: {
            en: renameName,
            fa: renameName,
          },
        },
      }).unwrap();
      showSuccess(tReports('renameSuccess'));
      setRenamingId(null);
      setRenameName('');
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tReports('renameFailed'));
    }
  };

  const handleDelete = async (template: ReportTemplate) => {
    try {
      await deleteTemplate({
        organizationId: orgId,
        id: template.id,
      }).unwrap();
      showSuccess(tReports('deleteSuccess'));
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tReports('deleteFailed'));
    }
  };

  const handleSetDefault = async (template: ReportTemplate) => {
    try {
      await updateTemplate({
        organizationId: orgId,
        id: template.id,
        data: {
          is_default: true,
        },
      }).unwrap();
      showSuccess(tReports('setDefaultSuccess'));
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tReports('setDefaultFailed'));
    }
  };

  const renderTemplateItem = (template: ReportTemplate) => (
    <ListItem
      key={template.id}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        mb: 1,
        flexDirection: 'column',
        alignItems: 'stretch',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <ListItemAvatar>
          <Avatar>
            <DescriptionIcon fontSize="small" />
          </Avatar>
        </ListItemAvatar>

        {renamingId === template.id ? (
          <TextField
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            size="small"
            autoFocus
            sx={{ flex: 1, mr: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRename(template);
              } else if (e.key === 'Escape') {
                setRenamingId(null);
                setRenameName('');
              }
            }}
          />
        ) : (
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  {getLocalizedName(template)}
                </Typography>
                {template.system && (
                  <Chip
                    label={tReports('system')}
                    size="small"
                    variant="outlined"
                  />
                )}
                {template.is_default && (
                  <Chip
                    label={tReports('default')}
                    size="small"
                    color="primary"
                    variant="filled"
                  />
                )}
              </Box>
            }
          />
        )}

        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
          <Tooltip title={t('commonActions.print')}>
            <IconButton size="small" onClick={() => handlePrint(template)}>
              <PrintIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title={tReports('design')}>
            <IconButton size="small" onClick={() => handleDesign(template)}>
              <DesignServicesIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title={t('commonActions.duplicate')}>
            <IconButton size="small" onClick={() => handleDuplicate(template)}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {!template.system && (
            <>
              <Tooltip title={t('commonActions.rename')}>
                <IconButton
                  size="small"
                  onClick={() => {
                    setRenamingId(template.id);
                    setRenameName(getLocalizedName(template));
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title={t('commonActions.delete')}>
                <IconButton
                  size="small"
                  onClick={() => handleDelete(template)}
                >
                  <DeleteIcon fontSize="small" color="error" />
                </IconButton>
              </Tooltip>
            </>
          )}

          <Tooltip
            title={
              template.is_default
                ? tReports('isDefault')
                : tReports('setAsDefault')
            }
          >
            <IconButton
              size="small"
              onClick={() => handleSetDefault(template)}
              disabled={template.is_default}
            >
              {template.is_default ? (
                <StarIcon fontSize="small" color="primary" />
              ) : (
                <StarBorderIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {renamingId === template.id && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
          <Button
            size="small"
            onClick={() => {
              setRenamingId(null);
              setRenameName('');
            }}
          >
            {t('commonActions.cancel')}
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => handleRename(template)}
          >
            {t('commonActions.save')}
          </Button>
        </Box>
      )}
    </ListItem>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{tReports('reportSettings')}</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {tReports('systemTemplate')}
            </Typography>
            {systemTemplate && renderTemplateItem(systemTemplate)}

            {orgTemplates.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  {tReports('customTemplates')}
                </Typography>
                {orgTemplates.map(renderTemplateItem)}
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('commonActions.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};