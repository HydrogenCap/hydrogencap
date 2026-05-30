import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Edit,
  Ban,
} from 'lucide-react';
import { QualityIssue } from './types';
import { getRowProgressColor, getRowStatusColor } from './statusColors';

// Issue row component with expandable property list
export function DataQualityIssueRow({ 
  issue, 
  isExpanded, 
  onToggle 
}: { 
  issue: QualityIssue; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const navigate = useNavigate();
  // Use requiredCount for percentage (excludes exempt fields)
  const percentage = issue.requiredCount > 0 
    ? Math.round((issue.completeCount / issue.requiredCount) * 100) 
    : 100;
  const hasIssues = issue.affectedProperties.length > 0;
  const hasExemptions = issue.exemptedCount > 0;
  const isExpandable = hasIssues || hasExemptions;
  
  const getStatusColor = getRowStatusColor;

  const getProgressColor = getRowProgressColor;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border border-border rounded-lg mb-2 overflow-hidden">
        {/* Header - Clickable */}
        <CollapsibleTrigger asChild>
          <button
            className="w-full p-3 bg-muted/50 hover:bg-muted transition-colors flex items-center justify-between text-left"
            disabled={!isExpandable}
          >
            <div className="flex items-center gap-3 flex-1">
              {issue.priority === 'high' && hasIssues ? (
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              ) : percentage === 100 ? (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              ) : (
                <Database className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-foreground">
                    {issue.label}
                  </span>
                  {issue.priority === 'high' && hasIssues && (
                    <Badge 
                      variant="outline" 
                      className="text-[10px] px-1.5 py-0 h-4 border-warning/50 text-warning bg-warning/10"
                    >
                      Priority
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasIssues && (
                    <span className="text-xs text-muted-foreground">
                      {issue.affectedProperties.length} {issue.affectedProperties.length === 1 ? 'property needs' : 'properties need'} attention
                    </span>
                  )}
                  {hasExemptions && (
                    <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                      <Ban className="h-3 w-3" />
                      {issue.exemptedProperties.length} exempt
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${getStatusColor(percentage)}`}>
                  {issue.completeCount}/{issue.requiredCount}
                </span>
                {isExpandable ? (
                  isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )
                ) : (
                  <div className="w-4" />
                )}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Progress Bar */}
        <div className="px-3 pb-2">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${getProgressColor(percentage)}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Expanded Property List */}
        <CollapsibleContent>
          <div className="border-t border-border bg-background">
            {/* Missing Properties */}
            {issue.affectedProperties.length > 0 && (
              <div className="p-3 space-y-2">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Properties Missing This Data:
                </div>
                {issue.affectedProperties.slice(0, 10).map((property) => (
                  <div
                    key={property.id}
                    className="p-3 border border-border rounded-md bg-card hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer flex items-center justify-between group"
                    onClick={() => navigate(`/properties/${property.id}/edit`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {property.address}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {property.area && <span>{property.area}</span>}
                        {property.area && property.ownership && <span> • </span>}
                        {property.ownership && <span>{property.ownership}</span>}
                      </div>
                      {property.missingFields.length > 0 && (
                        <div className="text-[10px] text-muted-foreground/70 mt-1">
                          Missing: {property.missingFields.join(', ')}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-3 gap-1.5 shrink-0 opacity-70 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/properties/${property.id}/edit`);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                      Fix
                    </Button>
                  </div>
                ))}
                {issue.affectedProperties.length > 10 && (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    +{issue.affectedProperties.length - 10} more properties
                  </p>
                )}
              </div>
            )}
            
            {/* Exempt Properties */}
            {issue.exemptedProperties.length > 0 && (
              <div className={`p-3 space-y-2 ${issue.affectedProperties.length > 0 ? 'border-t border-border' : ''}`}>
                <div className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Ban className="h-3 w-3" />
                  Marked as Not Required:
                </div>
                {issue.exemptedProperties.slice(0, 5).map((property) => (
                  <div
                    key={property.id}
                    className="p-3 border border-border/50 rounded-md bg-muted/30 flex items-center gap-3 opacity-70"
                  >
                    <Ban className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground/80 truncate">
                        {property.address}
                      </div>
                      <div className="text-xs text-muted-foreground italic">
                        {property.exemptionReason}
                      </div>
                    </div>
                  </div>
                ))}
                {issue.exemptedProperties.length > 5 && (
                  <p className="text-center text-xs text-muted-foreground/60 py-2">
                    +{issue.exemptedProperties.length - 5} more exempt
                  </p>
                )}
              </div>
            )}
            
            {/* All Complete State */}
            {issue.affectedProperties.length === 0 && issue.exemptedProperties.length === 0 && (
              <div className="p-6 text-center">
                <CheckCircle2 className="h-8 w-8 mx-auto text-success mb-2" />
                <p className="text-sm text-success font-medium">All properties have this data complete! 🎉</p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
