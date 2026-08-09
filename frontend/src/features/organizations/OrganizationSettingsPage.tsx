import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  MenuItem,
  CircularProgress,
  Chip,
  Autocomplete,
  Tabs,
  Tab,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  useGetOrganizationQuery,
  useUpdateOrganizationMutation,
} from './organizationsApi';
import { useToast } from '../../contexts/ToastContext';
import { useTranslatableLocales } from '../../hooks/useTranslatableLocales';
import MultiLocaleInput from '../../components/shared/MultiLocaleInput';
import { locales } from '../../shared/constants/locales';
import type { LocaleCode } from '../../shared/constants/locales';
import {
  buildLocaleMap,
  flattenTranslations,
  type LocaleMap,
} from '../../utils/translationHelper';

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

export const OrganizationSettingsPage = () => {
  const { t } = useTranslation('shared');
  const { t: tSettings } = useTranslation('settings');
  const { t: tOrgs } = useTranslation('organizations');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const { showSuccess, showError } = useToast();

  const { data: organization, isLoading: isOrgLoading } = useGetOrganizationQuery(orgId, {
    skip: !orgId,
  });
  const [updateOrganization, { isLoading: isSaving }] = useUpdateOrganizationMutation();

  const { allLocales, isReady } = useTranslatableLocales({ organizationId: orgId });

  const [tabValue, setTabValue] = useState(0);

  const [formData, setFormData] = useState<{
    name: LocaleMap;
    locale: LocaleCode;
    active_locales: LocaleCode[];
  }>({
    name: {},
    locale: 'en',
    active_locales: [],
  });

  // Populate form when organization data loads
  useEffect(() => {
    if (organization && isReady) {
      setFormData({
        name: buildLocaleMap(organization.t?.name, allLocales),
        locale: (organization.locale || 'en') as LocaleCode,
        active_locales: (organization.active_locales || []) as LocaleCode[],
      });
    }
  }, [organization, isReady, allLocales.join(',')]);

  const handleNameChange = (val: LocaleMap) => {
    setFormData((prev) => ({ ...prev, name: val }));
  };

  const handleSave = async () => {
    try {
      const payload = {
        id: orgId,
        organization_id: orgId,
        ...flattenTranslations({ name: formData.name }, ['name']),
        locale: formData.locale,
        active_locales: formData.active_locales,
      };

      await updateOrganization({ id: orgId, data: payload }).unwrap();
      showSuccess(tSettings('settingsSaved'));
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tSettings('saveFailed'));
    }
  };

  const hasChanges = useMemo(() => {
    if (!organization || !isReady) return false;
    return (
      JSON.stringify(formData.name) !==
        JSON.stringify(buildLocaleMap(organization.t?.name, allLocales)) ||
      formData.locale !== (organization.locale || 'en') ||
      JSON.stringify(formData.active_locales.slice().sort()) !==
        JSON.stringify((organization.active_locales || []).slice().sort())
    );
  }, [formData, organization, isReady, allLocales]);

  // Locale options for the primary locale dropdown
  const primaryLocaleOptions = useMemo(() => locales, []);

  // Locale options for the active_locales multiselect (exclude primary)
  const secondaryLocaleOptions = useMemo(
    () => locales.filter((loc) => loc.code !== formData.locale),
    [formData.locale]
  );

  // Currently selected active locale objects (for Autocomplete)
  const selectedActiveLocales = useMemo(
    () => locales.filter((loc) => formData.active_locales.includes(loc.code)),
    [formData.active_locales]
  );

  if (isOrgLoading || !isReady) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>
        {tOrgs('organizationSettings')}
      </Typography>

      <Paper sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', minHeight: 350 }}>
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
          </Tabs>

          <Box sx={{ flex: 1, px: 4, py: 3 }}>
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 500 }}>
                {/* Organization Name */}
                <MultiLocaleInput
                  field={t('name')}
                  value={formData.name}
                  onChange={handleNameChange}
                  required
                />

                {/* Primary Locale */}
                <TextField
                  select
                  label={tOrgs('primaryLocale')}
                  value={formData.locale}
                  onChange={(e) => {
                    const newLocale = e.target.value as LocaleCode;
                    setFormData((prev) => ({
                      ...prev,
                      locale: newLocale,
                      active_locales: prev.active_locales.filter((l) => l !== newLocale),
                    }));
                  }}
                  fullWidth
                  size="small"
                >
                  {primaryLocaleOptions.map((loc) => (
                    <MenuItem key={loc.code} value={loc.code}>
                      {loc.label}
                    </MenuItem>
                  ))}
                </TextField>

                {/* Active Locales (clearable multiselect) */}
                <Autocomplete
                  multiple
                  options={secondaryLocaleOptions}
                  getOptionLabel={(option) => option.label}
                  value={selectedActiveLocales}
                  onChange={(_, newValue) => {
                    setFormData((prev) => ({
                      ...prev,
                      active_locales: newValue.map((loc) => loc.code),
                    }));
                  }}
                  isOptionEqualToValue={(option, value) => option.code === value.code}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={tOrgs('activeLocales')}
                      size="small"
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => {
                      const { key, ...tagProps } = getTagProps({ index });
                      return (
                        <Chip
                          key={option.code}
                          label={option.label}
                          size="small"
                          {...tagProps}
                        />
                      );
                    })
                  }
                  fullWidth
                />
              </Box>
            </TabPanel>
          </Box>
        </Box>
      </Paper>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          startIcon={isSaving ? <CircularProgress size={20} /> : null}
        >
          {t('commonActions.save')}
        </Button>
      </Box>
    </Container>
  );
};