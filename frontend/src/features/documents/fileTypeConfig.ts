import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import DataObjectIcon from '@mui/icons-material/DataObject';
import type { SvgIconComponent } from '@mui/icons-material';

export interface FileTypeConfig {
  icon: SvgIconComponent;
  color: string;
  bgColor: string;
  label: string;
}

export const getFileTypeConfig = (contentType: string): FileTypeConfig => {
  if (contentType.startsWith('image/')) {
    return { icon: ImageIcon, color: '#7C3AED', bgColor: '#EDE9FE', label: 'Image' };
  }
  if (contentType === 'application/pdf') {
    return { icon: PictureAsPdfIcon, color: '#DC2626', bgColor: '#FEE2E2', label: 'PDF' };
  }
  if (contentType === 'text/csv') {
    return { icon: TableChartIcon, color: '#059669', bgColor: '#D1FAE5', label: 'CSV' };
  }
  if (contentType === 'application/json') {
    return { icon: DataObjectIcon, color: '#D97706', bgColor: '#FEF3C7', label: 'JSON' };
  }
  return { icon: DescriptionIcon, color: '#2563EB', bgColor: '#DBEAFE', label: 'Text' };
};