import { useState } from 'react';
import { format } from 'date-fns';
import { 
  ChevronDown, 
  ChevronUp, 
  Upload, 
  Trash2, 
  FileText, 
  Archive,
  ExternalLink,
  Edit2,
  X,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ComplianceStatusBadge } from './ComplianceStatusBadge';
import { 
  RESPONSIBLE_PARTIES, 
  type ComplianceItem, 
  type ComplianceDocument 
} from '@/lib/complianceTypes';
import { 
  useUpdateComplianceItem, 
  useDeleteComplianceItem,
  useUploadComplianceDocument 
} from '@/hooks/useCompliance';
import { useToast } from '@/hooks/use-toast';

interface ComplianceItemRowProps {
  item: ComplianceItem & { documents: ComplianceDocument[] };
  propertyId: string;
}

export function ComplianceItemRow({ item, propertyId }: ComplianceItemRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    issue_date: item.issue_date || '',
    expiry_date: item.expiry_date || '',
    responsible_party: item.responsible_party,
    notes: item.notes || '',
  });
  
  const { toast } = useToast();
  const updateItem = useUpdateComplianceItem();
  const deleteItem = useDeleteComplianceItem();
  const uploadDocument = useUploadComplianceDocument();

  const currentDoc = item.documents?.find(d => d.is_current);
  const archivedDocs = item.documents?.filter(d => !d.is_current) || [];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadDocument.mutateAsync({
        complianceItemId: item.id,
        propertyId,
        file,
      });
      toast({ title: 'Document uploaded successfully' });
    } catch (error) {
      toast({ 
        title: 'Upload failed', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive' 
      });
    }
    
    // Reset input
    e.target.value = '';
  };

  const handleSaveEdit = async () => {
    try {
      await updateItem.mutateAsync({
        id: item.id,
        ...editData,
        issue_date: editData.issue_date || null,
        expiry_date: editData.expiry_date || null,
      });
      setIsEditing(false);
      toast({ title: 'Compliance item updated' });
    } catch (error) {
      toast({ 
        title: 'Update failed', 
        variant: 'destructive' 
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteItem.mutateAsync({ id: item.id, propertyId });
      toast({ title: 'Compliance item deleted' });
    } catch (error) {
      toast({ 
        title: 'Delete failed', 
        variant: 'destructive' 
      });
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg bg-card">
        {/* Main row */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4 flex-1">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.compliance_type}</span>
                {item.is_coho_required && (
                  <Badge variant="outline" className="text-xs">COHO Required</Badge>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                {item.issue_date && (
                  <span>Issued: {format(new Date(item.issue_date), 'dd MMM yyyy')}</span>
                )}
                {item.expiry_date && (
                  <span>Expires: {format(new Date(item.expiry_date), 'dd MMM yyyy')}</span>
                )}
                <span>• {item.responsible_party}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ComplianceStatusBadge expiryDate={item.expiry_date} showLabel={false} />
            
            {currentDoc ? (
              <Button variant="outline" size="sm" asChild>
                <a href={currentDoc.file_url} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 mr-1" />
                  View
                </a>
              </Button>
            ) : (
              <Badge variant="secondary">No document</Badge>
            )}
          </div>
        </div>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="border-t p-4 space-y-4">
            {/* Edit mode or display mode */}
            {isEditing ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Issue Date</label>
                  <Input
                    type="date"
                    value={editData.issue_date}
                    onChange={(e) => setEditData({ ...editData, issue_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Expiry Date</label>
                  <Input
                    type="date"
                    value={editData.expiry_date}
                    onChange={(e) => setEditData({ ...editData, expiry_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Responsible Party</label>
                  <Select 
                    value={editData.responsible_party} 
                    onValueChange={(v) => setEditData({ ...editData, responsible_party: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESPONSIBLE_PARTIES.map(party => (
                        <SelectItem key={party} value={party}>{party}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    value={editData.notes}
                    onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit} disabled={updateItem.isPending}>
                    <Check className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  {item.notes && (
                    <p className="text-sm text-muted-foreground">{item.notes}</p>
                  )}
                  <ComplianceStatusBadge expiryDate={item.expiry_date} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Compliance Item</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will delete the compliance item and all associated documents. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}

            {/* Document upload */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Documents</h4>
                <div>
                  <input
                    type="file"
                    id={`upload-${item.id}`}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                  />
                  <Button size="sm" variant="outline" asChild>
                    <label htmlFor={`upload-${item.id}`} className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-1" />
                      Upload New
                    </label>
                  </Button>
                </div>
              </div>

              {/* Current document */}
              {currentDoc && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <div>
                      <span className="font-medium">{currentDoc.original_file_name}</span>
                      <div className="text-xs text-muted-foreground">
                        v{currentDoc.version_number} • Uploaded {format(new Date(currentDoc.uploaded_at), 'dd MMM yyyy')}
                      </div>
                    </div>
                    <Badge variant="default" className="ml-2">Current</Badge>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <a href={currentDoc.file_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              )}

              {/* Archived documents */}
              {archivedDocs.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Archive className="h-4 w-4" />
                    <span>Archived ({archivedDocs.length})</span>
                  </div>
                  <div className="space-y-1">
                    {archivedDocs.map(doc => (
                      <div 
                        key={doc.id} 
                        className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{doc.original_file_name}</span>
                          <span className="text-xs text-muted-foreground">
                            v{doc.version_number}
                          </span>
                        </div>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
