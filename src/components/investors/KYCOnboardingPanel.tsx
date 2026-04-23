import { useState } from 'react';
import {
  ShieldCheck, FileText, MapPin, Wallet, AlertTriangle, CheckCircle2, Clock, XCircle, Upload,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useInvestorKYC, useUpdateKYC, useApproveKYC, InvestorKYC } from '@/hooks/useInvestorOnboarding';

const KYC_STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20', icon: Clock },
  in_progress: { label: 'In Progress', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Clock },
  approved: { label: 'Approved', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2 },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
  expired: { label: 'Expired', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: AlertTriangle },
};

const ID_DOC_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'driving_licence', label: 'Driving Licence' },
  { value: 'national_id', label: 'National ID' },
];

const ADDRESS_DOC_TYPES = [
  { value: 'utility_bill', label: 'Utility Bill' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'council_tax', label: 'Council Tax Bill' },
  { value: 'mortgage_statement', label: 'Mortgage Statement' },
];

interface CheckItemProps {
  icon: React.ElementType;
  title: string;
  verified: boolean;
  children: React.ReactNode;
}

function CheckItem({ icon: Icon, title, verified, children }: CheckItemProps) {
  return (
    <div className="flex gap-4 p-4 border rounded-lg">
      <div className={`mt-0.5 ${verified ? 'text-emerald-600' : 'text-muted-foreground'}`}>
        {verified ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">{title}</h4>
          <Badge variant="outline" className={verified
            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
          }>
            {verified ? 'Verified' : 'Pending'}
          </Badge>
        </div>
        {children}
      </div>
    </div>
  );
}

export function KYCOnboardingPanel({ investorId }: { investorId: string }) {
  const { data: kyc, isLoading } = useInvestorKYC(investorId);
  const updateKYC = useUpdateKYC();
  const approveKYC = useApproveKYC();
  const [showApproveDialog, setShowApproveDialog] = useState(false);

  const handleUpdate = (field: string, value: string | boolean) => {
    updateKYC.mutate({ investorId, data: { [field]: value } as Partial<InvestorKYC> });
  };

  const handleApprove = () => {
    if (kyc?.id) {
      approveKYC.mutate(kyc.id, { onSuccess: () => setShowApproveDialog(false) });
    }
  };

  const statusConfig = KYC_STATUS_CONFIG[kyc?.kyc_status || 'pending'] || KYC_STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  const expiryDays = kyc?.expires_at
    ? differenceInDays(new Date(kyc.expires_at), new Date())
    : null;
  const isExpiringSoon = expiryDays !== null && expiryDays > 0 && expiryDays <= 30;
  const isExpired = expiryDays !== null && expiryDays <= 0;

  const checksComplete = kyc
    ? [kyc.id_verified, kyc.address_verified, kyc.source_of_funds_verified, kyc.pep_check_completed && kyc.sanctions_check_completed].filter(Boolean).length
    : 0;
  const totalChecks = 4;

  if (isLoading) {
    return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`text-sm py-1 px-3 ${statusConfig.className}`}>
            <StatusIcon className="h-3.5 w-3.5 mr-1.5" />
            {statusConfig.label}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {checksComplete} of {totalChecks} checks complete
          </span>
        </div>
        <div className="flex items-center gap-2">
          {kyc?.expires_at && (
            <span className={`text-sm ${isExpired ? 'text-destructive' : isExpiringSoon ? 'text-amber-600' : 'text-muted-foreground'}`}>
              {isExpired ? 'Expired' : `Expires ${format(new Date(kyc.expires_at), 'dd MMM yyyy')}`}
              {isExpiringSoon && ` (${expiryDays} days)`}
            </span>
          )}
          {kyc?.kyc_status !== 'approved' && checksComplete === totalChecks && (
            <Button size="sm" onClick={() => setShowApproveDialog(true)}>
              <ShieldCheck className="h-4 w-4 mr-1" />
              Approve KYC
            </Button>
          )}
        </div>
      </div>

      {/* Expiry Warning */}
      {(isExpiringSoon || isExpired) && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${isExpired ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-700'}`}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {isExpired
            ? 'KYC verification has expired. Re-verification is required.'
            : `KYC expires in ${expiryDays} days. Schedule re-verification.`}
        </div>
      )}

      {/* Checklist */}
      <div className="space-y-4">
        {/* 1. Identity Verification */}
        <CheckItem icon={FileText} title="Identity Verification" verified={kyc?.id_verified || false}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Document Type</Label>
              <Select
                value={kyc?.id_document_type || ''}
                onValueChange={(v) => handleUpdate('id_document_type', v)}
              >
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ID_DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Document URL</Label>
              <Input
                className="h-8 text-sm mt-1"
                placeholder="Upload or paste URL"
                defaultValue={kyc?.id_document_url || ''}
                onBlur={(e) => handleUpdate('id_document_url', e.target.value)}
              />
            </div>
          </div>
          {kyc?.id_document_type && !kyc.id_verified && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => handleUpdate('id_verified', true)}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Mark Verified
            </Button>
          )}
          {kyc?.id_verified && kyc.id_verified_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Verified on {format(new Date(kyc.id_verified_at), 'dd MMM yyyy')}
            </p>
          )}
        </CheckItem>

        {/* 2. Address Verification */}
        <CheckItem icon={MapPin} title="Address Verification" verified={kyc?.address_verified || false}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Document Type</Label>
              <Select
                value={kyc?.proof_of_address_type || ''}
                onValueChange={(v) => handleUpdate('proof_of_address_type', v)}
              >
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ADDRESS_DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Document URL</Label>
              <Input
                className="h-8 text-sm mt-1"
                placeholder="Upload or paste URL"
                defaultValue={kyc?.proof_of_address_url || ''}
                onBlur={(e) => handleUpdate('proof_of_address_url', e.target.value)}
              />
            </div>
          </div>
          {kyc?.proof_of_address_type && !kyc.address_verified && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => handleUpdate('address_verified', true)}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Mark Verified
            </Button>
          )}
        </CheckItem>

        {/* 3. Source of Funds */}
        <CheckItem icon={Wallet} title="Source of Funds" verified={kyc?.source_of_funds_verified || false}>
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                className="text-sm mt-1 min-h-[60px]"
                placeholder="Describe source of funds..."
                defaultValue={kyc?.source_of_funds || ''}
                onBlur={(e) => handleUpdate('source_of_funds', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Supporting Document URL</Label>
              <Input
                className="h-8 text-sm mt-1"
                placeholder="Upload or paste URL"
                defaultValue={kyc?.source_of_funds_doc_url || ''}
                onBlur={(e) => handleUpdate('source_of_funds_doc_url', e.target.value)}
              />
            </div>
          </div>
          {kyc?.source_of_funds && !kyc.source_of_funds_verified && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => handleUpdate('source_of_funds_verified', true)}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Mark Verified
            </Button>
          )}
        </CheckItem>

        {/* 4. PEP/Sanctions */}
        <CheckItem
          icon={ShieldCheck}
          title="PEP & Sanctions Check"
          verified={kyc?.pep_check_completed && kyc?.sanctions_check_completed || false}
        >
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={kyc?.pep_check_completed
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : ''
              }>
                PEP: {kyc?.pep_check_completed ? 'Complete' : 'Pending'}
              </Badge>
              {!kyc?.pep_check_completed && (
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleUpdate('pep_check_completed', true)}>
                  Complete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={kyc?.sanctions_check_completed
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : ''
              }>
                Sanctions: {kyc?.sanctions_check_completed ? 'Complete' : 'Pending'}
              </Badge>
              {!kyc?.sanctions_check_completed && (
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleUpdate('sanctions_check_completed', true)}>
                  Complete
                </Button>
              )}
            </div>
          </div>
          {kyc?.pep_check_completed && kyc?.sanctions_check_completed && kyc?.pep_sanctions_clear === null && (
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => handleUpdate('pep_sanctions_clear', true)}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Clear
              </Button>
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleUpdate('pep_sanctions_clear', false)}>
                <XCircle className="h-3.5 w-3.5 mr-1" />Flagged
              </Button>
            </div>
          )}
          {kyc?.pep_sanctions_clear === true && (
            <p className="text-xs text-emerald-600 mt-1">All clear - no PEP or sanctions matches</p>
          )}
          {kyc?.pep_sanctions_clear === false && (
            <p className="text-xs text-destructive mt-1">Flagged - review required before approval</p>
          )}
        </CheckItem>
      </div>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            className="text-sm min-h-[80px]"
            placeholder="Add notes about this KYC process..."
            defaultValue={kyc?.notes || ''}
            onBlur={(e) => handleUpdate('notes', e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve KYC</DialogTitle>
            <DialogDescription>
              Confirm identity and address checks are complete and approve this investor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Confirming will mark this investor's KYC as approved. The approval will be valid for 12 months.
            </p>
            <div className="text-sm space-y-1">
              <p>Identity: <strong>{kyc?.id_verified ? 'Verified' : 'Not verified'}</strong></p>
              <p>Address: <strong>{kyc?.address_verified ? 'Verified' : 'Not verified'}</strong></p>
              <p>Source of Funds: <strong>{kyc?.source_of_funds_verified ? 'Verified' : 'Not verified'}</strong></p>
              <p>PEP/Sanctions: <strong>{kyc?.pep_sanctions_clear ? 'Clear' : 'Incomplete'}</strong></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={approveKYC.isPending}>
              <ShieldCheck className="h-4 w-4 mr-1" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
