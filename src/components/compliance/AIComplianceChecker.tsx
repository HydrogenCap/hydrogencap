import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingButton } from '@/components/common/LoadingButton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileQuestion,
  Lightbulb,
  PoundSterling,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useAIComplianceChecker, AIComplianceRequirement, AIComplianceInsight } from '@/hooks/useAIComplianceChecker';
import { cn } from '@/lib/utils';

interface AIComplianceCheckerProps {
  propertyId: string;
  onRequirementClick?: (type: string) => void;
}

export function AIComplianceChecker({ propertyId, onRequirementClick }: AIComplianceCheckerProps) {
  const [activeTab, setActiveTab] = useState('overview');
  
  const {
    analysis,
    isLoading,
    isAnalyzing,
    runAnalysis,
    canAnalyze,
    getHighPriorityItems,
    _getMissingItems,
    getExpiringItems,
    _getActionableInsights,
  } = useAIComplianceChecker(propertyId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'valid': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'expiring_soon': return <Clock className="h-4 w-4 text-amber-500" />;
      case 'expired': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'missing': return <FileQuestion className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const _priorityBadge = (priority: string) => {
    const variants: Record<string, string> = {
      high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    };
    return <Badge className={variants[priority] || variants.low}>{priority}</Badge>;
  };

  const _insightIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'suggestion': return <Lightbulb className="h-4 w-4 text-blue-500" />;
      default: return <Sparkles className="h-4 w-4 text-purple-500" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Compliance Checker</CardTitle>
          </div>
          <div className="flex gap-2">
            <LoadingButton
              variant="outline"
              size="sm"
              onClick={() => runAnalysis('quick')}
              disabled={!canAnalyze}
              loading={isAnalyzing}
              loadingText="Checking..."
            >
              Quick Check
            </LoadingButton>
            <LoadingButton
              size="sm"
              onClick={() => runAnalysis('analyze')}
              disabled={!canAnalyze}
              loading={isAnalyzing}
              loadingText="Analysing..."
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Full Analysis
            </LoadingButton>
          </div>
        </div>
        <CardDescription>
          AI-powered analysis of compliance requirements based on property features
        </CardDescription>
      </CardHeader>

      <CardContent>
        {!analysis ? (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Run an AI analysis to get intelligent compliance recommendations</p>
            <p className="text-sm mt-1">The AI will evaluate your property features and determine requirements</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="requirements">Requirements</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
              <TabsTrigger value="costs">Costs</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Score Card */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-muted/50">
                  <CardContent className="p-4 text-center">
                    <div className={cn("text-3xl font-bold", scoreColor(analysis.analysis.complianceScore))}>
                      {analysis.analysis.complianceScore}%
                    </div>
                    <div className="text-sm text-muted-foreground">Compliance Score</div>
                    <Progress 
                      value={analysis.analysis.complianceScore} 
                      className="mt-2 h-2"
                    />
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {analysis.analysis.urgentActions}
                    </div>
                    <div className="text-sm text-muted-foreground">Urgent Actions</div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                      {getExpiringItems().length}
                    </div>
                    <div className="text-sm text-muted-foreground">Expiring Soon</div>
                  </CardContent>
                </Card>
              </div>

              {/* Summary */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <p className="text-sm">{analysis.analysis.summary}</p>
                </CardContent>
              </Card>

              {/* High Priority Items */}
              {getHighPriorityItems().length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    High Priority Actions
                  </h4>
                  <div className="space-y-2">
                    {getHighPriorityItems().slice(0, 3).map((item, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors"
                        onClick={() => onRequirementClick?.(item.type)}
                      >
                        <div className="flex items-center gap-3">
                          {statusIcon(item.status)}
                          <div>
                            <div className="font-medium text-sm">{item.type}</div>
                            <div className="text-xs text-muted-foreground">{item.recommendation}</div>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-right">
                Analysis generated: {new Date(analysis.generatedAt).toLocaleString()}
              </p>
            </TabsContent>

            <TabsContent value="requirements" className="mt-4">
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {analysis.requirements.map((req, idx) => (
                  <RequirementRow 
                    key={idx} 
                    requirement={req} 
                    onClick={() => onRequirementClick?.(req.type)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="insights" className="mt-4">
              <div className="space-y-3">
                {analysis.insights.map((insight, idx) => (
                  <InsightCard key={idx} insight={insight} />
                ))}
                {analysis.insights.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No additional insights</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="costs" className="mt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <PoundSterling className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium">Immediate Costs</span>
                      </div>
                      <div className="text-xl font-bold text-red-600 dark:text-red-400">
                        {analysis.costEstimate.immediate}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <PoundSterling className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Annual Recurring</span>
                      </div>
                      <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {analysis.costEstimate.annual}
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Cost Breakdown</h4>
                  <ul className="space-y-1">
                    {analysis.costEstimate.details.map((detail, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function RequirementRow({ 
  requirement, 
  onClick 
}: { 
  requirement: AIComplianceRequirement;
  onClick?: () => void;
}) {
  const statusColors: Record<string, string> = {
    valid: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
    expiring_soon: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
    expired: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
    missing: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
    not_required: 'bg-muted/50 border-muted',
  };

  const statusBadges: Record<string, string> = {
    valid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    expiring_soon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    missing: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    not_required: 'bg-muted text-muted-foreground',
  };

  const priorityBadges: Record<string, string> = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };

  return (
    <div 
      className={cn(
        "p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-all",
        statusColors[requirement.status] || statusColors.not_required
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{requirement.type}</span>
            <Badge className={cn("text-xs", statusBadges[requirement.status])}>
              {requirement.status.replace('_', ' ')}
            </Badge>
            {requirement.required && requirement.status !== 'not_required' && (
              <Badge className={cn("text-xs", priorityBadges[requirement.priority])}>
                {requirement.priority}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{requirement.reason}</p>
          {requirement.recommendation && requirement.status !== 'valid' && requirement.status !== 'not_required' && (
            <p className="text-xs text-primary mt-1 font-medium">{requirement.recommendation}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: AIComplianceInsight }) {
  const typeStyles: Record<string, string> = {
    warning: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
    suggestion: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
    info: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800',
  };

  const icons: Record<string, React.ReactNode> = {
    warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    suggestion: <Lightbulb className="h-4 w-4 text-blue-500" />,
    info: <Sparkles className="h-4 w-4 text-purple-500" />,
  };

  return (
    <Card className={cn("border", typeStyles[insight.type] || typeStyles.info)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{icons[insight.type]}</div>
          <div>
            <h4 className="font-medium text-sm">{insight.title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
            {insight.actionable && (
              <Badge variant="outline" className="mt-2 text-xs">Actionable</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
