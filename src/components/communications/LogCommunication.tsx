import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLogCommunication } from '@/hooks/useCommunicationLog';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Lock } from 'lucide-react';
import type {
  CommunicationChannel,
  CommunicationDirection,
  CommunicationRelatedType,
  LogCommunicationInput,
} from '@/hooks/useCommunicationLog';

const CHANNELS: { value: CommunicationChannel; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'phone', label: 'Phone Call' },
  { value: 'letter', label: 'Letter' },
  { value: 'in_person', label: 'In Person' },
  { value: 'portal', label: 'Portal' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'other', label: 'Other' },
];

const DIRECTIONS: { value: CommunicationDirection; label: string }[] = [
  { value: 'outbound', label: 'Outbound (sent)' },
  { value: 'inbound', label: 'Inbound (received)' },
];

const PROOF_METHODS = [
  { value: 'email_receipt', label: 'Email Read Receipt' },
  { value: 'signed_for', label: 'Signed For Delivery' },
  { value: 'witness', label: 'Witness Present' },
  { value: 'portal_read_receipt', label: 'Portal Read Receipt' },
];

const RELATED_TYPES: { value: CommunicationRelatedType; label: string }[] = [
  { value: 'maintenance_request', label: 'Maintenance Request' },
  { value: 'rent_arrears', label: 'Rent Arrears' },
  { value: 'tenancy', label: 'Tenancy' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'possession', label: 'Possession' },
  { value: 'general', label: 'General' },
];

interface LogCommunicationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPropertyId?: string;
  defaultTenantId?: string;
  defaultContractorId?: string;
  defaultRelatedToType?: CommunicationRelatedType;
  defaultRelatedToId?: string;
}

export function LogCommunication({
  open,
  onOpenChange,
  defaultPropertyId,
  defaultTenantId,
  defaultContractorId,
  defaultRelatedToType,
  defaultRelatedToId,
}: LogCommunicationProps) {
  const { toast } = useToast();
  const logComm = useLogCommunication();

  const [direction, setDirection] = useState<CommunicationDirection>('outbound');
  const [channel, setChannel] = useState<CommunicationChannel>('email');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [proofOfService, setProofOfService] = useState('');
  const [witnessName, setWitnessName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [relatedToType, setRelatedToType] = useState<CommunicationRelatedType | ''>(defaultRelatedToType ?? '');
  const [sentAt, setSentAt] = useState('');

  const resetForm = () => {
    setDirection('outbound');
    setChannel('email');
    setSubject('');
    setContent('');
    setProofOfService('');
    setWitnessName('');
    setReferenceNumber('');
    setRelatedToType(defaultRelatedToType ?? '');
    setSentAt('');
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({ title: 'Content is required', variant: 'destructive' });
      return;
    }

    const input: LogCommunicationInput = {
      direction,
      channel,
      subject: subject.trim() || null,
      content: content.trim(),
      property_id: defaultPropertyId ?? null,
      tenant_id: defaultTenantId ?? null,
      contractor_id: defaultContractorId ?? null,
      proof_of_service: proofOfService || null,
      witness_name: witnessName.trim() || null,
      reference_number: referenceNumber.trim() || null,
      related_to_type: relatedToType || null,
      related_to_id: defaultRelatedToId ?? null,
      sent_at: sentAt || undefined,
    };

    try {
      await logComm.mutateAsync(input);
      toast({ title: 'Communication logged' });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to log communication',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Communication</DialogTitle>
          <DialogDescription>
            Record a communication for the audit trail. This creates an immutable, legally admissible record.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="border-amber-200 bg-amber-500/10 text-amber-700 dark:text-amber-400 [&>svg]:text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-1.5">
            <Lock className="h-3 w-3 shrink-0" />
            This record cannot be edited or deleted once saved.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as CommunicationDirection)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIRECTIONS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as CommunicationChannel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Section 8 Notice — Ground 8 Rent Arrears"
            />
          </div>

          <div className="space-y-2">
            <Label>Content *</Label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Full text of the communication..."
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label>Date &amp; Time Sent</Label>
            <Input
              type="datetime-local"
              value={sentAt}
              onChange={e => setSentAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Leave blank for current time</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Proof of Service</Label>
              <Select value={proofOfService} onValueChange={setProofOfService}>
                <SelectTrigger><SelectValue placeholder="Select method..." /></SelectTrigger>
                <SelectContent>
                  {PROOF_METHODS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Related To</Label>
              <Select value={relatedToType} onValueChange={(v) => setRelatedToType(v as CommunicationRelatedType)}>
                <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  {RELATED_TYPES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {proofOfService === 'witness' && (
            <div className="space-y-2">
              <Label>Witness Name</Label>
              <Input
                value={witnessName}
                onChange={e => setWitnessName(e.target.value)}
                placeholder="Full name of witness"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Reference Number</Label>
            <Input
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              placeholder="e.g. tracking number, receipt ID"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={logComm.isPending || !content.trim()}>
            {logComm.isPending ? 'Saving...' : 'Log Communication'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
