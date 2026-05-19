import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, addMonths } from 'date-fns';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Home, 
  EllipsisVertical, 
  CheckCircle2, 
  Calendar,
  ExternalLink
} from 'lucide-react';
import { useUpdateComplianceItem, useUploadComplianceDocument } from '@/hooks/useCompliance';
import { toast } from 'sonner';
import type { StatusType } from './ComplianceStatusCard';

interface ComplianceEvent {
  id: string;
  propertyId: string;
  address: string;
  date: Date;
  type: string;
  typeLabel: string;
  daysUntil: number;
  status: 'valid' | 'expiring_soon' | 'expired' | 'missing';
  issueDate?: string | null;
}

interface ComplianceItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStatus: StatusType | null;
  items: ComplianceEvent[];
  onItemUpdated: () => void;
}

const STATUS_TITLES: Record<StatusType, string> = {
  expired: 'Expired Compliance Items',
  expiring_soon: 'Expiring Within 30 Days',
  within_90: 'Expiring Within 90 Days',
  valid: 'Valid Compliance Items',
  all: 'All Compliance Items',
};

// Standard validity periods for quick-fill
const VALIDITY_PERIODS: Record<string, number> = {
  GAS_SAFETY: 12,
  EICR: 60,
  EPC: 120,
  HMO_LICENCE: 60,
  FIRE_ALARM: 12,
  EMERGENCY_LIGHTING: 12,
  LEGIONELLA: 24,
  PAT_TESTING: 12,
};

export function ComplianceItemDrawer({
  open,
  onOpenChange,
  selectedStatus,
  items,
  onItemUpdated,
}: ComplianceItemDrawerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    issueDate: '',
    expiryDate: '',
    certificateNumber: '',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const updateCompliance = useUpdateComplianceItem();
  const uploadDocument = useUploadComplianceDocument();

  const handleStartEdit = (item: ComplianceEvent) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const validityMonths = VALIDITY_PERIODS[item.type] || 12;
    const defaultExpiry = format(addMonths(new Date(), validityMonths), 'yyyy-MM-dd');
    
    setEditingId(item.id);
    setFormData({
      issueDate: today,
      expiryDate: defaultExpiry,
      certificateNumber: '',
    });
    setUploadFile(null);
  };

  const handleSave = async (item: ComplianceEvent) => {
    try {
      // Update compliance item dates
      await updateCompliance.mutateAsync({
        id: item.id,
        issue_date: formData.issueDate || null,
        expiry_date: formData.expiryDate || null,
      });

      // Upload document if provided
      if (uploadFile) {
        await uploadDocument.mutateAsync({
          complianceItemId: item.id,
          propertyId: item.propertyId,
          file: uploadFile,
          complianceType: item.typeLabel,
          propertyAddress: item.address,
        });
      }

      toast.success(`${item.typeLabel} updated for ${item.address.split(',')[0]}`);
      setEditingId(null);
      setUploadFile(null);
      onItemUpdated();
    } catch (_error) {
      toast.error('Failed to update compliance item');
    }
  };

  const handleQuickExpiry = (months: number) => {
    const newExpiry = format(addMonths(new Date(formData.issueDate || new Date()), months), 'yyyy-MM-dd');
    setFormData(prev => ({ ...prev, expiryDate: newExpiry }));
  };

  const getStatusBadge = (item: ComplianceEvent) => {
    if (item.daysUntil < 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          Expired {Math.abs(item.daysUntil)} days ago
        </Badge>
      );
    }
    if (item.daysUntil === 0) {
      return <Badge variant="destructive" className="text-xs">Expires today</Badge>;
    }
    if (item.daysUntil <= 30) {
      return (
        <Badge className="bg-amber-500 text-white text-xs">
          {item.daysUntil} days left
        </Badge>
      );
    }
    if (item.daysUntil <= 90) {
      return (
        <Badge className="bg-yellow-500 text-white text-xs">
          {item.daysUntil} days left
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-500 text-white text-xs">
        Valid
      </Badge>
    );
  };

  if (!selectedStatus) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[540px] p-0 flex flex-col">
        <SheetHeader className="p-6 pb-2">
          <SheetTitle className="flex items-center gap-2">
            {STATUS_TITLES[selectedStatus]}
            <Badge variant="secondary" className="ml-2">{items.length}</Badge>
          </SheetTitle>
          <SheetDescription>
            Click on any item to update or upload a new certificate
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {items.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-3" />
                <p className="text-muted-foreground">
                  No {selectedStatus.replace('_', ' ')} items
                </p>
              </div>
            ) : (
              items.map((item) => (
                <Card key={item.id} className="p-4 hover:shadow-md transition-shadow">
                  {editingId === item.id ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold flex items-center gap-2">
                            <Home className="h-4 w-4" />
                            {item.address.split(',')[0]}
                          </h4>
                          <p className="text-sm text-muted-foreground">{item.typeLabel}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Issue Date</Label>
                          <Input
                            type="date"
                            value={formData.issueDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, issueDate: e.target.value }))}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Expiry Date</Label>
                          <Input
                            type="date"
                            value={formData.expiryDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                            className="h-9"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleQuickExpiry(6)}
                          className="text-xs"
                        >
                          +6 months
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleQuickExpiry(12)}
                          className="text-xs"
                        >
                          +12 months
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleQuickExpiry(60)}
                          className="text-xs"
                        >
                          +5 years
                        </Button>
                      </div>

                      <div>
                        <Label className="text-xs">Upload Certificate (optional)</Label>
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                          className="h-9 text-xs"
                        />
                        {uploadFile && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Selected: {uploadFile.name}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingId(null)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSave(item)}
                          disabled={updateCompliance.isPending || uploadDocument.isPending}
                          className="flex-1"
                        >
                          {updateCompliance.isPending ? 'Saving...' : 'Save & Mark Complete'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold flex items-center gap-2 truncate">
                            <Home className="h-4 w-4 shrink-0" />
                            {item.address.split(',')[0]}
                          </h4>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.address.split(',').slice(1).join(',').trim()}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-label="More options" variant="ghost" size="icon" className="h-8 w-8">
                              <EllipsisVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleStartEdit(item)}>
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/properties/${item.propertyId}?tab=compliance`}>
                                View Property
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {item.typeLabel}
                        </Badge>
                        {getStatusBadge(item)}
                      </div>

                      <div className="mt-3 text-sm text-muted-foreground space-y-1">
                        <p className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          Expires: {format(item.date, 'dd MMM yyyy')}
                        </p>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleStartEdit(item)}
                          className="flex-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Mark as Renewed
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <Link to={`/properties/${item.propertyId}?tab=compliance`}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </>
                  )}
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
