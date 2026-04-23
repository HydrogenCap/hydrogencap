import React, { useState } from 'react';
import { FileText, Calendar, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ComplianceStatusBadge } from './ComplianceStatusBadge';
import { 
  getComplianceStatus,
  formatComplianceDate 
} from '@/lib/complianceStatus';
import { cn } from '@/lib/utils';

interface CompanyComplianceData {
  accounts_due_date: string | null;
  accounts_period_end: string | null;
  accounts_last_filed_date: string | null;
  confirmation_statement_due_date: string | null;
  confirmation_statement_last_made_up_to: string | null;
  confirmation_statement_last_filed_date: string | null;
  ch_last_synced_at: string | null;
  company_number: string | null;
}

interface ComplianceFilingsCardProps {
  data: CompanyComplianceData;
  onUpdate: (updates: Partial<CompanyComplianceData>) => Promise<void>;
  onSyncFromCH?: () => Promise<void>;
  isSyncing?: boolean;
  isUpdating?: boolean;
}

export function ComplianceFilingsCard({
  data,
  onUpdate,
  onSyncFromCH,
  isSyncing = false,
  isUpdating = false,
}: ComplianceFilingsCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    accounts_due_date: data.accounts_due_date || '',
    accounts_period_end: data.accounts_period_end || '',
    accounts_last_filed_date: data.accounts_last_filed_date || '',
    confirmation_statement_due_date: data.confirmation_statement_due_date || '',
    confirmation_statement_last_made_up_to: data.confirmation_statement_last_made_up_to || '',
    confirmation_statement_last_filed_date: data.confirmation_statement_last_filed_date || '',
  });

  const accountsStatus = getComplianceStatus(data.accounts_due_date);
  const csStatus = getComplianceStatus(data.confirmation_statement_due_date);

  const handleSave = async () => {
    await onUpdate({
      accounts_due_date: editData.accounts_due_date || null,
      accounts_period_end: editData.accounts_period_end || null,
      accounts_last_filed_date: editData.accounts_last_filed_date || null,
      confirmation_statement_due_date: editData.confirmation_statement_due_date || null,
      confirmation_statement_last_made_up_to: editData.confirmation_statement_last_made_up_to || null,
      confirmation_statement_last_filed_date: editData.confirmation_statement_last_filed_date || null,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData({
      accounts_due_date: data.accounts_due_date || '',
      accounts_period_end: data.accounts_period_end || '',
      accounts_last_filed_date: data.accounts_last_filed_date || '',
      confirmation_statement_due_date: data.confirmation_statement_due_date || '',
      confirmation_statement_last_made_up_to: data.confirmation_statement_last_made_up_to || '',
      confirmation_statement_last_filed_date: data.confirmation_statement_last_filed_date || '',
    });
    setIsEditing(false);
  };

  // Overall status indicator
  const hasIssues = accountsStatus.status === 'overdue' || 
                    accountsStatus.status === 'due_soon' ||
                    csStatus.status === 'overdue' ||
                    csStatus.status === 'due_soon';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Compliance & Filings
            {hasIssues ? (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {onSyncFromCH && data.company_number && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSyncFromCH}
                disabled={isSyncing}
              >
                <RefreshCw className={cn('h-4 w-4 mr-1', isSyncing && 'animate-spin')} />
                Sync from CH
              </Button>
            )}
            {!isEditing ? (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={handleSave} disabled={isUpdating}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancel}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
        {data.ch_last_synced_at && (
          <p className="text-xs text-muted-foreground mt-1">
            Last synced: {new Date(data.ch_last_synced_at).toLocaleString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Annual Accounts Section */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Annual Accounts
          </h4>
          
          {isEditing ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="accounts_due_date" className="text-xs">Due Date</Label>
                <Input
                  id="accounts_due_date"
                  type="date"
                  value={editData.accounts_due_date}
                  onChange={(e) => setEditData({ ...editData, accounts_due_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accounts_period_end" className="text-xs">Period End</Label>
                <Input
                  id="accounts_period_end"
                  type="date"
                  value={editData.accounts_period_end}
                  onChange={(e) => setEditData({ ...editData, accounts_period_end: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accounts_last_filed_date" className="text-xs">Last Filed</Label>
                <Input
                  id="accounts_last_filed_date"
                  type="date"
                  value={editData.accounts_last_filed_date}
                  onChange={(e) => setEditData({ ...editData, accounts_last_filed_date: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                <ComplianceStatusBadge dueDate={data.accounts_due_date} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Period End</p>
                <p className="text-sm">{formatComplianceDate(data.accounts_period_end)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Last Filed</p>
                <p className="text-sm">{formatComplianceDate(data.accounts_last_filed_date)}</p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Confirmation Statement Section */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Confirmation Statement
          </h4>
          
          {isEditing ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cs_due_date" className="text-xs">Due Date</Label>
                <Input
                  id="cs_due_date"
                  type="date"
                  value={editData.confirmation_statement_due_date}
                  onChange={(e) => setEditData({ ...editData, confirmation_statement_due_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cs_last_made_up_to" className="text-xs">Last Made Up To</Label>
                <Input
                  id="cs_last_made_up_to"
                  type="date"
                  value={editData.confirmation_statement_last_made_up_to}
                  onChange={(e) => setEditData({ ...editData, confirmation_statement_last_made_up_to: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cs_last_filed_date" className="text-xs">Last Filed</Label>
                <Input
                  id="cs_last_filed_date"
                  type="date"
                  value={editData.confirmation_statement_last_filed_date}
                  onChange={(e) => setEditData({ ...editData, confirmation_statement_last_filed_date: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                <ComplianceStatusBadge dueDate={data.confirmation_statement_due_date} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Last Made Up To</p>
                <p className="text-sm">{formatComplianceDate(data.confirmation_statement_last_made_up_to)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Last Filed</p>
                <p className="text-sm">{formatComplianceDate(data.confirmation_statement_last_filed_date)}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
