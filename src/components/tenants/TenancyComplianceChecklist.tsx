import { useState, useMemo, useRef } from 'react';
import { format, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, CheckCircle2, Building2, Shield, Upload, FileText, X, Loader2 } from 'lucide-react';
import {
  useTenancyCompliance,
  useCompleteTenancyComplianceItem,
  useUncompleteTenancyComplianceItem,
  type TenancyComplianceItem,
} from '@/hooks/useTenancyCompliance';
import { supabase } from '@/integrations/supabase/client';
import { useCreateDocument } from '@/hooks/useDocuments';
import { fetchUserOrgId as getUserOrgId } from '@/hooks/useUserOrg';
import { useToast } from '@/hooks/use-toast';

interface Props {
  tenancyId: string;
  tenantType: 'individual' | 'company';
  tenantId?: string;
  propertyId?: string;
}

const CATEGORY_ORDER = [
  'Pre-Tenancy Checks',
  'Documents Served',
  'Deposit',
  'Property Setup',
];

const ITEM_CATEGORIES: Record<string, string> = {
  right_to_rent: 'Pre-Tenancy Checks',
  company_verification: 'Pre-Tenancy Checks',
  authorised_signatory: 'Pre-Tenancy Checks',
  right_to_rent_note: 'Pre-Tenancy Checks',
  how_to_rent: 'Documents Served',
  epc_to_tenant: 'Documents Served',
  gas_cert_to_tenant: 'Documents Served',
  tenancy_agreement_signed: 'Documents Served',
  deposit_protection: 'Deposit',
  deposit_prescribed_info: 'Deposit',
  deposit_protection_company: 'Deposit',
  inventory_completed: 'Property Setup',
  standing_order_setup: 'Property Setup',
  smoke_co_alarms: 'Property Setup',
};

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unknown error';

