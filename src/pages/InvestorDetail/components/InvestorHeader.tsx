import { ArrowLeft, Edit, Mail, Phone, ShieldCheck, Award, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TYPE_BADGE } from '../utils/badges';

type Investor = {
  id: string;
  investor_name: string;
  investor_type: string;
  email?: string | null;
  phone?: string | null;
  accredited_investor?: boolean | null;
  kyc_completed?: boolean | null;
  portal_access_enabled?: boolean | null;
};

export function InvestorHeader({
  investor,
  onBack,
  onEdit,
  onShowReport,
  onSendPortalAccess,
  canSendPortalAccess,
  sendingPortalAccess,
}: {
  investor: Investor;
  onBack: () => void;
  onEdit: () => void;
  onShowReport: () => void;
  onSendPortalAccess: () => void;
  canSendPortalAccess: boolean;
  sendingPortalAccess: boolean;
}) {
  const typeConfig = TYPE_BADGE[investor.investor_type] || TYPE_BADGE.individual;
  return (
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-1">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Investors
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{investor.investor_name}</h1>
          <Badge variant="outline" className={typeConfig.className}>{typeConfig.label}</Badge>
          {investor.accredited_investor && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"><Award className="h-3 w-3 mr-1" />Accredited</Badge>}
          {investor.kyc_completed ? (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"><ShieldCheck className="h-3 w-3 mr-1" />KYC Complete</Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">KYC Pending</Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {investor.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{investor.email}</span>}
          {investor.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{investor.phone}</span>}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" disabled={!canSendPortalAccess || sendingPortalAccess} onClick={onSendPortalAccess}>
          <Mail className="h-4 w-4 mr-2" />
          Send Portal Access
        </Button>
        <Button variant="outline" onClick={onShowReport}>
          <FileText className="h-4 w-4 mr-2" />Statement
        </Button>
        <Button variant="outline" onClick={onEdit}>
          <Edit className="h-4 w-4 mr-2" />Edit
        </Button>
      </div>
    </div>
  );
}
