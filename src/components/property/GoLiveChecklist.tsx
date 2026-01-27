import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  Circle, 
  Rocket, 
  Lock, 
  AlertTriangle,
  Building,
  Wrench,
  FileCheck,
  Wallet,
  CheckCheck,
  ExternalLink
} from 'lucide-react';
import { 
  useGoLiveChecklist, 
  validatePropertyData,
  buildChecklistSections, 
  calculateChecklistProgress,
  isChecklistComplete,
  type ChecklistSection,
  type ChecklistItemStatus
} from '@/hooks/useGoLiveChecklist';
import { useProperty } from '@/hooks/useProperties';
import { usePropertyCompliance } from '@/hooks/useCompliance';
import { usePropertyBeneficialOwnership } from '@/hooks/useOwnershipLinks';
import { usePropertyPassport } from '@/hooks/usePropertyPassport';
import { formatDateUK } from '@/lib/calculations';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface GoLiveChecklistProps {
  propertyId: string;
}

const sectionIcons: Record<string, React.ReactNode> = {
  setup: <Building className="h-5 w-5" />,
  build: <Wrench className="h-5 w-5" />,
  compliance: <FileCheck className="h-5 w-5" />,
  finance: <Wallet className="h-5 w-5" />,
  confirmation: <CheckCheck className="h-5 w-5" />,
};

