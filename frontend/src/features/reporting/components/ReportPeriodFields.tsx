import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { BaseDatePicker } from '../../../components/shared/BaseDatePicker';

interface Props {
  from: string | null;
  to: string | null;
  onFromChange: (value: string | null) => void;
  onToChange: (value: string | null) => void;
  /** Width of each picker, in pixels. */
  width?: number;
}

/** The "from" and "to" pickers of a report's period. */
export const ReportPeriodFields = ({ from, to, onFromChange, onToChange, width = 180 }: Props) => {
  const { t } = useTranslation('reporting');
  return (
    <>
      <Box sx={{ width }}>
        <BaseDatePicker label={t('viewer.from')} value={from} onChange={onFromChange} size="small" fullWidth />
      </Box>
      <Box sx={{ width }}>
        <BaseDatePicker label={t('viewer.to')} value={to} onChange={onToChange} size="small" fullWidth />
      </Box>
    </>
  );
};
