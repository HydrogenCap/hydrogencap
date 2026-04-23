import { useState, useCallback } from 'react';
import { format, addYears, addMonths } from 'date-fns';
import {
  Calendar, User, Upload, FileCheck, Loader2, CheckCircle,
  ChevronRight, ChevronLeft,
  AlertTriangle, Building2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { SEVERITY } from '@/lib/design-tokens';
import { useContractors } from '@/hooks/useContractors';
import {
  useBookContractor,
  useConfirmAppointment,
  useUploadRenewalCert,
  useCompleteRenewal,
  COMPLIANCE_TRADE_MAP,
  type RenewalStep,
} from '@/hooks/useRenewalWorkflow';
import { useToast } from '@/hooks/use-toast';

// Standard validity periods
const STANDARD_VALIDITY: Record<string, { years?: number; months?: number }> = {
  GAS_SAFETY: { years: 1 },
  EICR: { years: 5 },
  EPC: { years: 10 },
  HMO_LICENCE: { years: 5 },
  FIRE_ALARM: { years: 1 },
  EMERGENCY_LIGHTING: { years: 1 },
  LEGIONELLA: { years: 2 },
  PAT_TESTING: { years: 1 },
};

const COMPLIANCE_LABELS: Record<string, string> = {
  GAS_SAFETY: 'Gas Safety (CP12)',
  EICR: 'EICR',
  EPC: 'EPC',
  HMO_LICENCE: 'HMO Licence',
  FIRE_ALARM: 'Fire Alarm',
  EMERGENCY_LIGHTING: 'Emergency Lighting',
  LEGIONELLA: 'Legionella',
  PAT_TESTING: 'PAT Testing',
};

const STEPS: { key: RenewalStep; label: string; icon: React.ElementType }[] = [
  { key: 'book', label: 'Book Renewal', icon: Calendar },
  { key: 'confirm', label: 'Confirm Appointment', icon: CheckCircle },
  { key: 'upload', label: 'Upload Certificate', icon: Upload },
  { key: 'verify', label: 'Verify & Complete', icon: FileCheck },
];

interface RenewalWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  complianceItem: {
    id: string;
    property_id: string;
    compliance_type: string;
    expiry_date: string | null;
  };
  propertyAddress: string;
  onComplete?: () => void;
}

