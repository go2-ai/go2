import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Badge,
  InputBase,
  Avatar,
  Menu,
  MenuItem,
  Box,
  Typography,
  Tooltip,
  alpha,
  styled,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Search as SearchIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { clearOrganizations } from '../organizations/organizationsSlice';
import { clearUser } from '../auth/authSlice';
import { useSignOutMutation } from '../auth/authApi';
import type { RootState } from '../../app/store';
import SettingsIcon from '@mui/icons-material/Settings';
import { SettingsModal } from '../me/SettingsModal';

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: 40,
  backgroundColor: alpha(theme.palette.common.white, 0.08),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.16),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(3),
    width: 'auto',
  },
  transition: theme.transitions.create('all'),
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.text.secondary,
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: '30ch',
    },
    '&::placeholder': {
      color: alpha(theme.palette.common.white, 0.5),
    },
  },
}));

const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
};

export const TopBar = () => {
  const { t } = useTranslation('shared');
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { mode, toggleTheme } = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationAnchor, setNotificationAnchor] = useState<null | HTMLElement>(null);
  const { user } = useSelector((state: RootState) => state.auth);
  const { currentOrganization } = useSelector((state: RootState) => state.organizations);
  const [signOut] = useSignOutMutation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationsOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleNotificationsClose = () => {
    setNotificationAnchor(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut().unwrap();
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      // Always clear local state, even if API call fails
      dispatch(clearOrganizations());
      dispatch(clearUser());
      navigate('/app/signin');
    }
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: (theme) => theme.palette.background.paper,
        color: (theme) => theme.palette.text.primary,
        boxShadow: 'none',
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Toolbar>
        {/* Mobile menu button - hidden on desktop */}
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          sx={{ display: { xs: 'flex', md: 'none' }, mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        {/* Logo - visible on mobile */}
        <Typography
          variant="h6"
          sx={{
            display: { xs: 'flex', md: 'none' },
            fontWeight: 700,
            background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          GO3
        </Typography>

        {/* Organization name - visible on desktop */}
        <Typography
          variant="subtitle1"
          sx={{
            ml: 2,
            display: { xs: 'none', md: 'block' },
            color: 'text.secondary',
            fontWeight: 500,
          }}
        >
          {currentOrganization?.name}
        </Typography>

        {/* Search bar - centered */}
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
          <Search>
            <SearchIconWrapper>
              <SearchIcon />
            </SearchIconWrapper>
            <StyledInputBase
              placeholder={t('search')}
              inputProps={{ 'aria-label': 'search' }}
            />
          </Search>
        </Box>

        {/* Right side icons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={t('notifications')}>
            <IconButton onClick={handleNotificationsOpen} color="inherit">
              <Badge badgeContent={3} color="secondary">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title={mode === 'light' ? t('darkMode') : t('lightMode')}>
            <IconButton onClick={toggleTheme} color="inherit">
              {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
          </Tooltip>

          <Tooltip title={t('account')}>
            <IconButton
              onClick={handleMenuOpen}
              sx={{
                p: 0.5,
                border: '2px solid',
                borderColor: 'primary.main',
                '&:hover': {
                  borderColor: 'secondary.main',
                },
              }}
            >
              <Avatar
                sx={{
                  bgcolor: 'primary.main',
                  width: 32,
                  height: 32,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                {user ? getInitials(user.first_name, user.last_name) : 'U'}
              </Avatar>
            </IconButton>
          </Tooltip>
        </Box>

        {/* User Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            sx: {
              mt: 1,
              minWidth: 220,
              borderRadius: 2,
              boxShadow: (theme) => `0 4px 20px ${alpha(theme.palette.common.black, 0.1)}`,
            },
          }}
        >
          <MenuItem sx={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {user?.first_name} {user?.last_name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.email}
            </Typography>
          </MenuItem>
          <MenuItem onClick={() => { handleMenuClose(); setIsSettingsOpen(true); }}>
            <SettingsIcon sx={{ mr: 1, fontSize: 20 }} />
            {t('settings')}
          </MenuItem>
          <MenuItem onClick={handleSignOut}>
            <LogoutIcon sx={{ mr: 1, fontSize: 20 }} />
            {t('signOut')}
          </MenuItem>
        </Menu>

        {/* Notifications Menu */}
        <Menu
          anchorEl={notificationAnchor}
          open={Boolean(notificationAnchor)}
          onClose={handleNotificationsClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            sx: {
              mt: 1,
              width: 320,
              borderRadius: 2,
              boxShadow: (theme) => `0 4px 20px ${alpha(theme.palette.common.black, 0.1)}`,
            },
          }}
        >
          <MenuItem>
            <Typography variant="body2">No new notifications</Typography>
          </MenuItem>
        </Menu>
      </Toolbar>
      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </AppBar>
  );
};