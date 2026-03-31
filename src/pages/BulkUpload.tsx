import { useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Check, X, FileText, AlertTriangle, Loader2, FolderUp } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { useBulkDocScanner, type ScannedDocument } from '@/hooks/useBulkDocScanner';
import { COMPLIANCE_DOC_TYPES, DOC_TYPE_DISPLAY_NAMES, type ComplianceDocType } from '@/lib/complianceV2Types';

interface PropertyOption {
  id: string;
  address_line_1: string | null;
  postcode?: string | null;
}

type DocumentOverride = Partial<{
  documentType: string;
  propertyId: string;
  expiryDate: string;
  certificateNumber: string;
}>;

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  if (pct >= 80) return <Badge variant="default">{pct}%</Badge>;
  if (pct >= 50) return <Badge variant="secondary">{pct}%</Badge>;
  return <Badge variant="destructive">{pct > 0 ? `${pct}%` : '—'}</Badge>;
}

function StatusBadge({ status }: { status: ScannedDocument['status'] }) {
  switch (status) {
    case 'uploading': return <Badge variant="outline"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Uploading</Badge>;
    case 'classifying': return <Badge variant="outline"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Classifying</Badge>;
    case 'ready': return <Badge variant="secondary">Review</Badge>;
    case 'confirmed': return <Badge variant="default">Confirmed</Badge>;
    case 'rejected': return <Badge variant="destructive">Skipped</Badge>;
    case 'filed': return <Badge variant="secondary">Filed</Badge>;
    case 'error': return <Badge variant="destructive">Error</Badge>;
    default: return null;
  }
}

