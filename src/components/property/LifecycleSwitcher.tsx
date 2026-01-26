import { useState } from 'react';
import { Building2, Construction, CalendarDays, AlertCircle } from 'lucide-react';
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
import { toast } from 'sonner';
import { LifecycleType } from '@/contexts/LifecycleFilterContext';

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

  const isSwitchingToCoreRental = currentLifecycle === 'development' && selectedLifecycle === 'core_rental';
  const isSwitchingToDevelopment = currentLifecycle === 'core_rental' && selectedLifecycle === 'development';

  const handleSave = async () => {
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
              <Alert className="border-primary/30">
                <AlertCircle className="h-4 w-4 text-primary" />
                <AlertDescription>
                  Switching to <strong>Core Rental</strong> will:
                  <ul className="list-disc ml-4 mt-2 text-sm">
                    <li>Enable rental income fields</li>
                    <li>Enable mortgage tracking</li>
                    <li>Enable compliance enforcement</li>
                    <li>Include property in all KPIs (cashflow, yield, LTV)</li>
                    <li>Activate reminders and weekly compliance emails</li>
                  </ul>
                </AlertDescription>
              </Alert>

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
            disabled={selectedLifecycle === currentLifecycle || updateProperty.isPending}
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
