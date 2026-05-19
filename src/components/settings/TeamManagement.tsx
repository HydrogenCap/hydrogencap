import { useState } from 'react';
import {
  UserPlus,
  Users,
  Crown,
  ShieldCheck,
  Eye,
  Ellipsis,
  Mail,
  Copy,
  Trash2,
  RefreshCw,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow, isPast } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  useTeamMembers,
  useTeamInvites,
  useSendTeamInvite,
  useResendTeamInvite,
  useRevokeTeamInvite,
  useChangeTeamRole,
  useRemoveTeamMember,
  useCurrentUserRole,
  type AppRole,
  type TeamMember,
  type TeamInvite,
} from '@/hooks/useTeamManagement';

// ─── Role display helpers ────────────────────────────────────────

const ROLE_CONFIG: Record<AppRole, { label: string; icon: typeof Crown; color: string }> = {
  owner: { label: 'Owner', icon: Crown, color: 'text-amber-600' },
  admin: { label: 'Admin', icon: ShieldCheck, color: 'text-primary' },
  member: { label: 'Member', icon: Users, color: 'text-emerald-600' },
  accountant: { label: 'Accountant', icon: Eye, color: 'text-violet-600' },
  viewer: { label: 'Viewer', icon: Eye, color: 'text-muted-foreground' },
};

