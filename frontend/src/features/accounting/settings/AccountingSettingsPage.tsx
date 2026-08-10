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
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Stack,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { useGetOrganizationQuery } from '../../organizations/organizationsApi';
import {
  useGetAccountingSettingsQuery,
  useUpdateAccountingSettingsMutation,
} from './settingsApi';
import {
  useGetCurrenciesQuery,
  useCreateCurrencyMutation,
  useDeleteCurrencyMutation,
  type AccountingCurrency,
} from '../currencies/currenciesApi';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/confirmContext';
import { CurrencyModal } from '../currencies/components/CurrencyModal';
import { CURRENCY_PRESETS } from '../currencies/currencyPresets';

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

export const AccountingSettingsPage = () => {
  const { t } = useTranslation('shared');
  const { t: tAccounting } = useTranslation('accounting');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();

  const { data: organization } = useGetOrganizationQuery(orgId, { skip: !orgId });
  const { data: settings, isLoading: isSettingsLoading } = useGetAccountingSettingsQuery(orgId, { skip: !orgId });
  const { data: currencies, isLoading: isCurrenciesLoading } = useGetCurrenciesQuery(orgId, { skip: !orgId });

  const [updateSettings, { isLoading: isSaving }] = useUpdateAccountingSettingsMutation();
  const [createCurrency] = useCreateCurrencyMutation();
  const [deleteCurrency] = useDeleteCurrencyMutation();

  const [tabValue, setTabValue] = useState(0);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<AccountingCurrency | null>(null);

  const hasParent = !!organization?.parent_id;
  const isLoading = isSettingsLoading || isCurrenciesLoading;

  const [formData, setFormData] = useState({
    main_currency_id: null as number | null,
    use_parent_org_currencies: false,
    use_parent_org_accounts: false,
    use_parent_org_centers: false,
    use_parent_org_fiscal_years: false,
    account_category_length: 1,
    ledger_length: 2,
    account_length: 2,
    center_length: 6,
    center_levels: 3,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        main_currency_id: settings.main_currency_id,
        use_parent_org_currencies: settings.use_parent_org_currencies,
        use_parent_org_accounts: settings.use_parent_org_accounts,
        use_parent_org_centers: settings.use_parent_org_centers,
        use_parent_org_fiscal_years: settings.use_parent_org_fiscal_years,
        account_category_length: settings.account_category_length,
        ledger_length: settings.ledger_length,
        account_length: settings.account_length,
        center_length: settings.center_length,
        center_levels: settings.center_levels,
      });
    }
  }, [settings]);

  const handleToggle = (field: string) => {
    setFormData((prev) => ({ ...prev, [field]: !prev[field as keyof typeof prev] }));
  };

  const handleNumberChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0 && val <= 10) {
      setFormData((prev) => ({ ...prev, [field]: val }));
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateSettings({ organizationId: orgId, data: formData }).unwrap();
      showSuccess(tAccounting('settingsSaved'));
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tAccounting('saveFailed'));
    }
  };

  const hasChanges = useMemo(() => {
    if (!settings) return false;
    return (
      formData.main_currency_id !== settings.main_currency_id ||
      formData.use_parent_org_currencies !== settings.use_parent_org_currencies ||
      formData.use_parent_org_accounts !== settings.use_parent_org_accounts ||
      formData.use_parent_org_centers !== settings.use_parent_org_centers ||
      formData.use_parent_org_fiscal_years !== settings.use_parent_org_fiscal_years ||
      formData.account_category_length !== settings.account_category_length ||
      formData.ledger_length !== settings.ledger_length ||
      formData.account_length !== settings.account_length ||
      formData.center_length !== settings.center_length ||
      formData.center_levels !== settings.center_levels
    );
  }, [formData, settings]);

  const handleAddPreset = async (preset: (typeof CURRENCY_PRESETS)[number]) => {
    try {
      await createCurrency({
        organizationId: orgId,
        data: {
          name_en: preset.name_en,
          name_fa: preset.name_fa,
          abr: preset.abr,
          decimal_digits: preset.decimal_digits,
        },
      }).unwrap();
      showSuccess(tAccounting('currencyCreated'));
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tAccounting('currencyCreateFailed'));
    }
  };

  const handleDeleteCurrency = async (currency: AccountingCurrency) => {
    const confirmed = await confirm({
      title: tAccounting('deleteCurrencyTitle'),
      message: tAccounting('deleteCurrencyMessage', { name: currency.abr }),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });

    if (!confirmed) return;

    try {
      await deleteCurrency({ organizationId: orgId, id: currency.id }).unwrap();
      if (formData.main_currency_id === currency.id) {
        setFormData((prev) => ({ ...prev, main_currency_id: null }));
      }
      showSuccess(tAccounting('currencyDeleted'));
    } catch (err: any) {
      showError(err?.data?.errors?.[0] || tAccounting('currencyDeleteFailed'));
    }
  };

  const handleEditCurrency = (currency: AccountingCurrency) => {
    setEditingCurrency(currency);
    setIsCurrencyModalOpen(true);
  };

  const handleAddCustom = () => {
    setEditingCurrency(null);
    setIsCurrencyModalOpen(true);
  };

  const handleCurrencyModalClose = () => {
    setIsCurrencyModalOpen(false);
    setEditingCurrency(null);
  };

  const existingAbrs = new Set((currencies || []).map((c) => c.abr));
  const availablePresets = CURRENCY_PRESETS.filter((p) => !existingAbrs.has(p.abr));

  if (isLoading) {
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
        {tAccounting('accountingSettings')}
      </Typography>

      <Paper sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', minHeight: 400 }}>
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
            <Tab label={tAccounting('generalSettings')} />
            <Tab label={tAccounting('currencies')} />
          </Tabs>

          <Box sx={{ flex: 1, px: 4, py: 3 }}>
            {/* ── Tab 1: General Settings ── */}
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 500 }}>
                {/* Main Currency */}
                <TextField
                  select
                  label={tAccounting('mainCurrency')}
                  value={formData.main_currency_id ?? ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      main_currency_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  fullWidth
                  size="small"
                  required
                >
                  {(!currencies || currencies.length === 0) && (
                    <MenuItem value="" disabled>
                      {tAccounting('noCurrenciesYet')}
                    </MenuItem>
                  )}
                  {(currencies || []).map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.abr} — {c.name}
                    </MenuItem>
                  ))}
                </TextField>

                {/* Parent-org toggles */}
                {hasParent && (
                  <>
                    <Typography variant="subtitle2" color="text.secondary">
                      {tAccounting('inheritFromParent')}
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.use_parent_org_currencies}
                          onChange={() => handleToggle('use_parent_org_currencies')}
                        />
                      }
                      label={tAccounting('useParentOrgCurrencies')}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.use_parent_org_accounts}
                          onChange={() => handleToggle('use_parent_org_accounts')}
                        />
                      }
                      label={tAccounting('useParentOrgAccounts')}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.use_parent_org_centers}
                          onChange={() => handleToggle('use_parent_org_centers')}
                        />
                      }
                      label={tAccounting('useParentOrgCenters')}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.use_parent_org_fiscal_years}
                          onChange={() => handleToggle('use_parent_org_fiscal_years')}
                        />
                      }
                      label={tAccounting('useParentOrgFiscalYears')}
                    />
                  </>
                )}

                {/* Code length fields */}
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                  {tAccounting('codeLengths')}
                </Typography>
                {[
                  { field: 'account_category_length', label: tAccounting('accountCategoryLength') },
                  { field: 'ledger_length', label: tAccounting('ledgerLength') },
                  { field: 'account_length', label: tAccounting('accountLength') },
                  { field: 'center_length', label: tAccounting('centerLength') },
                  { field: 'center_levels', label: tAccounting('centerLevels') },
                ].map(({ field, label }) => (
                  <TextField
                    key={field}
                    label={label}
                    type="number"
                    value={formData[field as keyof typeof formData]}
                    onChange={handleNumberChange(field)}
                    fullWidth
                    size="small"
                    inputProps={{ min: 1, max: 10 }}
                  />
                ))}

                {/* Save button */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                  <Button
                    variant="contained"
                    onClick={handleSaveSettings}
                    disabled={!hasChanges || isSaving}
                    startIcon={isSaving ? <CircularProgress size={20} /> : null}
                  >
                    {t('commonActions.save')}
                  </Button>
                </Box>
              </Box>
            </TabPanel>

            {/* ── Tab 2: Currencies ── */}
            <TabPanel value={tabValue} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 600 }}>
                {/* Existing currencies */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    {tAccounting('availableCurrencies')} ({(currencies || []).length})
                  </Typography>
                  {!currencies || currencies.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      {tAccounting('noCurrenciesYet')}
                    </Typography>
                  ) : (
                    <List dense disablePadding>
                      {currencies.map((c) => (
                        <ListItem
                          key={c.id}
                          secondaryAction={
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <IconButton
                                edge="end"
                                size="small"
                                onClick={() => handleEditCurrency(c)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                edge="end"
                                size="small"
                                color="error"
                                onClick={() => handleDeleteCurrency(c)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          }
                          sx={{ pr: 12 }}
                        >
                          <ListItemText
                            primary={`${c.abr} — ${c.name}`}
                            secondary={tAccounting('decimalDigitsCount', { count: c.decimal_digits })}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>

                {/* Presets */}
                {availablePresets.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      {tAccounting('addFromPresets')}
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {availablePresets.map((preset) => (
                        <Chip
                          key={preset.abr}
                          label={`${preset.abr} — ${preset.name_en}`}
                          onClick={() => handleAddPreset(preset)}
                          onDelete={() => handleAddPreset(preset)}
                          deleteIcon={<AddIcon />}
                          variant="outlined"
                          size="small"
                        />
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Add custom */}
                <Box>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={handleAddCustom}
                  >
                    {tAccounting('addCustomCurrency')}
                  </Button>
                </Box>
              </Box>
            </TabPanel>
          </Box>
        </Box>
      </Paper>

      <CurrencyModal
        open={isCurrencyModalOpen}
        onClose={handleCurrencyModalClose}
        organizationId={orgId}
        currency={editingCurrency}
      />
    </Container>
  );
};