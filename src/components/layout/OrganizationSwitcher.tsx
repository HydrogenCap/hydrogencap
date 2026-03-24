import { Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrentOrgSelection } from '@/hooks/useUserOrg';

export function OrganizationSwitcher() {
  const {
    data: organizations,
    currentOrgId,
    currentOrganization,
    selectOrganization,
    isLoading,
  } = useCurrentOrgSelection();

  if (isLoading || !organizations?.length) {
    return null;
  }

  if (organizations.length === 1 && currentOrganization) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-sidebar-border/70 bg-sidebar-accent/30 px-3 py-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Organization</p>
          <p className="truncate text-sm font-medium text-sidebar-foreground">{currentOrganization.name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="px-1 text-[11px] uppercase tracking-wide text-muted-foreground">Organization</p>
      <Select value={currentOrgId ?? undefined} onValueChange={selectOrganization}>
        <SelectTrigger className="h-9 border-sidebar-border/70 bg-sidebar-accent/30 text-left text-sm">
          <SelectValue placeholder="Select organization" />
        </SelectTrigger>
        <SelectContent>
          {organizations.map((organization) => (
            <SelectItem key={organization.id} value={organization.id}>
              {organization.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
