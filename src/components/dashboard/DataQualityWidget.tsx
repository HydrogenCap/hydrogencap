import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Database, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  ChevronDown,
  ChevronRight,
  Edit,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { PropertyWithFinancials } from '@/hooks/useProperties';
import { useCompanies } from '@/hooks/useCompanies';

// Event name for property updates
export const PROPERTY_UPDATED_EVENT = 'propertyUpdated';

// Helper function to notify when a property is updated
export function notifyPropertyUpdated(propertyId?: string) {
  window.dispatchEvent(new CustomEvent(PROPERTY_UPDATED_EVENT, { detail: { propertyId } }));
}

interface DataQualityWidgetProps {
  properties: PropertyWithFinancials[];
}

interface AffectedProperty {
  id: string;
  address: string;
  area: string | null;
  ownership: string | null;
  missingFields: string[];
}

interface QualityIssue {
  category: string;
  label: string;
  priority: 'high' | 'medium' | 'low';
  completeCount: number;
  totalCount: number;
  affectedProperties: AffectedProperty[];
}

interface QualityAnalysis {
  overallCompleteness: number;
  completeFields: number;
  totalFields: number;
  issues: QualityIssue[];
}

// Field name formatter
function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

// Data quality analyzer
function analyzeDataQuality(
  properties: PropertyWithFinancials[], 
  companyMap: Map<string, string>
): QualityAnalysis {
  const categories = {
    mortgageDetails: {
      label: 'Mortgage Details',
      fields: [
        { key: 'lender', path: (p: PropertyWithFinancials) => p.loans?.[0]?.lender },
        { key: 'balance', path: (p: PropertyWithFinancials) => p.loans?.[0]?.current_mortgage_balance_gbp },
        { key: 'interestRate', path: (p: PropertyWithFinancials) => p.loans?.[0]?.interest_rate_percent },
        { key: 'fixedRateExpiry', path: (p: PropertyWithFinancials) => p.loans?.[0]?.fixed_rate_expires },
      ],
      priority: 'high' as const,
    },
    epcRating: {
      label: 'EPC Rating',
      fields: [
        { key: 'epcRating', path: (p: PropertyWithFinancials) => p.epc_rating },
      ],
      priority: 'high' as const,
    },
    rentalIncome: {
      label: 'Rental Income',
      fields: [
        { key: 'annualRent', path: (p: PropertyWithFinancials) => p.income?.[0]?.annual_rent_gbp },
      ],
      priority: 'high' as const,
    },
    propertyValue: {
      label: 'Property Valuation',
      fields: [
        { key: 'currentValue', path: (p: PropertyWithFinancials) => p.current_value_gbp },
        { key: 'purchasePrice', path: (p: PropertyWithFinancials) => p.purchase_price_gbp },
        { key: 'purchaseDate', path: (p: PropertyWithFinancials) => p.original_purchase_date },
      ],
      priority: 'high' as const,
    },
    tenure: {
      label: 'Tenure & Type',
      fields: [
        { key: 'tenure', path: (p: PropertyWithFinancials) => p.tenure },
        { key: 'propertyType', path: (p: PropertyWithFinancials) => p.property_type },
      ],
      priority: 'medium' as const,
    },
    bedrooms: {
      label: 'Bedrooms',
      fields: [
        { key: 'beds', path: (p: PropertyWithFinancials) => p.beds },
      ],
      priority: 'low' as const,
    },
    coordinates: {
      label: 'Map Location',
      fields: [
        { key: 'latitude', path: (p: PropertyWithFinancials) => p.latitude && p.longitude ? 'valid' : null },
      ],
      priority: 'low' as const,
    },
  };

  const issues: QualityIssue[] = [];
  let totalFields = 0;
  let completeFields = 0;

  Object.entries(categories).forEach(([categoryKey, category]) => {
    const affectedProperties: AffectedProperty[] = [];
    let categoryComplete = 0;
    let categoryTotal = 0;

    properties.forEach(property => {
      const missingFields: string[] = [];
      
      category.fields.forEach(field => {
        categoryTotal++;
        const value = field.path(property);
        
        if (value === null || value === undefined || value === '' || 
            (typeof value === 'string' && value.trim() === '')) {
          missingFields.push(formatFieldName(field.key));
        } else {
          categoryComplete++;
        }
      });

      if (missingFields.length > 0) {
        // Get ownership display name
        let ownership: string | null = null;
        if (property.legal_owner_company_id && companyMap) {
          ownership = companyMap.get(property.legal_owner_company_id) || null;
        }
        if (!ownership) {
          ownership = property.ownership_entity || null;
        }

        affectedProperties.push({
          id: property.id,
          address: property.address_line,
          area: property.postcode || null,
          ownership,
          missingFields,
        });
      }
    });

    totalFields += categoryTotal;
    completeFields += categoryComplete;

    issues.push({
      category: categoryKey,
      label: category.label,
      priority: category.priority,
      completeCount: categoryComplete,
      totalCount: categoryTotal,
      affectedProperties,
    });
  });

  // Sort: high priority first, then by completion percentage (lowest first)
  issues.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    const aPercent = a.completeCount / a.totalCount;
    const bPercent = b.completeCount / b.totalCount;
    return aPercent - bPercent;
  });

  return {
    overallCompleteness: totalFields > 0 ? completeFields / totalFields : 1,
    completeFields,
    totalFields,
    issues,
  };
}

