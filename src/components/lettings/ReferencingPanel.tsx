import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle, XCircle, Clock, AlertTriangle, Shield, Briefcase, Home, UserCheck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatGBP } from '@/lib/calculations';
import {
  useTenantReferences,
  useCreateReference,
  useUpdateReference,
  useApproveApplicant,
  type TenantReference,
} from '@/hooks/useLettingsWorkflow';
import type { LettingsPipelineItem } from '@/hooks/useLettingsPipeline';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
  pending: { label: 'Pending', variant: 'outline', icon: Clock },
  received: { label: 'Received', variant: 'secondary', icon: Clock },
  passed: { label: 'Passed', variant: 'default', icon: CheckCircle },
  satisfactory: { label: 'Satisfactory', variant: 'default', icon: CheckCircle },
  failed: { label: 'Failed', variant: 'destructive', icon: XCircle },
  unsatisfactory: { label: 'Unsatisfactory', variant: 'destructive', icon: XCircle },
  conditional: { label: 'Conditional', variant: 'secondary', icon: AlertTriangle },
  confirmed: { label: 'Confirmed', variant: 'default', icon: CheckCircle },
  refused: { label: 'Refused', variant: 'destructive', icon: XCircle },
  not_required: { label: 'Not Required', variant: 'outline', icon: CheckCircle },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function isCheckComplete(status: string): boolean {
  return ['passed', 'satisfactory', 'confirmed', 'not_required'].includes(status);
}

interface ReferencingPanelProps {
  item: LettingsPipelineItem;
}

