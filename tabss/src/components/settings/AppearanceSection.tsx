import {
  Box,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Typography,
  useColorScheme,
} from "@mui/material";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AppearanceSection() {
  const { mode, setMode } = useColorScheme();
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (event: any) => {
    i18n.changeLanguage(event.target.value);
  };

  if (!mode) {
    return null;
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
          {t("settings.appearance.title", "Appearance")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(
            "settings.appearance.description",
            "Customize how GO2 looks and feels on your device.",
          )}
        </Typography>
      </Box>

      {/* Theme Selection */}
      <Card sx={{ mb: 4 }} variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
            Theme Preference
          </Typography>

          <RadioGroup
            row
            value={mode}
            onChange={(event) =>
              setMode(event.target.value as "light" | "dark" | "system")
            }
            sx={{ gap: 2 }}
          >
            {[
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
              { value: "system", label: "System", icon: Monitor },
            ].map((option) => {
              const Icon = option.icon;
              const isSelected = mode === option.value;

              return (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                  control={<Radio sx={{ display: "none" }} />}
                  label={
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1.5,
                        p: 2,
                        width: 120,
                        borderRadius: 1,
                        border: "2px solid",
                        borderColor: isSelected ? "primary.main" : "divider",
                        bgcolor: isSelected ? "primary.main" : "transparent",
                        color: isSelected
                          ? "primary.contrastText"
                          : "text.primary",
                        transition: "all 0.2s",
                        cursor: "pointer",
                        "&:hover": {
                          borderColor: "primary.main",
                          bgcolor: isSelected ? "primary.main" : "action.hover",
                        },
                      }}
                    >
                      <Icon size={24} />
                      <Typography variant="body2" fontWeight={600}>
                        {option.label}
                      </Typography>
                    </Box>
                  }
                  sx={{ m: 0 }}
                />
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Language Selection */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
            Language & Region
          </Typography>

          <Box sx={{ maxWidth: 300 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Language</InputLabel>
              <Select
                value={i18n.language}
                label="Language"
                onChange={handleLanguageChange}
              >
                <MenuItem value="en">English (US)</MenuItem>
                <MenuItem value="fa">فارسی</MenuItem>
              </Select>
            </FormControl>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: "block" }}
            >
              Select your preferred language for the interface.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
