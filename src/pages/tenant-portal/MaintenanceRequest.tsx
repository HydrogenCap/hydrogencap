import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useDropzone } from 'react-dropzone';
import {
  Wrench, Plus, Upload, X, CheckCircle2, Image as ImageIcon,
  AlertTriangle, Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { TenantPortalLayoutV2 } from '@/components/tenant-portal/TenantPortalLayoutV2';
import { useTenantPortalSession } from '@/hooks/useTenantPortalSession';
import { supabase } from '@/integrations/supabase/client';
import { LoadingState } from '@/components/common/LoadingState';
import { toast } from 'sonner';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/lib/maintenanceTypes';
import { autoClassifyHazard, calculateDeadlines, type HazardCategory } from '@/hooks/useAwaabsLawCompliance';

const CATEGORIES = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'heating', label: 'Heating & Boilers' },
  { value: 'damp_mould', label: 'Damp & Mould' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'locks_security', label: 'Locks & Security' },
  { value: 'other', label: 'Other' },
];

const URGENCY_OPTIONS = [
  { value: 'low', label: 'Low', description: 'Not urgent — can wait a few weeks' },
  { value: 'medium', label: 'Medium', description: 'Needs attention within a week' },
  { value: 'high', label: 'High', description: 'Needs attention within 24-48 hours' },
  { value: 'emergency', label: 'Emergency', description: 'Immediate danger to safety or property' },
];

