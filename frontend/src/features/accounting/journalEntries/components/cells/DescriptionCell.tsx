// frontend/src/features/accounting/journalEntries/components/cells/DescriptionCell.tsx
import { Box } from '@mui/material';
import MultiLocaleInput from '../../../../../components/shared/MultiLocaleInput';
import { useTranslatableLocales } from '../../../../../hooks/useTranslatableLocales';

interface DescriptionCellProps {
  value: Record<string, string>;
  organizationId: number;
  onChange: (value: Record<string, string>) => void;
  disabled?: boolean;
}

export const DescriptionCell = ({ value, organizationId, onChange, disabled }: DescriptionCellProps) => {
  const { primaryLocale, nonPrimaryLocales, isReady } = useTranslatableLocales({ organizationId });

  if (!isReady) return null;

  return (
    <Box sx={{ height: '100%', width: '100%', px: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
      <MultiLocaleInput
        field="description"
        locale={primaryLocale}
        otherLocales={nonPrimaryLocales}
        value={value}
        onChange={onChange}
        disabled={disabled}
        dense
        fullWidth
        placeholder=""
      />
    </Box>
  );
};