function ChecklistItem({ 
  item, 
  onToggle, 
  disabled,
  onToggleNA
}: { 
  item: ChecklistItemStatus; 
  onToggle: (key: string, checked: boolean) => void;
  disabled: boolean;
  onToggleNA?: (key: string, notApplicable: boolean) => void;
}) {
  const showNAOption = item.key.includes('gas_safety') || 
                        item.key.includes('emergency_lighting') || 
                        item.key.includes('hmo_licence') ||
                        item.key.includes('finance_unencumbered');

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
      item.checked || item.notApplicable 
        ? 'bg-success/10' 
        : 'bg-muted/50 hover:bg-muted'
    }`}>
      <Checkbox
        id={item.key}
        checked={item.checked}
        disabled={disabled || item.autoValidated || item.notApplicable}
        onCheckedChange={(checked) => onToggle(item.key, checked as boolean)}
        className="mt-0.5"
      />
      <div className="flex-1 space-y-1">
        <label 
          htmlFor={item.key} 
          className={`text-sm cursor-pointer ${
            item.checked || item.notApplicable ? 'text-muted-foreground line-through' : ''
          }`}
        >
          {item.label}
        </label>
        <div className="flex items-center gap-2">
          {item.autoValidated && (
            <Badge variant="outline" className="text-xs text-success border-success/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Auto-verified
            </Badge>
          )}
          {item.notApplicable && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              N/A
            </Badge>
          )}
        </div>
      </div>
      {showNAOption && onToggleNA && !item.autoValidated && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 text-muted-foreground"
          onClick={() => {
            const naKey = item.key.replace('_uploaded', '_not_applicable')
              .replace('_added', '_unencumbered');
            onToggleNA(naKey, !item.notApplicable);
          }}
        >
          {item.notApplicable ? 'Undo N/A' : 'Mark N/A'}
        </Button>
      )}
    </div>
  );
}

function SectionCard({ 
  section, 
  onToggle, 
  onToggleNA,
  disabled 
}: { 
  section: ChecklistSection; 
  onToggle: (key: string, checked: boolean) => void;
  onToggleNA: (key: string, notApplicable: boolean) => void;
  disabled: boolean;
}) {
  const completedCount = section.items.filter(i => i.checked || i.notApplicable).length;
  const isComplete = completedCount === section.items.length;

  return (
    <Card className={`border ${isComplete ? 'border-success/50 bg-success/5' : 'border-border'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isComplete ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
              {sectionIcons[section.id] || <Circle className="h-5 w-5" />}
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {section.title}
                {isComplete && <CheckCircle2 className="h-4 w-4 text-success" />}
              </CardTitle>
              <CardDescription className="text-xs">
                {completedCount} / {section.items.length} completed
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {section.items.map((item) => (
          <ChecklistItem 
            key={item.key} 
            item={item} 
            onToggle={onToggle}
            onToggleNA={onToggleNA}
            disabled={disabled}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export function GoLiveChecklist({ propertyId }: GoLiveChecklistProps) {
  const { data: property, isLoading: propertyLoading } = useProperty(propertyId);
  const { data: complianceItems = [], isLoading: complianceLoading } = usePropertyCompliance(propertyId);
  const { data: ownershipLinks = [], isLoading: ownershipLoading } = usePropertyBeneficialOwnership(propertyId);
  const { data: passport, isLoading: passportLoading } = usePropertyPassport(propertyId);
  const { 
    checklist, 
    isLoading: checklistLoading, 
    updateChecklist, 
    isUpdating,
    approveGoLive,
    isApproving 
  } = useGoLiveChecklist(propertyId);

  const isLoading = propertyLoading || complianceLoading || ownershipLoading || checklistLoading || passportLoading;

  // If property is already core_rental, show read-only view
  const isAlreadyLive = property?.lifecycle_type === 'core_rental';

  // Validate actual data (pass passport for local authority check)
  const validation = validatePropertyData(property, complianceItems, ownershipLinks, passport);
  
  // Build checklist sections
  const sections = buildChecklistSections(checklist, validation);
  const progress = calculateChecklistProgress(sections);
  const canGoLive = isChecklistComplete(sections);

  const handleToggle = (key: string, checked: boolean) => {
    updateChecklist({ [key]: checked });
  };

  const handleToggleNA = (key: string, notApplicable: boolean) => {
    updateChecklist({ [key]: notApplicable });
  };

  const handleGoLive = () => {
    if (!canGoLive) {
      toast.error('Complete all checklist items before going live');
      return;
    }

    const address = property?.address_line || 'Property';
    approveGoLive(address, {
      onSuccess: () => {
        toast.success('🚀 Property is now live!', {
          description: 'Compliance tracking, KPIs, and reminders are now active.',
        });
      },
      onError: (error) => {
        toast.error('Failed to activate property', {
          description: error.message,
        });
      },
    });
  };

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            Loading checklist...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Read-only view for already-live properties
  if (isAlreadyLive) {
    return (
      <Card className="border-success/50 bg-success/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/20 text-success">
              <Rocket className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg text-success">Property is Live</CardTitle>
              <CardDescription>
                This property is fully operational with active compliance tracking
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        {checklist?.go_live_approved_at && (
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              Activated on {formatDateUK(checklist.go_live_approved_at)}
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Progress */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <Rocket className="h-7 w-7" />
              </div>
              <div>
                <CardTitle className="text-xl">Ready to Go Live</CardTitle>
                <CardDescription>
                  Complete this checklist to activate the property
                </CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">{progress.completed}/{progress.total}</div>
              <div className="text-sm text-muted-foreground">completed</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress.percentage}%</span>
            </div>
            <Progress value={progress.percentage} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Checklist Sections */}
      <div className="grid gap-4 lg:grid-cols-2">
        {sections.slice(0, 4).map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            onToggle={handleToggle}
            onToggleNA={handleToggleNA}
            disabled={isUpdating || isAlreadyLive}
          />
        ))}
      </div>

      {/* Final Confirmation Section */}
      <Card className={`border-2 ${canGoLive ? 'border-success' : 'border-warning/50'}`}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${canGoLive ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
              <CheckCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Final Confirmation</CardTitle>
              <CardDescription>
                Review all items above before confirming
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`flex items-start gap-3 p-4 rounded-lg ${
            checklist?.final_confirmation ? 'bg-success/10' : 'bg-muted/50'
          }`}>
            <Checkbox
              id="final_confirmation"
              checked={checklist?.final_confirmation ?? false}
              disabled={isUpdating}
              onCheckedChange={(checked) => handleToggle('final_confirmation', checked as boolean)}
              className="mt-0.5"
            />
            <label 
              htmlFor="final_confirmation" 
              className="text-sm cursor-pointer font-medium"
            >
              I confirm this property is operational and income-producing
            </label>
          </div>

          <Separator />

          {!canGoLive && (
            <Alert variant="destructive" className="bg-warning/10 border-warning/30 text-warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Incomplete Checklist</AlertTitle>
              <AlertDescription>
                Complete all {progress.total - progress.completed} remaining items to activate this property.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              <p>Once activated:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Compliance tracking & reminders begin</li>
                <li>Property included in KPIs & reporting</li>
                <li>Weekly compliance digest activated</li>
              </ul>
            </div>
            <Button
              size="lg"
              disabled={!canGoLive || isApproving}
              onClick={handleGoLive}
              className="gap-2 bg-success hover:bg-success/90 text-success-foreground"
            >
              {isApproving ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  Activating...
                </>
              ) : (
                <>
                  <Rocket className="h-5 w-5" />
                  Go Live
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            <Link to={`/properties/${propertyId}/edit`}>
              <Button variant="outline" size="sm" className="gap-2">
                <Building className="h-4 w-4" />
                Edit Property
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
            <Link to="/compliance">
              <Button variant="outline" size="sm" className="gap-2">
                <FileCheck className="h-4 w-4" />
                Upload Documents
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
