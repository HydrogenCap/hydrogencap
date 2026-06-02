import { lazy } from 'react';
import { FolderOpen, FileSignature, FolderUp, ScanLine } from 'lucide-react';
import { WorkspaceShell, type WorkspaceTab } from '@/components/layout/WorkspaceShell';

const Documents = lazy(() => import('./Documents'));
const DocumentTemplates = lazy(() => import('./DocumentTemplates'));
const BulkUpload = lazy(() => import('./BulkUpload'));
const BulkDocumentScanner = lazy(() => import('./BulkDocumentScanner'));

const TABS: WorkspaceTab[] = [
  { key: 'vault', label: 'Vault', icon: FolderOpen, Component: Documents },
  { key: 'templates', label: 'Templates', icon: FileSignature, Component: DocumentTemplates },
  { key: 'bulk-upload', label: 'Bulk upload', icon: FolderUp, Component: BulkUpload },
  { key: 'bulk-scanner', label: 'Bulk scanner', icon: ScanLine, Component: BulkDocumentScanner },
];

export default function DocumentsWorkspace() {
  return <WorkspaceShell label="Document views" tabs={TABS} defaultKey="vault" />;
}
