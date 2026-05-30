import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Database,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Ban,
} from 'lucide-react';
import { useCompanies } from '@/hooks/useCompanies';
import { PROPERTY_UPDATED_EVENT } from './dataQualityEvents';
import { analyzeDataQuality } from './data-quality/analyzeDataQuality';
import { DataQualityIssueRow } from './data-quality/DataQualityIssueRow';
import {
  getOverallProgressColor,
  getOverallStatusColor,
} from './data-quality/statusColors';
import type {
  DataQualityWidgetProps,
  QualityAnalysis,
} from './data-quality/types';

export function DataQualityWidget({ properties }: DataQualityWidgetProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [, setLastUpdateTime] = useState(Date.now());
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
      return { overallCompleteness: 1, completeFields: 0, totalFields: 0, requiredFields: 0, exemptedFields: 0, issues: [] };
    }
    return analyzeDataQuality(properties, companyMap);
  }, [properties, companyMap]);

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
  const getStatusColor = getOverallStatusColor;

  const getProgressColor = getOverallProgressColor;

  // Separate high priority issues that need attention
  const needsAttention = qualityAnalysis.issues.filter(
    issue => issue.priority === 'high' && issue.affectedProperties.length > 0
  );
  
  const otherIssues = qualityAnalysis.issues.filter(
    issue => issue.priority !== 'high' || issue.affectedProperties.length === 0
  );

  const _completeCategories = qualityAnalysis.issues.filter(
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
              {qualityAnalysis.requiredFields} required fields • {qualityAnalysis.exemptedFields > 0 && (
                <span className="text-muted-foreground/70">{qualityAnalysis.exemptedFields} exempt</span>
              )}
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
            <span className="font-medium">{qualityAnalysis.completeFields}/{qualityAnalysis.requiredFields} required fields complete</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${getProgressColor(overallPercentage)}`}
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
          {qualityAnalysis.exemptedFields > 0 && (
            <div className="text-xs text-muted-foreground/70 flex items-center gap-1">
              <Ban className="h-3 w-3" />
              {qualityAnalysis.exemptedFields} fields marked as not required/exempt
            </div>
          )}
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
