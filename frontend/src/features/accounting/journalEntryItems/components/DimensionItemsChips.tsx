import { Box, Chip, Tooltip, alpha } from '@mui/material';

interface DimensionItem {
  code: string;
  name: string;
}

const chipSx = {
  height: 22,
  fontSize: 12,
  fontWeight: 600,
  bgcolor: (theme: any) => alpha(theme.palette.primary.main, 0.1),
  color: 'primary.main',
} as const;

// Renders up to 3 "code | name" chips for the given items. If there are more,
// shows a "+n" chip whose tooltip lists every selected item.
export const DimensionItemsChips = ({ items }: { items: DimensionItem[] }) => {
  if (!items.length) return null;

  const visible = items.slice(0, 3);
  const overflow = items.slice(3);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
      {visible.map((item, i) => (
        <Chip key={i} size="small" label={`${item.code} | ${item.name}`} sx={chipSx} />
      ))}
      {overflow.length > 0 && (
        <Tooltip
          title={
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, py: 0.25 }}>
              {items.map((item, i) => (
                <Box key={i} sx={{ fontSize: 12 }}>
                  {item.code} | {item.name}
                </Box>
              ))}
            </Box>
          }
        >
          <Chip size="small" label={`+${overflow.length}`} sx={chipSx} />
        </Tooltip>
      )}
    </Box>
  );
};