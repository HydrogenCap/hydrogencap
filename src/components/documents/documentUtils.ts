import { File, FileText, Image, FileSpreadsheet } from 'lucide-react';

export const FILE_ICONS: Record<string, typeof File> = {
  pdf: FileText,
  image: Image,
  doc: FileText,
  spreadsheet: FileSpreadsheet,
  other: File,
};

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
