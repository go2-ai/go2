// frontend/src/features/versions/components/VersionTimeline.tsx
import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Tooltip,
} from '@mui/material'; // ✅ Added Tooltip
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import {
  Create as CreateIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow, format } from 'date-fns';
import type { Version, VersionChange } from '../types';

interface VersionTimelineProps {
  versions: Version[];
  isLoading?: boolean;
  error?: any;
  onRetry?: () => void;
}

// ✅ Fields to exclude from change display
const EXCLUDED_FIELDS = ['created_at', 'updated_at'];

export const VersionTimeline: React.FC<VersionTimelineProps> = ({
  versions,
  isLoading,
  error,
  onRetry,
}) => {
  const { t } = useTranslation('versions');

  const getEventIcon = (event: string) => {
    switch (event) {
      case 'create':
        return <CreateIcon fontSize="small" />;
      case 'update':
        return <EditIcon fontSize="small" />;
      case 'destroy':
        return <DeleteIcon fontSize="small" />;
      default:
        return <EditIcon fontSize="small" />;
    }
  };

  const getEventColor = (event: string) => {
    switch (event) {
      case 'create':
        return 'success';
      case 'update':
        return 'info';
      case 'destroy':
        return 'error';
      default:
        return 'info';
    }
  };

  const getEventLabel = (event: string) => {
    switch (event) {
      case 'create':
        return t('created');
      case 'update':
        return t('updated');
      case 'destroy':
        return t('deleted');
      default:
        return event;
    }
  };

  // ✅ Format relative time
  const formatRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  // ✅ Format absolute time with timezone for tooltip
  const formatAbsoluteTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      // Get timezone offset in hours
      const offset = -date.getTimezoneOffset() / 60;
      const sign = offset >= 0 ? '+' : '';
      const timezone = `UTC${sign}${offset}`;
      return `${format(date, 'PPpp')} (${timezone})`;
    } catch {
      return dateString;
    }
  };
  // ✅ Helper to format value for display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return ' '; // Empty space for null/undefined
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    return String(value);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          onRetry && (
            <Button color="inherit" size="small" onClick={onRetry}>
              {t('tryAgain')}
            </Button>
          )
        }
      >
        {t('failedToLoad')}
      </Alert>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('noVersionsFound')}
        </Typography>
      </Box>
    );
  }

  // ✅ Filter out excluded fields from changes
  const filterChanges = (changes: VersionChange[]): VersionChange[] => {
    return changes.filter(change => !EXCLUDED_FIELDS.includes(change.field));
  };

  return (
    <Box sx={{ p: 2 }}>
      <Timeline position="right" sx={{ p: 0 }}>
        {versions.map((version, index) => {
          const filteredChanges = filterChanges(version.changes || []);
          const relativeTime = formatRelativeTime(version.created_at);
          const absoluteTime = formatAbsoluteTime(version.created_at);
          
          return (
            <TimelineItem key={version.id}>
              <TimelineOppositeContent color="text.secondary" sx={{ flex: 0.2 }}>
                {/* ✅ Tooltip with absolute time */}
                <Tooltip title={absoluteTime} arrow placement="top">
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      cursor: 'help',
                      '&:hover': { color: 'text.primary' },
                    }}
                  >
                    {relativeTime}
                  </Typography>
                </Tooltip>
              </TimelineOppositeContent>

              <TimelineSeparator>
                <TimelineDot color={getEventColor(version.event) as any}>
                  {getEventIcon(version.event)}
                </TimelineDot>
                {index < versions.length - 1 && <TimelineConnector />}
              </TimelineSeparator>

              <TimelineContent sx={{ flex: 0.8 }}>
                <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body2" fontWeight="medium">
                      {version.user_display}
                    </Typography>
                    <Chip
                      label={getEventLabel(version.event)}
                      size="small"
                      color={getEventColor(version.event) as any}
                    />
                  </Box>

                  {/* Show changes for both create and update events */}
                  {filteredChanges.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      {filteredChanges.map((change: VersionChange) => {
                        const fromValue = formatValue(change.from);
                        const toValue = formatValue(change.to);
                        
                        return (
                          <Box
                            key={change.field}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              py: 0.5,
                              fontSize: '0.875rem',
                              flexWrap: 'wrap',
                            }}
                          >
                            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                              {change.field_label}:
                            </Typography>
                            {version.event === 'create' ? (
                              // For create events, show "→ value" without "from"
                              <Typography variant="body2" sx={{ color: 'success.main' }}>
                                {toValue}
                              </Typography>
                            ) : (
                              // For update events, show old → new
                              <>
                                <Typography
                                  variant="body2"
                                  sx={{ textDecoration: 'line-through', color: 'error.main' }}
                                >
                                  {fromValue}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  →
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'success.main' }}>
                                  {toValue}
                                </Typography>
                              </>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  )}

                  {version.event === 'destroy' && version.object_data && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('deletedData')}:
                      </Typography>
                      <Box
                        component="pre"
                        sx={{
                          p: 1,
                          mt: 0.5,
                          bgcolor: 'background.default',
                          borderRadius: 1,
                          fontSize: '0.75rem',
                          overflow: 'auto',
                          maxHeight: 100,
                        }}
                      >
                        {JSON.stringify(version.object_data, null, 2)}
                      </Box>
                    </Box>
                  )}
                </Paper>
              </TimelineContent>
            </TimelineItem>
          );
        })}
      </Timeline>
    </Box>
  );
};