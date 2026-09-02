import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Alert,
  Button,
  Avatar,
  TextField,
  InputAdornment,
  Chip,
  Stack,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Fade,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useTranslation } from 'react-i18next';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useTabManager } from '../../components/tabs/useTabManager';
import { useCurrentTabId } from '../../components/tabs/TabIdContext';
import {
  useGetDocumentsQuery,
  useDeleteDocumentMutation,
  type Document,
} from './documentsApi';
import { formatFileSize } from './formatFileSize';
import { getFileTypeConfig } from './fileTypeConfig';
import { DocumentUploader } from './components/DocumentUploader';
import { useDocumentUpload } from './hooks/useDocumentUpload';

export const DocumentsPage = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { t } = useTranslation('documents');
  const { layout } = useTabManager();
  const tabId = useCurrentTabId();

  const orgId = parseInt(organizationId || '0', 10);

  const { documentableType, documentableId } = useMemo(() => {
    const tab = layout.panels
      .flatMap((p) => p.tabs)
      .find((tab) => tab.id === tabId);

    if (!tab?.path) return { documentableType: '', documentableId: 0 };

    const url = new URL(tab.path, window.location.origin);
    return {
      documentableType: url.searchParams.get('type') || '',
      documentableId: parseInt(url.searchParams.get('id') || '0', 10),
    };
  }, [layout, tabId]);

  const {
    data: documents,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetDocumentsQuery(
    { organizationId: orgId, documentableType, documentableId },
    {
      skip: !orgId || !documentableType || !documentableId,
      refetchOnMountOrArgChange: true,
    }
  );

  const [deleteDocument] = useDeleteDocumentMutation();
  const { uploadFiles: uploadFilesFromDrop } = useDocumentUpload({
    organizationId: orgId,
    documentableType,
    documentableId,
  });

  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set(),
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const selectedIds = useMemo(
    () => Array.from(selectionModel.ids) as number[],
    [selectionModel]
  );
  const selectedCount = selectedIds.length;

  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    if (!searchTerm.trim()) return documents;
    const term = searchTerm.toLowerCase();
    return documents.filter((doc) => doc.name.toLowerCase().includes(term));
  }, [documents, searchTerm]);

  const handleDownload = (document: Document) => {
    window.open(document.url, '_blank');
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteDocument({ organizationId: orgId, id: pendingDelete.id }).unwrap();
      if (selectedDocument?.id === pendingDelete.id) {
        setSelectedDocument(null);
      }
      setSelectionModel((prev) => ({
        ...prev,
        ids: new Set(
          Array.from(prev.ids).filter((id) => id !== pendingDelete.id)
        ),
      }));
    } catch (err) {
      console.error('Failed to delete document:', err);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const handleDownloadZip = async () => {
    if (selectedIds.length === 0) return;

    setDownloadingZip(true);
    try {
      const csrfToken = document.querySelector<HTMLMetaElement>(
        'meta[name="csrf-token"]'
      )?.content;

      const response = await fetch(`/organizations/${orgId}/documents/zip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        body: JSON.stringify({ document_ids: selectedIds }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('ZIP download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'documents.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download ZIP:', err);
    } finally {
      setDownloadingZip(false);
    }
  };

  const handlePageDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  };

  const handlePageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handlePageDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  };

  const handlePageDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) {
      await uploadFilesFromDrop(e.dataTransfer.files);
    }
  };

  const columns: GridColDef<Document>[] = [
    {
      field: 'name',
      headerName: t('name'),
      flex: 1,
      minWidth: 220,
      sortable: true,
      renderCell: (params) => {
        const { icon: Icon, color, bgColor } = getFileTypeConfig(params.row.content_type);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, height: '100%' }}>
            <Avatar
              variant="rounded"
              sx={{ width: 34, height: 34, bgcolor: bgColor, color }}
            >
              <Icon fontSize="small" />
            </Avatar>
            <Typography variant="body2" fontWeight={500} noWrap>
              {params.row.name}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'size',
      headerName: t('size'),
      width: 100,
      sortable: true,
      renderCell: (params) => formatFileSize(params.row.size),
      
    },
    {
      field: 'uploaded_by',
      headerName: t('uploadedBy'),
      width: 160,
      sortable: true,
      renderCell: (params) => (params.row.uploaded_by || '—'),
    },
    {
      field: 'created_at',
      headerName: t('uploadedAt'),
      width: 140,
      sortable: true,
      renderCell: (params) => (formatDistanceToNow(new Date(params.row.created_at), { addSuffix: true })),
    },
    {
      field: 'actions',
      headerName: '',
      width: 96,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5, height: '100%', alignItems: 'center' }}>
          <Tooltip title={t('download')}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(params.row);
              }}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('delete')}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setPendingDelete(params.row);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          variant="outlined"
          action={
            <Button color="inherit" onClick={refetch}>
              {t('retry')}
            </Button>
          }
        >
          {t('failedToLoad')}
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{ height: '100%', overflow: 'hidden', p: 2, bgcolor: 'background.default', position: 'relative' }}
      onDragEnter={handlePageDragEnter}
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
    >
      <Fade in={isDragOver} unmountOnExit>
        <Box
          sx={{
            position: 'absolute',
            inset: 8,
            zIndex: 1300,
            bgcolor: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(2px)',
            border: '2px dashed',
            borderColor: 'primary.main',
            borderRadius: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            pointerEvents: 'none',
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 56, color: 'primary.main' }} />
          <Typography variant="h6" color="primary.main" fontWeight={600}>
            {t('dropToUpload', 'Drop files to upload')}
          </Typography>
        </Box>
      </Fade>

      <Group orientation="horizontal" id="documents-layout">
        <Panel defaultSize="65" minSize="30" maxSize="80">
          <Paper
            variant="outlined"
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                px: 3,
                py: 2.5,
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Typography variant="h4" component="h1" gutterBottom>
                  {t('documents')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('manageAttachedFiles', 'Manage files attached to this record')} · {documents?.length || 0} {t('files')}
                </Typography>
              </Box>

              <DocumentUploader
                organizationId={orgId}
                documentableType={documentableType}
                documentableId={documentableId}
              />
            </Box>

            <Box
              sx={{
                px: 3,
                py: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                minHeight: 56,
              }}
            >
              <TextField
                size="small"
                placeholder={t('searchFiles', 'Search files...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ maxWidth: 280, flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="disabled" />
                    </InputAdornment>
                  ),
                }}
              />

              <Fade in={selectedCount > 0} unmountOnExit>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography variant="body2" color="text.secondary">
                    {selectedCount} {t('selected', 'selected')}
                  </Typography>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => setSelectionModel({ type: 'include', ids: new Set() })}
                  >
                    {t('clear', 'Clear')}
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadZip}
                    disabled={downloadingZip}
                  >
                    {downloadingZip
                      ? t('preparingZip', 'Preparing…')
                      : `${t('downloadZip', 'Download ZIP')}`}
                  </Button>
                </Stack>
              </Fade>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0 }}>
              {isLoading ? (
                <Box sx={{ p: 3 }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} height={52} sx={{ borderRadius: 1 }} />
                  ))}
                </Box>
              ) : filteredDocuments.length === 0 ? (
                <Box
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    color: 'text.secondary',
                  }}
                >
                  <FolderOpenIcon sx={{ fontSize: 48, opacity: 0.4 }} />
                  <Typography variant="body1" fontWeight={500}>
                    {searchTerm
                      ? t('noResultsFound', 'No files match your search')
                      : t('noDocumentsYet', 'No documents yet')}
                  </Typography>
                  {!searchTerm && (
                    <Typography variant="body2">
                      {t('dragAnywhereToUpload', 'Drag files anywhere on this page to upload')}
                    </Typography>
                  )}
                </Box>
              ) : (
                <DataGrid
                  rows={filteredDocuments}
                  columns={columns}
                  loading={isFetching}
                  hideFooterPagination
                  hideFooter
                  disableColumnMenu
                  checkboxSelection
                  rowSelectionModel={selectionModel}
                  onRowSelectionModelChange={(newSelection) =>
                    setSelectionModel(newSelection)
                  }
                  onRowClick={(params) => setSelectedDocument(params.row)}
                  rowHeight={56}
                  sx={{
                    border: 'none',
                    '& .MuiDataGrid-cell:focus': { outline: 'none' },
                    '& .MuiDataGrid-cell:focus-within': { outline: 'none' },
                    '& .MuiDataGrid-columnHeaders': {
                      bgcolor: 'action.hover',
                      borderRadius: 0,
                    },
                    '& .MuiDataGrid-row': {
                      cursor: 'pointer',
                    },
                    '& .MuiDataGrid-row.Mui-selected': {
                      bgcolor: 'primary.50',
                    },
                  }}
                />
              )}
            </Box>
          </Paper>
        </Panel>

        <Separator>
          <Box
            sx={{
              width: 4,
              height: '100%',
              backgroundColor: 'divider',
              transition: 'background-color 0.2s',
              cursor: 'col-resize',
              '&:hover': {
                backgroundColor: 'primary.main',
                opacity: 0.5,
              },
            }}
          />
        </Separator>

        <Panel defaultSize="35" minSize="20" maxSize="70">
          <Paper
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden', 
            }}
          >
            {!selectedDocument ? (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  color: 'text.secondary',
                }}
              >
                <InsertDriveFileOutlinedIcon sx={{ fontSize: 40, opacity: 0.4 }} />
                <Typography variant="body2">{t('selectToPreview')}</Typography>
              </Box>
            ) : (
              <>
                <Box
                  sx={{
                    px: 2.5,
                    py: 2,
                    borderBottom: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  {(() => {
                    const { icon: Icon, color, bgColor } = getFileTypeConfig(
                      selectedDocument.content_type
                    );
                    return (
                      <Avatar variant="rounded" sx={{ bgcolor: bgColor, color }}>
                        <Icon fontSize="small" />
                      </Avatar>
                    );
                  })()}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600} noWrap>
                      {selectedDocument.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(selectedDocument.size)} ·{' '}
                      {formatDistanceToNow(new Date(selectedDocument.created_at), {
                        addSuffix: true,
                      })}
                    </Typography>
                  </Box>
                  <Tooltip title={t('download')}>
                    <IconButton size="small" onClick={() => handleDownload(selectedDocument)}>
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('close', 'Close')}>
                    <IconButton size="small" onClick={() => setSelectedDocument(null)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2,
                    overflow: 'hidden',
                    bgcolor: 'action.hover',
                  }}
                >
                  {selectedDocument.previewable &&
                  selectedDocument.content_type.startsWith('image/') ? (
                    <img
                      src={selectedDocument.url}
                      alt={selectedDocument.name}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        borderRadius: 8,
                      }}
                    />
                  ) : selectedDocument.previewable &&
                    (selectedDocument.content_type === 'application/pdf' ||
                      selectedDocument.content_type === 'text/plain') ? (
                    <iframe
                      src={selectedDocument.url}
                      title={selectedDocument.name}
                      style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
                    />
                  ) : (
                    <Box sx={{ textAlign: 'center' }}>
                      <InsertDriveFileOutlinedIcon
                        sx={{ fontSize: 40, opacity: 0.4, mb: 1 }}
                      />
                      <Typography color="text.secondary" sx={{ mb: 2 }}>
                        {t('noPreview')}
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleDownload(selectedDocument)}
                      >
                        {t('download')}
                      </Button>
                    </Box>
                  )}
                </Box>
              </>
            )}
          </Paper>
        </Panel>
      </Group>

      <Dialog open={!!pendingDelete} onClose={() => setPendingDelete(null)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteOutlineIcon color="error" />
          {t('deleteDocument', 'Delete document')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t(
              'deleteConfirmation',
              'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
              { name: pendingDelete?.name }
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPendingDelete(null)} disabled={deleting}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? t('deleting', 'Deleting…') : t('delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};