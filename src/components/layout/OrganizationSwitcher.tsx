import { useState } from 'react';
import { Building2, ChevronDown, Plus, Check, Crown, ShieldCheck, Users, Eye, Calculator } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
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
import { useCurrentOrgSelection } from '@/hooks/useUserOrg';
import { useCreateOrganization } from '@/hooks/useCreateOrganization';

const ROLE_ICONS: Record<string, typeof Crown> = {
  owner: Crown,
  admin: ShieldCheck,
  member: Users,
  accountant: Calculator,
  viewer: Eye,
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'text-amber-600',
  admin: 'text-primary',
  member: 'text-emerald-600',
  accountant: 'text-violet-600',
  viewer: 'text-muted-foreground',
};

function RoleBadge({ role }: { role: string }) {
  const Icon = ROLE_ICONS[role] ?? Eye;
  const color = ROLE_COLORS[role] ?? 'text-muted-foreground';
  return (
    <Badge variant="outline" className="gap-1 text-[10px] font-normal px-1.5 py-0">
      <Icon className={`h-2.5 w-2.5 ${color}`} />
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </Badge>
  );
}

export function OrganizationSwitcher() {
  const {
    data: organizations,
    currentOrgId,
    currentOrganization,
    selectOrganization,
    isLoading,
  } = useCurrentOrgSelection();

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  if (isLoading || !organizations?.length) {
    return null;
  }

  // Single org — static display
  if (organizations.length === 1 && currentOrganization) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-sidebar-border/70 bg-sidebar-accent/30 px-3 py-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Organization</p>
          <p className="truncate text-sm font-medium text-sidebar-foreground">{currentOrganization.name}</p>
        </div>
        <RoleBadge role={currentOrganization.role} />
      </div>
    );
  }

  // Multi-org — dropdown switcher
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-md border border-sidebar-border/70 bg-sidebar-accent/30 px-3 py-2 text-left transition-colors hover:bg-sidebar-accent/50">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Organization</p>
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {currentOrganization?.name ?? 'Select org'}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px]">
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => selectOrganization(org.id)}
              className="flex items-center gap-2 py-2"
            >
              <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{org.name}</p>
              </div>
              <RoleBadge role={org.role} />
              {org.id === currentOrgId && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowCreateDialog(true)}
            className="gap-2 text-muted-foreground"
          >
            <Plus className="h-4 w-4" />
            Create New Organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrgDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  );
}

// ─── Create Org Dialog ──────────────────────────────────────────

function CreateOrgDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState('');
  const createOrg = useCreateOrganization();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await createOrg.mutateAsync({ name: name.trim() });
    setName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogDescription>
            Create a new organization to manage a separate portfolio of properties.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="e.g. Smith Properties Ltd"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createOrg.isPending}>
              {createOrg.isPending ? 'Creating...' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
