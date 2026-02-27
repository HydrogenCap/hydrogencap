import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Wrench, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { TenantPortalLayout } from '@/components/tenant-portal/TenantPortalLayout';
import { useTenantPortalSession } from '@/hooks/useTenantPortalSession';
import { supabase } from '@/integrations/supabase/client';
import { LoadingState } from '@/components/common/LoadingState';
import { toast } from 'sonner';

const priorityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-primary/10 text-primary',
  urgent: 'bg-warning/10 text-warning',
  emergency: 'bg-destructive/10 text-destructive',
};

const statusColors: Record<string, string> = {
  reported: 'bg-accent text-accent-foreground',
  triaged: 'bg-primary/10 text-primary',
  in_progress: 'bg-warning/10 text-warning',
  completed: 'bg-primary/10 text-primary',
  cancelled: 'bg-muted text-muted-foreground',
  closed: 'bg-muted text-muted-foreground',
};

export default function TenantMaintenance() {
  const { tenancyId, tenantId, orgId } = useTenantPortalSession();
  const queryClient = useQueryClient();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [urgency, setUrgency] = useState('normal');

  // Get property_id from tenancy
  const { data: tenancy } = useQuery({
    queryKey: ['tenant-portal-tenancy-for-maintenance', tenancyId],
    queryFn: async () => {
      if (!tenancyId) return null;
      const { data, error } = await supabase
        .from('tenancies')
        .select('property_id')
        .eq('id', tenancyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenancyId,
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ['tenant-portal-maintenance', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createRequest = useMutation({
    mutationFn: async () => {
      if (!orgId || !tenantId || !tenancy?.property_id) throw new Error('Missing data');
      const { error } = await supabase
        .from('maintenance_requests')
        .insert({
          org_id: orgId,
          tenant_id: tenantId,
          property_id: tenancy.property_id,
          title,
          description,
          category: category as any,
          urgency: urgency as any,
          status: 'submitted' as any,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-portal-maintenance'] });
      setShowNewDialog(false);
      setTitle('');
      setDescription('');
      setCategory('general');
      setUrgency('normal');
      toast.success('Maintenance request submitted');
    },
    onError: (err: any) => {
      toast.error('Failed to submit request', { description: err.message });
    },
  });

  return (
    <TenantPortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wrench className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Maintenance Requests</h1>
          </div>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </div>

        {isLoading ? (
          <LoadingState text="Loading requests..." />
        ) : requests && requests.length > 0 ? (
          <div className="space-y-3">
            {requests.map((req) => (
              <Card key={req.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-medium">{req.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{req.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Submitted {format(new Date(req.created_at), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0 ml-4">
                      <Badge variant="outline" className={priorityColors[req.priority] || ''}>
                        {req.priority}
                      </Badge>
                      <Badge variant="outline" className={statusColors[req.status] || ''}>
                        {req.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="font-medium mb-1">No maintenance requests</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Need something fixed? Submit a request and your landlord will be notified.
              </p>
              <Button onClick={() => setShowNewDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Submit Request
              </Button>
            </CardContent>
          </Card>
        )}

        {/* New Request Dialog */}
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Maintenance Request</DialogTitle>
              <DialogDescription>
                Describe the issue and we'll notify your landlord.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Leaking tap in kitchen" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Please describe the issue in detail..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="plumbing">Plumbing</SelectItem>
                      <SelectItem value="electrical">Electrical</SelectItem>
                      <SelectItem value="heating">Heating</SelectItem>
                      <SelectItem value="structural">Structural</SelectItem>
                      <SelectItem value="pest_control">Pest Control</SelectItem>
                      <SelectItem value="appliance">Appliance</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Urgency</Label>
                  <Select value={urgency} onValueChange={setUrgency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
              <Button onClick={() => createRequest.mutate()} disabled={!title || !description || createRequest.isPending}>
                {createRequest.isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TenantPortalLayout>
  );
}