// Issue row component with expandable property list
function DataQualityIssueRow({ 
  issue, 
  isExpanded, 
  onToggle 
}: { 
  issue: QualityIssue; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const navigate = useNavigate();
  const percentage = Math.round((issue.completeCount / issue.totalCount) * 100);
  const hasIssues = issue.affectedProperties.length > 0;
  
  const getStatusColor = (pct: number) => {
    if (pct >= 100) return 'text-success';
    if (pct >= 70) return 'text-warning';
    return 'text-destructive';
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return 'bg-success';
    if (pct >= 70) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border border-border rounded-lg mb-2 overflow-hidden">
        {/* Header - Clickable */}
        <CollapsibleTrigger asChild>
          <button
            className="w-full p-3 bg-muted/50 hover:bg-muted transition-colors flex items-center justify-between text-left"
            disabled={!hasIssues}
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
                {hasIssues && (
                  <span className="text-xs text-muted-foreground">
                    {issue.affectedProperties.length} {issue.affectedProperties.length === 1 ? 'property needs' : 'properties need'} attention
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${getStatusColor(percentage)}`}>
                  {issue.completeCount}/{issue.totalCount}
                </span>
                {hasIssues ? (
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
            {issue.affectedProperties.length > 0 ? (
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
            ) : (
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

export function DataQualityWidget({ properties }: DataQualityWidgetProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: companies } = useCompanies();
  
  // Listen for property update events to trigger re-analysis
  useEffect(() => {
    const handlePropertyUpdate = () => {
      setLastUpdateTime(Date.now());
    };

    window.addEventListener(PROPERTY_UPDATED_EVENT, handlePropertyUpdate);
    return () => window.removeEventListener(PROPERTY_UPDATED_EVENT, handlePropertyUpdate);
  }, []);

  // Build company name lookup map
  const companyMap = useMemo(() => {
    const map = new Map<string, string>();
    companies?.forEach(c => map.set(c.id, c.legal_name));
    return map;
  }, [companies]);

  // Re-analyze when properties change or lastUpdateTime changes
  const qualityAnalysis = useMemo<QualityAnalysis>(() => {
    if (!properties?.length) {
      return { overallCompleteness: 1, completeFields: 0, totalFields: 0, issues: [] };
    }
    return analyzeDataQuality(properties, companyMap);
  }, [properties, companyMap, lastUpdateTime]);

  const overallPercentage = Math.round(qualityAnalysis.overallCompleteness * 100);

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setLastUpdateTime(Date.now());
    setTimeout(() => setIsRefreshing(false), 500);
  }, []);

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  // Get status color
  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-success';
    if (percentage >= 70) return 'text-warning';
    return 'text-destructive';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-success';
    if (percentage >= 70) return 'bg-warning';
    return 'bg-destructive';
  };

  // Separate high priority issues that need attention
  const needsAttention = qualityAnalysis.issues.filter(
    issue => issue.priority === 'high' && issue.affectedProperties.length > 0
  );
  
  const otherIssues = qualityAnalysis.issues.filter(
    issue => issue.priority !== 'high' || issue.affectedProperties.length === 0
  );

  const completeCategories = qualityAnalysis.issues.filter(
    issue => issue.affectedProperties.length === 0
  ).length;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Data Quality</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {qualityAnalysis.totalFields} fields across {properties.length} properties
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Refresh data quality analysis"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <div className={`text-3xl font-bold ${getStatusColor(overallPercentage)}`}>
            {overallPercentage}%
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Completeness</span>
            <span className="font-medium">{completeCategories}/{qualityAnalysis.issues.length} categories complete</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${getProgressColor(overallPercentage)}`}
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
        </div>

        {/* Needs Attention Section */}
        {needsAttention.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Needs Attention
            </h4>
            {needsAttention.map((issue) => (
              <DataQualityIssueRow
                key={issue.category}
                issue={issue}
                isExpanded={expandedSections[issue.category] ?? false}
                onToggle={() => toggleSection(issue.category)}
              />
            ))}
          </div>
        )}

        {/* Other Categories */}
        {otherIssues.length > 0 && needsAttention.length > 0 && (
          <div className="border-t border-border pt-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Other Categories
            </h4>
            {otherIssues.map((issue) => (
              <DataQualityIssueRow
                key={issue.category}
                issue={issue}
                isExpanded={expandedSections[issue.category] ?? false}
                onToggle={() => toggleSection(issue.category)}
              />
            ))}
          </div>
        )}

        {/* Show all if no high priority issues */}
        {needsAttention.length === 0 && qualityAnalysis.issues.length > 0 && (
          <div className="space-y-2">
            {qualityAnalysis.issues.map((issue) => (
              <DataQualityIssueRow
                key={issue.category}
                issue={issue}
                isExpanded={expandedSections[issue.category] ?? false}
                onToggle={() => toggleSection(issue.category)}
              />
            ))}
          </div>
        )}

        {/* All Complete State */}
        {qualityAnalysis.issues.length > 0 && qualityAnalysis.issues.every(i => i.affectedProperties.length === 0) && (
          <div className="text-center py-4">
            <CheckCircle2 className="h-10 w-10 mx-auto text-success mb-2" />
            <p className="text-sm text-success font-medium">All data complete!</p>
            <p className="text-xs text-muted-foreground mt-1">
              Every property has all key fields filled in
            </p>
          </div>
        )}

        {/* Link to Properties */}
        <Link 
          to="/properties"
          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors mt-4"
        >
          <span className="text-sm font-medium">View all properties</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </CardContent>
    </Card>
  );
}
