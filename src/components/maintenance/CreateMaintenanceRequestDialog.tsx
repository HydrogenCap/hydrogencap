import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCreateMaintenanceRequest } from '@/hooks/useMaintenanceRequests';
import { useProperties } from '@/hooks/useProperties';
import { useRooms } from '@/hooks/useRooms';
import { useTenants } from '@/hooks/useTenants';
import { MAINTENANCE_CATEGORY_NAMES, PRIORITY_CONFIG, type MaintenanceCategory, type MaintenancePriority, type ReportedBy } from '@/lib/maintenanceTypes';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

const categoryOptions = Object.entries(MAINTENANCE_CATEGORY_NAMES).map(([value, label]) => ({ value, label }));

export default function CreateMaintenanceRequestDialog({ open, onOpenChange, onCreated }: Props) {
  const createRequest = useCreateMaintenanceRequest();
  const { data: properties } = useProperties();
  const { data: tenants } = useTenants();

  const [propertyId, setPropertyId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [category, setCategory] = useState<MaintenanceCategory>('other');
  const [priority, setPriority] = useState<MaintenancePriority>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [reportedBy, setReportedBy] = useState<ReportedBy>('operator');
  const [notes, setNotes] = useState('');

  const { data: rooms } = useRooms(propertyId || undefined);

  useEffect(() => { setRoomId(''); setTenantId(''); }, [propertyId]);

  const resetForm = () => {
    setPropertyId(''); setRoomId(''); setTenantId('');
    setCategory('other'); setPriority('medium');
    setTitle(''); setDescription(''); setLocationDetail('');
    setReportedBy('operator'); setNotes('');
  };

  const handleSubmit = () => {
    if (!propertyId || !title.trim() || !description.trim()) return;

    createRequest.mutate({
      property_id: propertyId,
      room_id: roomId || null,
      tenant_id: tenantId || null,
      category,
      priority,
      title: title.trim(),
      description: description.trim(),
      location_detail: locationDetail.trim() || null,
      reported_by: reportedBy,
      notes: notes.trim() || null,
    }, {
      onSuccess: (data) => {
        resetForm();
        onOpenChange(false);
        onCreated?.(data.id);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) resetForm(); onOpenChange(next); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report Maintenance Issue</DialogTitle>
          <DialogDescription>Log a maintenance issue for a property</DialogDescription>
        </DialogHeader>

        {priority === 'emergency' && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm text-destructive">
              <p className="font-semibold">EMERGENCY</p>
              <p>Consider contacting a contractor immediately for life-safety issues.</p>
            </div>
          </div>
        )}

        <div className="space-y-4 py-2">
          {/* Section 1: Where */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Where</h4>
            <div className="space-y-2">
              <Label>Property *</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  {properties?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.address_line}{p.postcode ? ` — ${p.postcode}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {propertyId && rooms && rooms.length > 0 && (
              <div className="space-y-2">
                <Label>Room (optional)</Label>
                <Select value={roomId} onValueChange={setRoomId}>
                  <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="communal">Communal Areas</SelectItem>
                    <SelectItem value="external">External / Garden</SelectItem>
                    {rooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.room_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tenant (optional)</Label>
              <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>
                  {tenants?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.tenant_type === 'company' ? t.company_name || 'Company' : `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Unnamed'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Location Detail (optional)</Label>
              <Input value={locationDetail} onChange={e => setLocationDetail(e.target.value)} placeholder="e.g. Upstairs bathroom, Kitchen under sink" />
            </div>
          </div>

          {/* Section 2: What */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">What</h4>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={v => setCategory(v as MaintenanceCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Leaking tap in kitchen" maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe the issue in detail. What is the problem? When did it start?" maxLength={2000} />
            </div>
          </div>

          {/* Section 3: Urgency */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Urgency</h4>
            <RadioGroup value={priority} onValueChange={v => setPriority(v as MaintenancePriority)} className="space-y-2">
              {Object.entries(PRIORITY_CONFIG).map(([value, cfg]) => (
                <label key={value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${priority === value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                  <RadioGroupItem value={value} className="mt-0.5" />
                  <div>
                    <span className="font-medium">{cfg.icon} {cfg.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {value === 'emergency' && 'Danger to life or property. Gas leak, flooding, fire damage, no heating in winter.'}
                      {value === 'urgent' && 'Significant impact on habitability. No hot water, broken boiler, major leak.'}
                      {value === 'medium' && 'Needs attention within 1-2 weeks. Dripping tap, minor damp, faulty appliance.'}
                      {value === 'low' && 'Non-urgent improvement. Painting touch-up, garden maintenance.'}
                    </p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Section 4: Reported By */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Reported By</h4>
            <Select value={reportedBy} onValueChange={v => setReportedBy(v as ReportedBy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="operator">Operator</SelectItem>
                <SelectItem value="tenant">Tenant</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
                <SelectItem value="inspector">Inspector</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any additional notes..." maxLength={2000} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!propertyId || !title.trim() || !description.trim() || createRequest.isPending}>
            {createRequest.isPending ? 'Creating…' : 'Report Issue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
