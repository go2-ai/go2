import { useState } from 'react';
import {
  Button,
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  CircularProgress,
  Divider,
  Avatar,
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
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTabManager } from '../../components/tabs/useTabManager';
import {
  apiErrorMessage,
  useGetReportTemplatesQuery,
  useUpdateReportTemplateMutation,
  useDeleteReportTemplateMutation,
  useCopyReportTemplateMutation,
  type ReportTemplateSummary,
} from '../reportTemplates/reportTemplatesApi';
import { useOpenReport } from './useOpenReport';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/confirmContext';
import { parseId, useTabSearchParams } from '../../components/tabs/useTabSearchParams';
import { useTabLoading } from '../../components/tabs/TabLoadingContext';

// Path: report-settings?report_key=journal_entry&record_id=42
export const ReportSettingsPage = () => {
  const { t } = useTranslation('shared');
  const { t: tReports, i18n } = useTranslation('reports');
  const { organizationId } = useParams<{ organizationId: string }>();
  const searchParams = useTabSearchParams();
  const { openReport } = useOpenReport();
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { openTab } = useTabManager();

  const orgId = parseInt(organizationId || '0', 10);
  const reportKey = searchParams.get('report_key') || '';
  const recordId = parseId(searchParams.get('record_id'));
  const language = (i18n.language || 'en').split('-')[0];

  const { data: templates, isLoading } = useGetReportTemplatesQuery(orgId, { skip: !orgId });
  useTabLoading(isLoading);

  const [updateTemplate] = useUpdateReportTemplateMutation();
  const [deleteTemplate] = useDeleteReportTemplateMutation();
  const [copyTemplate] = useCopyReportTemplateMutation();

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameName, setRenameName] = useState('');

  const reportTemplates = templates?.filter((t) => t.report_key === reportKey) || [];

  const systemTemplate = reportTemplates.find((t) => t.system);
  const orgTemplates = reportTemplates
    .filter((t) => !t.system)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const orgDefault = orgTemplates.find((t) => t.is_default);
  // Admin rights are the same for every template of the organization.
  const canManage = reportTemplates.some((t) => t.copyable);

  const templateName = (template: ReportTemplateSummary): string => template.name || tReports('untitled');

  // The system template is the default until the organization picks one of its own.
  const isEffectivelyDefault = (template: ReportTemplateSummary): boolean =>
    template.system ? !orgDefault : template.is_default;

  const formatUpdatedAt = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const handlePrint = (template: ReportTemplateSummary) => {
    if (!recordId) return;
    openReport(reportKey, recordId, templateName(template), template.id);
  };

  const handleDesign = (template: ReportTemplateSummary) => {
    const params = new URLSearchParams({ template_id: String(template.id) });
    if (recordId) params.set('record_id', String(recordId));
    const path = `/app/organizations/${orgId}/report-designer?${params.toString()}`;
    openTab('report-designer', `${tReports('design')}: ${templateName(template)}`, path);
    navigate(path);
  };

  const handleDuplicate = async (template: ReportTemplateSummary) => {
    try {
      await copyTemplate({ organizationId: orgId, sourceTemplateId: template.id }).unwrap();
      showSuccess(tReports('duplicateSuccess'));
    } catch (err) {
      showError(apiErrorMessage(err) || tReports('duplicateFailed'));
    }
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameName('');
  };

  const handleRename = async (template: ReportTemplateSummary) => {
    const name = renameName.trim();
    if (!name) return;

    try {
      // Only the current language changes; other translations are kept.
      await updateTemplate({
        organizationId: orgId,
        id: template.id,
        data: { name: { [language]: name } },
      }).unwrap();
      showSuccess(tReports('renameSuccess'));
      cancelRename();
    } catch (err) {
      showError(apiErrorMessage(err) || tReports('renameFailed'));
    }
  };

  const handleDelete = async (template: ReportTemplateSummary) => {
    const confirmed = await confirm({
      title: tReports('deleteTemplateTitle'),
      message: tReports('deleteTemplateMessage', { name: templateName(template) }),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });

    if (!confirmed) return;

    try {
      await deleteTemplate({ organizationId: orgId, id: template.id }).unwrap();
      showSuccess(tReports('deleteTemplateSuccess'));
    } catch (err) {
      showError(apiErrorMessage(err) || tReports('deleteTemplateFailed'));
    }
  };

  const handleToggleDefault = async (template: ReportTemplateSummary) => {
    // System templates are read-only: making the system template the default
    // means clearing the organization's own default.
    const target = template.system ? orgDefault : template;
    if (!target) return;
    const newIsDefault = template.system ? false : !template.is_default;

    try {
      await updateTemplate({
        organizationId: orgId,
        id: target.id,
        data: { is_default: newIsDefault },
      }).unwrap();
      showSuccess(newIsDefault ? tReports('setDefaultSuccess') : tReports('unsetDefaultSuccess'));
    } catch (err) {
      showError(apiErrorMessage(err) || tReports('setDefaultFailed'));
    }
  };

  const getReportPageName = (key: string): string => {
    switch (key) {
      case 'journal_entry':
        return tReports('journalEntryPage');
      case 'explorer':
        return tReports('explorerPage');
      case 'journal_entry_items':
        return tReports('journalEntryItemsPage');
      case 'currency_revaluation':
        return tReports('currencyRevaluationPage');
      default:
        return key;
    }
  };

  const renderDefaultButton = (template: ReportTemplateSummary) => {
    const isDefault = isEffectivelyDefault(template);
    // The system template can only become the default again (by clearing the organization's default).
    const canToggle = template.system ? canManage && !isDefault && !!orgDefault?.editable : template.editable;
    if (!canToggle) {
      return isDefault ? (
        <Box sx={{ display: 'inline-flex', p: '5px' }}>
          <StarIcon fontSize="small" color="primary" aria-label={tReports('default')} />
        </Box>
      ) : null;
    }

    return (
      <Tooltip title={isDefault ? tReports('unsetDefault') : tReports('setAsDefault')}>
        <IconButton size="small" onClick={() => handleToggleDefault(template)}>
          {isDefault ? <StarIcon fontSize="small" color="primary" /> : <StarBorderIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    );
  };

  const renderTemplateRow = (template: ReportTemplateSummary) => (
    <Paper
      key={template.id}
      variant="outlined"
      sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}
    >
      <Avatar variant="rounded">
        <DescriptionIcon fontSize="small" />
      </Avatar>

      {renamingId === template.id ? (
        <>
          <TextField
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            size="small"
            autoFocus
            sx={{ flex: 1 }}
            slotProps={{ htmlInput: { 'aria-label': t('commonActions.rename') } }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRename(template);
              } else if (e.key === 'Escape') {
                cancelRename();
              }
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button size="small" onClick={cancelRename}>
              {t('commonActions.cancel')}
            </Button>
            <Button size="small" variant="contained" onClick={() => handleRename(template)}>
              {t('commonActions.save')}
            </Button>
          </Box>
        </>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body1" fontWeight={500}>
              {templateName(template)}
            </Typography>
            {template.system && <Chip label={tReports('system')} size="small" variant="outlined" />}
            {isEffectivelyDefault(template) && <Chip label={tReports('default')} size="small" color="primary" />}
          </Box>
          {!template.system && (
            <Typography variant="caption" color="text.secondary">
              {tReports('lastUpdatedAt')}: {formatUpdatedAt(template.updated_at)}
              {template.created_by_name && ` · ${template.created_by_name}`}
            </Typography>
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {recordId && (
          <Tooltip title={t('commonActions.print')}>
            <IconButton size="small" onClick={() => handlePrint(template)}>
              <PrintIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {template.editable && (
          <Tooltip title={tReports('design')}>
            <IconButton size="small" onClick={() => handleDesign(template)}>
              <DesignServicesIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {template.copyable && (
          <Tooltip title={t('commonActions.duplicate')}>
            <IconButton size="small" onClick={() => handleDuplicate(template)}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {template.editable && (
          <>
            <Tooltip title={t('commonActions.rename')}>
              <IconButton
                size="small"
                onClick={() => {
                  setRenamingId(template.id);
                  setRenameName(templateName(template));
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title={t('commonActions.delete')}>
              <IconButton size="small" onClick={() => handleDelete(template)}>
                <DeleteIcon fontSize="small" color="error" />
              </IconButton>
            </Tooltip>
          </>
        )}

        {renderDefaultButton(template)}
      </Box>
    </Paper>
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {tReports('reportSettings')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {tReports('reportSettingsFor', { page: getReportPageName(reportKey) })}
      </Typography>

      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        {tReports('systemTemplate')}
      </Typography>
      {systemTemplate && (
        <motion.div
          key={systemTemplate.id}
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {renderTemplateRow(systemTemplate)}
        </motion.div>
      )}

      {orgTemplates.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            {tReports('customTemplates')}
          </Typography>
          {orgTemplates.map((template) => (
            <motion.div
              key={template.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, type: 'spring', stiffness: 200, damping: 20 }}
            >
              {renderTemplateRow(template)}
            </motion.div>
          ))}
        </>
      )}
    </Box>
  );
};
