import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import {
  useGetCenterTypesQuery,
  useDeleteCenterTypeMutation,
  type CenterType,
} from './centerTypesApi';
import { CenterTypeModal } from './components/CenterTypeModal';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/confirmContext';

export const CenterTypesPage = () => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCenterType, setEditingCenterType] = useState<CenterType | null>(null);

  const { data: centerTypes, isLoading, error, refetch } = useGetCenterTypesQuery(orgId, { skip: !orgId });
  const [deleteCenterType] = useDeleteCenterTypeMutation();

  const handleAdd = () => {
    setEditingCenterType(null);
    setIsModalOpen(true);
  };

  const handleEdit = (centerType: CenterType) => {
    setEditingCenterType(centerType);
    setIsModalOpen(true);
  };

  const handleDelete = async (centerType: CenterType) => {
    const confirmed = await confirm({
      title: tAccounting('deleteCenterTypeTitle'),
      message: tAccounting('deleteCenterTypeMessage', { name: centerType.name }),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });

    if (!confirmed) return;

    try {
      await deleteCenterType({ organizationId: orgId, id: centerType.id }).unwrap();
      showSuccess(tAccounting('centerTypeDeleted'));
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tAccounting('centerTypeDeleteFailed'));
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingCenterType(null);
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={refetch}>
              {t('commonActions.retry')}
            </Button>
          }
        >
          {tAccounting('failedToLoadCenterTypes')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {tAccounting('centerTypes')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tAccounting('centerTypesDescription')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          {tAccounting('addCenterType')}
        </Button>
      </Box>

      {!centerTypes || centerTypes.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">{tAccounting('noCenterTypes')}</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('name')}</TableCell>
                <TableCell>{tAccounting('firstCode')}</TableCell>
                <TableCell>{tAccounting('lastCode')}</TableCell>
                <TableCell>{tAccounting('autoIncrement')}</TableCell>
                <TableCell>{tAccounting('metadataFields')}</TableCell>
                <TableCell align="right">{t('actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {centerTypes.map((ct) => (
                <TableRow key={ct.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {ct.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={ct.first_code} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip label={ct.last_code} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={ct.auto_increment ? t('yes') : t('no')}
                      size="small"
                      color={ct.auto_increment ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" gap={0.5} flexWrap="wrap">
                      {(ct.metadata || []).map((field) => (
                        <Chip
                          key={field.id}
                          label={`${field.id} (${field.type})`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      ))}
                      {(!ct.metadata || ct.metadata.length === 0) && (
                        <Typography variant="caption" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleEdit(ct)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(ct)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <CenterTypeModal
        open={isModalOpen}
        onClose={handleModalClose}
        organizationId={orgId}
        centerType={editingCenterType}
      />
    </Container>
  );
};