export default function BulkUpload() {
  const {
    documents,
    isProcessing,
    isFiling,
    processFiles,
    setOverride,
    confirmDoc,
    rejectDoc,
    fileConfirmedDocuments,
    clearAll,
    properties,
  } = useBulkDocScanner();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    processFiles(acceptedFiles);
  }, [processFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: 50,
    maxSize: 20 * 1024 * 1024,
    disabled: isProcessing,
  });

  const confirmedCount = documents.filter(d => d.status === 'confirmed').length;
  const readyCount = documents.filter(d => d.status === 'ready').length;
  const processingCount = documents.filter(d => d.status === 'uploading' || d.status === 'classifying').length;
  const progressPct = documents.length > 0
    ? Math.round(((documents.length - processingCount) / documents.length) * 100)
    : 0;

  const confirmAll = useCallback(() => {
    documents.forEach((d, i) => {
      if (d.status === 'ready' && d.matchedPropertyId && d.classification.documentType) {
        confirmDoc(i);
      }
    });
  }, [documents, confirmDoc]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Bulk Upload Certificates</h1>
        {/* Upload Zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Drop files here or click to browse</h3>
          <p className="text-sm text-muted-foreground mt-1">
            PDF, JPG, PNG — up to 50 files at once, 20MB per file
          </p>
        </div>

        {/* Progress */}
        {documents.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {processingCount > 0
                  ? `Processing ${processingCount} of ${documents.length} files…`
                  : `${documents.length} files processed`}
              </p>
              <div className="flex gap-2">
                {readyCount > 0 && (
                  <Button variant="outline" size="sm" onClick={confirmAll}>
                    Confirm All Matched ({documents.filter(d => d.status === 'ready' && d.matchedPropertyId && d.classification.documentType).length})
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={clearAll}>Clear All</Button>
              </div>
            </div>
            {processingCount > 0 && <Progress value={progressPct} />}
          </div>
        )}

        {/* Results Table */}
        {documents.length > 0 && (
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detected Type</TableHead>
                  <TableHead className="w-[80px]">Confidence</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Cert #</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc, idx) => (
                  <DocumentRow
                    key={idx}
                    doc={doc}
                    idx={idx}
                    properties={properties}
                    onOverride={setOverride}
                    onConfirm={confirmDoc}
                    onReject={rejectDoc}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* File Button */}
        {confirmedCount > 0 && (
          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={fileConfirmedDocuments}
              disabled={isFiling}
            >
              {isFiling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <FolderUp className="h-4 w-4 mr-2" />
              File {confirmedCount} Confirmed Document{confirmedCount !== 1 ? 's' : ''}
            </Button>
          </div>
        )}

        {/* Error / Unfiled section */}
        {documents.some(d => d.status === 'error' || d.status === 'rejected') && (
          <div className="border border-destructive/30 rounded-lg p-4">
            <h3 className="font-semibold text-destructive flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4" />
              Unfiled / Errors ({documents.filter(d => d.status === 'error' || d.status === 'rejected').length})
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              {documents.filter(d => d.status === 'error' || d.status === 'rejected').map((d, i) => (
                <li key={i} className="flex items-center gap-2">
                  <FileText className="h-3 w-3" />
                  {d.file.name}
                  {d.error && <span className="text-destructive">— {d.error}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function DocumentRow({
  doc, idx, properties, onOverride, onConfirm, onReject,
}: {
  doc: ScannedDocument;
  idx: number;
  properties: PropertyOption[];
  onOverride: (idx: number, o: DocumentOverride) => void;
  onConfirm: (idx: number) => void;
  onReject: (idx: number) => void;
}) {
  const isEditable = doc.status === 'ready' || doc.status === 'confirmed';
  const docType = doc.userOverrides.documentType || doc.classification.documentType || '';
  const propId = doc.userOverrides.propertyId || doc.matchedPropertyId || '';
  const expiry = doc.userOverrides.expiryDate || doc.classification.extractedData.expiryDate || '';
  const certNum = doc.userOverrides.certificateNumber || doc.classification.extractedData.certificateNumber || '';

  return (
    <TableRow className={doc.status === 'rejected' ? 'opacity-50' : doc.status === 'filed' ? 'bg-accent/50' : ''}>
      <TableCell className="font-mono text-xs truncate max-w-[200px]" title={doc.file.name}>
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          {doc.file.name}
        </div>
      </TableCell>
      <TableCell><StatusBadge status={doc.status} /></TableCell>
      <TableCell>
        {isEditable ? (
          <Select value={docType} onValueChange={v => onOverride(idx, { documentType: v })}>
            <SelectTrigger className="h-8 text-xs w-[180px]">
              <SelectValue placeholder="Select type…" />
            </SelectTrigger>
            <SelectContent>
              {COMPLIANCE_DOC_TYPES.map(t => (
                <SelectItem key={t} value={t} className="text-xs">{DOC_TYPE_DISPLAY_NAMES[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs">{docType ? DOC_TYPE_DISPLAY_NAMES[docType as ComplianceDocType] || docType : '—'}</span>
        )}
      </TableCell>
      <TableCell><ConfidenceBadge confidence={doc.classification.confidence} /></TableCell>
      <TableCell>
        {isEditable ? (
          <Select value={propId} onValueChange={v => onOverride(idx, { propertyId: v })}>
            <SelectTrigger className="h-8 text-xs w-[180px]">
              <SelectValue placeholder="Select property…" />
            </SelectTrigger>
            <SelectContent>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.address_line_1}{p.postcode ? `, ${p.postcode}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs">{properties.find(p => p.id === propId)?.address_line_1 || '—'}</span>
        )}
      </TableCell>
      <TableCell>
        {isEditable ? (
          <Input
            type="date"
            value={expiry}
            onChange={e => onOverride(idx, { expiryDate: e.target.value })}
            className="h-8 text-xs w-[140px]"
          />
        ) : (
          <span className="text-xs">{expiry || '—'}</span>
        )}
      </TableCell>
      <TableCell>
        {isEditable ? (
          <Input
            value={certNum}
            onChange={e => onOverride(idx, { certificateNumber: e.target.value })}
            className="h-8 text-xs w-[120px]"
            placeholder="—"
          />
        ) : (
          <span className="text-xs">{certNum || '—'}</span>
        )}
      </TableCell>
      <TableCell>
        {isEditable && (
          <div className="flex gap-1">
            <Button
              size="icon"
              variant={doc.status === 'confirmed' ? 'default' : 'outline'}
              className="h-7 w-7"
              onClick={() => onConfirm(idx)}
              title="Confirm"
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              onClick={() => onReject(idx)}
              title="Skip"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
