import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  ArrowLeft,
  Edit2,
  Trash2,
  ExternalLink,
  Calendar,
  MapPin,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCompany,
  useUpdateCompany,
  useDeleteCompany,
  type CompanyType,
  type CompanyStatus,
} from '@/hooks/useCompanies';
import { useCompaniesHouse } from '@/hooks/useCompaniesHouse';
import { ComplianceFilingsCard, CompanyLinkedProperties, ShareCapitalCard } from '@/components/companies';
import { CompanyOwnershipSection } from '@/components/ownership';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const companyTypeLabels: Record<string, string> = {
  HOLDCO: 'Holding Co',
  SPV: 'SPV',
  OPCO: 'Operating Co',
  OTHER: 'Other',
};

const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: 'SPV', label: 'SPV (Property Holding)' },
  { value: 'HOLDCO', label: 'Holding Company' },
  { value: 'OPCO', label: 'Operating Company' },
  { value: 'OTHER', label: 'Other' },
];

const COMPANY_STATUSES: { value: CompanyStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DORMANT', label: 'Dormant' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'CLOSED', label: 'Closed' },
];

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  DORMANT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  SOLD: 'bg-muted text-muted-foreground',
  CLOSED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: company, isLoading } = useCompany(id);
  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();
  const { lookupCompany, isLookingUp } = useCompaniesHouse();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    legal_name: '',
    trading_name: '',
    company_type: 'SPV' as CompanyType,
    status: 'ACTIVE' as CompanyStatus,
  });
  const hasAutoSynced = useRef(false);

  // Auto-sync from Companies House if company number exists and hasn't synced in 24 hours
  const performAutoSync = useCallback(async () => {
    if (!company?.company_number || isLookingUp || hasAutoSynced.current) return;
    
    const lastSynced = company.ch_last_synced_at ? new Date(company.ch_last_synced_at) : null;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const shouldAutoSync = !lastSynced || lastSynced < twentyFourHoursAgo;
    
    if (shouldAutoSync) {
      hasAutoSynced.current = true;
      try {
        const result = await lookupCompany(company.company_number);
        if (result) {
          await updateCompany.mutateAsync({
            id: company.id,
            ch_registered_address: result.company.registered_address,
            ch_incorporation_date: result.company.date_of_creation,
            ch_last_synced_at: new Date().toISOString(),
            accounts_due_date: result.compliance.accounts_due_date,
            accounts_period_end: result.compliance.accounts_period_end,
            accounts_last_filed_date: result.compliance.accounts_last_filed_date,
            confirmation_statement_due_date: result.compliance.confirmation_statement_due_date,
            confirmation_statement_last_made_up_to: result.compliance.confirmation_statement_last_made_up_to,
            confirmation_statement_last_filed_date: result.compliance.confirmation_statement_last_filed_date,
          });
          toast({ title: 'Auto-synced from Companies House', description: 'Compliance dates updated automatically' });
        }
      } catch (err) {
        console.error('Auto-sync failed:', err);
      }
    }
  }, [company, isLookingUp, lookupCompany, updateCompany, toast]);

  useEffect(() => {
    if (company && !isLoading) {
      performAutoSync();
    }
  }, [company, isLoading, performAutoSync]);

  const handleStartEdit = () => {
    if (!company) return;
    setEditForm({
      legal_name: company.legal_name,
      trading_name: company.trading_name || '',
      company_type: company.company_type,
      status: company.status,
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!company) return;
    try {
      await updateCompany.mutateAsync({
        id: company.id,
        legal_name: editForm.legal_name,
        trading_name: editForm.trading_name || null,
        company_type: editForm.company_type,
        status: editForm.status,
      });
      toast({ title: 'Company updated' });
      setIsEditing(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to update company', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!company) return;
    try {
      await deleteCompany.mutateAsync(company.id);
      toast({ title: 'Company deleted' });
      navigate('/companies');
    } catch {
      toast({ title: 'Error', description: 'Failed to delete company', variant: 'destructive' });
    }
  };

  const handleRefreshFromCH = async () => {
    if (!company?.company_number) return;
    try {
      const result = await lookupCompany(company.company_number);
      if (result) {
        await updateCompany.mutateAsync({
          id: company.id,
          ch_registered_address: result.company.registered_address,
          ch_incorporation_date: result.company.date_of_creation,
          ch_last_synced_at: new Date().toISOString(),
          accounts_due_date: result.compliance.accounts_due_date,
          accounts_period_end: result.compliance.accounts_period_end,
          accounts_last_filed_date: result.compliance.accounts_last_filed_date,
          confirmation_statement_due_date: result.compliance.confirmation_statement_due_date,
          confirmation_statement_last_made_up_to: result.compliance.confirmation_statement_last_made_up_to,
          confirmation_statement_last_filed_date: result.compliance.confirmation_statement_last_filed_date,
        });
        toast({ title: 'Synced from Companies House', description: 'Company details and compliance dates updated' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to sync from Companies House', variant: 'destructive' });
    }
  };

  const handleUpdateComplianceDates = async (updates: {
    accounts_due_date?: string | null;
    accounts_period_end?: string | null;
    accounts_last_filed_date?: string | null;
    confirmation_statement_due_date?: string | null;
    confirmation_statement_last_made_up_to?: string | null;
    confirmation_statement_last_filed_date?: string | null;
  }) => {
    if (!company) return;
    try {
      await updateCompany.mutateAsync({
        id: company.id,
        ...updates,
      });
      toast({ title: 'Compliance dates updated' });
    } catch {
      toast({ title: 'Error', description: 'Failed to update compliance dates', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!company) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Company not found</h2>
          <Button onClick={() => navigate('/companies')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Companies
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/companies')}
              className="mb-2 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Companies
            </Button>
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">{company.legal_name}</h1>
                {company.trading_name && company.trading_name !== company.legal_name && (
                  <p className="text-muted-foreground">Trading as: {company.trading_name}</p>
                )}
              </div>
              <Badge variant="outline" className="ml-2">
                {companyTypeLabels[company.company_type]}
              </Badge>
              <Badge className={cn('text-xs', statusColors[company.status])}>
                {company.status}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleStartEdit}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Company</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {company.legal_name}? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Company Details */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Company Details
                  {company.company_number && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefreshFromCH}
                      disabled={isLookingUp}
                    >
                      <RefreshCw className={cn('h-4 w-4 mr-1', isLookingUp && 'animate-spin')} />
                      Sync CH
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {company.company_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">Company Number</p>
                    <a
                      href={`https://find-and-update.company-information.service.gov.uk/company/${company.company_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      {company.company_number}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {company.ch_incorporation_date && (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Incorporated</p>
                      <p className="font-medium">
                        {new Date(company.ch_incorporation_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

                {company.ch_registered_address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Registered Address</p>
                      <p className="text-sm">{company.ch_registered_address}</p>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">Jurisdiction</p>
                  <p className="font-medium">{company.jurisdiction}</p>
                </div>

                {company.ch_last_synced_at && (
                  <p className="text-xs text-muted-foreground">
                    Last synced: {new Date(company.ch_last_synced_at).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Compliance & Filings Section */}
            <ComplianceFilingsCard
              data={{
                accounts_due_date: company.accounts_due_date,
                accounts_period_end: company.accounts_period_end,
                accounts_last_filed_date: company.accounts_last_filed_date,
                confirmation_statement_due_date: company.confirmation_statement_due_date,
                confirmation_statement_last_made_up_to: company.confirmation_statement_last_made_up_to,
                confirmation_statement_last_filed_date: company.confirmation_statement_last_filed_date,
                ch_last_synced_at: company.ch_last_synced_at,
                company_number: company.company_number,
              }}
              onUpdate={handleUpdateComplianceDates}
              onSyncFromCH={handleRefreshFromCH}
              isSyncing={isLookingUp}
              isUpdating={updateCompany.isPending}
            />

            {/* Linked Properties Section */}
            <CompanyLinkedProperties companyId={company.id} />

            {/* Share Capital Section */}
            <ShareCapitalCard companyId={company.id} />
          </div>

          {/* Right Column - Shareholders (unified ownership_links) */}
          <div className="lg:col-span-2">
            <CompanyOwnershipSection
              companyId={company.id}
              companyName={company.legal_name}
            />
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      {isEditing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit Company</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Legal Name</Label>
                <Input
                  value={editForm.legal_name}
                  onChange={(e) => setEditForm({ ...editForm, legal_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Trading Name</Label>
                <Input
                  value={editForm.trading_name}
                  onChange={(e) => setEditForm({ ...editForm, trading_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Company Type</Label>
                <Select
                  value={editForm.company_type}
                  onValueChange={(v) => setEditForm({ ...editForm, company_type: v as CompanyType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v as CompanyStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSaveEdit} disabled={updateCompany.isPending}>
                  {updateCompany.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
