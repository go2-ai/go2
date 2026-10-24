import { useState } from 'react';
import { Button, Stack } from '@mui/material';
import GridOnIcon from '@mui/icons-material/GridOn';
import { useTranslation } from 'react-i18next';
import { ReportSplitButton } from '../../reports/components/ReportSplitButton';
import { downloadExcel, type SheetOptions } from '../../../utils/spreadsheet';
import { useToast } from '../../../contexts/ToastContext';
import { PRINT_KEYS, printSource } from '../reportingApi';
import type { ReportSummary } from '../types';

interface Props {
  report: ReportSummary;
  /** The run params on screen: the print shows the same figures. */
  params: object;
  /** The figures on screen as one sheet (a data export, not the print layout). */
  sheet: () => SheetOptions | null;
}

/** Print / PDF through the report's print template, and a data-only Excel export. */
export const ReportExportBar = ({ report, params, sheet }: Props) => {
  const { t, i18n } = useTranslation('reporting');
  const { showError } = useToast();
  const [exporting, setExporting] = useState(false);
  const reportKey = PRINT_KEYS[report.report_type];

  const exportExcel = async () => {
    const options = sheet();
    if (!options) return;
    setExporting(true);
    try {
      await downloadExcel({ ...options, rtl: i18n.dir() === 'rtl' });
    } catch {
      showError(t('export.failed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Stack direction="row" spacing={1}>
      <Button size="small" variant="outlined" startIcon={<GridOnIcon />} onClick={exportExcel} disabled={exporting}>
        {t('export.excel')}
      </Button>
      {reportKey && <ReportSplitButton reportKey={reportKey} recordId={report.id} source={printSource(params)} reportTitle={report.name} />}
    </Stack>
  );
};
