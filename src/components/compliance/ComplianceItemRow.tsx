import { useState } from 'react';
import { format } from 'date-fns';
import { 
  ChevronDown, 
  ChevronUp, 
  Upload, 
  Trash2, 
  FileText, 
  History,
  Download,
  Eye,
  Edit2,
  X,
  Check,
  Calendar,
  User,
  Clock
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
import { DocumentViewerModal } from './DocumentViewerModal';
import { 
  RESPONSIBLE_PARTIES, 
  type ComplianceItem, 
  type ComplianceDocument,
  getComplianceItemStatus 
} from '@/lib/complianceTypes';
import { 
  useUpdateComplianceItem, 
  useDeleteComplianceItem,
  useUploadComplianceDocument 
} from '@/hooks/useCompliance';
import { useDownloadFile } from '@/hooks/useSignedUrl';
import { useToast } from '@/hooks/use-toast';

interface ComplianceItemRowProps {
  item: ComplianceItem & { documents: ComplianceDocument[] };
  propertyId: string;
  propertyAddress: string;
}

export function ComplianceItemRow({ item, propertyId, propertyAddress }: ComplianceItemRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerDocument, setViewerDocument] = useState<ComplianceDocument | null>(null);
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
  const { download, downloading } = useDownloadFile('compliance');

  const currentDoc = item.documents?.find(d => d.is_current);
  const archivedDocs = (item.documents?.filter(d => !d.is_current) || [])
    .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  
  const status = getComplianceItemStatus(item.expiry_date);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadDocument.mutateAsync({
        complianceItemId: item.id,
        propertyId,
        file,
        complianceType: item.compliance_type,
        propertyAddress,
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

  const handleViewDocument = (doc: ComplianceDocument) => {
    setViewerDocument(doc);
    setViewerOpen(true);
  };

  const handleDownloadDocument = async (doc: ComplianceDocument) => {
    await download(doc.file_url, doc.original_file_name);
  };

  return (
    <>
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
                <span className="font-medium">{item.compliance_type}</span>
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

            <div className="flex items-center gap-2">
              <ComplianceStatusBadge expiryDate={item.expiry_date} showLabel={false} />
              
              {currentDoc ? (
                <div className="flex items-center gap-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleViewDocument(currentDoc)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownloadDocument(currentDoc)}
                    disabled={downloading}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Badge variant="outline" className="status-warning border text-xs">
                  <Upload className="h-3 w-3 mr-1" />
                  Missing
                </Badge>
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

              {/* Document section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Documents</h4>
                  <div className="flex items-center gap-2">
                    {archivedDocs.length > 0 && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => setShowHistory(!showHistory)}
                      >
                        <History className="h-4 w-4 mr-1" />
                        History ({archivedDocs.length})
                      </Button>
                    )}
                    <div>
                      <input
                        type="file"
                        id={`upload-${item.id}`}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={handleFileUpload}
                      />
                      <Button size="sm" variant="outline" asChild disabled={uploadDocument.isPending}>
                        <label htmlFor={`upload-${item.id}`} className="cursor-pointer">
                          <Upload className="h-4 w-4 mr-1" />
                          {currentDoc ? 'Upload New Version' : 'Upload Document'}
                        </label>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Current document card */}
                {currentDoc ? (
                  <div className="p-4 bg-muted/50 rounded-lg border">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{currentDoc.original_file_name}</span>
                            <Badge variant="default" className="text-xs">Current</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Uploaded {format(new Date(currentDoc.uploaded_at), 'dd MMM yyyy HH:mm')}
                            </span>
                            <span>Version {currentDoc.version_number}</span>
                          </div>
                          {currentDoc.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{currentDoc.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleViewDocument(currentDoc)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDownloadDocument(currentDoc)}
                          disabled={downloading}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 border-2 border-dashed rounded-lg text-center">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      No document uploaded yet
                    </p>
                    <Button size="sm" variant="outline" asChild>
                      <label htmlFor={`upload-${item.id}`} className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-1" />
                        Upload Document
                      </label>
                    </Button>
                  </div>
                )}

                {/* Document history */}
                {showHistory && archivedDocs.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h5 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Document History
                    </h5>
                    <div className="border rounded-lg divide-y">
                      {archivedDocs.map((doc, index) => (
                        <div 
                          key={doc.id} 
                          className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="text-sm">{doc.original_file_name}</span>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>Version {doc.version_number}</span>
                                <span>
                                  Uploaded {format(new Date(doc.uploaded_at), 'dd MMM yyyy')}
                                </span>
                                {doc.archived_at && (
                                  <Badge variant="secondary" className="text-xs">
                                    Superseded
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleViewDocument(doc)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleDownloadDocument(doc)}
                              disabled={downloading}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Document viewer modal */}
      <DocumentViewerModal
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        document={viewerDocument}
        title={`${item.compliance_type} - ${viewerDocument?.original_file_name}`}
      />
    </>
  );
}
