import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateMaintenanceRequest, MaintenanceCategory, MaintenanceUrgency } from '@/hooks/useMaintenanceRequests';
import { useProperties } from '@/hooks/useProperties';
import { useRooms } from '@/hooks/useRooms';
import { useTenants } from '@/hooks/useTenants';

interface CreateMaintenanceRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryOptions: { value: MaintenanceCategory; label: string }[] = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'heating', label: 'Heating' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'damp_mould', label: 'Damp / Mould' },
  { value: 'structural', label: 'Structural' },
  { value: 'security', label: 'Security' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'garden', label: 'Garden' },
  { value: 'other', label: 'Other' },
];

const urgencyOptions: { value: MaintenanceUrgency; label: string; description: string }[] = [
  { value: 'emergency', label: 'Emergency', description: 'Immediate risk to safety or property' },
  { value: 'urgent', label: 'Urgent', description: 'Needs attention within 24–48 hours' },
  { value: 'normal', label: 'Normal', description: 'Standard response time' },
  { value: 'low', label: 'Low', description: 'Can be scheduled at convenience' },
];

export default function CreateMaintenanceRequestDialog({ open, onOpenChange }: CreateMaintenanceRequestDialogProps) {
  const createRequest = useCreateMaintenanceRequest();
  const { data: properties } = useProperties();
  const { data: tenants } = useTenants();

  const [propertyId, setPropertyId] = useState('');
  const [roomId, setRoomId] = useState<string>('');
  const [tenantId, setTenantId] = useState<string>('');
  const [category, setCategory] = useState<MaintenanceCategory>('other');
  const [urgency, setUrgency] = useState<MaintenanceUrgency>('normal');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationInProperty, setLocationInProperty] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  const { data: rooms } = useRooms(propertyId || undefined);

  // Reset dependent fields when property changes
  useEffect(() => {
    setRoomId('');
    setTenantId('');
  }, [propertyId]);

  const resetForm = () => {
    setPropertyId('');
    setRoomId('');
    setTenantId('');
    setCategory('other');
    setUrgency('normal');
    setTitle('');
    setDescription('');
    setLocationInProperty('');
    setInternalNotes('');
  };

  const handleSubmit = () => {
    if (!propertyId || !title.trim() || !description.trim()) return;

    createRequest.mutate(
      {
        property_id: propertyId,
        room_id: roomId || null,
        tenant_id: tenantId || null,
        category,
        urgency,
        title: title.trim(),
        description: description.trim(),
        location_in_property: locationInProperty.trim() || null,
        internal_notes: internalNotes.trim() || null,
        photos: null,
        scheduled_date: null,
      },
      {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) resetForm(); onOpenChange(next); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Maintenance Request</DialogTitle>
          <DialogDescription>Log a maintenance issue for a property</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Property */}
          <div className="space-y-2">
            <Label>Property *</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger>
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {properties?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.address_line}{p.postcode ? ` — ${p.postcode}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Room (optional, shown when property selected) */}
          {propertyId && rooms && rooms.length > 0 && (
            <div className="space-y-2">
              <Label>Room (optional)</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.room_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tenant (optional) */}
          <div className="space-y-2">
            <Label>Reported by Tenant (optional)</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger>
                <SelectValue placeholder="Select tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.tenant_type === 'company'
                      ? t.company_name || 'Unnamed Company'
                      : `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Unnamed'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category & Urgency row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as MaintenanceCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Urgency *</Label>
              <Select value={urgency} onValueChange={(v) => setUrgency(v as MaintenanceUrgency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {urgencyOptions.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      <div>
                        <span>{u.label}</span>
                        <span className="text-xs text-muted-foreground ml-1">— {u.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="maint-title">Title *</Label>
            <Input
              id="maint-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Leaking tap in bathroom"
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="maint-desc">Description *</Label>
            <Textarea
              id="maint-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail"
              rows={3}
              maxLength={2000}
            />
          </div>

          {/* Location in property */}
          <div className="space-y-2">
            <Label htmlFor="maint-location">Location in property (optional)</Label>
            <Input
              id="maint-location"
              value={locationInProperty}
              onChange={(e) => setLocationInProperty(e.target.value)}
              placeholder="e.g. First floor bathroom, Kitchen"
              maxLength={200}
            />
          </div>

          {/* Internal notes */}
          <div className="space-y-2">
            <Label htmlFor="maint-notes">Internal Notes (optional)</Label>
            <Textarea
              id="maint-notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={2}
              placeholder="Notes visible only to managers"
              maxLength={2000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!propertyId || !title.trim() || !description.trim() || createRequest.isPending}
          >
            {createRequest.isPending ? 'Creating…' : 'Create Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
