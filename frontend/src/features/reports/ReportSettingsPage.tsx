import { useMemo, useState } from 'react';
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
import { useCurrentTabId } from '../../components/tabs/TabIdContext';
import {
  useGetReportTemplatesQuery,
  useUpdateReportTemplateMutation,
  useDeleteReportTemplateMutation,
  useCreateReportTemplateMutation,
  type ReportTemplate,
} from '../reportTemplates/reportTemplatesApi';
import { useOpenReport } from './useOpenReport';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/confirmContext';
import { getReportData } from './reportDataStore';

export const ReportSettingsPage = () => {
  const { t } = useTranslation('shared');
  const { t: tReports } = useTranslation('reports');
  const { i18n } = useTranslation();
  const { organizationId } = useParams<{ organizationId: string }>();
  const { layout } = useTabManager();
  const tabId = useCurrentTabId();
  const { openReport } = useOpenReport();
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { openTab } = useTabManager();

  const orgId = parseInt(organizationId || '0', 10);

  const { reportKey, reportData } = useMemo(() => {
    const tab = layout.panels
      .flatMap((p) => p.tabs)
      .find((tab) => tab.id === tabId);

    if (!tab?.path) return { reportKey: '', reportData: {} };

    const url = new URL(tab.path, window.location.origin);
    const dataKey = url.searchParams.get('data_key') || '';
    return {
      reportKey: url.searchParams.get('report_key') || '',
      reportData: dataKey ? getReportData(dataKey) || {} : {},
    };
  }, [layout, tabId]);

  const { data: templates, isLoading, refetch } = useGetReportTemplatesQuery(orgId, {
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
  const orgTemplates = reportTemplates
    .filter((t) => !t.system)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const hasOrgDefault = orgTemplates.some((t) => t.is_default);

  const getLocalizedName = (template: ReportTemplate): string => {
    const name = template.name;
    if (typeof name === 'string') return name;
    if (name && typeof name === 'object') {
      return name[i18n.language] || name || Object.values(name)[0] || 'Untitled';
    }
    return 'Untitled';
  };

  const isEffectivelyDefault = (template: ReportTemplate): boolean => {
    if (template.system) {
      return !hasOrgDefault;
    }
    return template.is_default;
  };

  const formatUpdatedAt = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const handlePrint = (template: ReportTemplate) => {
    openReport(reportKey, reportData, getLocalizedName(template), template.id);
  };

  const handleDesign = (template: ReportTemplate) => {
    const path = `/app/organizations/${orgId}/report-designer?template_id=${template.id}`;
    openTab('report-designer', `Design: ${getLocalizedName(template)}`, path);
    navigate(path);
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
      refetch();
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
      refetch();
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tReports('renameFailed'));
    }
  };

  const handleDelete = async (template: ReportTemplate) => {
    const confirmed = await confirm({
      title: tReports('deleteTemplateTitle'),
      message: tReports('deleteTemplateMessage', {
        name: getLocalizedName(template),
      }),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });

    if (!confirmed) return;

    try {
      await deleteTemplate({
        organizationId: orgId,
        id: template.id,
      }).unwrap();
      showSuccess(tReports('deleteSuccess'));
      refetch();
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tReports('deleteFailed'));
    }
  };

  const handleToggleDefault = async (template: ReportTemplate) => {
    const newIsDefault = !template.is_default;

    try {
      await updateTemplate({
        organizationId: orgId,
        id: template.id,
        data: { is_default: newIsDefault },
      }).unwrap();

      showSuccess(
        newIsDefault
          ? tReports('setDefaultSuccess')
          : tReports('unsetDefaultSuccess')
      );

      refetch();
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tReports('setDefaultFailed'));
    }
  };

  const getReportPageName = (reportKey: string): string => {
    switch (reportKey) {
      case 'journal_entry':
        return tReports('journalEntryPage');
      case 'explorer':
        return tReports('explorerPage');
      case 'journal_entry_items':
        return tReports('journalEntryItemsPage');
      default:
        return reportKey;
    }
  };

  const renderTemplateRow = (template: ReportTemplate) => (
    <Paper
      key={template.id}
      variant="outlined"
      sx={{
        p: 2,
        mb: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
      }}
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRename(template);
              } else if (e.key === 'Escape') {
                setRenamingId(null);
                setRenameName('');
              }
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              size="small"
              onClick={() => {
                setRenamingId(null);
                setRenameName('');
              }}
            >
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
              {getLocalizedName(template)}
            </Typography>
            {template.system && (
              <Chip label={tReports('system')} size="small" variant="outlined" />
            )}
            {isEffectivelyDefault(template) && (
              <Chip label={tReports('default')} size="small" color="primary" />
            )}
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
        <Tooltip title={t('commonActions.print')}>
          <IconButton size="small" onClick={() => handlePrint(template)}>
            <PrintIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {!template.system && (
          <Tooltip title={tReports('design')}>
            <IconButton size="small" onClick={() => handleDesign(template)}>
              <DesignServicesIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

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
              <IconButton size="small" onClick={() => handleDelete(template)}>
                <DeleteIcon fontSize="small" color="error" />
              </IconButton>
            </Tooltip>
          </>
        )}

        <Tooltip
          title={
            isEffectivelyDefault(template)
              ? tReports('unsetDefault')
              : tReports('setAsDefault')
          }
        >
          <IconButton size="small" onClick={() => handleToggleDefault(template)}>
            {isEffectivelyDefault(template) ? (
              <StarIcon fontSize="small" color="primary" />
            ) : (
              <StarBorderIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
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
              transition={{
                duration: 0.3,
                type: 'spring',
                stiffness: 200,
                damping: 20,
              }}
            >
              {renderTemplateRow(template)}
            </motion.div>
          ))}
        </>
      )}
    </Box>
  );
};