import { Navigate, Outlet } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useGetMeQuery } from './authApi';

export const ProtectedRoute = () => {
  const { isLoading, isError } = useGetMeQuery();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return <Navigate to="/app/signin" replace />;
  }

  return <Outlet />;
};