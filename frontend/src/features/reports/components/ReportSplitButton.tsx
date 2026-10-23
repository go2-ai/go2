import { useState } from 'react';
import { Button, Menu, MenuItem, Divider, Box, IconButton, Typography } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useGetReportResolutionQuery,
  useGetReportTemplatesQuery,
  type ReportTemplateSummary,
} from '../../reportTemplates/reportTemplatesApi';
import { reportTargetParams, useOpenReport, type ReportTarget } from '../useOpenReport';
import { useTabManager } from '../../../components/tabs/useTabManager';

interface ReportSplitButtonProps {
  reportKey: string;
  /** Id of the record to print, e.g. the journal entry id. */
  recordId?: number;
  /** For list pages: what the page shows, as a query string (see ReportTarget). */
  source?: string;
  reportTitle: string;
  disabled?: boolean;
}

/**
 * Print prints with the default template (the member's own default, else the
 * organization's, else the system template in the organization's language).
 * The menu lists the other templates in the organization's primary language;
 * other languages are in the report settings.
 */
export const ReportSplitButton = ({ reportKey, recordId, source, reportTitle, disabled = false }: ReportSplitButtonProps) => {
  const { t } = useTranslation('shared');
  const { t: treports } = useTranslation('reports');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const navigate = useNavigate();
  const { openTab } = useTabManager();
  const { openReport } = useOpenReport();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const { data: resolution } = useGetReportResolutionQuery(
    { organizationId: orgId, reportKey },
    { skip: !orgId }
  );
  const { data: templates } = useGetReportTemplatesQuery(orgId, { skip: !orgId });

  const defaultTemplateId = resolution?.default_template_id ?? null;
  const primary = resolution?.locales[0];

  // Templates in the primary language; the system one may be a fallback (e.g. English).
  const menuTemplates = (templates ?? []).filter(
    (template) =>
      template.report_key === reportKey &&
      template.id !== defaultTemplateId &&
      (template.system ? template.id === primary?.system_template_id : template.locale === primary?.locale)
  );

  const templateName = (template: ReportTemplateSummary) => template.name || treports('untitled');

  const handleMenuClose = () => setAnchorEl(null);

  const target: ReportTarget = { recordId, source };

  const handlePrintDefault = () => {
    if (defaultTemplateId) openReport(reportKey, target, defaultTemplateId, reportTitle);
  };

  const handlePrintTemplate = (templateId: number) => {
    handleMenuClose();
    openReport(reportKey, target, templateId, reportTitle);
  };

  const handleOpenSettings = () => {
    handleMenuClose();
    const params = reportTargetParams(target, new URLSearchParams({ report_key: reportKey }));
    const path = `/app/organizations/${orgId}/report-settings?${params.toString()}`;
    openTab('report-settings', treports('reportSettings'), path);
    navigate(path);
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Button
          onClick={handlePrintDefault}
          size="small"
          disabled={disabled || !defaultTemplateId}
          startIcon={<PrintIcon fontSize="small" />}
        >
          {t('commonActions.print')}
        </Button>
        <IconButton
          size="small"
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{ ml: -0.5 }}
          aria-label={treports('reportSettings')}
          aria-haspopup="menu"
        >
          <ArrowDropDownIcon fontSize="small" />
        </IconButton>
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        {menuTemplates.map((template) => (
          <MenuItem key={template.id} onClick={() => handlePrintTemplate(template.id)}>
            <Typography variant="body2">
              {templateName(template)}
              {template.system && (
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  ({treports('system')})
                </Typography>
              )}
            </Typography>
          </MenuItem>
        ))}

        {menuTemplates.length > 0 && <Divider />}

        <MenuItem onClick={handleOpenSettings}>
          <Typography component="span" variant="body2">
            {treports('reportSettings')}
          </Typography>
        </MenuItem>
      </Menu>
    </>
  );
};
