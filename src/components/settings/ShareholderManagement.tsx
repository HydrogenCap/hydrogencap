import { useState } from 'react';
import { format, isPast } from 'date-fns';
import { Mail, UserX, Clock, Shield, Eye, EyeOff, Copy, Plus, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  useShareholderInvites,
  useShareholderAccessList,
  useCreateShareholderInvite,
  useRevokeShareholderInvite,
  useRevokeShareholderAccess,
  useUpdateShareholderPermissions,
} from '@/hooks/useShareholderAccess';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';

export function ShareholderManagement() {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');

  const { data: invites, isLoading: invitesLoading } = useShareholderInvites();
  const { data: accessList, isLoading: accessLoading } = useShareholderAccessList();
  const createInvite = useCreateShareholderInvite();
  const revokeInvite = useRevokeShareholderInvite();
  const revokeAccess = useRevokeShareholderAccess();
  const updatePermissions = useUpdateShareholderPermissions();

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    await createInvite.mutateAsync({ email: inviteEmail.trim(), name: inviteName.trim() || undefined });
    setInviteEmail('');
    setInviteName('');
    setInviteDialogOpen(false);
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/portal/accept/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Invite link copied to clipboard');
  };

  const pendingInvites = invites?.filter((i) => !i.accepted_at && !isPast(new Date(i.expires_at))) || [];
  const expiredInvites = invites?.filter((i) => !i.accepted_at && isPast(new Date(i.expires_at))) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Shareholder Portal Access
            </CardTitle>
            <CardDescription>
              Invite shareholders to view portfolio performance in a read-only portal
            </CardDescription>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Invite Shareholder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Shareholder</DialogTitle>
                <DialogDescription>
                  Send an invitation to access the read-only shareholder portal.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="investor@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name (Optional)</Label>
                  <Input
                    id="name"
                    placeholder="John Smith"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={createInvite.isPending}>
                  {createInvite.isPending ? 'Sending...' : 'Send Invitation'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">
              Active Access ({accessList?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending Invites ({pendingInvites.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {accessLoading ? (
              <LoadingState text="Loading access list..." />
            ) : !accessList?.length ? (
              <EmptyState
                icon={Shield}
                title="No Active Shareholders"
                description="Invite shareholders to give them read-only access to your portfolio."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Access Level</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessList.map((access) => (
                    <TableRow key={access.id}>
                      <TableCell className="font-medium">{access.user_id}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{access.access_level}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <div className="flex items-center gap-1">
                            <Switch
                              checked={access.can_view_financials}
                              onCheckedChange={(checked) =>
                                updatePermissions.mutate({
                                  accessId: access.id,
                                  permissions: { can_view_financials: checked },
                                })
                              }
                            />
                            <span className="text-xs text-muted-foreground">Financials</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Switch
                              checked={access.can_view_compliance}
                              onCheckedChange={(checked) =>
                                updatePermissions.mutate({
                                  accessId: access.id,
                                  permissions: { can_view_compliance: checked },
                                })
                              }
                            />
                            <span className="text-xs text-muted-foreground">Compliance</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {access.last_accessed_at
                          ? format(new Date(access.last_accessed_at), 'dd MMM yyyy')
                          : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeAccess.mutate(access.id)}
                        >
                          <UserX className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="pending" className="mt-4">
            {invitesLoading ? (
              <LoadingState text="Loading invites..." />
            ) : !pendingInvites.length ? (
              <EmptyState
                icon={Mail}
                title="No Pending Invites"
                description="All invitations have been accepted or expired."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium">{invite.email}</TableCell>
                      <TableCell>{invite.name || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(invite.expires_at), 'dd MMM yyyy')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInviteLink(invite.token)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => revokeInvite.mutate(invite.id)}
                          >
                            <UserX className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
