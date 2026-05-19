import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';
import {
  Upload,
  File,
  X,
  CalendarIcon,
  ExternalLink,
  Wrench,
  CreditCard,
  FileCheck,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';


import { cn } from '@/lib/utils';
import type { RiskItem, RiskType } from '@/hooks/usePortfolioRisks';

type ResolveMode = 'upload' | 'payment' | 'link' | 'maintenance';

interface ResolveActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risk: RiskItem | null;
}

function getResolveMode(type: RiskType): ResolveMode {
  switch (type) {
    case 'hmo_licence':
    case 'insurance':
    case 'tenancy_compliance':
    case 'epc':
      return 'upload';
    case 'negative_cashflow':
    case 'rate_expiry':
    case 'ltv':
      return 'payment';
    case 'operational_data':
    case 'leasehold':
    case 'lease_expiry':
      return 'link';
    default:
      return 'link';
  }
}

function getResolveModeLabel(mode: ResolveMode): { icon: React.ReactNode; title: string; description: string } {
  switch (mode) {
    case 'upload':
      return {
        icon: <FileCheck className="h-5 w-5" />,
        title: 'Upload Certificate / Document',
        description: 'Upload the renewed certificate or compliance document to resolve this action.',
      };
    case 'payment':
      return {
        icon: <CreditCard className="h-5 w-5" />,
        title: 'Record Payment / Financial Action',
        description: 'Record a payment or financial update to resolve this action.',
      };
    case 'link':
      return {
        icon: <ExternalLink className="h-5 w-5" />,
        title: 'Update Property Data',
        description: 'Navigate to the property page to fill in the missing information.',
      };
    case 'maintenance':
      return {
        icon: <Wrench className="h-5 w-5" />,
        title: 'Create Maintenance Job',
        description: 'Create a job or assign to a contractor to resolve this issue.',
      };
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── Upload Panel ───
function UploadPanel({ risk }: { risk: RiskItem }) {
  const [file, setFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();
  const navigate = useNavigate();

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
    },
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        )}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="flex items-center justify-center gap-2">
            <File className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">{file.name}</span>
            <span className="text-xs text-muted-foreground">({formatBytes(file.size)})</span>
            <Button aria-label="Close"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drop a file here or click to browse
            </p>
            <p className="text-xs text-muted-foreground">PDF, PNG, JPG accepted</p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>New Expiry Date (optional)</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !expiryDate && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {expiryDate ? format(expiryDate, 'dd MMM yyyy') : 'Pick expiry date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={expiryDate} onSelect={setExpiryDate} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <AlertCircle className="h-3.5 w-3.5" />
        After uploading, navigate to the property to complete the compliance record.
      </p>

      <Button className="w-full" onClick={() => navigate(risk.targetUrl)}>
        <ExternalLink className="h-4 w-4 mr-2" />
        Go to Property to Upload
      </Button>
    </div>
  );
}

// ─── Payment Panel ───
function PaymentPanel({ risk }: { risk: RiskItem }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This financial action needs to be resolved from the property detail page where you can update loan details, record payments, or adjust cashflow data.
      </p>

      <Button className="w-full" onClick={() => navigate(risk.targetUrl)}>
        <ExternalLink className="h-4 w-4 mr-2" />
        Go to Property Details
      </Button>
    </div>
  );
}

// ─── Link Panel ───
function LinkPanel({ risk }: { risk: RiskItem }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Navigate to the relevant page to fill in the missing data or update the record.
      </p>

      <Button className="w-full" onClick={() => navigate(risk.targetUrl)}>
        <ExternalLink className="h-4 w-4 mr-2" />
        Go to Record
      </Button>
    </div>
  );
}

export function ResolveActionDialog({ open, onOpenChange, risk }: ResolveActionDialogProps) {
  if (!risk) return null;

  const mode = getResolveMode(risk.type);
  const modeInfo = getResolveModeLabel(mode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {modeInfo.icon}
            {modeInfo.title}
          </DialogTitle>
          <DialogDescription>{modeInfo.description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-3 mb-2">
          <p className="text-sm font-medium">{risk.address}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{risk.message}</p>
        </div>

        {mode === 'upload' && <UploadPanel risk={risk} />}
        {mode === 'payment' && <PaymentPanel risk={risk} />}
        {mode === 'link' && <LinkPanel risk={risk} />}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
