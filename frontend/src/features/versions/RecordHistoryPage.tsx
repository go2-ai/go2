
import React, { useEffect, useMemo, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useGetRecordVersionsQuery } from './versionsApi';
import { VersionTimeline } from './components/VersionTimeline';
import { useTabManager } from '../../components/tabs/useTabManager';
import { useCurrentTabId } from '../../components/tabs/TabIdContext';
import { useParams } from 'react-router-dom';

export const RecordHistoryPage: React.FC = () => {
  const { t } = useTranslation('versions');
  const { organizationId } = useParams<{ organizationId: string }>();
  const { layout, updateTabTitle } = useTabManager();
  const tabId = useCurrentTabId();
  const titleUpdatedRef = useRef(false);

  const orgId = parseInt(organizationId || '0', 10);
  const { recordType, recordId } = useMemo(() => {
    const tab = layout.panels
      .flatMap((p) => p.tabs)
      .find((t) => t.id === tabId);

    if (!tab?.path) return { recordType: '', recordId: 0 };

    const url = new URL(tab.path, window.location.origin);
    return {
      recordType: url.searchParams.get('type') || '',
      recordId: parseInt(url.searchParams.get('id') || '0', 10),
    };
  }, [layout, tabId]);

  const { data: versions, isLoading, error, refetch } = useGetRecordVersionsQuery(
    { organizationId: orgId, recordType, recordId },
    { skip: !recordType || !recordId, refetchOnMountOrArgChange: true }
  );

  useEffect(() => {
    if (versions && versions.length > 0 && !titleUpdatedRef.current && tabId) {
      const displayName = versions[0]?.record_display_name || `${recordType} #${recordId}`;
      updateTabTitle(tabId, `History (${displayName})`);
      titleUpdatedRef.current = true;
    }
  }, [versions, recordType, recordId, tabId, updateTabTitle]);

  const getRecordName = (): string => {
    if (!versions || versions.length === 0) {
      return `${recordType} #${recordId}`;
    }
    return versions[0]?.record_display_name || `${recordType} #${recordId}`;
  };

  const recordName = getRecordName();

  return (
    
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}> 
      <Box
        sx={{
          flexShrink: 0,
          p: 3,
          pb: 2,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          {t('history')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('historyDescription', { type: recordType, name: recordName })}
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
        }}
      >
        <VersionTimeline
          versions={versions || []}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
        />
      </Box>
    </Box>
  );
};