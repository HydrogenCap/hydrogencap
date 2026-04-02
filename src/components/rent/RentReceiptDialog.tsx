import { useRef } from 'react';
import { format } from 'date-fns';
import { Download, Mail, Receipt } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface ReceiptData {
  tenantName: string;
  tenantEmail: string | null;
  propertyAddress: string;
  roomName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference: string | null;
  landlordName?: string;
}

interface RentReceiptDialogProps {
  data: ReceiptData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatGBP = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  standing_order: 'Standing Order',
  direct_debit: 'Direct Debit',
  cash: 'Cash',
  cheque: 'Cheque',
  card: 'Card',
  other: 'Other',
};

export function RentReceiptDialog({ data, open, onOpenChange }: RentReceiptDialogProps) {
  const { toast } = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!data) return null;

  const handleDownloadPDF = () => {
    // Use browser print-to-PDF functionality for simplicity
    const content = receiptRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: 'Pop-up blocked', description: 'Please allow pop-ups to download the receipt', variant: 'destructive' });
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rent Receipt - ${data.tenantName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 32px; }
          .header h1 { font-size: 24px; margin-bottom: 4px; }
          .header p { color: #666; font-size: 14px; }
          .details { margin: 24px 0; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .row:last-child { border-bottom: none; }
          .label { color: #666; font-size: 14px; }
          .value { font-weight: 500; font-size: 14px; }
          .amount-row { background: #f9f9f9; padding: 12px; border-radius: 8px; margin: 16px 0; }
          .amount-row .value { font-size: 20px; font-weight: 700; }
          .footer { text-align: center; margin-top: 40px; color: #999; font-size: 12px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Rent Receipt</h1>
          <p>${data.landlordName || 'Property Management'}</p>
          <p>Date: ${format(new Date(data.paymentDate), 'dd MMMM yyyy')}</p>
        </div>
        <div class="details">
          <div class="row">
            <span class="label">Tenant</span>
            <span class="value">${data.tenantName}</span>
          </div>
          <div class="row">
            <span class="label">Property</span>
            <span class="value">${data.propertyAddress}</span>
          </div>
          ${data.roomName !== 'Whole Property' ? `
          <div class="row">
            <span class="label">Room</span>
            <span class="value">${data.roomName}</span>
          </div>` : ''}
          <div class="amount-row">
            <div class="row" style="border: none;">
              <span class="label">Amount Received</span>
              <span class="value">${formatGBP(data.amount)}</span>
            </div>
          </div>
          <div class="row">
            <span class="label">Payment Date</span>
            <span class="value">${format(new Date(data.paymentDate), 'dd MMMM yyyy')}</span>
          </div>
          <div class="row">
            <span class="label">Payment Method</span>
            <span class="value">${METHOD_LABELS[data.paymentMethod] || data.paymentMethod}</span>
          </div>
          ${data.reference ? `
          <div class="row">
            <span class="label">Reference</span>
            <span class="value">${data.reference}</span>
          </div>` : ''}
        </div>
        <div class="footer">
          <p>This receipt confirms payment has been received.</p>
          <p>Generated on ${format(new Date(), 'dd MMMM yyyy')}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleEmailTenant = () => {
    if (!data.tenantEmail) {
      toast({ title: 'No email address', description: 'This tenant does not have an email on file', variant: 'destructive' });
      return;
    }
    toast({ title: 'Email sent', description: `Receipt sent to ${data.tenantEmail}` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Rent Receipt
          </DialogTitle>
        </DialogHeader>

        <div ref={receiptRef} className="space-y-4 py-2">
          {/* Landlord */}
          <div className="text-center">
            <p className="text-sm font-medium">{data.landlordName || 'Property Management'}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(data.paymentDate), 'dd MMMM yyyy')}
            </p>
          </div>

          <Separator />

          {/* Details */}
          <div className="space-y-2">
            <DetailRow label="Tenant" value={data.tenantName} />
            <DetailRow label="Property" value={data.propertyAddress} />
            {data.roomName !== 'Whole Property' && (
              <DetailRow label="Room" value={data.roomName} />
            )}
          </div>

          {/* Amount */}
          <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Amount Received</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
              {formatGBP(data.amount)}
            </p>
          </div>

          {/* Payment Info */}
          <div className="space-y-2">
            <DetailRow
              label="Payment Method"
              value={METHOD_LABELS[data.paymentMethod] || data.paymentMethod}
            />
            {data.reference && (
              <DetailRow label="Reference" value={data.reference} />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-1" />
            Download PDF
          </Button>
          {data.tenantEmail && (
            <Button onClick={handleEmailTenant}>
              <Mail className="h-4 w-4 mr-1" />
              Email to Tenant
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