export function ReferencingPanel({ item }: ReferencingPanelProps) {
  const { data: ref, isLoading } = useTenantReferences(item.id);
  const createRef = useCreateReference();
  const updateRef = useUpdateReference();
  const approveApplicant = useApproveApplicant();
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState(item.offered_to_name || '');
  const [createEmail, setCreateEmail] = useState(item.offered_to_email || '');
  const [createPhone, setCreatePhone] = useState(item.offered_to_phone || '');

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading references…</p>;

  if (!ref && !showCreate) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">No referencing record yet for this letting.</p>
        <Button onClick={() => setShowCreate(true)}>Start Referencing</Button>
      </div>
    );
  }

  if (!ref && showCreate) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Create Reference Record</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Applicant Name</Label>
            <Input value={createName} onChange={e => setCreateName(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={createPhone} onChange={e => setCreatePhone(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button
              disabled={!createName || createRef.isPending}
              onClick={() => createRef.mutate({
                letting_id: item.id,
                applicant_name: createName,
                applicant_email: createEmail || undefined,
                applicant_phone: createPhone || undefined,
              })}
            >
              Create
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!ref) return null;

  const checks = [
    { label: 'Credit Check', status: ref.credit_check_status },
    { label: 'Employment', status: ref.employer_ref_status },
    { label: 'Landlord', status: ref.landlord_ref_status },
    { label: 'Right to Rent', status: ref.right_to_rent_checked ? 'passed' : 'pending' },
    { label: 'Guarantor', status: ref.guarantor_required ? ref.guarantor_status : 'not_required' },
  ];
  const completedCount = checks.filter(c => isCheckComplete(c.status)).length;
  const progressPercent = (completedCount / checks.length) * 100;
  const allComplete = completedCount === checks.length;

  const monthlyIncome = ref.annual_income ? ref.annual_income / 12 : null;
  const monthlyRent = item.offered_rent || item.advertised_rent || 0;
  const rentToIncomeRatio = monthlyIncome && monthlyRent ? (monthlyRent / monthlyIncome) * 100 : null;
  const affordabilityFlag = rentToIncomeRatio !== null && rentToIncomeRatio > 35;

  const update = (fields: Partial<TenantReference>) => {
    updateRef.mutate({ id: ref.id, lettingId: item.id, ...fields });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{ref.applicant_name}</h3>
          <p className="text-sm text-muted-foreground">{ref.applicant_email} {ref.applicant_phone ? `· ${ref.applicant_phone}` : ''}</p>
        </div>
        <StatusBadge status={ref.overall_status} />
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span>{completedCount} of {checks.length} checks complete</span>
          <span className="text-muted-foreground">{Math.round(progressPercent)}%</span>
        </div>
        <Progress value={progressPercent} />
      </div>

      {/* Affordability */}
      {monthlyRent > 0 && (
        <Card className={cn(affordabilityFlag && 'border-orange-300 bg-orange-50 dark:bg-orange-950/20')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm">
              {affordabilityFlag && <AlertTriangle className="h-4 w-4 text-orange-500" />}
              <span className="font-medium">Affordability:</span>
              <span>
                Rent {formatGBP(monthlyRent)}/mo
                {monthlyIncome ? ` vs Income ${formatGBP(monthlyIncome)}/mo` : ' — income not entered'}
                {rentToIncomeRatio !== null && (
                  <span className={cn('ml-1 font-medium', affordabilityFlag ? 'text-orange-600' : 'text-green-600')}>
                    ({rentToIncomeRatio.toFixed(1)}% of income)
                  </span>
                )}
              </span>
            </div>
            {affordabilityFlag && (
              <p className="text-xs text-orange-600 mt-1">Rent exceeds 35% of gross monthly income</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Credit Check */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> Credit Check</CardTitle>
            <StatusBadge status={ref.credit_check_status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select
                value={ref.credit_check_status}
                onValueChange={(v) => update({ credit_check_status: v as TenantReference['credit_check_status'] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="conditional">Conditional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Credit Score</Label>
              <Input
                type="number"
                defaultValue={ref.credit_score ?? ''}
                onBlur={e => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  if (val !== ref.credit_score) update({ credit_score: val });
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Check Date</Label>
              <Input
                type="date"
                defaultValue={ref.credit_check_date ?? ''}
                onBlur={e => {
                  if (e.target.value !== (ref.credit_check_date ?? '')) update({ credit_check_date: e.target.value || null });
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employment Reference */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Briefcase className="h-4 w-4" /> Employment Reference</CardTitle>
            <StatusBadge status={ref.employer_ref_status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Employment Status</Label>
              <Select
                value={ref.employment_status ?? ''}
                onValueChange={(v) => update({ employment_status: v as TenantReference['employment_status'] })}
              >
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employed">Employed</SelectItem>
                  <SelectItem value="self_employed">Self-Employed</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="unemployed">Unemployed</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Annual Income</Label>
              <Input
                type="number"
                defaultValue={ref.annual_income ?? ''}
                onBlur={e => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  if (val !== ref.annual_income) update({ annual_income: val });
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Employer Name</Label>
              <Input
                defaultValue={ref.employer_name ?? ''}
                onBlur={e => {
                  if (e.target.value !== (ref.employer_name ?? '')) update({ employer_name: e.target.value || null });
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Employer Contact</Label>
              <Input
                defaultValue={ref.employer_contact ?? ''}
                onBlur={e => {
                  if (e.target.value !== (ref.employer_contact ?? '')) update({ employer_contact: e.target.value || null });
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Reference Status</Label>
              <Select
                value={ref.employer_ref_status}
                onValueChange={(v) => update({ employer_ref_status: v as TenantReference['employer_ref_status'] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="satisfactory">Satisfactory</SelectItem>
                  <SelectItem value="unsatisfactory">Unsatisfactory</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Previous Landlord Reference */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Home className="h-4 w-4" /> Previous Landlord Reference</CardTitle>
            <StatusBadge status={ref.landlord_ref_status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Landlord Name</Label>
              <Input
                defaultValue={ref.previous_landlord_name ?? ''}
                onBlur={e => {
                  if (e.target.value !== (ref.previous_landlord_name ?? '')) update({ previous_landlord_name: e.target.value || null });
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Landlord Contact</Label>
              <Input
                defaultValue={ref.previous_landlord_contact ?? ''}
                onBlur={e => {
                  if (e.target.value !== (ref.previous_landlord_contact ?? '')) update({ previous_landlord_contact: e.target.value || null });
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Reference Status</Label>
              <Select
                value={ref.landlord_ref_status}
                onValueChange={(v) => update({ landlord_ref_status: v as TenantReference['landlord_ref_status'] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="satisfactory">Satisfactory</SelectItem>
                  <SelectItem value="unsatisfactory">Unsatisfactory</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Right to Rent */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><UserCheck className="h-4 w-4" /> Right to Rent</CardTitle>
            <StatusBadge status={ref.right_to_rent_checked ? 'passed' : 'pending'} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ref.right_to_rent_checked}
                onChange={e => update({ right_to_rent_checked: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label className="text-xs">Verified</Label>
            </div>
            <div>
              <Label className="text-xs">Document Type</Label>
              <Input
                defaultValue={ref.right_to_rent_doc_type ?? ''}
                placeholder="e.g., Passport, BRP"
                onBlur={e => {
                  if (e.target.value !== (ref.right_to_rent_doc_type ?? '')) update({ right_to_rent_doc_type: e.target.value || null });
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Expiry Date</Label>
              <Input
                type="date"
                defaultValue={ref.right_to_rent_expiry ?? ''}
                onBlur={e => {
                  if (e.target.value !== (ref.right_to_rent_expiry ?? '')) update({ right_to_rent_expiry: e.target.value || null });
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guarantor */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Guarantor</CardTitle>
            <StatusBadge status={ref.guarantor_required ? ref.guarantor_status : 'not_required'} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={ref.guarantor_required}
              onChange={e => update({
                guarantor_required: e.target.checked,
                guarantor_status: e.target.checked ? 'pending' : 'not_required',
              })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label className="text-xs">Guarantor Required</Label>
          </div>
          {ref.guarantor_required && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Guarantor Name</Label>
                <Input
                  defaultValue={ref.guarantor_name ?? ''}
                  onBlur={e => {
                    if (e.target.value !== (ref.guarantor_name ?? '')) update({ guarantor_name: e.target.value || null });
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Guarantor Contact</Label>
                <Input
                  defaultValue={ref.guarantor_contact ?? ''}
                  onBlur={e => {
                    if (e.target.value !== (ref.guarantor_contact ?? '')) update({ guarantor_contact: e.target.value || null });
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select
                  value={ref.guarantor_status}
                  onValueChange={(v) => update({ guarantor_status: v as TenantReference['guarantor_status'] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="refused">Refused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <div>
        <Label className="text-xs">Notes</Label>
        <Textarea
          defaultValue={ref.notes ?? ''}
          placeholder="Additional notes about this reference…"
          onBlur={e => {
            if (e.target.value !== (ref.notes ?? '')) update({ notes: e.target.value || null });
          }}
        />
      </div>

      {/* Approve / Reject */}
      {ref.overall_status === 'in_progress' && allComplete && (
        <div className="flex gap-2 pt-2">
          <Button
            className="flex-1"
            onClick={() => approveApplicant.mutate({ id: ref.id, lettingId: item.id, status: 'approved' })}
            disabled={approveApplicant.isPending}
          >
            <CheckCircle className="h-4 w-4 mr-1" /> Approve Applicant
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => approveApplicant.mutate({ id: ref.id, lettingId: item.id, status: 'rejected' })}
            disabled={approveApplicant.isPending}
          >
            <XCircle className="h-4 w-4 mr-1" /> Reject Applicant
          </Button>
        </div>
      )}

      {ref.overall_status === 'approved' && (
        <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/20 p-3 text-center">
          <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
          <p className="text-sm font-medium text-green-700">Applicant Approved</p>
        </div>
      )}

      {ref.overall_status === 'rejected' && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 text-center">
          <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
          <p className="text-sm font-medium text-red-700">Applicant Rejected</p>
        </div>
      )}
    </div>
  );
}
