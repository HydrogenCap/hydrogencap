import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from '@/hooks/useUserOrg';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Copy, Send, CheckCircle2, Clock } from 'lucide-react';
import type { Tenant } from '@/hooks/useTenants';
import type { TenancyWithDetails } from '@/hooks/useTenancies';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant;
  tenancies: TenancyWithDetails[];
}

export function InviteTenantPortalDialog({ open, onOpenChange, tenant, tenancies }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isCompany = tenant.tenant_type === 'company';
  const defaultEmail = isCompany ? (tenant.company_contact_email || tenant.email || '') : (tenant.email || '');
  const activeTenancies = useMemo(
    () => tenancies.filter(t => t.status === 'active' || t.status === 'notice'),
    [tenancies]
  );

  const [email, setEmail] = useState(defaultEmail);
  const [selectedTenancyId, setSelectedTenancyId] = useState('');

  useEffect(() => {
    if (!open) return;

    setEmail(defaultEmail);
    setSelectedTenancyId((current) => {
      if (current && activeTenancies.some((tenancy) => tenancy.id === current)) {
        return current;
      }
      return activeTenancies[0]?.id || '';
    });
  }, [activeTenancies, defaultEmail, open]);

  // Fetch existing invites for this tenant
  const { data: existingInvites } = useQuery({
    queryKey: ['tenant-portal-invites', tenant.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('tenant_portal_invites')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Check if tenant already has portal access
  const { data: portalAccess } = useQuery({
    queryKey: ['tenant-portal-access-check', tenant.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('tenant_portal_access')
        .select('*')
        .eq('tenant_id', tenant.id)
        .is('revoked_at', null);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const sendInvite = useMutation({
    mutationFn: async () => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');
      if (!email) throw new Error('Email is required');
      if (!selectedTenancyId) throw new Error('Select a tenancy');

      const { data: user } = await supabase.auth.getUser();

      const { data, error } = await (supabase as any)
        .from('tenant_portal_invites')
        .insert({
          org_id: orgId,
          tenant_id: tenant.id,
          tenancy_id: selectedTenancyId,
          email,
          invited_by: user.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-portal-invites', tenant.id] });
      toast({
        title: 'Invite created',
        description: `Portal invite link generated for ${email}`,
      });
    },
    onError: (error) => {
      toast({ title: 'Failed to create invite', description: error.message, variant: 'destructive' });
    },
  });

  const hasAccess = (portalAccess?.length ?? 0) > 0;

  const getInviteUrl = (token: string) => {
    return `${window.location.origin}/tenant-portal/accept/${token}`;
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getInviteUrl(token));
    toast({ title: 'Link copied', description: 'Invite link copied to clipboard' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tenant Portal Access</DialogTitle>
          <DialogDescription>
            Invite this tenant to access their portal where they can view rent, documents, and submit maintenance requests.
          </DialogDescription>
        </DialogHeader>

        {/* Current access status */}
        {hasAccess && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-primary">Portal access active</p>
              <p className="text-muted-foreground">
                {portalAccess?.map(a => a.user_id).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Send new invite */}
        {activeTenancies.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-medium">Send new invite</h4>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tenant@example.com"
              />
            </div>
            {activeTenancies.length > 1 && (
              <div className="space-y-2">
                <Label>Tenancy</Label>
                <Select value={selectedTenancyId} onValueChange={setSelectedTenancyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenancy" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTenancies.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.room.room_name === 'Whole Property' ? t.property.address_line : `${t.room.room_name} - ${t.property.address_line}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              onClick={() => sendInvite.mutate()}
              disabled={sendInvite.isPending || !email || !selectedTenancyId}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {sendInvite.isPending ? 'Creating...' : 'Create Invite Link'}
            </Button>
          </div>
        )}

        {activeTenancies.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active tenancies. Create a tenancy first before inviting to the portal.
          </p>
        )}

        {/* Existing invites */}
        {existingInvites && existingInvites.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <h4 className="text-sm font-medium">Previous invites</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {existingInvites.map(invite => {
                const isExpired = new Date(invite.expires_at) < new Date();
                const isAccepted = !!invite.accepted_at;
                return (
                  <div key={invite.id} className="flex items-center justify-between gap-2 p-2 rounded border text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{invite.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(invite.created_at), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isAccepted ? (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Accepted
                        </Badge>
                      ) : isExpired ? (
                        <Badge variant="secondary" className="text-xs">Expired</Badge>
                      ) : (
                        <>
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyLink(invite.token)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
