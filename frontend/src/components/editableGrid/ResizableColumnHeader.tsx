import { Box, useTheme } from '@mui/material';

interface ResizableColumnHeaderProps {
  title: string;
  width: number;
  onResize: (newWidth: number) => void;
  align?: 'left' | 'right' | 'center';
}

export const ResizableColumnHeader = ({ title, width, onResize, align }: ResizableColumnHeaderProps) => {
  const theme = useTheme();
  const isRtl = theme.direction === 'rtl';

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const rawDelta = moveEvent.clientX - startX;
      // stylis-plugin-rtl mirrors our authored `right: -2` to `left: -2` in
      // the DOM for RTL locales, so the handle visually ends up on the
      // column's left edge (the border shared with the next column) when
      // isRtl. JS mouse coordinates aren't touched by that CSS mirroring,
      // so we still need to invert the delta ourselves for that case.
      const delta = isRtl ? -rawDelta : rawDelta;
      const newWidth = Math.max(60, startWidth + delta);
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        position: 'relative',
        px: 0.75,
        userSelect: 'none',
      }}
    >
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
          textAlign: align === 'right' ? 'right' : align === 'center' ? 'center' : 'left',
          fontSize: '0.8125rem',
          fontWeight: 600,
        }}
      >
        {title}
      </span>
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          position: 'absolute',
          // Always author as LTR — stylis-plugin-rtl mirrors this to `left`
          // automatically when rendered under rtlCache. Do NOT swap this
          // manually based on isRtl; that caused a double-mirror that
          // silently canceled itself out.
          right: -2,
          top: 0,
          bottom: 0,
          width: 4,
          cursor: 'col-resize',
          '&:hover': {
            backgroundColor: 'primary.main',
            opacity: 0.5,
          },
        }}
      />
    </Box>
  );
};