// src/components/tabs/SortableTab.tsx

import type { Tab } from './types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CloseIcon from '@mui/icons-material/Close';
import PushPinIcon from '@mui/icons-material/PushPin';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import MuiTab, { type TabProps } from '@mui/material/Tab';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';

interface SortableTabProps extends TabProps {
  tab: Tab;
  onClose: (id: string) => void;
  value: string;
  isActive?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function SortableTab({
  tab,
  onClose,
  isActive,
  ...rest
}: SortableTabProps) {
  const [isHovered, setIsHovered] = useState(false);
  const theme = useTheme();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id, disabled: tab.pinned });

  const showCloseButton = !tab.pinned && (isActive || isHovered);

  const primaryColor = theme.palette.primary.main;
  const activeBackground = `${primaryColor}00`;
  const inactiveBackground =
    theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.03)'
      : 'rgba(0, 0, 0, 0.02)';

  return (
    <MuiTab
      ref={setNodeRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={rest.onContextMenu}
      label={
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            position: 'relative',
            zIndex: 2,
          }}
        >
          {tab.pinned && (
            <PushPinIcon
              sx={{
                fontSize: 11,
                color: isActive ? 'primary.main' : 'text.secondary',
                marginRight: '2px',
              }}
            />
          )}
          <span
            style={{
              maxWidth: 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
            }}
          >
            {tab.title}
          </span>
          {!tab.pinned && (
            <IconButton
              component="span"
              role="button"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              sx={{
                p: '2px',
                ml: 0.5,
                opacity: showCloseButton ? 0.7 : 0,
                visibility: showCloseButton ? 'visible' : 'hidden',
                color: isActive ? 'primary.light' : 'text.secondary',
                borderRadius: '50%',
                '&:hover': {
                  opacity: 1,
                  backgroundColor: 'action.hover',
                  color: 'text.primary',
                },
                transition: 'all 0.15s ease-in-out',
              }}
              aria-label={`Close ${tab.title}`}
            >
              <CloseIcon sx={{ fontSize: 13 }} />
            </IconButton>
          )}
        </Box>
      }
      sx={{
        minHeight: 32,
        height: 32,
        py: 0,
        px: 1.5,
        minWidth: 100,
        maxWidth: 220,
        transform: CSS.Transform.toString(transform),
        transition: transition || 'all 0.15s ease-in-out',
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'pointer',
        zIndex: isDragging ? 10 : isActive ? 3 : isHovered ? 2 : 1,
        fontSize: '0.8125rem',
        position: 'relative',
        marginLeft: '-4px',
        marginRight: 0,
        borderRadius: '6px 6px 0 0',
        background: isActive
          ? activeBackground
          : isHovered
            ? theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(0, 0, 0, 0.03)'
            : inactiveBackground,
        backdropFilter: 'blur(8px)',
        border: '1px solid',
        borderColor: isActive
          ? `${primaryColor}30`
          : theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.08)',
        borderBottom: 'none',
        '&:first-of-type': {
          marginLeft: 0,
        },
        '&.Mui-selected': {
          fontWeight: 600,
          color: 'primary.light',
          boxShadow: isActive ? `0 -1px 3px ${primaryColor}20` : 'none',
        },
        '&:not(.Mui-selected)': {
          color: 'text.secondary',
          '&:hover': {
            color: 'text.primary',
          },
        },
      }}
      {...attributes}
      {...listeners}
      {...rest}
    />
  );
}