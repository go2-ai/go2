import { Box, Typography } from '@mui/material';

interface FooterStatProps {
  label: string;
  value: string;
  highlight?: boolean;
}

// A single "label above value" block used in the totals footer of both the
// Explorer and Journal Entry Items pages.
export const FooterStat = ({ label, value, highlight }: FooterStatProps) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 130 }}>
    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>
      {label}
    </Typography>
    <Typography
      variant="body2"
      sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: highlight ? 700 : 500 }}
    >
      {value}
    </Typography>
  </Box>
);