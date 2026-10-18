import { useState } from 'react';
import { Button, Menu, MenuItem, Divider, Box, IconButton, Typography } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  findDefaultTemplate,
  useGetReportTemplatesQuery,
  type ReportTemplateSummary,
} from '../../reportTemplates/reportTemplatesApi';
import { useOpenReport } from '../useOpenReport';
import { useTabManager } from '../../../components/tabs/useTabManager';

interface ReportSplitButtonProps {
  reportKey: string;
  /** Id of the record to print, e.g. the journal entry id. */
  recordId: number;
  reportTitle: string;
}

export const ReportSplitButton = ({ reportKey, recordId, reportTitle }: ReportSplitButtonProps) => {
  const { t } = useTranslation('shared');
  const { t: treports } = useTranslation('reports');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const navigate = useNavigate();
  const { openTab } = useTabManager();
  const { openReport } = useOpenReport();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const { data: templates } = useGetReportTemplatesQuery(orgId, { skip: !orgId });

  const reportTemplates = templates?.filter((t) => t.report_key === reportKey) || [];
  const defaultTemplate = findDefaultTemplate(reportTemplates, reportKey);

  // Templates to show in menu = all except the default
  const menuTemplates = reportTemplates.filter((t) => t.id !== defaultTemplate?.id);

  const templateName = (template: ReportTemplateSummary) => template.name || treports('untitled');

  const handleMenuClose = () => setAnchorEl(null);

  const handlePrintDefault = () => {
    if (defaultTemplate) {
      openReport(reportKey, recordId, reportTitle, defaultTemplate.id);
    }
  };

  const handlePrintTemplate = (templateId: number) => {
    handleMenuClose();
    openReport(reportKey, recordId, reportTitle, templateId);
  };

  const handleOpenSettings = () => {
    handleMenuClose();
    const params = new URLSearchParams({ report_key: reportKey, record_id: String(recordId) });
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
          disabled={!defaultTemplate}
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
