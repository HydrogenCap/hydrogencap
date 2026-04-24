import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, AlertTriangle, FileText, ExternalLink } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import {
  usePlanningApplications,
  useCreatePlanningApplication,
  useUpdatePlanningApplication,
  type PlanningApplication,
} from '@/hooks/useCapexUpgrade';

const APP_TYPE_LABELS: Record<string, string> = {
  planning: 'Planning Permission',
  building_regs: 'Building Regulations',
  hmo_licence: 'HMO Licence',
  listed_building: 'Listed Building Consent',
};

const STATUS_PIPELINE = ['submitted', 'validated', 'consultation', 'approved', 'refused', 'conditions_discharge', 'withdrawn'] as const;

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  submitted: { label: 'Submitted', variant: 'secondary' },
  validated: { label: 'Validated', variant: 'secondary' },
  consultation: { label: 'Consultation', variant: 'default' },
  approved: { label: 'Approved', variant: 'outline' },
  refused: { label: 'Refused', variant: 'destructive' },
  conditions_discharge: { label: 'Conditions Discharge', variant: 'default' },
  withdrawn: { label: 'Withdrawn', variant: 'secondary' },
};

export default function PlanningTracker({ projectId, propertyId }: { projectId: string; propertyId: string }) {
  const { data: apps = [], isLoading } = usePlanningApplications(projectId);
  const updateApp = useUpdatePlanningApplication();
  const [showAdd, setShowAdd] = useState(false);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Planning Applications</h3>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-3 w-3 mr-1" /> New Application
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : apps.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No planning applications. Add one to track submissions and approvals.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {apps.map(app => {
            const statusInfo = STATUS_LABELS[app.status] || STATUS_LABELS.submitted;
            const conditions = (app.conditions || []) as Array<{ text: string; discharged: boolean }>;
            const allDischarged = conditions.length > 0 && conditions.every(c => c.discharged);

            // Expiry check
            const expiryDate = app.expiry_date ? parseISO(app.expiry_date) : null;
            const daysUntilExpiry = expiryDate ? differenceInDays(expiryDate, new Date()) : null;
            const expiryWarning = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 180;
            const expired = daysUntilExpiry !== null && daysUntilExpiry <= 0;

            const isExpanded = expandedApp === app.id;

            return (
              <Card key={app.id} className={expired ? 'border-destructive' : expiryWarning ? 'border-amber-300' : ''}>
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpandedApp(isExpanded ? null : app.id)}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{APP_TYPE_LABELS[app.application_type] || app.application_type}</span>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        {expired && <Badge variant="destructive">Expired</Badge>}
                        {expiryWarning && <Badge variant="secondary">Expires soon</Badge>}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                        {app.reference_number && <span>Ref: {app.reference_number}</span>}
                        {app.authority_name && <span>{app.authority_name}</span>}
                        {app.submitted_date && <span>Submitted: {format(parseISO(app.submitted_date), 'dd MMM yyyy')}</span>}
                        {app.decision_date && <span>Decision: {format(parseISO(app.decision_date), 'dd MMM yyyy')}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Expiry alert */}
                  {(expired || expiryWarning) && (
                    <div className={`mt-3 p-2 rounded text-xs flex items-center gap-2 ${expired ? 'bg-destructive/10 text-destructive' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'}`}>
                      <AlertTriangle className="h-3 w-3" />
                      {expired
                        ? 'Planning permission has expired. Works must have commenced within 3 years of approval.'
                        : `Planning permission expires on ${format(expiryDate!, 'dd MMM yyyy')} (${daysUntilExpiry} days). Ensure works have commenced.`
                      }
                    </div>
                  )}

                  {/* Status pipeline */}
                  <div className="flex items-center gap-1 mt-3 overflow-x-auto">
                    {STATUS_PIPELINE.filter(s => !['refused', 'withdrawn'].includes(s) || app.status === s).map((step, idx) => {
                      const pipelineIdx = STATUS_PIPELINE.indexOf(app.status as typeof STATUS_PIPELINE[number]);
                      const stepIdx = STATUS_PIPELINE.indexOf(step);
                      const isCurrent = step === app.status;
                      const isPast = stepIdx < pipelineIdx;
                      return (
                        <div key={step} className="flex items-center gap-1">
                          {idx > 0 && <div className={`w-4 h-0.5 ${isPast ? 'bg-primary' : 'bg-muted'}`} />}
                          <div
                            className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                              isCurrent ? 'bg-primary text-primary-foreground font-medium' :
                              isPast ? 'bg-primary/20 text-primary' :
                              'bg-muted text-muted-foreground'
                            }`}
                          >
                            {STATUS_LABELS[step]?.label || step}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      {/* Conditions */}
                      {conditions.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">
                            Conditions ({conditions.filter(c => c.discharged).length}/{conditions.length} discharged)
                          </h4>
                          <div className="space-y-2">
                            {conditions.map((cond, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <Checkbox
                                  checked={cond.discharged}
                                  onCheckedChange={(checked) => {
                                    const updated = [...conditions];
                                    updated[i] = { ...cond, discharged: !!checked };
                                    updateApp.mutate({ id: app.id, conditions: updated });
                                  }}
                                />
                                <span className={cond.discharged ? 'line-through text-muted-foreground' : ''}>
                                  {cond.text}
                                </span>
                              </div>
                            ))}
                          </div>
                          {allDischarged && (
                            <Badge variant="outline" className="mt-2">All conditions discharged</Badge>
                          )}
                        </div>
                      )}

                      {/* Documents */}
                      {(app.document_urls as string[])?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Documents</h4>
                          <div className="space-y-1">
                            {(app.document_urls as string[]).map((url, i) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sm text-primary hover:underline"
                              >
                                <FileText className="h-3 w-3" />
                                Document {i + 1}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Update status */}
                      <div>
                        <Label className="text-xs">Update Status</Label>
                        <Select value={app.status} onValueChange={(val) => updateApp.mutate({ id: app.id, status: val as PlanningApplication['status'] })}>
                          <SelectTrigger className="w-48 mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUS_PIPELINE.map(s => (
                              <SelectItem key={s} value={s}>{STATUS_LABELS[s]?.label || s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AddApplicationDialog open={showAdd} onOpenChange={setShowAdd} projectId={projectId} propertyId={propertyId} />
    </div>
  );
}

function AddApplicationDialog({ open, onOpenChange, projectId, propertyId }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  propertyId: string;
}) {
  const create = useCreatePlanningApplication();
  const [appType, setAppType] = useState<string>('planning');
  const [refNumber, setRefNumber] = useState('');
  const [authority, setAuthority] = useState('');
  const [submittedDate, setSubmittedDate] = useState('');

  const handleCreate = () => {
    create.mutate({
      property_id: propertyId,
      project_id: projectId,
      application_type: appType as PlanningApplication['application_type'],
      reference_number: refNumber || null,
      submitted_date: submittedDate || null,
      authority_name: authority || null,
      status: 'submitted',
      conditions: [],
      decision_date: null,
      expiry_date: null,
      document_urls: [],
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setAppType('planning');
        setRefNumber('');
        setAuthority('');
        setSubmittedDate('');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Planning Application</DialogTitle>
          <DialogDescription>Track a planning or building regulation application</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Application Type</Label>
            <Select value={appType} onValueChange={setAppType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(APP_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Reference Number</Label><Input value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder="e.g. 26/00123/FUL" /></div>
          <div><Label>Local Authority</Label><Input value={authority} onChange={e => setAuthority(e.target.value)} placeholder="e.g. Manchester City Council" /></div>
          <div><Label>Submitted Date</Label><Input type="date" value={submittedDate} onChange={e => setSubmittedDate(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={create.isPending}>
            {create.isPending ? 'Adding...' : 'Add Application'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
