import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useGetMyOrganizationsQuery } from './organizationsApi';
import {
  setOrganizations,
  setCurrentOrganization,
  setLoading,
} from './organizationsSlice';
import { Container, Box, CircularProgress, Typography } from '@mui/material';

export const OrganizationResolver = () => {
  const { t } = useTranslation('organizations');
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { data: organizations, isLoading, error } = useGetMyOrganizationsQuery();

  useEffect(() => {
    dispatch(setLoading(isLoading));
  }, [isLoading, dispatch]);

  useEffect(() => {
    if (!isLoading && organizations) {
      dispatch(setOrganizations(organizations));
      
      if (organizations.length === 0) {
        navigate('/app/onboarding', { replace: true });
      } else {
        const lastOrganization = organizations[organizations.length - 1];
        dispatch(setCurrentOrganization(lastOrganization));
        navigate(`/app/organizations/${lastOrganization.id}`, { replace: true });
      }
    }
  }, [isLoading, organizations, dispatch, navigate]);

  useEffect(() => {
    if (error) {
      console.error('Failed to fetch organizations:', error);
      navigate('/app/signin', { replace: true });
    }
  }, [error, navigate]);

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          mt: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}
      >
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>
          {t('loadingOrganizations')}
        </Typography>
      </Box>
    </Container>
  );
};