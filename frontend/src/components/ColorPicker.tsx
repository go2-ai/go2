import { useState, Fragment } from "react";
import {
  TextField,
  IconButton,
  InputAdornment,
  Popover,
  Box,
  Button,
  Stack,
} from "@mui/material";
import { SketchPicker } from "react-color";
import SquareIcon from "@mui/icons-material/Square";
import { useTranslation } from 'react-i18next';

interface ColorPickerProps {
  label?: string,
  value: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [tempColor, setTempColor] = useState(value);
  const { t } = useTranslation('shared');

  const open = Boolean(anchorEl);
  const id = open ? "color-picker-popover" : undefined;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    setTempColor(value);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleConfirm = () => {
    onChange(tempColor);
    handleClose();
  };

  const handleCancel = () => {
    handleClose();
  };

  return (
    <Fragment>
      <TextField
        label={label || t("color")}
        value={value}
        size="small"
        fullWidth
        InputProps={{
          readOnly: true,
          startAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-describedby={id}
                onClick={handleClick}
                size="small"
              >
                <SquareIcon sx={{ color: value }}/>
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleCancel}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
      >
        <Box sx={{ p: 2 }}>
          <SketchPicker
            color={tempColor}
            onChange={(color) => setTempColor(color.hex)}
          />
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button size="small" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="small" variant="contained" onClick={handleConfirm}>
              Confirm
            </Button>
          </Stack>
        </Box>
      </Popover>
    </Fragment>
  );
}