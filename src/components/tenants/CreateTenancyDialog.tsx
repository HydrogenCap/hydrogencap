import { useState, useCallback, useEffect, useMemo } from 'react';
import { captureError } from '@/lib/sentry';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, ChevronLeft, ChevronRight, Loader2, Bot, AlertTriangle, CheckCircle2, Info, Sparkles, Home } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useProperties } from '@/hooks/useProperties';
import { useRoomsWithTenancy, useUpdateRoom, useCreateRoom } from '@/hooks/useRooms';
import { useCreateTenancy, type PaymentMethod } from '@/hooks/useTenancies';
import { useUpdateTenant } from '@/hooks/useTenants';
import { useToast } from '@/hooks/use-toast';
import { fetchUserOrgId as getUserOrgId } from '@/hooks/useUserOrg';

interface CreateTenancyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName: string;
  tenantType: 'individual' | 'company';
}

interface AIExtraction {
  document_type?: string;
  tenant_name_on_agreement?: string;
  tenant_name_matches?: boolean;
  landlord_name?: string;
  property_address_on_agreement?: string;
  property_address_matches?: boolean;
  room_or_unit?: string;
  start_date?: string;
  end_date?: string;
  rent_amount_pcm?: number;
  rent_due_day?: number;
  deposit_amount?: number;
  deposit_scheme?: string;
  notice_period_weeks?: number;
  break_clause_date?: string;
  break_clause_notice_months?: number;
  permitted_occupants?: number;
  includes_bills?: boolean;
  bills_included?: string;
  furnished_status?: string;
  pet_clause?: string;
  guarantor_required?: boolean;
  guarantor_name?: string;
  special_conditions?: string[];
  is_signed?: boolean;
  signature_date?: string;
  confidence?: number;
  issues?: { message: string; severity: 'critical' | 'warning' | 'info' }[];
}

const PROCESSING_STEPS = [
  'Uploading document...',
  'Extracting text...',
  'AI reading agreement...',
  'Extracting terms...',
];

function AIBadge() {
  return (
    <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1 border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">
      <Sparkles className="h-2.5 w-2.5 mr-0.5" />AI
    </Badge>
  );
}

