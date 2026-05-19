import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Trash2, Shield, Eye, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useOrgMembers, useUpdateMemberRole, useRemoveMember } from '@/hooks/useOrgMembers';
import { Skeleton } from '@/components/ui/skeleton';
import type { AppRole } from '@/hooks/useUserRole';

const ROLE_META: Record<AppRole, { label: string; icon: typeof Crown; color: string }> = {
  owner: { label: 'Owner', icon: Crown, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  admin: { label: 'Admin', icon: Shield, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  member: { label: 'Member', icon: Users, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  accountant: { label: 'Accountant', icon: Eye, color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  viewer: { label: 'Viewer', icon: Eye, color: 'bg-muted text-muted-foreground border-border' },
};

export function TeamMembersSettings() {
  const { user } = useAuth();
  const { isOwner, isLoading: roleLoading } = useUserRole();
  const { data: members, isLoading } = useOrgMembers();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  if (isLoading || roleLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Members
        </CardTitle>
        <CardDescription>
          Manage team access and roles. Owners can change roles and remove members.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members?.map((member) => {
            const meta = ROLE_META[member.role];
            const isSelf = member.user_id === user?.id;
            const isOnlyOwner = member.role === 'owner' && members.filter(m => m.role === 'owner').length === 1;

            return (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                    {(member.full_name?.[0] ?? member.email?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {member.full_name || 'Unnamed'} {isSelf && <span className="text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isOwner && !isSelf && !isOnlyOwner ? (
                    <Select
                      value={member.role}
                      onValueChange={(val) => updateRole.mutate({ membershipId: member.id, role: val as AppRole })}
                    >
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className={meta.color}>
                      <meta.icon className="h-3 w-3 mr-1" />
                      {meta.label}
                    </Badge>
                  )}

                  {isOwner && !isSelf && !isOnlyOwner && (
                    <Button aria-label="Delete"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeMember.mutate(member.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
