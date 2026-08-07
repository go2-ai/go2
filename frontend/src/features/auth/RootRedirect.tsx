import { Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useGetMeQuery } from './authApi';

export const RootRedirect = () => {
  const { isLoading, isError } = useGetMeQuery();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return isError
    ? <Navigate to="/app/signin" replace />
    : <Navigate to="/app/organization-resolver" replace />;
};