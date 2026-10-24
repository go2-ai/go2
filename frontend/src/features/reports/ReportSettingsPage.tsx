import { useState } from 'react';
import {
  Alert,
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
  Tabs,
  Tab,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import DescriptionIcon from '@mui/icons-material/Description';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTabManager } from '../../components/tabs/useTabManager';
import {
  apiErrorMessage,
  useGetReportTemplatesQuery,
  useGetReportResolutionQuery,
  useUpdateReportTemplateMutation,
  useDeleteReportTemplateMutation,
  useCopyReportTemplateMutation,
  useSetReportDefaultMutation,
  useClearReportDefaultMutation,
  type ReportDefaultScope,
  type ReportTemplateSummary,
} from '../reportTemplates/reportTemplatesApi';
import { hasReportTarget, reportTargetFromParams, reportTargetParams, useOpenReport } from './useOpenReport';
import { localeLabel } from './reportLocales';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/confirmContext';
import { useTabSearchParams } from '../../components/tabs/useTabSearchParams';
import { useTabLoading } from '../../components/tabs/TabLoadingContext';

// Path: report-settings?report_key=journal_entry&record_id=42 (or source=, see ReportTarget)
//
// Templates are listed per language of the organization (its primary
// language first): the system template of that language (or its fallback)
// and the organization's templates written in it. Members who manage the
// report copy, design, rename and delete templates and pick the default for
// everyone; members who print it can pick their own default. Both defaults
// can be in any language.
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
  // What the opening page prints (a record or a list page's source), for Print and the designer's sample.
  const target = reportTargetFromParams(searchParams);
  const language = (i18n.language || 'en').split('-')[0];

  const { data: templates, isLoading: templatesLoading } = useGetReportTemplatesQuery(orgId, { skip: !orgId });
  const { data: resolution, isLoading: resolutionLoading } = useGetReportResolutionQuery(
    { organizationId: orgId, reportKey },
    { skip: !orgId || !reportKey }
  );
  const isLoading = templatesLoading || resolutionLoading;
  useTabLoading(isLoading);

  const [updateTemplate] = useUpdateReportTemplateMutation();
  const [deleteTemplate] = useDeleteReportTemplateMutation();
  const [copyTemplate] = useCopyReportTemplateMutation();
  const [setDefault] = useSetReportDefaultMutation();
  const [clearDefault] = useClearReportDefaultMutation();

  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameName, setRenameName] = useState('');

  const localeOptions = resolution?.locales ?? [];
  // Languages only matter (tabs, badges) when the organization has more than one.
  const hasSeveralLocales = localeOptions.length > 1;
  const primaryLocale = localeOptions[0]?.locale;
  const locale = selectedLocale && localeOptions.some((l) => l.locale === selectedLocale) ? selectedLocale : primaryLocale;
  const localeOption = localeOptions.find((l) => l.locale === locale);

  const reportTemplates = templates?.filter((template) => template.report_key === reportKey) || [];
  const systemTemplate = reportTemplates.find((template) => template.id === localeOption?.system_template_id);
  const isFallback = !!systemTemplate && systemTemplate.locale !== locale;
  const orgTemplates = reportTemplates
    .filter((template) => !template.system && template.locale === locale)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const canManage = resolution?.can_manage ?? false;
  const canPrint = resolution?.can_print ?? false;
  const organizationDefaultId = resolution?.organization_default_template_id ?? null;
  const personalDefaultId = resolution?.personal_default_template_id ?? null;
  // Without an organization default, everyone prints with the system template of the primary language.
  const effectiveOrganizationDefaultId = organizationDefaultId ?? localeOptions[0]?.system_template_id ?? null;

  const templateName = (template: ReportTemplateSummary): string => template.name || tReports('untitled');

  const describeTemplate = (id: number): string => {
    const template = reportTemplates.find((candidate) => candidate.id === id);
    return template ? templateName(template) : tReports('untitled');
  };

  const formatUpdatedAt = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const handlePrint = (template: ReportTemplateSummary) => {
    if (!hasReportTarget(target)) return;
    openReport(reportKey, target, template.id, templateName(template));
  };

  const handleDesign = (template: ReportTemplateSummary) => {
    const params = reportTargetParams(target, new URLSearchParams({ template_id: String(template.id) }));
    const path = `/app/organizations/${orgId}/report-designer?${params.toString()}`;
    openTab('report-designer', `${tReports('design')}: ${templateName(template)}`, path);
    navigate(path);
  };

  // Copies are written in the selected language (e.g. an English fallback
  // copied to translate it into French).
  const handleDuplicate = async (template: ReportTemplateSummary) => {
    try {
      await copyTemplate({ organizationId: orgId, sourceTemplateId: template.id, locale }).unwrap();
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

  const handleToggleDefault = async (template: ReportTemplateSummary, scope: ReportDefaultScope) => {
    const isDefault = scope === 'organization' ? template.id === organizationDefaultId : template.id === personalDefaultId;

    try {
      if (isDefault) {
        await clearDefault({ organizationId: orgId, reportKey, scope }).unwrap();
        showSuccess(tReports('unsetDefaultSuccess'));
      } else {
        await setDefault({ organizationId: orgId, reportKey, templateId: template.id, scope }).unwrap();
        showSuccess(tReports('setDefaultSuccess'));
      }
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
      case 'financial_statement':
        return tReports('financialStatementPage');
      case 'trial_balance':
        return tReports('trialBalancePage');
      case 'financial_ratios':
        return tReports('financialRatiosPage');
      default:
        return key;
    }
  };

  // Only members who manage the report see this action (the chip shows the default to everyone).
  const renderOrganizationDefaultButton = (template: ReportTemplateSummary) => {
    if (!canManage) return null;

    const isDefault = template.id === effectiveOrganizationDefaultId;
    // The implicit default (system template of the primary language) is cleared by picking another one.
    const isImplicit = isDefault && template.id !== organizationDefaultId;
    if (isImplicit) {
      return (
        <Tooltip title={tReports('defaultForEveryone')}>
          <Box sx={{ display: 'inline-flex', p: '5px' }}>
            <StarIcon fontSize="small" color="primary" aria-label={tReports('defaultForEveryone')} />
          </Box>
        </Tooltip>
      );
    }

    const label = isDefault ? tReports('unsetDefaultForEveryone') : tReports('setAsDefaultForEveryone');
    return (
      <Tooltip title={label}>
        <IconButton size="small" onClick={() => handleToggleDefault(template, 'organization')} aria-label={label}>
          {isDefault ? <StarIcon fontSize="small" color="primary" /> : <StarBorderIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    );
  };

  const renderPersonalDefaultButton = (template: ReportTemplateSummary) => {
    if (!canPrint) return null;

    const isDefault = template.id === personalDefaultId;
    const label = isDefault ? tReports('unsetMyDefault') : tReports('setAsMyDefault');
    return (
      <Tooltip title={label}>
        <IconButton size="small" onClick={() => handleToggleDefault(template, 'personal')} aria-label={label}>
          {isDefault ? <BookmarkIcon fontSize="small" color="secondary" /> : <BookmarkBorderIcon fontSize="small" />}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body1" fontWeight={500}>
              {templateName(template)}
            </Typography>
            {hasSeveralLocales && <Chip label={localeLabel(template.locale)} size="small" variant="outlined" />}
            {template.system && <Chip label={tReports('system')} size="small" variant="outlined" />}
            {template.id === effectiveOrganizationDefaultId && (
              <Chip label={tReports('defaultForEveryone')} size="small" color="primary" />
            )}
            {template.id === personalDefaultId && (
              <Chip label={tReports('myDefault')} size="small" color="secondary" />
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
        {hasReportTarget(target) && canPrint && (
          <Tooltip title={t('commonActions.print')}>
            <IconButton size="small" onClick={() => handlePrint(template)} aria-label={t('commonActions.print')}>
              <PrintIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {template.editable && (
          <Tooltip title={tReports('design')}>
            <IconButton size="small" onClick={() => handleDesign(template)} aria-label={tReports('design')}>
              <DesignServicesIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {template.copyable && (
          <Tooltip
            title={
              hasSeveralLocales
                ? tReports('duplicateIn', { language: localeLabel(locale ?? template.locale) })
                : t('commonActions.duplicate')
            }
          >
            <IconButton
              size="small"
              onClick={() => handleDuplicate(template)}
              aria-label={t('commonActions.duplicate')}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {template.editable && (
          <>
            <Tooltip title={t('commonActions.rename')}>
              <IconButton
                size="small"
                aria-label={t('commonActions.rename')}
                onClick={() => {
                  setRenamingId(template.id);
                  setRenameName(templateName(template));
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title={t('commonActions.delete')}>
              <IconButton size="small" onClick={() => handleDelete(template)} aria-label={t('commonActions.delete')}>
                <DeleteIcon fontSize="small" color="error" />
              </IconButton>
            </Tooltip>
          </>
        )}

        {renderPersonalDefaultButton(template)}
        {renderOrganizationDefaultButton(template)}
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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {tReports('reportSettingsFor', { page: getReportPageName(reportKey) })}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {effectiveOrganizationDefaultId && (
          <Chip
            icon={<StarIcon fontSize="small" />}
            color="primary"
            variant="outlined"
            label={`${tReports('defaultForEveryone')}: ${describeTemplate(effectiveOrganizationDefaultId)}`}
          />
        )}
        {personalDefaultId && (
          <Chip
            icon={<BookmarkIcon fontSize="small" />}
            color="secondary"
            variant="outlined"
            label={`${tReports('myDefault')}: ${describeTemplate(personalDefaultId)}`}
          />
        )}
      </Box>

      {hasSeveralLocales && (
        <Tabs
          value={locale ?? false}
          onChange={(_event, value: string) => setSelectedLocale(value)}
          aria-label={tReports('templateLanguage')}
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          {localeOptions.map((option) => (
            <Tab key={option.locale} value={option.locale} label={localeLabel(option.locale)} />
          ))}
        </Tabs>
      )}

      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        {tReports('systemTemplate')}
      </Typography>
      {isFallback && systemTemplate && locale && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {tReports('noSystemTemplateInLanguage', {
            language: localeLabel(locale),
            fallback: localeLabel(systemTemplate.locale),
          })}
        </Alert>
      )}
      {systemTemplate && (
        <motion.div
          key={`${systemTemplate.id}-${locale}`}
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
