import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, X, Percent, Building2, ArrowRightLeft, Loader2 } from 'lucide-react';
import { useBulkLoanUpdate, useBulkPropertyUpdate } from '@/hooks/useBulkPropertyUpdate';
import { useCompanies } from '@/hooks/useCompanies';

interface BulkActionsProps {
  selectedIds: Set<string>;
  onClearSelection: () => void;
}

export function BulkActions({ selectedIds, onClearSelection }: BulkActionsProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [dialogTab, setDialogTab] = useState<'mortgage' | 'property'>('mortgage');
  
  // Mortgage fields
  const [newRate, setNewRate] = useState('');
  const [fixedRateExpires, setFixedRateExpires] = useState('');
  const [lender, setLender] = useState('');
  
  // Property fields
  const [lifecycleType, setLifecycleType] = useState('');
  const [legalOwnerCompanyId, setLegalOwnerCompanyId] = useState('');

  const bulkLoanUpdate = useBulkLoanUpdate();
  const bulkPropertyUpdate = useBulkPropertyUpdate();
  const { data: companies } = useCompanies();

  const count = selectedIds.size;
  if (count === 0) return null;

  const isUpdating = bulkLoanUpdate.isPending || bulkPropertyUpdate.isPending;

  const resetForm = () => {
    setNewRate('');
    setFixedRateExpires('');
    setLender('');
    setLifecycleType('');
    setLegalOwnerCompanyId('');
  };

  const handleOpenDialog = (tab: 'mortgage' | 'property') => {
    setDialogTab(tab);
    setShowDialog(true);
  };

  const handleMortgageUpdate = async () => {
    const propertyIds = Array.from(selectedIds);
    
    await bulkLoanUpdate.mutateAsync({
      propertyIds,
      interestRate: newRate ? parseFloat(newRate) : undefined,
      fixedRateExpires: fixedRateExpires || undefined,
      lender: lender || undefined,
    });

    setShowDialog(false);
    resetForm();
    onClearSelection();
  };

  const handlePropertyUpdate = async () => {
    const propertyIds = Array.from(selectedIds);
    
    await bulkPropertyUpdate.mutateAsync({
      propertyIds,
      lifecycleStage: lifecycleType || undefined,
      entityId: legalOwnerCompanyId || undefined,
    });

    setShowDialog(false);
    resetForm();
    onClearSelection();
  };

  const canSubmitMortgage = newRate || fixedRateExpires || lender;
  const canSubmitProperty = lifecycleType || legalOwnerCompanyId;

  return (
    <>
      <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Building2 className="h-4 w-4" />
          {count} selected
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" className="gap-2">
              Bulk Actions
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleOpenDialog('mortgage')}>
              <Percent className="h-4 w-4 mr-2" />
              Update Mortgage Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleOpenDialog('property')}>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Update Property Details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button 
          size="sm" 
          variant="ghost" 
          onClick={onClearSelection}
          className="ml-auto"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Bulk Update {count} Properties</DialogTitle>
            <DialogDescription>
              Update multiple properties at once. Only filled fields will be updated.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as 'mortgage' | 'property')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="mortgage">
                <Percent className="h-4 w-4 mr-2" />
                Mortgage
              </TabsTrigger>
              <TabsTrigger value="property">
                <Building2 className="h-4 w-4 mr-2" />
                Property
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mortgage" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="rate">New Interest Rate (%)</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="20"
                  placeholder="e.g. 5.25"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry">Fixed Rate Expiry Date</Label>
                <Input
                  id="expiry"
                  type="date"
                  value={fixedRateExpires}
                  onChange={(e) => setFixedRateExpires(e.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lender">Lender</Label>
                <Input
                  id="lender"
                  placeholder="e.g. Barclays, NatWest"
                  value={lender}
                  onChange={(e) => setLender(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleMortgageUpdate} 
                  disabled={isUpdating || !canSubmitMortgage}
                >
                  {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Update Mortgages
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="property" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Lifecycle Status</Label>
                <Select value={lifecycleType} onValueChange={setLifecycleType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select lifecycle..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="core_rental">Core Rental</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Changing to Core Rental will set the operational date to today.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Legal Owner (Company)</Label>
                <Select value={legalOwnerCompanyId} onValueChange={setLegalOwnerCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select company..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.legal_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handlePropertyUpdate} 
                  disabled={isUpdating || !canSubmitProperty}
                >
                  {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Update Properties
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