function RoleBadge({ role }: { role: AppRole }) {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Icon className={`h-3 w-3 ${config.color}`} />
      {config.label}
    </Badge>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export function TeamManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: members, isLoading: membersLoading } = useTeamMembers();
  const { data: invites, isLoading: invitesLoading } = useTeamInvites();
  const { data: currentRole } = useCurrentUserRole();

  const sendInvite = useSendTeamInvite();
  const resendInvite = useResendTeamInvite();
  const revokeInvite = useRevokeTeamInvite();
  const changeRole = useChangeTeamRole();
  const removeMember = useRemoveTeamMember();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole>('viewer');

  const canManage = currentRole === 'owner' || currentRole === 'admin';

  const pendingInvites = invites?.filter(
    i => !i.acceptedAt && !i.revokedAt && !isPast(new Date(i.expiresAt))
  ) || [];
  const expiredInvites = invites?.filter(
    i => !i.acceptedAt && !i.revokedAt && isPast(new Date(i.expiresAt))
  ) || [];

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    if (inviteEmail.toLowerCase().trim() === user?.email) {
      toast({ title: 'Cannot invite yourself', variant: 'destructive' });
      return;
    }

    if (members?.some(m => m.email.toLowerCase() === inviteEmail.toLowerCase().trim())) {
      toast({ title: 'This person is already a team member', variant: 'destructive' });
      return;
    }

    try {
      await sendInvite.mutateAsync({
        email: inviteEmail.trim(),
        name: inviteName.trim() || undefined,
        role: inviteRole,
      });
      setInviteEmail('');
      setInviteName('');
      setInviteRole('viewer');
    } catch (err) {
      toast({ title: 'Failed to send invite', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/team/accept/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Invite link copied' });
  };

  return (
    <div className="space-y-6">
      {/* ─── Invite Form ─────────────────────────────────────── */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Team Member
            </CardTitle>
            <CardDescription>
              Invite someone to access your portfolio. They'll receive an email
              with a link to join.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email address *</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Name (optional)</Label>
                  <Input
                    id="invite-name"
                    placeholder="John Smith"
                    value={inviteName}
                    onChange={e => setInviteName(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-end gap-4">
                <div className="space-y-2 flex-1 max-w-[200px]">
                  <Label>Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={v => setInviteRole(v as AppRole)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <span className="flex items-center gap-2">
                          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                          Admin — Full access
                        </span>
                      </SelectItem>
                      <SelectItem value="member">
                        <span className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-emerald-600" />
                          Member — Read & write
                        </span>
                      </SelectItem>
                      <SelectItem value="accountant">
                        <span className="flex items-center gap-2">
                          <Eye className="h-3.5 w-3.5 text-violet-600" />
                          Accountant — Financial access
                        </span>
                      </SelectItem>
                      <SelectItem value="viewer">
                        <span className="flex items-center gap-2">
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          Viewer — Read only
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" disabled={!inviteEmail.trim() || sendInvite.isPending}>
                  {sendInvite.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</>
                  ) : (
                    <><Mail className="h-4 w-4 mr-2" />Send Invite</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── Active Members ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
            {members && (
              <Badge variant="secondary" className="ml-auto font-normal">
                {members.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>People with access to your portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !members || members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No team members yet</p>
          ) : (
            <div className="space-y-1">
              {members.map(member => (
                <MemberRow
                  key={member.membershipId}
                  member={member}
                  isCurrentUser={member.userId === user?.id}
                  canManage={canManage}
                  currentRole={currentRole || 'viewer'}
                  onChangeRole={(newRole) =>
                    changeRole.mutate({ membershipId: member.membershipId, newRole })
                  }
                  onRemove={() => removeMember.mutate(member.membershipId)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Pending Invites ─────────────────────────────────── */}
      {canManage && (pendingInvites.length > 0 || expiredInvites.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Invites
              {pendingInvites.length > 0 && (
                <Badge variant="secondary" className="ml-auto font-normal">
                  {pendingInvites.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invitesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-1">
                {pendingInvites.map(invite => (
                  <InviteRow
                    key={invite.id}
                    invite={invite}
                    status="pending"
                    onResend={() => resendInvite.mutate(invite.id)}
                    onRevoke={() => revokeInvite.mutate(invite.id)}
                    onCopyLink={() => copyInviteLink(invite.token)}
                    isResending={resendInvite.isPending}
                  />
                ))}

                {expiredInvites.length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <p className="text-xs text-muted-foreground font-medium px-3 py-1">Expired</p>
                    {expiredInvites.map(invite => (
                      <InviteRow
                        key={invite.id}
                        invite={invite}
                        status="expired"
                        onResend={() => resendInvite.mutate(invite.id)}
                        onRevoke={() => revokeInvite.mutate(invite.id)}
                        onCopyLink={() => copyInviteLink(invite.token)}
                        isResending={resendInvite.isPending}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Member Row ──────────────────────────────────────────────────

function MemberRow({
  member,
  isCurrentUser,
  canManage,
  currentRole,
  onChangeRole,
  onRemove,
}: {
  member: TeamMember;
  isCurrentUser: boolean;
  canManage: boolean;
  currentRole: AppRole;
  onChangeRole: (role: AppRole) => void;
  onRemove: () => void;
}) {
  const canEdit = canManage && !isCurrentUser && member.role !== 'owner';
  const canPromoteToAdmin = currentRole === 'owner';

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <span className="text-sm font-medium text-primary">
          {(member.fullName || member.email)[0].toUpperCase()}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {member.fullName || member.email}
          {isCurrentUser && (
            <span className="text-xs text-muted-foreground ml-1">(you)</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>

      <RoleBadge role={member.role} />

      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="Ellipsis" variant="ghost" size="icon" className="h-8 w-8">
              <Ellipsis className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canPromoteToAdmin && member.role !== 'admin' && (
              <DropdownMenuItem onClick={() => onChangeRole('admin')}>
                <ShieldCheck className="h-4 w-4 mr-2 text-primary" />
                Make Admin
              </DropdownMenuItem>
            )}
            {member.role !== 'member' && (
              <DropdownMenuItem onClick={() => onChangeRole('member')}>
                <Users className="h-4 w-4 mr-2 text-emerald-600" />
                Make Member
              </DropdownMenuItem>
            )}
            {member.role !== 'accountant' && (
              <DropdownMenuItem onClick={() => onChangeRole('accountant')}>
                <Eye className="h-4 w-4 mr-2 text-violet-600" />
                Make Accountant
              </DropdownMenuItem>
            )}
            {member.role !== 'viewer' && (
              <DropdownMenuItem onClick={() => onChangeRole('viewer')}>
                <Eye className="h-4 w-4 mr-2" />
                Make Viewer
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={e => e.preventDefault()}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove from team
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                  <AlertDialogDescription>
                    <strong>{member.fullName || member.email}</strong> will
                    immediately lose access to the portfolio. They can be
                    re-invited later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onRemove}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// ─── Invite Row ──────────────────────────────────────────────────

function InviteRow({
  invite,
  status,
  onResend,
  onRevoke,
  onCopyLink,
  isResending,
}: {
  invite: TeamInvite;
  status: 'pending' | 'expired';
  onResend: () => void;
  onRevoke: () => void;
  onCopyLink: () => void;
  isResending: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Mail className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {invite.name || invite.email}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {invite.name ? invite.email : ''}
          {status === 'pending'
            ? ` · Expires ${formatDistanceToNow(new Date(invite.expiresAt), { addSuffix: true })}`
            : ' · Expired'}
        </p>
      </div>

      <RoleBadge role={invite.role} />

      <Badge
        variant="outline"
        className={status === 'expired' ? 'text-muted-foreground' : 'text-amber-600'}
      >
        {status === 'pending' ? 'Pending' : 'Expired'}
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label="Ellipsis" variant="ghost" size="icon" className="h-8 w-8">
            <Ellipsis className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onCopyLink}>
            <Copy className="h-4 w-4 mr-2" />
            Copy invite link
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onResend} disabled={isResending}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {status === 'expired' ? 'Re-send invite' : 'Resend email'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onRevoke} className="text-destructive focus:text-destructive">
            <XCircle className="h-4 w-4 mr-2" />
            Revoke invite
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
