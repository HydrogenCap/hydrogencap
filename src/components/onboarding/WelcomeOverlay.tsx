import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { CheckCircle2, Loader2, Upload, Home, Users, Building2, Building } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrg } from '@/hooks/useUserOrg';
import { useWelcomeOverlay, type PortfolioBand } from '@/hooks/useWelcomeOverlay';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { createSignedStorageUrl } from '@/lib/storagePaths';
import { toast } from "sonner";

interface BandOption {
  value: PortfolioBand;
  label: string;
  icon: typeof Home;
}

const BAND_OPTIONS: BandOption[] = [
  { value: '1', label: '1 property', icon: Home },
  { value: '2-5', label: '2-5 properties', icon: Building2 },
  { value: '6-20', label: '6-20 properties', icon: Building },
  { value: '21+', label: '21+ properties', icon: Users },
];

type Step = 0 | 1 | 2 | 3;

export function WelcomeOverlay() {
  const { shouldShow, setBand, markSeen } = useWelcomeOverlay();
  const { user } = useAuth();
  const { data: orgId } = useUserOrg();
  const [step, setStep] = useState<Step>(0);
  const [selectedBand, setSelectedBand] = useState<PortfolioBand | null>(null);
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');
  const [propertyType, setPropertyType] = useState<string>('');
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [savingProperty, setSavingProperty] = useState(false);
  const [docFileName, setDocFileName] = useState<string | null>(null);
  const [docProcessing, setDocProcessing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(async () => {
    try {
      await markSeen();
    } catch (err) {
      console.error('Failed to mark welcome as seen', err);
    }
  }, [markSeen]);

  const handleSkip = async () => {
    await finish();
  };

  const handleSelectBand = async (value: PortfolioBand) => {
    setSelectedBand(value);
    try {
      await setBand(value);
    } catch (err) {
      console.error('Failed to save portfolio band', err);
    }
    setStep(1);
  };

  const runAutofill = useCallback(async (pc: string) => {
    if (!pc || pc.trim().length < 5) return;
    setAutofillLoading(true);
    try {
      const { data: result } = await supabase.functions.invoke('property-autofill', {
        body: { postcode: pc.trim(), address_line_1: address },
      });
      const f = (result as { fields?: { city?: string; property_type?: string } } | null)?.fields;
      if (f) {
        if (f.city && !city) setCity(f.city);
        if (f.property_type && !propertyType) setPropertyType(f.property_type);
      }
    } catch (err) {
      console.error('Autofill failed', err);
    } finally {
      setAutofillLoading(false);
    }
  }, [address, city, propertyType]);

  const handlePostcodeChange = (value: string) => {
    setPostcode(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runAutofill(value), 500);
  };

  const handleSaveProperty = async () => {
    if (!address.trim() || !postcode.trim() || !orgId) {
      setStep(2);
      return;
    }
    setSavingProperty(true);
    try {
      // Find any legal_entity in the org to satisfy NOT NULL entity_id.
      const { data: entity } = await supabaseAny
        .from('legal_entities')
        .select('id')
        .eq('org_id', orgId)
        .limit(1)
        .maybeSingle();

      if (entity?.id) {
        const { error } = await supabaseAny.from('properties_v2').insert({
          org_id: orgId,
          entity_id: entity.id,
          address_line_1: address.trim(),
          city: city.trim() || 'Unknown',
          postcode: postcode.trim().toUpperCase(),
          property_type: propertyType || 'house',
          lifecycle_stage: 'core_rental',
          listing_grade: 'standard',
          rent_basis: 'monthly',
        });
        if (error) throw error;
        toast.success('Property added', { description: 'Your first property is in.' });
      } else {
        toast.success('Property saved for later', { description: 'Add a legal entity in Settings to attach this property.' });
      }
    } catch (err) {
      console.error('Welcome property insert failed', err);
      toast.error('Could not add property', { description: err instanceof Error ? err.message : 'Skipping for now.' });
    } finally {
      setSavingProperty(false);
      setStep(2);
    }
  };

  const handleDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file || !user || !orgId) return;
    setDocFileName(file.name);
    setDocProcessing(true);
    try {
      const path = `${orgId}/welcome/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: docRow, error: docErr } = await supabaseAny
        .from('documents')
        .insert({
          org_id: orgId,
          file_url: path,
          original_file_name: file.name,
          uploaded_by: user.id,
        })
        .select('id')
        .single();
      if (docErr) throw docErr;

      const signedUrl = await createSignedStorageUrl('documents', path, 3600);
      await supabase.functions.invoke('process-document-v2', {
        body: { document_url: signedUrl, document_id: docRow.id, org_id: orgId },
      });
      toast.success('Certificate uploaded', { description: 'We’re processing it in the background.' });
      setStep(3);
    } catch (err) {
      console.error('Welcome doc upload failed', err);
      toast.error('Upload failed', { description: err instanceof Error ? err.message : 'You can upload again later from Documents.' });
      setStep(3);
    } finally {
      setDocProcessing(false);
    }
  }, [user, orgId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
    },
  });

  if (!shouldShow) return null;

  return (
    <Dialog open={shouldShow} onOpenChange={() => { /* non-dismissable on outside click */ }}>
      <DialogContent
        className="max-w-lg"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl text-primary">
            {step === 0 && 'Welcome to TenureIQ'}
            {step === 1 && 'Add your first property'}
            {step === 2 && 'Upload a compliance certificate'}
            {step === 3 && 'You’re ready!'}
          </DialogTitle>
          <DialogDescription>
            {step === 0 && 'How big is your portfolio? This helps us tailor the experience.'}
            {step === 1 && 'Just an address — we’ll fill in the details.'}
            {step === 2 && 'Drop in a recent gas safety, EICR, or EPC. We’ll classify it.'}
            {step === 3 && 'Your dashboard is set up. The activation checklist below covers what’s next.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step counter */}
        <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of 4`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>

        {/* Step 3a: Portfolio size */}
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3 py-2">
            {BAND_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = selectedBand === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => handleSelectBand(opt.value)}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5 ${
                    active ? 'border-primary bg-primary/10 text-primary' : 'border-border'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Step 3b: First property */}
        {step === 1 && (
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="welcome-address">Address line 1</Label>
              <Input
                id="welcome-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 12 Acacia Avenue"
              />
            </div>
            <div>
              <Label htmlFor="welcome-postcode">Postcode</Label>
              <div className="relative">
                <Input
                  id="welcome-postcode"
                  value={postcode}
                  onChange={(e) => handlePostcodeChange(e.target.value.toUpperCase())}
                  placeholder="GL50 1HN"
                  className="font-mono"
                />
                {autofillLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
            {(city || propertyType) && (
              <p className="text-xs text-muted-foreground">
                Detected: {[city, propertyType].filter(Boolean).join(' · ')}
              </p>
            )}
            <Button onClick={handleSaveProperty} disabled={savingProperty} className="w-full">
              {savingProperty ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </Button>
          </div>
        )}

        {/* Step 3c: Compliance certificate */}
        {step === 2 && (
          <div className="space-y-3 py-2">
            <div
              {...getRootProps()}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <input {...getInputProps()} />
              {docProcessing ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-2 text-sm font-medium">{docFileName}</p>
                  <p className="text-xs text-muted-foreground">Processing…</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">
                    {isDragActive ? 'Drop the file here' : 'Drag & drop a PDF or image'}
                  </p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                </>
              )}
            </div>
            <Button variant="outline" onClick={() => setStep(3)} className="w-full">
              I’ll do this later
            </Button>
          </div>
        )}

        {/* Step 3d: Done */}
        {step === 3 && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            <p className="text-sm text-muted-foreground">
              You can revisit setup anytime from the activation checklist below.
            </p>
            <Button onClick={finish} className="w-full">
              Done
            </Button>
          </div>
        )}

        {/* Skip for now — visible on every step */}
        {step < 3 && (
          <div className="flex justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip for now
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default WelcomeOverlay;
