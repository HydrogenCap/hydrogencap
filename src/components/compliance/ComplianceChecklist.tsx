import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Check, 
  X, 
  AlertTriangle, 
  Upload, 
  ChevronDown, 
  ChevronUp,
  Info,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AddComplianceItemDialog } from './AddComplianceItemDialog';
import { usePropertyComplianceRequirements } from '@/hooks/useComplianceRequirements';
import {
  type ComplianceRequirement,
  type RequirementStatus,
  getRequirementStatusColor,
  getRequirementStatusLabel,
  groupRequirementsByCategory,
} from '@/lib/complianceRequirements';

interface ComplianceChecklistProps {
  propertyId: string;
  propertyAddress: string;
  compact?: boolean;
}

// Status icon component
function StatusIcon({ status }: { status: RequirementStatus }) {
  switch (status) {
    case 'valid':
      return <Check className="h-4 w-4 text-green-600" />;
    case 'expired':
    case 'missing':
      return <X className="h-4 w-4 text-red-600" />;
    case 'expiring_soon':
      return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    case 'not_required':
      return <div className="h-4 w-4 rounded-full bg-muted" />;
    default:
      return null;
  }
}

// Single requirement row
function RequirementRow({ 
  requirement, 
  propertyId, 
  propertyAddress,
  onUploadClick 
}: { 
  requirement: ComplianceRequirement;
  propertyId: string;
  propertyAddress: string;
  onUploadClick?: (type: string) => void;
}) {
  const statusLabel = getRequirementStatusLabel(requirement.status, requirement.daysUntilExpiry);
  const statusColor = getRequirementStatusColor(requirement.status);
  
  const rowStyles = {
    missing: 'bg-destructive/10 border border-destructive/20',
    expired: 'bg-destructive/10 border border-destructive/20',
    expiring_soon: 'bg-amber-500/10 border border-amber-500/20',
    valid: 'bg-muted/30 border border-transparent',
    not_required: 'bg-muted/20 border border-transparent opacity-60',
  };

  return (
    <div className={`flex items-center justify-between py-3 px-4 rounded-lg ${rowStyles[requirement.status]}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <StatusIcon status={requirement.status} />
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`font-medium text-sm ${
            requirement.status === 'not_required' ? 'text-muted-foreground' : 'text-foreground'
          }`}>
            {requirement.type}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help flex-shrink-0" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">{requirement.reason}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      <div className="flex items-center gap-3 flex-shrink-0">
        <Badge className={`${statusColor} text-xs font-medium`}>
          {statusLabel}
        </Badge>
        
        {requirement.existingItem && requirement.hasDocument && (
          <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
            <Link to={`/properties/${propertyId}?tab=compliance`}>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        )}
        
        {(requirement.status === 'missing' || !requirement.hasDocument) && requirement.required && (
          <AddComplianceItemDialog 
            propertyId={propertyId} 
            defaultType={requirement.type}
            trigger={
              <Button size="sm" className="h-8 px-3">
                <Upload className="h-4 w-4 mr-1.5" />
                Add
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}

// Category section
function CategorySection({ 
  category, 
  requirements,
  propertyId,
  propertyAddress,
  defaultExpanded = true,
}: { 
  category: string;
  requirements: ComplianceRequirement[];
  propertyId: string;
  propertyAddress: string;
  defaultExpanded?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  
  const issueCount = requirements.filter(r => 
    r.status === 'missing' || r.status === 'expired' || r.status === 'expiring_soon'
  ).length;
  
  const requiredCount = requirements.filter(r => r.required).length;
  const validCount = requirements.filter(r => r.status === 'valid').length;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-2 h-auto">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{category}</span>
            {issueCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {issueCount} issue{issueCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {validCount}/{requiredCount} complete
            </span>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 mt-1">
          {requirements.map(req => (
            <RequirementRow 
              key={req.type} 
              requirement={req}
              propertyId={propertyId}
              propertyAddress={propertyAddress}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ComplianceChecklist({ propertyId, propertyAddress, compact = false }: ComplianceChecklistProps) {
  const { data: summary, isLoading } = usePropertyComplianceRequirements(propertyId);
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compliance Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compliance Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Unable to load compliance requirements</p>
        </CardContent>
      </Card>
    );
  }
  
  const groupedRequirements = groupRequirementsByCategory(summary.requirements);
  const totalIssues = summary.missingCount + summary.expiredCount + summary.expiringSoonCount;
  
  if (compact) {
    // Compact version for dashboard/property header
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Compliance Status</CardTitle>
            {totalIssues > 0 && (
              <Badge variant="destructive">
                {totalIssues} issue{totalIssues !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Compliance Score</span>
              <span className="font-semibold">{summary.complianceScore}%</span>
            </div>
            <Progress value={summary.complianceScore} className="h-2" />
            
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-green-100 dark:bg-green-900/20">
                <div className="font-bold text-green-700 dark:text-green-400">{summary.validCount}</div>
                <div className="text-green-600 dark:text-green-500">Valid</div>
              </div>
              <div className="p-2 rounded bg-amber-100 dark:bg-amber-900/20">
                <div className="font-bold text-amber-700 dark:text-amber-400">{summary.expiringSoonCount}</div>
                <div className="text-amber-600 dark:text-amber-500">Expiring</div>
              </div>
              <div className="p-2 rounded bg-red-100 dark:bg-red-900/20">
                <div className="font-bold text-red-700 dark:text-red-400">{summary.expiredCount}</div>
                <div className="text-red-600 dark:text-red-500">Expired</div>
              </div>
              <div className="p-2 rounded bg-red-100 dark:bg-red-900/20">
                <div className="font-bold text-red-700 dark:text-red-400">{summary.missingCount}</div>
                <div className="text-red-600 dark:text-red-500">Missing</div>
              </div>
            </div>
            
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to={`/properties/${propertyId}?tab=compliance`}>
                View Full Checklist
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Full version
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Compliance Checklist
            {totalIssues > 0 && (
              <Badge variant="destructive">
                {totalIssues} issue{totalIssues !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Score: <span className="font-semibold text-foreground">{summary.complianceScore}%</span>
            </div>
            <Progress value={summary.complianceScore} className="w-24 h-2" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/20 text-center">
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {summary.validCount}
            </div>
            <div className="text-xs text-green-600 dark:text-green-500">Valid</div>
          </div>
          <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/20 text-center">
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {summary.expiringSoonCount}
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-500">Expiring Soon</div>
          </div>
          <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/20 text-center">
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
              {summary.expiredCount}
            </div>
            <div className="text-xs text-red-600 dark:text-red-500">Expired</div>
          </div>
          <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/20 text-center">
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
              {summary.missingCount}
            </div>
            <div className="text-xs text-red-600 dark:text-red-500">Missing</div>
          </div>
        </div>
        
        {/* Requirements by category */}
        <div className="space-y-4">
          {Object.entries(groupedRequirements).map(([category, requirements]) => (
            <CategorySection
              key={category}
              category={category}
              requirements={requirements}
              propertyId={propertyId}
              propertyAddress={propertyAddress}
              defaultExpanded={
                requirements.some(r => 
                  r.status === 'missing' || r.status === 'expired' || r.status === 'expiring_soon'
                )
              }
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
