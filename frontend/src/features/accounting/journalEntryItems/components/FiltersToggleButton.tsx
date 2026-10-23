import { Badge, Button, Tooltip } from '@mui/material';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useTranslation } from 'react-i18next';

interface FiltersToggleButtonProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  /** Filters that differ from the defaults (the badge). */
  changeCount: number;
  /** Id of the panel's form (aria-controls). */
  controls: string;
}

/** Shows and hides a filter panel; the badge counts the changed filters. */
export const FiltersToggleButton = ({ open, onToggle, changeCount, controls }: FiltersToggleButtonProps) => {
  const { t: tAccounting } = useTranslation('accounting');

  return (
    <Tooltip
      title={tAccounting('explorer.filters.changedCount', { count: changeCount })}
      disableHoverListener={changeCount === 0}
    >
      <Button
        onClick={() => onToggle(!open)}
        size="small"
        variant={open ? 'contained' : 'outlined'}
        aria-expanded={open}
        aria-controls={controls}
        startIcon={
          <Badge badgeContent={changeCount} color={open ? 'secondary' : 'primary'}>
            <TuneRoundedIcon sx={{ fontSize: 18 }} />
          </Badge>
        }
        sx={{ textTransform: 'none', borderRadius: 5 }}
      >
        {tAccounting('explorer.filters.open', { defaultValue: 'Filters' })}
      </Button>
    </Tooltip>
  );
};
