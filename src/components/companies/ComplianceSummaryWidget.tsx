import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getComplianceStatus, type ComplianceStatus } from '@/lib/complianceStatus';
import { cn } from '@/lib/utils';

interface Company {
  id: string;
  accounts_due_date: string | null;
  confirmation_statement_due_date: string | null;
}

interface ComplianceSummaryWidgetProps {
  companies: Company[] | undefined;
  isLoading?: boolean;
  onFilterClick?: (filter: 'accounts_overdue' | 'accounts_due_soon' | 'cs_overdue' | 'cs_due_soon') => void;
}

export function ComplianceSummaryWidget({ 
  companies, 
  isLoading,
  onFilterClick 
}: ComplianceSummaryWidgetProps) {
  const navigate = useNavigate();

  // Calculate compliance stats
  const stats = React.useMemo(() => {
    if (!companies?.length) {
      return {
        accountsOverdue: 0,
        accountsDueSoon: 0,
        csOverdue: 0,
        csDueSoon: 0,
        allOk: 0,
      };
    }

    let accountsOverdue = 0;
    let accountsDueSoon = 0;
    let csOverdue = 0;
    let csDueSoon = 0;
    let allOk = 0;

    companies.forEach((company) => {
      const accountsStatus = getComplianceStatus(company.accounts_due_date);
      const csStatus = getComplianceStatus(company.confirmation_statement_due_date);

      if (accountsStatus.status === 'overdue') accountsOverdue++;
      if (accountsStatus.status === 'due_soon') accountsDueSoon++;
      if (csStatus.status === 'overdue') csOverdue++;
      if (csStatus.status === 'due_soon') csDueSoon++;
      
      if (
        (accountsStatus.status === 'ok' || accountsStatus.status === 'unknown') &&
        (csStatus.status === 'ok' || csStatus.status === 'unknown')
      ) {
        allOk++;
      }
    });

    return { accountsOverdue, accountsDueSoon, csOverdue, csDueSoon, allOk };
  }, [companies]);

  const totalIssues = stats.accountsOverdue + stats.accountsDueSoon + stats.csOverdue + stats.csDueSoon;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleClick = (filter: 'accounts_overdue' | 'accounts_due_soon' | 'cs_overdue' | 'cs_due_soon') => {
    if (onFilterClick) {
      onFilterClick(filter);
    } else {
      navigate(`/companies?compliance=${filter}`);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Company Compliance
          {totalIssues > 0 ? (
            <span className="ml-auto flex items-center gap-1 text-sm font-normal text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {totalIssues} issue{totalIssues !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1 text-sm font-normal text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              All OK
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Accounts Section */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Annual Accounts</p>
            <div className="grid grid-cols-2 gap-2">
              <MetricButton
                label="Overdue"
                value={stats.accountsOverdue}
                variant="danger"
                onClick={() => handleClick('accounts_overdue')}
                disabled={stats.accountsOverdue === 0}
              />
              <MetricButton
                label="Due in 30 days"
                value={stats.accountsDueSoon}
                variant="warning"
                onClick={() => handleClick('accounts_due_soon')}
                disabled={stats.accountsDueSoon === 0}
              />
            </div>
          </div>

          {/* Confirmation Statement Section */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Confirmation Statements</p>
            <div className="grid grid-cols-2 gap-2">
              <MetricButton
                label="Overdue"
                value={stats.csOverdue}
                variant="danger"
                onClick={() => handleClick('cs_overdue')}
                disabled={stats.csOverdue === 0}
              />
              <MetricButton
                label="Due in 30 days"
                value={stats.csDueSoon}
                variant="warning"
                onClick={() => handleClick('cs_due_soon')}
                disabled={stats.csDueSoon === 0}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricButtonProps {
  label: string;
  value: number;
  variant: 'danger' | 'warning' | 'success';
  onClick: () => void;
  disabled?: boolean;
}

function MetricButton({ label, value, variant, onClick, disabled }: MetricButtonProps) {
  const variantClasses = {
    danger: 'hover:bg-red-50 dark:hover:bg-red-900/10',
    warning: 'hover:bg-amber-50 dark:hover:bg-amber-900/10',
    success: 'hover:bg-green-50 dark:hover:bg-green-900/10',
  };

  const valueClasses = {
    danger: value > 0 ? 'text-red-600' : 'text-muted-foreground',
    warning: value > 0 ? 'text-amber-600' : 'text-muted-foreground',
    success: 'text-green-600',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center p-3 rounded-lg border transition-colors',
        disabled ? 'cursor-default opacity-60' : variantClasses[variant]
      )}
    >
      <span className={cn('text-2xl font-bold', valueClasses[variant])}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}