export function RenewalWorkflowDialog({
  open,
  onOpenChange,
  complianceItem,
  propertyAddress,
  onComplete,
}: RenewalWorkflowDialogProps) {
  const [currentStep, setCurrentStep] = useState<RenewalStep>('book');
  const [completed, setCompleted] = useState(false);

  // Step 1: Book Renewal
  const [selectedContractor, setSelectedContractor] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [contractorNotes, setContractorNotes] = useState('');

  // Step 2: Confirm Appointment
  const [appointmentConfirmed, setAppointmentConfirmed] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [tenantNotified, setTenantNotified] = useState(false);
  const [tenantAccessInstructions, setTenantAccessInstructions] = useState('');

  // Step 3: Upload Certificate
  const [certFile, setCertFile] = useState<File | null>(null);
  const [newIssueDate, setNewIssueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [certificateRef, setCertificateRef] = useState('');

  // Contractor query filtered by trade
  const tradeFilter = COMPLIANCE_TRADE_MAP[complianceItem.compliance_type];
  const { data: contractors } = useContractors({
    complianceType: tradeFilter,
    isActive: true,
  });

  const bookContractor = useBookContractor();
  const confirmAppointment = useConfirmAppointment();
  const uploadCert = useUploadRenewalCert();
  const completeRenewal = useCompleteRenewal();
  const { toast } = useToast();

  const isPending =
    bookContractor.isPending ||
    confirmAppointment.isPending ||
    uploadCert.isPending ||
    completeRenewal.isPending;

  const stepIndex = STEPS.findIndex(s => s.key === currentStep);

  const getDefaultExpiry = useCallback((issueDate: string) => {
    const validity = STANDARD_VALIDITY[complianceItem.compliance_type];
    if (!validity) return '';
    const issue = new Date(issueDate);
    if (validity.years) return format(addYears(issue, validity.years), 'yyyy-MM-dd');
    if (validity.months) return format(addMonths(issue, validity.months), 'yyyy-MM-dd');
    return '';
  }, [complianceItem.compliance_type]);

  const handleIssueDateChange = (date: string) => {
    setNewIssueDate(date);
    const defaultExpiry = getDefaultExpiry(date);
    if (defaultExpiry) setNewExpiryDate(defaultExpiry);
  };

  const handleStep1Submit = async () => {
    try {
      await bookContractor.mutateAsync({
        complianceItemId: complianceItem.id,
        contractorId: selectedContractor,
        preferredDate,
        notes: contractorNotes || undefined,
      });
      setAppointmentDate(preferredDate);
      setAppointmentTime(preferredTime);
      setCurrentStep('confirm');
    } catch {
      toast({ title: 'Failed to book contractor', variant: 'destructive' });
    }
  };

  const handleStep2Submit = async () => {
    try {
      await confirmAppointment.mutateAsync({
        complianceItemId: complianceItem.id,
        appointmentDate: appointmentDate || preferredDate,
        tenantNotified,
        tenantAccessInstructions: tenantAccessInstructions || undefined,
      });
      setCurrentStep('upload');
    } catch {
      toast({ title: 'Failed to confirm appointment', variant: 'destructive' });
    }
  };

  const handleStep3Submit = async () => {
    if (!certFile) {
      setCurrentStep('verify');
      return;
    }
    try {
      await uploadCert.mutateAsync({
        complianceItemId: complianceItem.id,
        propertyId: complianceItem.property_id,
        file: certFile,
        complianceType: complianceItem.compliance_type,
        propertyAddress,
        newIssueDate,
        newExpiryDate,
        certificateReference: certificateRef || undefined,
      });
      setCurrentStep('verify');
    } catch {
      toast({ title: 'Failed to upload certificate', variant: 'destructive' });
    }
  };

  const handleStep4Submit = async () => {
    try {
      await completeRenewal.mutateAsync({
        complianceItemId: complianceItem.id,
        newIssueDate,
        newExpiryDate,
      });
      setCompleted(true);
      onComplete?.();
      setTimeout(() => {
        onOpenChange(false);
        resetForm();
      }, 2000);
    } catch {
      toast({ title: 'Failed to complete renewal', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setCurrentStep('book');
    setCompleted(false);
    setSelectedContractor('');
    setPreferredDate('');
    setPreferredTime('');
    setContractorNotes('');
    setAppointmentConfirmed(false);
    setAppointmentDate('');
    setAppointmentTime('');
    setTenantNotified(false);
    setTenantAccessInstructions('');
    setCertFile(null);
    setNewIssueDate(format(new Date(), 'yyyy-MM-dd'));
    setNewExpiryDate('');
    setCertificateRef('');
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  };

  const canProceedStep1 = selectedContractor && preferredDate;
  const canProceedStep3 = newIssueDate && newExpiryDate;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Renewal Workflow
          </DialogTitle>
          <DialogDescription>
            {COMPLIANCE_LABELS[complianceItem.compliance_type] || complianceItem.compliance_type} &mdash; {propertyAddress.split(',')[0]}
          </DialogDescription>
        </DialogHeader>

        {completed ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold">Renewal Complete</h3>
            <p className="text-muted-foreground">
              The certificate has been renewed and compliance status updated.
            </p>
          </div>
        ) : (
          <>
            {/* Step Indicator */}
            <div className="flex items-center gap-1 px-1">
              {STEPS.map((step, idx) => {
                const StepIcon = step.icon;
                const isActive = idx === stepIndex;
                const isDone = idx < stepIndex;
                return (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors',
                      isActive && 'bg-primary text-primary-foreground',
                      isDone && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                      !isActive && !isDone && 'text-muted-foreground',
                    )}>
                      <StepIcon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{step.label}</span>
                      <span className="sm:hidden">{idx + 1}</span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={cn(
                        'flex-1 h-px mx-1',
                        idx < stepIndex ? 'bg-green-400' : 'bg-border',
                      )} />
                    )}
                  </div>
                );
              })}
            </div>

            <Separator />

            {/* Step Content */}
            <div className="space-y-4 py-2 min-h-[280px]">
              {/* Pre-filled info */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Expiry:</span>
                  <Badge variant={complianceItem.expiry_date ? 'secondary' : 'outline'} className="text-xs">
                    {complianceItem.expiry_date
                      ? format(new Date(complianceItem.expiry_date), 'dd MMM yyyy')
                      : 'Not set'}
                  </Badge>
                </div>
              </div>

              {/* STEP 1: Book Renewal */}
              {currentStep === 'book' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Contractor</Label>
                    <Select value={selectedContractor} onValueChange={setSelectedContractor}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a contractor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {contractors?.filter(c => c.is_preferred).map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5" />
                              {c.name} {c.company_name && `(${c.company_name})`}
                              <Badge variant="outline" className="text-[10px] ml-1">Preferred</Badge>
                            </div>
                          </SelectItem>
                        ))}
                        {contractors?.filter(c => !c.is_preferred).map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5" />
                              {c.name} {c.company_name && `(${c.company_name})`}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(!contractors || contractors.length === 0) && (
                      <p className="text-xs text-muted-foreground">
                        No contractors found for this trade. Add one in Contractors.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Preferred Date</Label>
                      <Input
                        type="date"
                        value={preferredDate}
                        onChange={(e) => setPreferredDate(e.target.value)}
                        min={format(new Date(), 'yyyy-MM-dd')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Preferred Time</Label>
                      <Select value={preferredTime} onValueChange={setPreferredTime}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="morning">Morning (8am-12pm)</SelectItem>
                          <SelectItem value="afternoon">Afternoon (12pm-5pm)</SelectItem>
                          <SelectItem value="evening">Evening (5pm-8pm)</SelectItem>
                          <SelectItem value="any">Any time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes for Contractor</Label>
                    <Textarea
                      value={contractorNotes}
                      onChange={(e) => setContractorNotes(e.target.value)}
                      placeholder="Access instructions, parking, special requirements..."
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: Confirm Appointment */}
              {currentStep === 'confirm' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Confirmed Date</Label>
                      <Input
                        type="date"
                        value={appointmentDate}
                        onChange={(e) => setAppointmentDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmed Time</Label>
                      <Select value={appointmentTime} onValueChange={setAppointmentTime}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="morning">Morning (8am-12pm)</SelectItem>
                          <SelectItem value="afternoon">Afternoon (12pm-5pm)</SelectItem>
                          <SelectItem value="evening">Evening (5pm-8pm)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={appointmentConfirmed}
                        onCheckedChange={(v) => setAppointmentConfirmed(v === true)}
                      />
                      <span className="text-sm">Appointment confirmed with contractor</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={tenantNotified}
                        onCheckedChange={(v) => setTenantNotified(v === true)}
                      />
                      <span className="text-sm">Tenant notified (if access needed)</span>
                    </label>
                  </div>

                  {tenantNotified && (
                    <div className="space-y-2">
                      <Label>Tenant Access Instructions</Label>
                      <Textarea
                        value={tenantAccessInstructions}
                        onChange={(e) => setTenantAccessInstructions(e.target.value)}
                        placeholder="Key safe code, entry instructions..."
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Upload New Certificate */}
              {currentStep === 'upload' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    {certFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileCheck className="h-5 w-5 text-green-500" />
                        <span className="text-sm">{certFile.name}</span>
                        <Button variant="ghost" size="sm" onClick={() => setCertFile(null)}>
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Click to upload new certificate</p>
                        <p className="text-xs text-muted-foreground mt-1">PDF, JPG, or PNG</p>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>New Issue Date</Label>
                      <Input
                        type="date"
                        value={newIssueDate}
                        onChange={(e) => handleIssueDateChange(e.target.value)}
                        max={format(new Date(), 'yyyy-MM-dd')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>New Expiry Date *</Label>
                      <Input
                        type="date"
                        value={newExpiryDate}
                        onChange={(e) => setNewExpiryDate(e.target.value)}
                        min={newIssueDate}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Certificate Reference Number</Label>
                    <Input
                      value={certificateRef}
                      onChange={(e) => setCertificateRef(e.target.value)}
                      placeholder="e.g. CP12-2024-00123"
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: Verify & Complete */}
              {currentStep === 'verify' && (
                <div className="space-y-4">
                  <div className="rounded-lg border p-4 space-y-3">
                    <h4 className="font-medium text-sm">Renewal Summary</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Certificate</div>
                      <div>{COMPLIANCE_LABELS[complianceItem.compliance_type] || complianceItem.compliance_type}</div>

                      <div className="text-muted-foreground">Property</div>
                      <div className="truncate">{propertyAddress.split(',')[0]}</div>

                      {newIssueDate && (
                        <>
                          <div className="text-muted-foreground">New Issue Date</div>
                          <div>{format(new Date(newIssueDate), 'dd MMM yyyy')}</div>
                        </>
                      )}

                      {newExpiryDate && (
                        <>
                          <div className="text-muted-foreground">New Expiry Date</div>
                          <div className={cn('font-medium', SEVERITY.success.text)}>
                            {format(new Date(newExpiryDate), 'dd MMM yyyy')}
                          </div>
                        </>
                      )}

                      {certificateRef && (
                        <>
                          <div className="text-muted-foreground">Reference</div>
                          <div>{certificateRef}</div>
                        </>
                      )}

                      {certFile && (
                        <>
                          <div className="text-muted-foreground">Document</div>
                          <div className="truncate">{certFile.name}</div>
                        </>
                      )}
                    </div>
                  </div>

                  {complianceItem.expiry_date && (
                    <div className={cn('flex items-start gap-2 rounded-lg p-3 text-sm', SEVERITY.info.bg)}>
                      <AlertTriangle className={cn('h-4 w-4 mt-0.5 shrink-0', SEVERITY.info.text)} />
                      <div>
                        <p className={cn('font-medium', SEVERITY.info.text)}>Previous certificate will be superseded</p>
                        <p className="text-muted-foreground">
                          Expiry: {format(new Date(complianceItem.expiry_date), 'dd MMM yyyy')}
                        </p>
                      </div>
                    </div>
                  )}

                  {(!newIssueDate || !newExpiryDate) && (
                    <div className={cn('flex items-start gap-2 rounded-lg p-3 text-sm', SEVERITY.warning.bg)}>
                      <AlertTriangle className={cn('h-4 w-4 mt-0.5 shrink-0', SEVERITY.warning.text)} />
                      <p className={cn('font-medium', SEVERITY.warning.text)}>
                        Please go back and enter the issue and expiry dates before completing.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Navigation Footer */}
            <DialogFooter className="flex-row justify-between sm:justify-between">
              <div>
                {stepIndex > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentStep(STEPS[stepIndex - 1].key)}
                    disabled={isPending}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
                {currentStep === 'book' && (
                  <Button size="sm" onClick={handleStep1Submit} disabled={!canProceedStep1 || isPending}>
                    {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Book Renewal
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {currentStep === 'confirm' && (
                  <Button size="sm" onClick={handleStep2Submit} disabled={isPending}>
                    {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Confirm
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {currentStep === 'upload' && (
                  <Button size="sm" onClick={handleStep3Submit} disabled={!canProceedStep3 || isPending}>
                    {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    {certFile ? 'Upload & Continue' : 'Skip Upload'}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {currentStep === 'verify' && (
                  <Button
                    size="sm"
                    onClick={handleStep4Submit}
                    disabled={!newIssueDate || !newExpiryDate || isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Complete Renewal
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
