import { Box, Tooltip, Typography } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface RowHeaderProps {
  rowIndex: number;
  hasError: boolean;
  errorMessage?: string | null;
  isSelected?: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  dragHandleProps?: any;
}

export const RowHeader = ({
  rowIndex,
  hasError,
  errorMessage,
  isSelected,
  onContextMenu,
  onMouseDown,
  dragHandleProps,
}: RowHeaderProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: '100%',
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: isSelected ? 'action.selected' : 'transparent',
        transition: 'background-color 0.15s ease',
        position: 'relative',
        flexShrink: 0,
        userSelect: 'none',
      }}
      onContextMenu={onContextMenu}
      onMouseDown={onMouseDown}
    >
      {/* Left accent bar for active/selected row */}
      {isSelected && (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: '0 4px 4px 0',
            bgcolor: 'primary.main',
          }}
        />
      )}

      <Box
        {...dragHandleProps}
        sx={{
          cursor: 'grab',
          color: 'action.active',
          transition: 'opacity 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          zIndex: 1,
          '&:active': { cursor: 'grabbing' },
        }}
      >
        <DragIndicatorIcon sx={{ fontSize: 16 }} />
      </Box>

        <Tooltip title={errorMessage || 'This row has errors'} arrow>
          <ErrorOutlineIcon
            color="error"
            sx={{
              fontSize: 16,
              zIndex: 1,
              mt: 0.25,
              visibility: hasError ? 'visible' : 'hidden'
            }}
          />
        </Tooltip>
    </Box>
  );
};