import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Button,
  Stack,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useConfirmEmailMutation } from './authApi';

export const EmailConfirmation = () => {
  const { t } = useTranslation('auth');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [confirmEmail] = useConfirmEmailMutation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(6);
  const executed = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const token = searchParams.get('confirmation_token');

  useEffect(() => {
    if (executed.current) return;
    executed.current = true;
    
    if (!token) {
      setStatus('error');
      setErrorMessage(t('noConfirmationToken'));
      return;
    }

    const confirm = async () => {
      try {
        const result = await confirmEmail({ confirmation_token: token }).unwrap();
        setStatus('success');
      } catch (error: any) {
        console.error('Confirmation failed:', error);
        setStatus('error');
        
        if (error.status === 404) {
          setErrorMessage(t('invalidToken'));
        } else if (error.status === 422) {
          setErrorMessage(t('alreadyConfirmed'));
        } else {
          setErrorMessage(t('confirmationFailed'));
        }
      }
    };

    confirm();
  }, [token, confirmEmail, t]);

  // Countdown timer for auto-redirect
  useEffect(() => {
    if (status === 'success') {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // Clear timer and redirect
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            navigate('/app/organization-resolver');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // Cleanup timer on component unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status, navigate]);

  const handleRedirectNow = () => {
    // Clear timer if exists
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    navigate('/app/organization-resolver');
  };

  if (status === 'loading') {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, textAlign: 'center' }}>
          <Paper elevation={3} sx={{ p: 4 }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>
              {t('confirmingEmail')}
            </Typography>
          </Paper>
        </Box>
      </Container>
    );
  }

  if (status === 'success') {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8 }}>
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <Alert severity="success" sx={{ mb: 3 }}>
              ✓ {t('emailConfirmedSuccessfully')}
            </Alert>
            <Typography variant="body1" sx={{ mb: 3 }}>
              {t('youCanNowSignIn')}
            </Typography>
            
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="contained"
                color="primary"
                onClick={handleRedirectNow}
              >
                {t('continueNow')}
              </Button>
            </Stack>
            
            <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
              {t('redirectingIn', { seconds: countdown })}
            </Typography>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {t('confirmationFailedTitle')}
          </Alert>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {errorMessage || t('confirmationFailed')}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/signup')}
          >
            {t('tryAgain')}
          </Button>
        </Paper>
      </Box>
    </Container>
  );
};