const LOCATIONS = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'living_room', label: 'Living Room' },
  { value: 'hallway', label: 'Hallway' },
  { value: 'communal', label: 'Communal Area' },
  { value: 'garden', label: 'Garden / External' },
  { value: 'other', label: 'Other' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIMES = ['Morning (8am-12pm)', 'Afternoon (12pm-5pm)', 'Evening (5pm-7pm)'];

export default function MaintenanceRequest() {
  const { tenancyId, tenantId, orgId, user, canSubmitMaintenance } = useTenantPortalSession();
  const queryClient = useQueryClient();
  const [showNewDialog, setShowNewDialog] = useState(false);

  // Form state
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [location, setLocation] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);

  const { data: tenancy } = useQuery({
    queryKey: ['tenant-maintenance-tenancy', tenancyId],
    queryFn: async () => {
      if (!tenancyId) return null;
      const { data, error } = await (supabase as any)
        .from('tenancies')
        .select('property_id')
        .eq('id', tenancyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: canSubmitMaintenance && !!tenancyId,
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ['tenant-maintenance-requests', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await (supabase as any)
        .from('maintenance_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: canSubmitMaintenance && !!tenantId,
  });

  // Photo upload via dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setPhotos(prev => {
      const combined = [...prev, ...acceptedFiles];
      return combined.slice(0, 3); // max 3
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 3 - photos.length,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: photos.length >= 3,
  });

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (photos.length === 0) return [];
    const urls: string[] = [];
    for (const photo of photos) {
      const ext = photo.name.split('.').pop();
      const path = `maintenance/${orgId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from('documents')
        .upload(path, photo);
      if (error) throw error;
      urls.push(path);
    }
    return urls;
  };

  const resetForm = () => {
    setCategory('');
    setDescription('');
    setUrgency('medium');
    setLocation('');
    setPhotos([]);
    setSelectedDays([]);
    setSelectedTimes([]);
  };

  const createRequest = useMutation({
    mutationFn: async () => {
      if (!canSubmitMaintenance) throw new Error('Maintenance access is disabled');
      if (!orgId || !tenantId || !tenancy?.property_id) throw new Error('Missing required data');

      const photoUrls = await uploadPhotos();

      // Awaab's Law: auto-classify hazard and calculate statutory deadlines
      const now = new Date();
      const hazardCategory = autoClassifyHazard(
        category as any,
        description,
        urgency
      );
      const deadlines = calculateDeadlines(now, hazardCategory);

      const payload = {
        org_id: orgId,
        tenant_id: tenantId,
        property_id: tenancy.property_id,
        title: `${CATEGORIES.find(c => c.value === category)?.label || category} - ${LOCATIONS.find(l => l.value === location)?.label || location}`,
        description,
        category,
        priority: urgency === 'emergency' ? 'emergency' : urgency === 'high' ? 'urgent' : urgency,
        urgency,
        location_in_property: location,
        location_detail: location,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
        availability: selectedDays.length > 0 || selectedTimes.length > 0
          ? { days: selectedDays, times: selectedTimes }
          : null,
        reported_by: 'tenant' as const,
        status: 'reported',
        is_emergency: urgency === 'emergency',
        tenant_user_id: user?.id,
        // Awaab's Law fields — auto-populated on tenant report (Day 0)
        awaabs_law_applies: true,
        hazard_category: hazardCategory,
        reported_at: now.toISOString(),
        investigation_due_by: deadlines.investigationDue.toISOString(),
        repair_due_by: deadlines.repairDue.toISOString(),
        escalation_level: hazardCategory === 'emergency' ? 'critical' : 'normal',
      };

      const { data, error } = await (supabase as any)
        .from('maintenance_requests')
        .insert(payload)
        .select('id, org_id')
        .single();
      if (error) throw error;

      // Log Awaab's Law audit event
      if (data?.id) {
        await (supabase as any).from('awaabs_law_events').insert({
          maintenance_request_id: data.id,
          org_id: orgId,
          event_type: 'hazard_reported',
          event_data: {
            hazard_category: hazardCategory,
            reported_at: now.toISOString(),
            investigation_due: deadlines.investigationDue.toISOString(),
            repair_due: deadlines.repairDue.toISOString(),
            auto_classified: true,
          },
          performed_by: user?.id ?? null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-maintenance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-dashboard-maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['awaabs_law'] });
      setShowNewDialog(false);
      resetForm();
      toast.success('Maintenance request submitted', {
        description: 'Your landlord has been notified. Awaab\'s Law tracking is active.',
      });
    },
    onError: (err) => {
      toast.error('Failed to submit request', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    },
  });

  const openRequests = requests?.filter(r =>
    !['completed', 'verified', 'closed', 'cancelled'].includes(r.status)
  ) || [];
  const closedRequests = requests?.filter(r =>
    ['completed', 'verified', 'closed', 'cancelled'].includes(r.status)
  ) || [];

  return (
    <TenantPortalLayoutV2>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="h-6 w-6 text-primary" />
              Maintenance Requests
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Report issues and track repairs
            </p>
          </div>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Report Issue
          </Button>
        </div>

        {isLoading ? (
          <LoadingState text="Loading requests..." />
        ) : (
          <>
            {/* Open requests */}
            {openRequests.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Open Requests ({openRequests.length})
                </h2>
                {openRequests.map((req) => (
                  <RequestCard key={req.id} request={req} />
                ))}
              </div>
            )}

            {/* Closed requests */}
            {closedRequests.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Completed ({closedRequests.length})
                </h2>
                {closedRequests.slice(0, 5).map((req) => (
                  <RequestCard key={req.id} request={req} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {requests?.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Wrench className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <h3 className="font-medium mb-1">No maintenance requests</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Need something fixed? Report an issue and we'll get it sorted.
                  </p>
                  <Button onClick={() => setShowNewDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Report Issue
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* New Request Dialog */}
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Report a Maintenance Issue</DialogTitle>
              <DialogDescription>
                Describe the issue and we'll notify your landlord or agent.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Category */}
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="What type of issue?" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Please describe the issue in detail — when did it start? How bad is it?"
                />
              </div>

              {/* Urgency + Location */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Urgency *</Label>
                  <Select value={urgency} onValueChange={setUrgency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {URGENCY_OPTIONS.map(u => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {urgency === 'emergency' && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      If there's immediate danger, call 999
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Location in property</Label>
                  <Select value={location} onValueChange={setLocation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select room" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATIONS.map(l => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Photo Upload */}
              <div className="space-y-2">
                <Label>Photos (optional, up to 3)</Label>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                    ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                    ${photos.length >= 3 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm text-muted-foreground">
                    {photos.length >= 3
                      ? 'Maximum 3 photos reached'
                      : 'Tap to add photos or drag & drop'}
                  </p>
                </div>
                {photos.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {photos.map((photo, i) => (
                      <div key={i} className="relative group">
                        <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                          <img
                            src={URL.createObjectURL(photo)}
                            alt={`Upload ${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Availability */}
              <div className="space-y-3">
                <Label>Availability for access (optional)</Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  When can a contractor visit to inspect or fix the issue?
                </p>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Days</p>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map(day => (
                      <label key={day} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={selectedDays.includes(day)}
                          onCheckedChange={(checked) => {
                            setSelectedDays(prev =>
                              checked ? [...prev, day] : prev.filter(d => d !== day)
                            );
                          }}
                        />
                        {day}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Times</p>
                  <div className="flex flex-wrap gap-2">
                    {TIMES.map(time => (
                      <label key={time} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={selectedTimes.includes(time)}
                          onCheckedChange={(checked) => {
                            setSelectedTimes(prev =>
                              checked ? [...prev, time] : prev.filter(t => t !== time)
                            );
                          }}
                        />
                        {time}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => { setShowNewDialog(false); resetForm(); }}>
                Cancel
              </Button>
              <Button
                onClick={() => createRequest.mutate()}
                disabled={!category || !description || createRequest.isPending}
              >
                {createRequest.isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TenantPortalLayoutV2>
  );
}

function RequestCard({ request }: { request: Record<string, unknown> }) {
  const req = request as {
    id: string;
    title: string;
    description: string | null;
    category: string;
    priority: string;
    status: string;
    created_at: string;
    reference_number?: string | null;
    urgency?: string | null;
    location_in_property?: string | null;
    photo_urls?: string[] | null;
  };

  const statusConfig = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG];
  const priorityConfig = PRIORITY_CONFIG[req.priority as keyof typeof PRIORITY_CONFIG];

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm truncate">{req.title}</h3>
              {req.photo_urls && req.photo_urls.length > 0 && (
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
            </div>
            {req.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{req.description}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {req.reference_number && (
                <span className="font-mono">{req.reference_number}</span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(req.created_at), 'dd MMM yyyy')}
              </span>
              {req.location_in_property && (
                <span className="capitalize">{req.location_in_property.replace('_', ' ')}</span>
              )}
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {priorityConfig && (
              <Badge variant="outline" className={`text-xs ${priorityConfig.color}`}>
                {priorityConfig.label}
              </Badge>
            )}
            {statusConfig && (
              <Badge variant="outline" className={`text-xs ${statusConfig.color}`}>
                {statusConfig.label}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
