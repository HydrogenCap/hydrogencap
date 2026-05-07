import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { LoanPurpose } from '../utils/types';

export function BrokerPackDialog({
  open, onOpenChange,
  propertyForBrokerPack, companyForBrokerPack,
  brokerPackValidation,
  loanPurpose, setLoanPurpose,
  targetLoanAmount, setTargetLoanAmount,
  targetLTV, setTargetLTV,
  preparedFor, setPreparedFor,
  brokerNotes, setBrokerNotes,
  isPending, onGenerate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propertyForBrokerPack: { address_line?: string } | null;
  companyForBrokerPack: { legal_name?: string; company_number?: string | null } | null;
  brokerPackValidation: { canGenerate: boolean; warnings: string[]; errors: string[] };
  loanPurpose: LoanPurpose;
  setLoanPurpose: (v: LoanPurpose) => void;
  targetLoanAmount: string;
  setTargetLoanAmount: (v: string) => void;
  targetLTV: string;
  setTargetLTV: (v: string) => void;
  preparedFor: string;
  setPreparedFor: (v: string) => void;
  brokerNotes: string;
  setBrokerNotes: (v: string) => void;
  isPending: boolean;
  onGenerate: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">🏦</span>
            Mortgage Broker Pack Configuration
          </DialogTitle>
          <DialogDescription>
            Configure the lender-grade documentation pack for {propertyForBrokerPack?.address_line}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {brokerPackValidation.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc ml-4 text-sm">
                  {brokerPackValidation.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {brokerPackValidation.warnings.length > 0 && (
            <Alert className="border-warning/50 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning">
                <p className="font-medium mb-1">Optional items missing:</p>
                <ul className="list-disc ml-4 text-sm">
                  {brokerPackValidation.warnings.map((warn, i) => <li key={i}>{warn}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="loan-purpose">Loan Purpose *</Label>
            <Select value={loanPurpose} onValueChange={(v) => setLoanPurpose(v as LoanPurpose)}>
              <SelectTrigger><SelectValue placeholder="Select loan purpose..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="refinance">Refinance</SelectItem>
                <SelectItem value="capital_raise">Capital Raise</SelectItem>
                <SelectItem value="rate_switch">Rate Switch</SelectItem>
                <SelectItem value="purchase">Purchase</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target-loan">Target Loan Amount (£)</Label>
              <Input id="target-loan" type="number" placeholder="e.g. 150000" value={targetLoanAmount} onChange={(e) => setTargetLoanAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-ltv">Target LTV (%)</Label>
              <Input id="target-ltv" type="number" placeholder="e.g. 75" value={targetLTV} onChange={(e) => setTargetLTV(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prepared-for">Prepared For</Label>
            <Input id="prepared-for" placeholder="Broker name or lender..." value={preparedFor} onChange={(e) => setPreparedFor(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="broker-notes-dialog">Additional Notes</Label>
            <Textarea id="broker-notes-dialog" placeholder="Any additional information for the broker..." value={brokerNotes} onChange={(e) => setBrokerNotes(e.target.value)} rows={3} />
          </div>

          {companyForBrokerPack && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
              <p className="font-medium">Borrowing Entity</p>
              <p className="text-muted-foreground">{companyForBrokerPack.legal_name}</p>
              {companyForBrokerPack.company_number && (
                <p className="text-muted-foreground text-xs">Company No: {companyForBrokerPack.company_number}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onGenerate} disabled={!brokerPackValidation.canGenerate || isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Generate Pack
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
