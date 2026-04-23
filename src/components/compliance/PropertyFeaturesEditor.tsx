import { useState, useEffect } from 'react';
import { Save, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface PropertyFeaturesEditorProps {
  propertyId: string;
  initialFeatures: {
    has_gas: boolean | null;
    has_fire_alarm_system: boolean | null;
    fire_alarm_grade: string | null;
    has_emergency_lighting: boolean | null;
    asset_category: string | null;
    occupancy_status: string | null;
    is_hmo_licensed: boolean | null;
    selective_licence_required: boolean | null;
    co_alarm_required: boolean | null;
    is_grade_listed: boolean | null;
    listing_grade: string | null;
    has_solar: boolean | null;
  };
  onUpdate?: () => void;
}

const ASSET_CATEGORIES = ['Single Let', 'HMO', 'HMO (Licensed)', 'Commercial', 'Mixed Use'];
const OCCUPANCY_STATUSES = ['Occupied', 'Void', 'In Works'];
const FIRE_ALARM_GRADES = ['None', 'Grade D1', 'Grade D2', 'Grade A', 'Grade LD1', 'Grade LD2', 'Grade LD3'];
const LISTING_GRADES = ['I', 'II*', 'II'];

export function PropertyFeaturesEditor({ 
  propertyId, 
  initialFeatures,
  onUpdate 
}: PropertyFeaturesEditorProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [features, setFeatures] = useState(initialFeatures);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    setFeatures(initialFeatures);
  }, [initialFeatures]);
  
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('properties_v2')
        .update({
          has_gas_supply: features.has_gas,
          has_fire_alarm_system: features.has_fire_alarm_system,
          fire_alarm_grade: features.fire_alarm_grade,
          has_emergency_lighting: features.has_emergency_lighting,
          asset_category: features.asset_category,
          occupancy_status: features.occupancy_status,
          is_hmo_licensed: features.is_hmo_licensed,
          selective_licence_required: features.selective_licence_required,
          co_alarm_required: features.co_alarm_required,
          listed_status: features.is_grade_listed ? 'listed' : 'not_listed',
          listing_grade: features.listing_grade,
          has_solar: features.has_solar,
        })
        .eq('id', propertyId);
      
      if (error) throw error;
      
      // Invalidate queries to refresh compliance requirements
      queryClient.invalidateQueries({ queryKey: ['property_features', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['all_property_features'] });
      queryClient.invalidateQueries({ queryKey: ['compliance'] });
      
      toast({ title: 'Property features updated' });
      setOpen(false);
      onUpdate?.();
    } catch (error) {
      toast({ 
        title: 'Failed to update', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" />
          Configure Property Features
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Property Compliance Features</DialogTitle>
          <DialogDescription>
            Configure property features to automatically determine required compliance items.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Asset Category */}
          <div className="space-y-2">
            <Label>Asset Category</Label>
            <Select 
              value={features.asset_category || 'Single Let'} 
              onValueChange={(v) => setFeatures({ ...features, asset_category: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Occupancy Status */}
          <div className="space-y-2">
            <Label>Occupancy Status</Label>
            <Select 
              value={features.occupancy_status || 'Occupied'} 
              onValueChange={(v) => setFeatures({ ...features, occupancy_status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OCCUPANCY_STATUSES.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Gas Supply */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Has Gas Supply</Label>
              <p className="text-xs text-muted-foreground">Determines if CP12 is required</p>
            </div>
            <Switch 
              checked={features.has_gas ?? true}
              onCheckedChange={(v) => setFeatures({ ...features, has_gas: v })}
            />
          </div>
          
          {/* CO Alarm Required */}
          <div className="flex items-center justify-between">
            <div>
              <Label>CO Alarm Required</Label>
              <p className="text-xs text-muted-foreground">Gas or solid fuel present</p>
            </div>
            <Switch 
              checked={features.co_alarm_required ?? true}
              onCheckedChange={(v) => setFeatures({ ...features, co_alarm_required: v })}
            />
          </div>
          
          {/* Fire Alarm System */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Has Fire Alarm System</Label>
              <p className="text-xs text-muted-foreground">Integrated fire detection</p>
            </div>
            <Switch 
              checked={features.has_fire_alarm_system ?? false}
              onCheckedChange={(v) => setFeatures({ ...features, has_fire_alarm_system: v })}
            />
          </div>
          
          {features.has_fire_alarm_system && (
            <div className="space-y-2 pl-4 border-l-2">
              <Label>Fire Alarm Grade</Label>
              <Select 
                value={features.fire_alarm_grade || 'None'} 
                onValueChange={(v) => setFeatures({ ...features, fire_alarm_grade: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIRE_ALARM_GRADES.map(grade => (
                    <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Emergency Lighting */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Has Emergency Lighting</Label>
              <p className="text-xs text-muted-foreground">Battery backup lighting system</p>
            </div>
            <Switch 
              checked={features.has_emergency_lighting ?? false}
              onCheckedChange={(v) => setFeatures({ ...features, has_emergency_lighting: v })}
            />
          </div>
          
          {/* HMO Licensed */}
          <div className="flex items-center justify-between">
            <div>
              <Label>HMO Licence Required</Label>
              <p className="text-xs text-muted-foreground">Mandatory or additional HMO</p>
            </div>
            <Switch 
              checked={features.is_hmo_licensed ?? false}
              onCheckedChange={(v) => setFeatures({ ...features, is_hmo_licensed: v })}
            />
          </div>
          
          {/* Selective Licensing */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Selective Licensing Area</Label>
              <p className="text-xs text-muted-foreground">Council requires licence</p>
            </div>
            <Switch 
              checked={features.selective_licence_required ?? false}
              onCheckedChange={(v) => setFeatures({ ...features, selective_licence_required: v })}
            />
          </div>
          
          {/* Grade Listed Building */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Grade Listed Building</Label>
              <p className="text-xs text-muted-foreground">Exempt from EPC requirements</p>
            </div>
            <Switch 
              checked={features.is_grade_listed ?? false}
              onCheckedChange={(v) => setFeatures({ 
                ...features, 
                is_grade_listed: v,
                listing_grade: v ? (features.listing_grade || 'II') : null
              })}
            />
          </div>
          
          {features.is_grade_listed && (
            <div className="space-y-2 pl-4 border-l-2">
              <Label>Listing Grade</Label>
              <Select 
                value={features.listing_grade || 'II'} 
                onValueChange={(v) => setFeatures({ ...features, listing_grade: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LISTING_GRADES.map(grade => (
                    <SelectItem key={grade} value={grade}>Grade {grade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Historic England listing classification</p>
            </div>
          )}
          
          {/* Solar Panels */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Has Solar Panels</Label>
              <p className="text-xs text-muted-foreground">Enables MCS certificate tracking</p>
            </div>
            <Switch 
              checked={features.has_solar ?? false}
              onCheckedChange={(v) => setFeatures({ ...features, has_solar: v })}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            Save Features
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
