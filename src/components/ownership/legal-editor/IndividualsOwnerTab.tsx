import { Plus, Trash2, User } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import type { PendingOwner } from './types';

interface Person { id: string; display_name: string }

interface Props {
  individuals: Person[];
  pendingOwners: PendingOwner[];
  pendingTotal: number;
  remainingPercent: number;
  onRemovePerson: (partyId: string) => void;

  showAddPerson: boolean;
  setShowAddPerson: (v: boolean) => void;

  personSearchOpen: boolean;
  setPersonSearchOpen: (v: boolean) => void;
  selectedPersonId: string;
  setSelectedPersonId: (v: string) => void;
  selectedPersonPercent: string;
  setSelectedPersonPercent: (v: string) => void;

  showNewPersonForm: boolean;
  setShowNewPersonForm: (v: boolean) => void;
  newPersonName: string;
  setNewPersonName: (v: string) => void;

  onAddPerson: () => void;
  createPartyPending: boolean;
}

export function IndividualsOwnerTab(p: Props) {
  const selectedPerson = p.individuals.find(i => i.id === p.selectedPersonId);
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Add individual owners with their percentage splits. Total must equal 100%.
      </p>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total allocated</span>
          <span className={`font-medium ${Math.abs(p.pendingTotal - 100) < 0.5 ? 'text-success' : p.pendingTotal > 100 ? 'text-destructive' : 'text-warning'}`}>
            {p.pendingTotal.toFixed(1)}%
          </span>
        </div>
        <Progress value={Math.min(p.pendingTotal, 100)} className="h-2" />
      </div>

      {p.pendingOwners.length > 0 && (
        <div className="space-y-2">
          {p.pendingOwners.map((owner) => (
            <div
              key={owner.partyId}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{owner.partyName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{owner.percent}%</span>
                <Button
                  aria-label="Delete"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => p.onRemovePerson(owner.partyId)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {p.showAddPerson ? (
        <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
          <h4 className="font-medium text-sm">Add Owner</h4>

          {!p.showNewPersonForm ? (
            <div className="space-y-2">
              <Label className="text-xs">Person</Label>
              <div className="flex gap-2">
                <Popover open={p.personSearchOpen} onOpenChange={p.setPersonSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start">
                      {selectedPerson ? (
                        <span className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {selectedPerson.display_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Select person...</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search people..." />
                      <CommandList>
                        <CommandEmpty>
                          <p className="text-sm text-muted-foreground p-2">No people found</p>
                        </CommandEmpty>
                        <CommandGroup>
                          {p.individuals.map((party) => (
                            <CommandItem
                              key={party.id}
                              value={party.display_name}
                              onSelect={() => {
                                p.setSelectedPersonId(party.id);
                                p.setPersonSearchOpen(false);
                              }}
                            >
                              <User className="mr-2 h-4 w-4" />
                              {party.display_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  aria-label="Add"
                  variant="outline"
                  size="icon"
                  onClick={() => p.setShowNewPersonForm(true)}
                  title="Create new person"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs">New Person Name</Label>
              <Input
                value={p.newPersonName}
                onChange={(e) => p.setNewPersonName(e.target.value)}
                placeholder="e.g., David O'Neill"
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { p.setShowNewPersonForm(false); p.setNewPersonName(''); }}
              >
                Select existing instead
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Ownership %</Label>
            <Input
              type="number"
              value={p.selectedPersonPercent}
              onChange={(e) => p.setSelectedPersonPercent(e.target.value)}
              placeholder={`Max ${p.remainingPercent.toFixed(1)}%`}
              min="0.01"
              max="100"
              step="0.01"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                p.setShowAddPerson(false);
                p.setSelectedPersonId('');
                p.setSelectedPersonPercent('');
                p.setShowNewPersonForm(false);
                p.setNewPersonName('');
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={p.onAddPerson} disabled={p.createPartyPending}>
              Add
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => p.setShowAddPerson(true)}
          disabled={p.remainingPercent < 0.01}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Owner
        </Button>
      )}

      {p.pendingOwners.length > 0 && Math.abs(p.pendingTotal - 100) > 0.5 && (
        <Alert variant={p.pendingTotal > 100 ? 'destructive' : 'default'} className="border-warning bg-warning/10">
          <AlertDescription className="text-warning">
            Total is {p.pendingTotal.toFixed(1)}% — must equal 100% to save
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
