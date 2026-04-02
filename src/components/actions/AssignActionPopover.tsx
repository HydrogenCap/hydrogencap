import { useState } from 'react';
import { UserPlus, User, Wrench, Check, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useOrgMembers, type OrgMember } from '@/hooks/useOrgMembers';
import { useContractors, type Contractor } from '@/hooks/useContractors';
import { useAssignAction, getActionKey, type ActionAssignment } from '@/hooks/useActionWorkflows';
import type { RiskItem } from '@/hooks/usePortfolioRisks';

interface AssignActionPopoverProps {
  risk: RiskItem;
  assignment?: ActionAssignment;
  memberMap: Map<string, OrgMember>;
  contractorMap: Map<string, Contractor>;
  children: React.ReactNode;
}

export function AssignActionPopover({
  risk,
  assignment,
  memberMap,
  contractorMap,
  children,
}: AssignActionPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'members' | 'contractors'>('members');

  const { data: members = [] } = useOrgMembers();
  const { data: contractors = [] } = useContractors({ isActive: true });
  const assignMutation = useAssignAction();

  const filteredMembers = members.filter(m => {
    const name = (m.full_name || m.email || '').toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const filteredContractors = contractors.filter(c => {
    const name = (c.name + ' ' + (c.company_name || '')).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const handleAssignUser = (userId: string) => {
    const { actionType, actionKey } = getActionKey(risk.id);
    assignMutation.mutate(
      { actionType, actionKey, assignedToUserId: userId },
      { onSuccess: () => setOpen(false) }
    );
  };

  const handleAssignContractor = (contractorId: string) => {
    const { actionType, actionKey } = getActionKey(risk.id);
    assignMutation.mutate(
      { actionType, actionKey, assignedToContractorId: contractorId },
      { onSuccess: () => setOpen(false) }
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-3 border-b">
          <p className="text-sm font-medium mb-2">Assign to</p>
          <Input
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium transition-colors',
              tab === 'members'
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setTab('members')}
          >
            <User className="h-3.5 w-3.5 inline mr-1" />
            Team ({filteredMembers.length})
          </button>
          <button
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium transition-colors',
              tab === 'contractors'
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setTab('contractors')}
          >
            <Wrench className="h-3.5 w-3.5 inline mr-1" />
            Contractors ({filteredContractors.length})
          </button>
        </div>

        <ScrollArea className="max-h-48">
          {assignMutation.isPending ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : tab === 'members' ? (
            <div className="p-1">
              {filteredMembers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No team members found</p>
              ) : (
                filteredMembers.map(member => {
                  const isAssigned = assignment?.assigned_to_user_id === member.user_id;
                  return (
                    <button
                      key={member.id}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors text-sm',
                        isAssigned ? 'bg-primary/10' : 'hover:bg-muted'
                      )}
                      onClick={() => handleAssignUser(member.user_id)}
                    >
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.full_name || member.email || 'Unknown'}
                        </p>
                        {member.full_name && member.email && (
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        )}
                      </div>
                      {isAssigned && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="p-1">
              {filteredContractors.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No contractors found</p>
              ) : (
                filteredContractors.map(contractor => {
                  const isAssigned = assignment?.assigned_to_contractor_id === contractor.id;
                  return (
                    <button
                      key={contractor.id}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors text-sm',
                        isAssigned ? 'bg-primary/10' : 'hover:bg-muted'
                      )}
                      onClick={() => handleAssignContractor(contractor.id)}
                    >
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{contractor.name}</p>
                        {contractor.company_name && (
                          <p className="text-xs text-muted-foreground truncate">{contractor.company_name}</p>
                        )}
                      </div>
                      {contractor.is_preferred && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                          Preferred
                        </Badge>
                      )}
                      {isAssigned && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
