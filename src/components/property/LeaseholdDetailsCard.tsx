import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Building, Edit2, AlertTriangle } from 'lucide-react';
import { formatGBP } from '@/lib/calculations';
import { format } from 'date-fns';
import { useLeaseholdDetails, useUpsertLeaseholdDetails } from '@/hooks/useLeaseholdDetails';

interface LeaseholdDetailsCardProps {
  propertyId: string;
  leaseYearsRemaining?: number | null;
  tenure?: string | null;
}

export function LeaseholdDetailsCard({ propertyId, leaseYearsRemaining, tenure }: LeaseholdDetailsCardProps) {
  const isLeasehold = tenure === 'Leasehold' || tenure === 'Share of Freehold';
  const { data: details, isLoading } = useLeaseholdDetails(isLeasehold ? propertyId : undefined);
  const upsert = useUpsertLeaseholdDetails();
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    groundRentAnnual: '',
    groundRentReviewDate: '',
    groundRentEscalation: '',
    serviceChargeAnnual: '',
    serviceChargeReviewDate: '',
    managingAgent: '',
    managingAgentPhone: '',
    managingAgentEmail: '',
    leaseStartDate: '',
    originalTermYears: '',
    nextReviewDate: '',
    section20NoticesPending: false,
    notes: '',
  });

  if (!isLeasehold) return null;

  const handleOpenDialog = () => {
    if (details) {
      setFormData({
        groundRentAnnual: details.ground_rent_annual?.toString() || '',
        groundRentReviewDate: details.ground_rent_review_date || '',
        groundRentEscalation: details.ground_rent_escalation || '',
        serviceChargeAnnual: details.service_charge_annual?.toString() || '',
        serviceChargeReviewDate: details.service_charge_review_date || '',
        managingAgent: details.managing_agent || '',
        managingAgentPhone: details.managing_agent_phone || '',
        managingAgentEmail: details.managing_agent_email || '',
        leaseStartDate: details.lease_start_date || '',
        originalTermYears: details.original_term_years?.toString() || '',
        nextReviewDate: details.next_review_date || '',
        section20NoticesPending: details.section_20_notices_pending || false,
        notes: details.notes || '',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    await upsert.mutateAsync({
      propertyId,
      groundRentAnnual: formData.groundRentAnnual ? parseFloat(formData.groundRentAnnual) : undefined,
      groundRentReviewDate: formData.groundRentReviewDate || undefined,
      groundRentEscalation: formData.groundRentEscalation || undefined,
      serviceChargeAnnual: formData.serviceChargeAnnual ? parseFloat(formData.serviceChargeAnnual) : undefined,
      serviceChargeReviewDate: formData.serviceChargeReviewDate || undefined,
      managingAgent: formData.managingAgent || undefined,
      managingAgentPhone: formData.managingAgentPhone || undefined,
      managingAgentEmail: formData.managingAgentEmail || undefined,
      leaseStartDate: formData.leaseStartDate || undefined,
      originalTermYears: formData.originalTermYears ? parseInt(formData.originalTermYears) : undefined,
      nextReviewDate: formData.nextReviewDate || undefined,
      section20NoticesPending: formData.section20NoticesPending,
      notes: formData.notes || undefined,
    });
    setDialogOpen(false);
  };

  // Lease health assessment
  const getLeaseHealthBadge = () => {
    if (!leaseYearsRemaining) return null;
    if (leaseYearsRemaining < 60) return <Badge variant="destructive" className="text-xs">Critical — Below 60 yrs</Badge>;
    if (leaseYearsRemaining < 80) return <Badge className="text-xs bg-amber-500/20 text-amber-500 border-amber-500/30">Warning — Below 80 yrs</Badge>;
    return <Badge variant="secondary" className="text-xs">Healthy</Badge>;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building className="h-4 w-4 text-primary" />
          Leasehold Details
        </CardTitle>
        <Button variant="outline" size="sm" onClick={handleOpenDialog}>
          <Edit2 className="h-3 w-3 mr-1" /> {details ? 'Edit' : 'Add Details'}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-3">
            {/* Lease health warning */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Lease Remaining</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{leaseYearsRemaining ?? '—'} years</span>
                {getLeaseHealthBadge()}
              </div>
            </div>

            {leaseYearsRemaining && leaseYearsRemaining < 80 && (
              <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-500">
                  {leaseYearsRemaining < 60
                    ? 'Below 60 years — most lenders will not offer a mortgage. Lease extension strongly recommended.'
                    : 'Below 80 years — approaching the threshold where lease extensions become significantly more expensive (marriage value applies).'}
                </p>
              </div>
            )}

            {details ? (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {details.ground_rent_annual != null && (
                  <>
                    <span className="text-muted-foreground">Ground Rent</span>
                    <span className="font-medium">{formatGBP(details.ground_rent_annual)}/yr</span>
                  </>
                )}
                {details.service_charge_annual != null && (
                  <>
                    <span className="text-muted-foreground">Service Charge</span>
                    <span className="font-medium">{formatGBP(details.service_charge_annual)}/yr</span>
                  </>
                )}
                {details.managing_agent && (
                  <>
                    <span className="text-muted-foreground">Managing Agent</span>
                    <span className="font-medium">{details.managing_agent}</span>
                  </>
                )}
                {details.section_20_notices_pending && (
                  <>
                    <span className="text-muted-foreground">Section 20</span>
                    <Badge variant="destructive" className="text-xs w-fit">Notice Pending</Badge>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No leasehold details recorded yet.</p>
            )}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Leasehold Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ground Rent (£/yr)</Label>
                  <Input type="number" step="0.01" value={formData.groundRentAnnual} onChange={e => setFormData(f => ({ ...f, groundRentAnnual: e.target.value }))} />
                </div>
                <div>
                  <Label>Ground Rent Review Date</Label>
                  <Input type="date" value={formData.groundRentReviewDate} onChange={e => setFormData(f => ({ ...f, groundRentReviewDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Ground Rent Escalation</Label>
                <Input value={formData.groundRentEscalation} onChange={e => setFormData(f => ({ ...f, groundRentEscalation: e.target.value }))} placeholder="e.g. Fixed, RPI, Doubles every 25 yrs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Service Charge (£/yr)</Label>
                  <Input type="number" step="0.01" value={formData.serviceChargeAnnual} onChange={e => setFormData(f => ({ ...f, serviceChargeAnnual: e.target.value }))} />
                </div>
                <div>
                  <Label>Service Charge Review</Label>
                  <Input type="date" value={formData.serviceChargeReviewDate} onChange={e => setFormData(f => ({ ...f, serviceChargeReviewDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Managing Agent</Label>
                <Input value={formData.managingAgent} onChange={e => setFormData(f => ({ ...f, managingAgent: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Agent Phone</Label>
                  <Input value={formData.managingAgentPhone} onChange={e => setFormData(f => ({ ...f, managingAgentPhone: e.target.value }))} />
                </div>
                <div>
                  <Label>Agent Email</Label>
                  <Input type="email" value={formData.managingAgentEmail} onChange={e => setFormData(f => ({ ...f, managingAgentEmail: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Lease Start Date</Label>
                  <Input type="date" value={formData.leaseStartDate} onChange={e => setFormData(f => ({ ...f, leaseStartDate: e.target.value }))} />
                </div>
                <div>
                  <Label>Original Term (years)</Label>
                  <Input type="number" value={formData.originalTermYears} onChange={e => setFormData(f => ({ ...f, originalTermYears: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Next Review Date</Label>
                <Input type="date" value={formData.nextReviewDate} onChange={e => setFormData(f => ({ ...f, nextReviewDate: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={formData.section20NoticesPending} onCheckedChange={v => setFormData(f => ({ ...f, section20NoticesPending: v }))} />
                <Label>Section 20 notice pending</Label>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <Button onClick={handleSave} disabled={upsert.isPending} className="w-full">
                {upsert.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
