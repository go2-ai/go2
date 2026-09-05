import { useState, useMemo } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  Divider,
  Box,
  IconButton,
  Typography,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SettingsIcon from '@mui/icons-material/Settings';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useGetReportTemplatesQuery } from '../../reportTemplates/reportTemplatesApi';
import { useOpenReport } from './../useOpenReport';
import { useTabManager } from '../../../components/tabs/useTabManager';
import { setReportData } from './../reportDataStore';

interface ReportSplitButtonProps {
  reportKey: string;
  reportData: Record<string, any>;
  reportTitle: string;
}

export const ReportSplitButton = ({
  reportKey,
  reportData,
  reportTitle,
}: ReportSplitButtonProps) => {
  const { t } = useTranslation('shared');
  const { t: treports } = useTranslation('reports');
  const { i18n } = useTranslation();
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const navigate = useNavigate();
  const { openTab } = useTabManager();
  const { openReport } = useOpenReport();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const { data: templates } = useGetReportTemplatesQuery(orgId, {
    skip: !orgId,
  });

  const reportTemplates =
    templates?.filter((t) => t.report_key === reportKey) || [];

  const systemTemplate = reportTemplates.find((t) => t.system);
  const orgTemplates = reportTemplates.filter((t) => !t.system);

  const defaultOrgTemplate = orgTemplates.find((t) => t.is_default);
  const defaultTemplate = defaultOrgTemplate || systemTemplate;

  // Templates to show in menu = all except the default
  const menuTemplates = reportTemplates.filter(
    (t) => t.id !== defaultTemplate?.id
  );

  const getLocalizedName = (template: any): string => {
    const name = template.name;
    if (typeof name === 'string') return name;
    if (name && typeof name === 'object') {
      return name[i18n.language] || name.en || Object.values(name)[0] || 'Untitled';
    }
    return 'Untitled';
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handlePrintDefault = () => {
    if (defaultTemplate) {
      openReport(reportKey, reportData, reportTitle, defaultTemplate.id);
    }
  };

  const handlePrintTemplate = (templateId: number) => {
    handleMenuClose();
    openReport(reportKey, reportData, reportTitle, templateId);
  };

  const handleOpenSettings = () => {
    handleMenuClose();
    const dataKey = `report_settings_${Date.now()}`;
    setReportData(dataKey, reportData);
    const path = `/app/organizations/${orgId}/report-settings?report_key=${reportKey}&data_key=${dataKey}`;
    openTab('report-settings', treports('reportSettings'), path);
    navigate(path);
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Button
          onClick={handlePrintDefault}
          size="small"
          startIcon={<PrintIcon fontSize="small" />}
        >
          {t('commonActions.print')}
        </Button>
        <IconButton size="small" onClick={handleMenuOpen} sx={{ ml: -0.5 }}>
          <ArrowDropDownIcon fontSize="small" />
        </IconButton>
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        {menuTemplates.map((template) => (
          <MenuItem
            key={template.id}
            onClick={() => handlePrintTemplate(template.id)}
          >
            <Typography variant="body2">
              {getLocalizedName(template)}
              {template.system && (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  ({treports('system')})
                </Typography>
              )}
            </Typography>
          </MenuItem>
        ))}

        {menuTemplates.length > 0 && <Divider />}

        <MenuItem onClick={handleOpenSettings}>
          <Typography
            component="span"
            variant="body2"
          >
            {treports('reportSettings')}
          </Typography>
        </MenuItem>
      </Menu>
    </>
  );
};