export function TenancyComplianceChecklist({ tenancyId, tenantType, tenantId, propertyId }: Props) {
  const { data: items, isLoading } = useTenancyCompliance(tenancyId);
  const completeMutation = useCompleteTenancyComplianceItem();
  const uncompleteMutation = useUncompleteTenancyComplianceItem();
  const createDocument = useCreateDocument();
  const { toast } = useToast();

  const [dialogItem, setDialogItem] = useState<TenancyComplianceItem | null>(null);
  const [dialogMode, setDialogMode] = useState<'complete' | 'uncomplete'>('complete');
  const [notes, setNotes] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCompany = tenantType === 'company';

  const applicableItems = useMemo(() => {
    return items?.filter(i => i.is_applicable && i.is_required) || [];
  }, [items]);

  const completedCount = applicableItems.filter(i => i.completed_date).length;
  const totalCount = applicableItems.length;
  const allComplete = totalCount > 0 && completedCount === totalCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const overdueItems = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return applicableItems.filter(i => !i.completed_date && i.due_date && i.due_date < today);
  }, [applicableItems]);

  const grouped = useMemo(() => {
    if (!items) return {};
    const groups: Record<string, TenancyComplianceItem[]> = {};
    items.forEach(item => {
      const cat = ITEM_CATEGORIES[item.item_type] || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [items]);

  const handleCheckboxClick = (item: TenancyComplianceItem) => {
    if (!item.is_applicable) return;
    setDialogItem(item);
    setDialogMode(item.completed_date ? 'uncomplete' : 'complete');
    setNotes('');
    setUploadFile(null);
  };

  const handleConfirm = async () => {
    if (!dialogItem) return;
    if (dialogMode === 'complete') {
      setIsUploading(true);
      try {
        let documentUrl: string | undefined;

        // Upload file if provided
        if (uploadFile) {
          const orgId = await getUserOrgId();
          if (!orgId) throw new Error('No organization found');

          const fileExt = uploadFile.name.split('.').pop();
          const fileName = `${crypto.randomUUID()}.${fileExt}`;
          const filePath = `${orgId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, uploadFile);
          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('documents')
            .getPublicUrl(filePath);
          documentUrl = urlData.publicUrl;

          // Create document record linked to tenancy
          await createDocument.mutateAsync({
            file_url: documentUrl,
            original_file_name: uploadFile.name,
            display_name: `${dialogItem.label}`,
            doc_type: dialogItem.item_type === 'inventory_completed' ? 'inventory' : dialogItem.item_type,
            category: 'tenancy',
            tenant_id: tenantId || null,
            tenancy_id: tenancyId,
            property_id: propertyId || null,
            review_status: 'accepted',
          });
        }

        completeMutation.mutate({
          itemId: dialogItem.id,
          notes: notes || undefined,
          documentUrl,
        });
      } catch (error: unknown) {
        toast({ title: 'Upload failed', description: getErrorMessage(error), variant: 'destructive' });
      } finally {
        setIsUploading(false);
      }
    } else {
      uncompleteMutation.mutate(dialogItem.id);
    }
    setDialogItem(null);
  };

  if (isLoading || !items) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Tenancy Compliance — {completedCount}/{totalCount} items completed
            {isCompany && (
              <Badge variant="outline" className="text-xs ml-2">
                <Building2 className="h-3 w-3 mr-1" />
                Company let
              </Badge>
            )}
          </CardTitle>
        </div>
        <Progress value={progressPercent} className="h-2 mt-2" />
        {allComplete && (
          <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            {isCompany
              ? '✓ Fully compliant — all required items completed'
              : '✓ Fully compliant — valid for Section 21'}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overdue warning */}
        {overdueItems.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              {isCompany
                ? `⚠️ ${overdueItems.length} compliance item${overdueItems.length > 1 ? 's are' : ' is'} overdue — review and complete to ensure tenancy is properly documented`
                : `⚠️ ${overdueItems.length} compliance item${overdueItems.length > 1 ? 's are' : ' is'} overdue — you cannot serve a valid Section 21 notice until all items are completed`}
            </span>
          </div>
        )}

        {/* Grouped checklist */}
        {CATEGORY_ORDER.map(category => {
          const categoryItems = grouped[category];
          if (!categoryItems || categoryItems.length === 0) return null;

          return (
            <div key={category}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {category}
              </h4>
              <div className="space-y-1">
                {categoryItems.map(item => (
                  <ComplianceRow
                    key={item.id}
                    item={item}
                    onCheckboxClick={handleCheckboxClick}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Legal note */}
        <p className="text-xs text-muted-foreground pt-2 border-t">
          {isCompany
            ? "Company lets may not require all items listed for ASTs. Items marked as not applicable have been excluded. Seek legal advice if unsure."
            : "These items are required under the Deregulation Act 2015, Housing Act 2004, and Immigration Act 2014 for a valid Section 21 notice."}
        </p>
      </CardContent>

      {/* Confirm Dialog */}
      <AlertDialog open={!!dialogItem} onOpenChange={(open) => !open && setDialogItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogMode === 'complete'
                ? `Mark "${dialogItem?.label}" as completed?`
                : `Mark "${dialogItem?.label}" as incomplete?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogMode === 'complete'
                ? 'This will record today as the completion date.'
                : 'This will remove the completion date.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {dialogMode === 'complete' && (
            <div className="space-y-3 mt-2">
              <Textarea
                placeholder="Optional notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
              <div className="space-y-2">
                <Label className="text-sm">Attach document (optional)</Label>
                {uploadFile ? (
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate flex-1">{uploadFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setUploadFile(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp,.doc,.docx"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) setUploadFile(e.target.files[0]);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUploading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isUploading}>
              {isUploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>
              ) : (
                'Confirm'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ComplianceRow({
  item,
  onCheckboxClick,
}: {
  item: TenancyComplianceItem;
  onCheckboxClick: (item: TenancyComplianceItem) => void;
}) {
  const today = new Date();
  const dueDate = item.due_date ? new Date(item.due_date) : null;
  const isCompleted = !!item.completed_date;
  const isNotApplicable = !item.is_applicable;
  const isOptional = !item.is_required;

  let statusBadge: React.ReactNode = null;

  if (isNotApplicable) {
    statusBadge = <Badge variant="outline" className="text-xs opacity-60">Not applicable</Badge>;
  } else if (isCompleted) {
    statusBadge = (
      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800">
        Completed {item.completed_date ? format(new Date(item.completed_date), 'dd MMM') : ''}
      </Badge>
    );
  } else if (dueDate) {
    const daysUntilDue = differenceInDays(dueDate, today);
    if (daysUntilDue < 0) {
      statusBadge = (
        <Badge variant="destructive" className="text-xs">
          Overdue by {Math.abs(daysUntilDue)} days
        </Badge>
      );
    } else if (daysUntilDue <= 7) {
      statusBadge = (
        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800">
          Due {format(dueDate, 'dd MMM')}
        </Badge>
      );
    } else {
      statusBadge = (
        <Badge variant="outline" className="text-xs">
          Due {format(dueDate, 'dd MMM')}
        </Badge>
      );
    }
  }

  return (
    <div
      className={`flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors ${
        isNotApplicable ? 'opacity-50' : ''
      }`}
    >
      <Checkbox
        checked={isCompleted}
        disabled={isNotApplicable}
        onCheckedChange={() => onCheckboxClick(item)}
        className="shrink-0"
      />
      <span className={`flex-1 text-sm ${isNotApplicable ? 'line-through text-muted-foreground' : ''} ${isCompleted ? 'text-muted-foreground' : ''}`}>
        {item.label}
        {isOptional && !isNotApplicable && (
          <Badge variant="secondary" className="text-xs ml-2">Optional</Badge>
        )}
      </span>
      {statusBadge}
    </div>
  );
}
