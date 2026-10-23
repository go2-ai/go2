import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../contexts/ToastContext';
import { exportGridToExcel, type ExportGridToExcelOptions } from '../../../utils/exportGridToExcel';

/** Exports a grid to Excel in the UI's direction; failures show a toast. */
export const useExcelExport = () => {
  const { t: tAccounting, i18n } = useTranslation('accounting');
  const { showError } = useToast();

  return useCallback(
    async (options: Omit<ExportGridToExcelOptions, 'rtl'>) => {
      try {
        await exportGridToExcel({ ...options, rtl: i18n.dir() === 'rtl' });
      } catch {
        showError(tAccounting('explorer.exportFailed'));
      }
    },
    [i18n, showError, tAccounting]
  );
};
