import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Tabs,
  Tab,
  MenuItem,
  CircularProgress,
  IconButton,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../app/store';
import { useUpdateMeMutation } from '../auth/authApi';
import { setUser } from '../auth/authSlice';
import { useToast } from '../../contexts/ToastContext';
import { locales } from '../../shared/constants/locales';
import type { LocaleCode } from '../../shared/constants/locales';

const TIMEZONES = ['UTC', 'America/New_York', 'Asia/Tehran'] as const;

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormData {
  first_name: string;
  last_name: string;
  locale: LocaleCode;
  timezone: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

export const SettingsModal = ({ open, onClose }: SettingsModalProps) => {
  const { t } = useTranslation('shared');
  const { t: tSettings, i18n } = useTranslation('settings');
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const [updateMe, { isLoading }] = useUpdateMeMutation();
  const { showSuccess, showError } = useToast();

  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    first_name: '',
    last_name: '',
    locale: 'en',
    timezone: 'UTC',
  });

  // Populate form when modal opens
  useEffect(() => {
    if (open && user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        locale: (user.locale || 'en') as LocaleCode,
        timezone: user.timezone || 'UTC',
      });
      setTabValue(0);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    try {
      const updatedUser = await updateMe(formData).unwrap();

      dispatch(setUser({
        id: updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        locale: updatedUser.locale,
        timezone: updatedUser.timezone,
      }));

      if (updatedUser.locale !== i18n.language) {
        i18n.changeLanguage(updatedUser.locale);
      }

      showSuccess(tSettings('settingsSaved'));
      onClose();
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tSettings('saveFailed'));
    }
  };

  const hasChanges =
    formData.first_name !== (user?.first_name || '') ||
    formData.last_name !== (user?.last_name || '') ||
    formData.locale !== (user?.locale || 'en') ||
    formData.timezone !== (user?.timezone || 'UTC');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {tSettings('settings')}
        <IconButton size="small" onClick={onClose} disabled={isLoading}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', minHeight: 320 }}>
          <Tabs
            orientation="vertical"
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            sx={{
              borderRight: 1,
              borderColor: 'divider',
              minWidth: 160,
              flexShrink: 0,
              '& .MuiTab-root': {
                alignItems: 'flex-start',
                textAlign: 'left',
                px: 3,
                py: 1.5,
                minHeight: 48,
              },
            }}
          >
            <Tab label={tSettings('general')} />
            <Tab label={tSettings('preferences')} />
          </Tabs>

          <Box sx={{ flex: 1, px: 4, py: 3 }}>
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
                <TextField
                  label={t('firstName')}
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  fullWidth
                  size="small"
                />
                <TextField
                  label={t('lastName')}
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  fullWidth
                  size="small"
                />
              </Box>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
                <TextField
                  select
                  label={t('locale')}
                  name="locale"
                  value={formData.locale}
                  onChange={handleChange}
                  fullWidth
                  size="small"
                >
                  {locales.map((loc) => (
                    <MenuItem key={loc.code} value={loc.code}>
                      {loc.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label={t('timezone')}
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  fullWidth
                  size="small"
                >
                  {TIMEZONES.map((tz) => (
                    <MenuItem key={tz} value={tz}>
                      {tz}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            </TabPanel>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} disabled={isLoading}>
          {t('commonActions.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!hasChanges || isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {t('commonActions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};