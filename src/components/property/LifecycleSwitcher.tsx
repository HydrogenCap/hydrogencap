import { useState } from 'react';
import { Building2, Construction, CalendarDays, AlertCircle, Rocket, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUpdateProperty } from '@/hooks/useProperties';
import { 
  useGoLiveChecklist,
  validatePropertyData,
  buildChecklistSections,
  calculateChecklistProgress,
  isChecklistComplete
} from '@/hooks/useGoLiveChecklist';
import { usePropertyCompliance } from '@/hooks/useCompliance';
import { usePropertyBeneficialOwnership } from '@/hooks/useOwnershipLinks';
import { useProperty } from '@/hooks/useProperties';
import { toast } from 'sonner';
import { LifecycleType } from '@/contexts/LifecycleFilterContext';
import { Link } from 'react-router-dom';

interface LifecycleSwitcherProps {
  propertyId: string;
  currentLifecycle: LifecycleType;
  operationalDate?: string | null;
}

export function LifecycleSwitcher({ 
  propertyId, 
  currentLifecycle,
  operationalDate 
}: LifecycleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [selectedLifecycle, setSelectedLifecycle] = useState<LifecycleType>(currentLifecycle);
  const [opDate, setOpDate] = useState(operationalDate || '');
  const updateProperty = useUpdateProperty();
  
  // Load checklist data for validation
  const { data: property } = useProperty(propertyId);
  const { checklist } = useGoLiveChecklist(propertyId);
  const { data: complianceItems = [] } = usePropertyCompliance(propertyId);
  const { data: ownershipLinks = [] } = usePropertyBeneficialOwnership(propertyId);
  
  // Validate checklist completion
  const validation = validatePropertyData(property, complianceItems, ownershipLinks);
  const sections = buildChecklistSections(checklist, validation);
  const progress = calculateChecklistProgress(sections);
  const checklistComplete = isChecklistComplete(sections);

  const isSwitchingToCoreRental = currentLifecycle === 'development' && selectedLifecycle === 'core_rental';
  const isSwitchingToDevelopment = currentLifecycle === 'core_rental' && selectedLifecycle === 'development';
  
  // Block switching to core_rental if checklist is incomplete
  const canSwitchToCoreRental = checklistComplete;

  const handleSave = async () => {
    if (isSwitchingToCoreRental && !canSwitchToCoreRental) {
      toast.error('Complete the Ready to Go Live checklist to activate this property');
      return;
    }
    
    try {
      await updateProperty.mutateAsync({
        id: propertyId,
        lifecycle_type: selectedLifecycle,
        lifecycle_status_date: new Date().toISOString().split('T')[0],
        ...(isSwitchingToCoreRental && opDate ? { operational_date: opDate } : {}),
      });
      
      toast.success(
        selectedLifecycle === 'core_rental' 
          ? 'Property activated as Core Rental - income metrics and compliance tracking enabled'
          : 'Property set to Development - income metrics and compliance tracking paused'
      );
      setOpen(false);
    } catch (error) {
      toast.error('Failed to update property lifecycle');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {currentLifecycle === 'core_rental' ? (
            <>
              <Building2 className="h-4 w-4 text-primary" />
              Core Rental
            </>
          ) : (
            <>
              <Construction className="h-4 w-4 text-amber-600" />
              Development
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Property Lifecycle</DialogTitle>
          <DialogDescription>
            Change how this property is categorized and tracked in your portfolio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Lifecycle Type</Label>
            <Select 
              value={selectedLifecycle} 
              onValueChange={(v) => setSelectedLifecycle(v as LifecycleType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="development">
                  <div className="flex items-center gap-2">
                    <Construction className="h-4 w-4 text-amber-600" />
                    Development
                  </div>
                </SelectItem>
                <SelectItem value="core_rental">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Core Rental
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isSwitchingToCoreRental && (
            <>
              {!canSwitchToCoreRental ? (
                <Alert className="border-warning/50 bg-warning/10">
                  <Lock className="h-4 w-4 text-warning" />
                  <AlertDescription className="space-y-2">
                    <p className="font-medium text-warning">
                      Complete the Go Live Checklist first
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {progress.completed} of {progress.total} items completed ({progress.percentage}%)
                    </p>
                    <Link 
                      to={`/properties/${propertyId}?tab=overview`}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      onClick={() => setOpen(false)}
                    >
                      <Rocket className="h-3 w-3" />
                      View checklist
                    </Link>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-success/30 bg-success/10">
                  <Rocket className="h-4 w-4 text-success" />
                  <AlertDescription>
                    <p className="font-medium text-success">Ready to Go Live!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Switching to <strong>Core Rental</strong> will:
                    </p>
                    <ul className="list-disc ml-4 mt-2 text-sm text-muted-foreground">
                      <li>Enable rental income fields</li>
                      <li>Enable mortgage tracking</li>
                      <li>Enable compliance enforcement</li>
                      <li>Include property in all KPIs (cashflow, yield, LTV)</li>
                      <li>Activate reminders and weekly compliance emails</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {canSwitchToCoreRental && (
                <div className="space-y-2">
                  <Label htmlFor="operational-date" className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Operational Date (optional)
                  </Label>
                  <Input
                    id="operational-date"
                    type="date"
                    value={opDate}
                    onChange={(e) => setOpDate(e.target.value)}
                    placeholder="When did this property become income-producing?"
                  />
                  <p className="text-xs text-muted-foreground">
                    Date when the property started generating rental income
                  </p>
                </div>
              )}
            </>
          )}

          {isSwitchingToDevelopment && (
            <Alert className="border-warning/30">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertDescription>
                Switching to <strong>Development</strong> will:
                <ul className="list-disc ml-4 mt-2 text-sm">
                  <li>Pause rental income metrics</li>
                  <li>Pause mortgage metrics</li>
                  <li>Exclude property from portfolio KPIs</li>
                  <li>Pause compliance tracking and reminders</li>
                  <li>Stop flagging missing or expired compliance</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {operationalDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Operational since: {new Date(operationalDate).toLocaleDateString('en-GB')}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={
              selectedLifecycle === currentLifecycle || 
              updateProperty.isPending ||
              (isSwitchingToCoreRental && !canSwitchToCoreRental)
            }
          >
            {updateProperty.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Badge component for displaying lifecycle status inline
export function LifecycleBadge({ lifecycle }: { lifecycle: LifecycleType }) {
  if (lifecycle === 'core_rental') {
    return (
      <Badge variant="outline" className="text-primary border-primary/30 gap-1">
        <Building2 className="h-3 w-3" />
        Core Rental
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="text-warning border-warning/30 gap-1">
      <Construction className="h-3 w-3" />
      Development
    </Badge>
  );
}
