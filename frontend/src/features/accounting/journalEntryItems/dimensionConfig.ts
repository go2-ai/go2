import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import type { SvgIconComponent } from '@mui/icons-material';
import type { ExplorerDimension } from './journalEntryItemsApi';

export interface DimensionMeta {
  dimension: ExplorerDimension;
  labelKey: string;
  fallbackLabel: string;
  icon: SvgIconComponent;
  centerLevel?: number;
}

export const DIMENSION_META: DimensionMeta[] = [
  { dimension: 'account_category', labelKey: 'explorer.dimensions.account_category', fallbackLabel: 'Category', icon: CategoryRoundedIcon },
  { dimension: 'ledger', labelKey: 'explorer.dimensions.ledger', fallbackLabel: 'Ledger', icon: MenuBookRoundedIcon },
  { dimension: 'account', labelKey: 'explorer.dimensions.account', fallbackLabel: 'Account', icon: AccountBalanceWalletRoundedIcon },
  { dimension: 'center1', labelKey: 'explorer.dimensions.center1', fallbackLabel: 'Center 1', icon: HubRoundedIcon, centerLevel: 1 },
  { dimension: 'center2', labelKey: 'explorer.dimensions.center2', fallbackLabel: 'Center 2', icon: HubRoundedIcon, centerLevel: 2 },
  { dimension: 'center3', labelKey: 'explorer.dimensions.center3', fallbackLabel: 'Center 3', icon: HubRoundedIcon, centerLevel: 3 },
  { dimension: 'center4', labelKey: 'explorer.dimensions.center4', fallbackLabel: 'Center 4', icon: HubRoundedIcon, centerLevel: 4 },
  { dimension: 'center5', labelKey: 'explorer.dimensions.center5', fallbackLabel: 'Center 5', icon: HubRoundedIcon, centerLevel: 5 },
  { dimension: 'center6', labelKey: 'explorer.dimensions.center6', fallbackLabel: 'Center 6', icon: HubRoundedIcon, centerLevel: 6 },
  { dimension: 'currency', labelKey: 'explorer.dimensions.currency', fallbackLabel: 'Currency', icon: PaidRoundedIcon },
];

export const metaFor = (dimension: ExplorerDimension): DimensionMeta =>
  DIMENSION_META.find((m) => m.dimension === dimension)!;
