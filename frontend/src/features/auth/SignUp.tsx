import { useState } from 'react';
import useQueryParam from '../../hooks/queryParam'
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  MenuItem,
  Link,
  Snackbar,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useSignUpMutation } from './authApi';
import { timezones, locales } from '../../shared/constants';
import { useLocale } from '../../shared/hooks/useLocale';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setUser } from './authSlice';

export const SignUp = () => {
  const { t } = useTranslation('auth');
  const { t: tShared } = useTranslation('shared');

  const invitationEmail = useQueryParam('email')
  const [formData, setFormData] = useState({
    email: invitationEmail ||'',
    first_name: '',
    last_name: '',
    password: '',
    password_confirmation: '',
    timezone: 'UTC',
    locale: useQueryParam('locale') || 'en',
    invitation_key: useQueryParam('invitation_key') || null
  });
  
  const [isSuccess, setIsSuccess] = useState(false);
  const [signUp, { isLoading, error }] = useSignUpMutation();
  const [validationError, setValidationError] = useState<string | null>(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  // Use the custom locale hook
  useLocale(formData.locale as any);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear validation error when user types
    setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Password match validation
    if (formData.password !== formData.password_confirmation) {
      setValidationError(t('validation.passwordsDoNotMatch'));
      return;
    }
    
    try {
      const { password_confirmation, ...userData } = formData;
      let result = await signUp(userData).unwrap();
      console.log(result);
      if (result.confirmed_at != null) {
        dispatch(setUser({ 
          id: result.id, 
          email: result.email,
          first_name: '', // Add if available in response
          last_name: '',   // Add if available in response
          locale: result.locale || 'en', // Default to 'en' if not provided
        }));
        navigate('/app/organization-resolver')
      } 
      setIsSuccess(true);
    } catch (err) {
      console.error('Sign up failed:', err);
    }
  };

  const handleCloseSnackbar = () => {
    setValidationError(null);
  };

  // Show confirmation message on successful signup
  if (isSuccess) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8 }}>
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h5" component="h2" gutterBottom color="primary">
              ✓ {t('signUpSuccess')}
            </Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>
              {t('checkYourEmail')}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
              {t('confirmationLinkSent')}
            </Typography>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            {tShared('signUp')}
          </Typography>
          
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label={tShared('firstName')}
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              margin="normal"
              required
            />
            
            <TextField
              fullWidth
              label={tShared('lastName')}
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              margin="normal"
              required
            />
            
            <TextField
              fullWidth
              label={tShared('email')}
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              margin="normal"
              dir="ltr"
              required
              disabled={!!invitationEmail}
            />
            
            <TextField
              fullWidth
              label={tShared('password')}
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              margin="normal"
              required
              dir="ltr"
            />
            
            <TextField
              fullWidth
              label={tShared('confirmPassword')}
              name="password_confirmation"
              type="password"
              value={formData.password_confirmation}
              onChange={handleChange}
              margin="normal"
              required
              dir="ltr"
            />
            
            <TextField
              fullWidth
              select
              label={tShared('timezone')}
              name="timezone"
              value={formData.timezone}
              onChange={handleChange}
              margin="normal"
            >
              {timezones.map((tz) => (
                <MenuItem key={tz} value={tz}>
                  {tz}
                </MenuItem>
              ))}
            </TextField>
            
            <TextField
              fullWidth
              select
              label={tShared('locale')}
              name="locale"
              value={formData.locale}
              onChange={handleChange}
              margin="normal"
            >
              {locales.map((loc) => (
                <MenuItem key={loc.code} value={loc.code}>
                  {loc.label}
                </MenuItem>
              ))}
            </TextField>
            
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {t('signUpFailed')}
              </Alert>
            )}
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              disabled={isLoading}
              sx={{ mt: 3, mb: 2 }}
            >
              {isLoading ? <CircularProgress size={24} /> : tShared('signUp')}
            </Button>
            
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2">
                {t('alreadyHaveAccount')}{' '}
                <Link 
                  component={RouterLink} 
                  to="/app/signin"
                  underline="hover"
                >
                  {t('signInHere')}
                </Link>
              </Typography>
            </Box>
          </form>
        </Paper>
      </Box>
      
      {/* Snackbar for validation errors */}
      <Snackbar
        open={!!validationError}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity="error" 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {validationError}
        </Alert>
      </Snackbar>
    </Container>
  );
};