export default function CreateTenancyDialog({ open, onOpenChange, tenantId, tenantName, tenantType }: CreateTenancyDialogProps) {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [extraction, setExtraction] = useState<AIExtraction | null>(null);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const [agreementUrl, setAgreementUrl] = useState<string | null>(null);

  // Form state
  const [propertyId, setPropertyId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rentAmountPcm, setRentAmountPcm] = useState('');
  const [rentDueDay, setRentDueDay] = useState('1');
  const [noticePeriodWeeks, setNoticePeriodWeeks] = useState('4');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositScheme, setDepositScheme] = useState('');
  const [depositReference, setDepositReference] = useState('');
  const [depositProtectedDate, setDepositProtectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [wholePropertyHmo, setWholePropertyHmo] = useState(false);
  const { data: properties } = useProperties();
  const { data: roomsWithTenancy } = useRoomsWithTenancy(propertyId);
  const createTenancy = useCreateTenancy();
  const { mutateAsync: updateRoomAsync } = useUpdateRoom();
  const { mutateAsync: createRoomAsync, isPending: isCreateRoomPending } = useCreateRoom();
  const updateTenant = useUpdateTenant();
  const { toast } = useToast();

  const selectedProperty = properties?.find(p => p.id === propertyId);
  const isNonHmoSingleLet = selectedProperty && selectedProperty.asset_category !== 'HMO' && selectedProperty.asset_category !== 'HMO (Licensed)';
  const isHmo = selectedProperty && (selectedProperty.asset_category === 'HMO' || selectedProperty.asset_category === 'HMO (Licensed)');
  const isWholePropertyLet = isNonHmoSingleLet || (isHmo && wholePropertyHmo);
  const vacantRooms = useMemo(
    () => roomsWithTenancy?.filter((room) => room.status === 'vacant') ?? [],
    [roomsWithTenancy]
  );
  const selectedRoom = roomsWithTenancy?.find(r => r.id === roomId);

  // Auto-create a "Whole Property" room for single-let properties that have no rooms
  useEffect(() => {
    if (isWholePropertyLet && propertyId && roomsWithTenancy && roomsWithTenancy.length === 0 && !isCreateRoomPending) {
      void createRoomAsync({
        property_id: propertyId,
        room_name: 'Whole Property',
        room_number: null,
        floor: 0,
        room_type: 'studio' as const,
        target_rent_pcm: null,
        status: 'vacant' as const,
        description: 'Whole property let',
        amenities: null,
        square_footage: null,
        photos: null,
      });
    }
  }, [createRoomAsync, isCreateRoomPending, isWholePropertyLet, propertyId, roomsWithTenancy]);

  // Auto-select room for whole-property lets
  useEffect(() => {
    if (isWholePropertyLet && vacantRooms.length === 1 && !roomId) {
      setRoomId(vacantRooms[0].id);
    }
  }, [isWholePropertyLet, vacantRooms, roomId]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setExtraction(null);
      setAiFilledFields(new Set());
      setAgreementUrl(null);
      setPropertyId('');
      setRoomId('');
      setStartDate('');
      setEndDate('');
      setRentAmountPcm('');
      setRentDueDay('1');
      setNoticePeriodWeeks('4');
      setDepositAmount('');
      setDepositScheme('');
      setDepositReference('');
      setDepositProtectedDate('');
      setNotes('');
      setPaymentMethod('bank_transfer');
      setPaymentReference('');
      setIsProcessing(false);
      setProcessingStep(0);
      setProcessingProgress(0);
      setWholePropertyHmo(false);
    }
  }, [open]);

  // Apply AI extraction to form
  const applyExtraction = useCallback((ext: AIExtraction) => {
    const filled = new Set<string>();
    if (ext.start_date) { setStartDate(ext.start_date); filled.add('start_date'); }
    if (ext.end_date) { setEndDate(ext.end_date); filled.add('end_date'); }
    if (ext.rent_amount_pcm) { setRentAmountPcm(String(ext.rent_amount_pcm)); filled.add('rent_amount_pcm'); }
    if (ext.rent_due_day) { setRentDueDay(String(ext.rent_due_day)); filled.add('rent_due_day'); }
    if (ext.notice_period_weeks) { setNoticePeriodWeeks(String(ext.notice_period_weeks)); filled.add('notice_period_weeks'); }
    if (ext.deposit_amount) { setDepositAmount(String(ext.deposit_amount)); filled.add('deposit_amount'); }
    if (ext.deposit_scheme) { setDepositScheme(ext.deposit_scheme); filled.add('deposit_scheme'); }

    // Auto-match AI-detected property address to a property in the list
    if (ext.property_address_on_agreement && properties?.length) {
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const aiAddr = normalize(ext.property_address_on_agreement);
      // Try to find best match: check if the property address or postcode is contained
      const match = properties.find(p => {
        const full = normalize(`${p.address_line || ''} ${p.postcode || ''}`);
        // Match if one contains the other or they share a significant overlap
        return full.includes(aiAddr) || aiAddr.includes(full) ||
          (p.postcode && aiAddr.includes(normalize(p.postcode)) &&
           normalize(p.address_line || '').split('').filter(c => aiAddr.includes(c)).length > (p.address_line?.length || 0) * 0.5);
      });
      if (match) {
        setPropertyId(match.id);
        filled.add('property');
      }
    }

    setAiFilledFields(filled);
  }, [properties]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast({ title: 'Invalid file', description: 'Please upload a PDF file', variant: 'destructive' });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 20MB', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    setProcessingStep(0);
    setProcessingProgress(10);

    try {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      // Step 1: Upload
      const fileName = `${Date.now()}_agreement.pdf`;
      const filePath = `${orgId}/tenancy-agreements/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData, error: urlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 600); // 10 min expiry
      if (urlError || !urlData?.signedUrl) throw new Error('Failed to create signed URL');
      
      setAgreementUrl(urlData.signedUrl);
      setProcessingStep(1);
      setProcessingProgress(30);

      // Step 2-3: Call AI
      setProcessingStep(2);
      setProcessingProgress(50);

      const { data, error } = await supabase.functions.invoke('process-tenancy-agreement', {
        body: {
          fileUrl: urlData.signedUrl,
          tenantName,
          tenantType,
          propertyAddress: '',
        },
      });

      setProcessingStep(3);
      setProcessingProgress(90);

      if (error) throw error;

      if (data?.extraction) {
        setExtraction(data.extraction);
        applyExtraction(data.extraction);
        toast({ title: 'Agreement analysed', description: `AI confidence: ${Math.round((data.extraction.confidence || 0) * 100)}%` });
      }

      setProcessingProgress(100);
      setTimeout(() => {
        setIsProcessing(false);
        setStep(2);
      }, 500);
    } catch (err) {
      console.error('Upload/AI error:', err);
      captureError(err, 'CreateTenancyDialog.uploadAI');
      setIsProcessing(false);
      toast({
        title: 'Processing failed',
        description: 'You can still enter details manually.',
        variant: 'destructive',
      });
    }
  }, [applyExtraction, tenantName, tenantType, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const canProceedStep2 = propertyId && (roomId || isWholePropertyLet);
  const canProceedStep3 = startDate && rentAmountPcm && Number(rentAmountPcm) > 0;

  const handleCreate = async () => {
    try {
      // For whole-property HMO lets, use the first room and mark all as occupied
      const allRooms = roomsWithTenancy || [];
      const effectiveRoomId = wholePropertyHmo && allRooms.length > 0 ? allRooms[0].id : roomId;

      await createTenancy.mutateAsync({
        tenant_id: tenantId,
        property_id: propertyId,
        room_id: effectiveRoomId,
        start_date: startDate,
        end_date: endDate || null,
        rent_amount_pcm: Number(rentAmountPcm),
        rent_due_day: Number(rentDueDay),
        deposit_amount: depositAmount ? Number(depositAmount) : null,
        deposit_scheme: depositScheme || null,
        deposit_reference: depositReference || null,
        deposit_protected_date: depositProtectedDate || null,
        tenancy_agreement_url: agreementUrl,
        status: 'active' as const,
        notice_date: null,
        notice_period_weeks: Number(noticePeriodWeeks) || 4,
        payment_method: paymentMethod || null,
        payment_reference: paymentReference || null,
        notes: wholePropertyHmo ? `${notes || ''}\nWhole property let (${allRooms.length} rooms)`.trim() : (notes || null),
      });

      // Mark rooms as occupied
      if (wholePropertyHmo) {
        await Promise.all(allRooms.map(r => updateRoomAsync({ id: r.id, status: 'occupied' })));
      } else {
        await updateRoomAsync({ id: effectiveRoomId, status: 'occupied' });
      }

      // Update tenant to active if prospect
      updateTenant.mutate({ id: tenantId, status: 'active' });

      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create tenancy:', err);
      captureError(err, 'CreateTenancyDialog.create');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Tenancy — {tenantName}</DialogTitle>
          <DialogDescription>
            Step {step} of 4 • {['Upload Agreement', 'Property & Room', 'Tenancy Terms', 'Review & Confirm'][step - 1]}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex gap-1 mb-2">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        {/* STEP 1: Upload Agreement */}
        {step === 1 && (
          <div className="space-y-4">
            {isProcessing ? (
              <div className="border border-border rounded-lg p-8 text-center bg-muted/30">
                <Loader2 className="h-10 w-10 mx-auto mb-3 text-primary animate-spin" />
                <p className="font-medium">{PROCESSING_STEPS[processingStep]}</p>
                <Progress value={processingProgress} className="mt-4 max-w-xs mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">AI is reading your tenancy agreement</p>
              </div>
            ) : (
              <>
                <div
                  className="border-2 border-dashed rounded-lg p-10 text-center transition-colors hover:border-primary/50 cursor-pointer"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="font-medium mb-1">Upload Signed Tenancy Agreement</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    AI will extract key terms automatically
                  </p>
                  <label>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleFileInput}
                    />
                    <Button asChild variant="outline">
                      <span className="cursor-pointer">
                        <FileText className="h-4 w-4 mr-2" />
                        Browse PDF
                      </span>
                    </Button>
                  </label>
                </div>
                <button
                  className="text-sm text-muted-foreground hover:text-foreground underline block mx-auto"
                  onClick={() => setStep(2)}
                >
                  Skip — enter details manually
                </button>
              </>
            )}
          </div>
        )}

        {/* STEP 2: Property & Room */}
        {step === 2 && (
          <div className="space-y-4">
            {extraction?.property_address_on_agreement && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  AI detected property: <strong>{extraction.property_address_on_agreement}</strong>. Please select the matching property below.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Property *</Label>
              <Select value={propertyId} onValueChange={(v) => { setPropertyId(v); setRoomId(''); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties?.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.address_line}{p.postcode ? ` — ${p.postcode}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {propertyId && isHmo && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant={wholePropertyHmo ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setWholePropertyHmo(true); setRoomId(''); }}
                  >
                    <Home className="h-4 w-4 mr-1" /> Whole Property
                  </Button>
                  <Button
                    type="button"
                    variant={!wholePropertyHmo ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setWholePropertyHmo(false)}
                  >
                    Individual Room
                  </Button>
                </div>
                {wholePropertyHmo && (
                  <Alert>
                    <Home className="h-4 w-4" />
                    <AlertDescription>
                      Tenant will rent the entire property ({roomsWithTenancy?.length || 0} rooms). All rooms will be marked as occupied.
                    </AlertDescription>
                  </Alert>
                )}
                {!wholePropertyHmo && (
                  <div className="space-y-2">
                    <Label>
                      Room *
                      {extraction?.room_or_unit && (
                        <span className="text-sm text-muted-foreground ml-2">(AI hint: {extraction.room_or_unit})</span>
                      )}
                    </Label>
                    {vacantRooms.length === 0 ? (
                      <p className="text-sm text-destructive">No vacant rooms at this property</p>
                    ) : (
                      <Select value={roomId} onValueChange={setRoomId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vacant room" />
                        </SelectTrigger>
                        <SelectContent>
                          {vacantRooms.map(r => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.room_name} ({r.room_type})
                              {r.target_rent_pcm ? ` — £${r.target_rent_pcm}/mo target` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            )}

            {propertyId && isNonHmoSingleLet && (
              <Alert>
                <Home className="h-4 w-4" />
                <AlertDescription>
                  This property is let as a whole — no room selection needed.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* STEP 3: Tenancy Terms */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date * {aiFilledFields.has('start_date') && <AIBadge />}</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{tenantType === 'company' ? 'Lease End Date' : 'End Date'} {aiFilledFields.has('end_date') && <AIBadge />}</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rent (£/mo) * {aiFilledFields.has('rent_amount_pcm') && <AIBadge />}</Label>
                <Input type="number" min="1" value={rentAmountPcm} onChange={e => setRentAmountPcm(e.target.value)} placeholder="e.g. 850" />
                {selectedRoom?.target_rent_pcm && (
                  <p className="text-xs text-muted-foreground">Room target rent: £{selectedRoom.target_rent_pcm}/mo</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Rent Due Day * {aiFilledFields.has('rent_due_day') && <AIBadge />}</Label>
                <Input type="number" min="1" max="28" value={rentDueDay} onChange={e => setRentDueDay(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notice Period (weeks) {aiFilledFields.has('notice_period_weeks') && <AIBadge />}</Label>
              <Input type="number" min="0" value={noticePeriodWeeks} onChange={e => setNoticePeriodWeeks(e.target.value)} />
            </div>

            {/* Deposit */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Deposit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount (£) {aiFilledFields.has('deposit_amount') && <AIBadge />}</Label>
                    <Input type="number" min="0" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Scheme {aiFilledFields.has('deposit_scheme') && <AIBadge />}</Label>
                    <Select value={depositScheme} onValueChange={setDepositScheme}>
                      <SelectTrigger><SelectValue placeholder="Select scheme" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DPS">DPS</SelectItem>
                        <SelectItem value="TDS">TDS</SelectItem>
                        <SelectItem value="mydeposits">mydeposits</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Reference</Label>
                    <Input value={depositReference} onChange={e => setDepositReference(e.target.value)} placeholder="Deposit ref" />
                  </div>
                  <div className="space-y-2">
                    <Label>Protected Date</Label>
                    <Input type="date" value={depositProtectedDate} onChange={e => setDepositProtectedDate(e.target.value)} />
                  </div>
                </div>
                {tenantType === 'company' && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Company lets may not require deposit protection under the Housing Act 2004. Check your agreement type.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>How will rent be paid?</Label>
                    <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v as PaymentMethod)}>
                      <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standing_order">Standing Order</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="direct_debit">Direct Debit</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reference / Account Details</Label>
                    <Input value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="e.g. Sort code & account" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI insights */}
            {extraction && (extraction.special_conditions?.length || extraction.furnished_status || extraction.pet_clause || extraction.guarantor_name || extraction.break_clause_date || extraction.issues?.length) && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start text-sm gap-2">
                    <Bot className="h-4 w-4 text-blue-500" />
                    AI Agreement Analysis
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  {/* Summary grid */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {extraction.furnished_status && (
                      <div><span className="text-muted-foreground">Furnished:</span> {extraction.furnished_status}</div>
                    )}
                    {extraction.pet_clause && (
                      <div><span className="text-muted-foreground">Pets:</span> {extraction.pet_clause}</div>
                    )}
                    {extraction.includes_bills !== null && extraction.includes_bills !== undefined && (
                      <div><span className="text-muted-foreground">Bills included:</span> {extraction.includes_bills ? (extraction.bills_included || 'Yes') : 'No'}</div>
                    )}
                    {extraction.permitted_occupants && (
                      <div><span className="text-muted-foreground">Max occupants:</span> {extraction.permitted_occupants}</div>
                    )}
                    {extraction.guarantor_name && (
                      <div><span className="text-muted-foreground">Guarantor:</span> {extraction.guarantor_name}</div>
                    )}
                    {extraction.break_clause_date && (
                      <div><span className="text-muted-foreground">Break clause:</span> {extraction.break_clause_date}</div>
                    )}
                  </div>

                  {extraction.special_conditions && extraction.special_conditions.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">Special Conditions</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {extraction.special_conditions.map((c, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-muted-foreground">•</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {extraction.issues?.map((issue, i) => (
                    <Alert key={i} variant={issue.severity === 'critical' ? 'destructive' : 'default'}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{issue.message}</AlertDescription>
                    </Alert>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes" rows={2} />
            </div>
          </div>
        )}

        {/* STEP 4: Review */}
        {step === 4 && (
          <div className="space-y-3">
            <Card>
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tenant</span>
                  <span className="font-medium">{tenantName} <Badge variant="outline" className="ml-1 text-xs">{tenantType}</Badge></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Property</span>
                  <span className="font-medium">{properties?.find(p => p.id === propertyId)?.address_line}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Room</span>
                  <span className="font-medium">{selectedRoom?.room_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Period</span>
                  <span>{startDate ? format(new Date(startDate), 'dd MMM yyyy') : '—'} → {endDate ? format(new Date(endDate), 'dd MMM yyyy') : 'Periodic'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rent</span>
                  <span className="font-medium">£{Number(rentAmountPcm).toLocaleString()}/mo, due day {rentDueDay}</span>
                </div>
                {depositAmount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deposit</span>
                    <span>£{Number(depositAmount).toLocaleString()}{depositScheme ? ` (${depositScheme})` : ''}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agreement</span>
                  {agreementUrl ? (
                    <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Uploaded</span>
                  ) : (
                    <button className="text-amber-600 underline text-xs" onClick={() => setStep(1)}>Upload now</button>
                  )}
                </div>
              </CardContent>
            </Card>

            {extraction?.issues?.filter(i => i.severity === 'critical' || i.severity === 'warning').map((issue, i) => (
              <Alert key={i} variant={issue.severity === 'critical' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{issue.severity === 'critical' ? 'Critical' : 'Warning'}</AlertTitle>
                <AlertDescription>{issue.message}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            {step === 2 && (
              <Button onClick={() => setStep(3)} disabled={!canProceedStep2}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={() => setStep(4)} disabled={!canProceedStep3}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 4 && (
              <Button onClick={handleCreate} disabled={createTenancy.isPending}>
                {createTenancy.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Tenancy
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
