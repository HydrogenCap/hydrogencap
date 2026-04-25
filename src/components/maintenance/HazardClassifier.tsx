import { useState, useMemo } from 'react';
import { AlertTriangle, Shield, Clock, Zap, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  autoClassifyHazard,
  calculateDeadlines,
  useClassifyHazard,
  type HazardCategory,
} from '@/hooks/useAwaabsLawCompliance';
import { formatCountdown } from '@/lib/working-days';
import type { MaintenanceCategory } from '@/lib/maintenanceTypes';

const HAZARD_CONFIG: Record<HazardCategory, {
  label: string;
  description: string;
  repairDeadline: string;
  icon: typeof AlertTriangle;
  color: string;
  bgColor: string;
}> = {
  emergency: {
    label: 'Emergency',
    description: 'Immediate risk to health or safety',
    repairDeadline: 'Begin repairs within 24 hours',
    icon: Zap,
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
  },
  significant: {
    label: 'Significant',
    description: 'Hazard affecting health but not immediately dangerous',
    repairDeadline: 'Begin repairs within 5 working days',
    icon: AlertTriangle,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
  },
  standard: {
    label: 'Standard',
    description: 'Repair needed but no health hazard',
    repairDeadline: 'Reasonable timescale (28 working days)',
    icon: Clock,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
  },
  not_hazard: {
    label: 'Not a Hazard',
    description: 'Cosmetic or non-safety issue',
    repairDeadline: 'No statutory deadline',
    icon: Info,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 border-gray-200',
  },
};

const EMERGENCY_EXAMPLES = [
  'No heating or hot water (Oct–Mar)',
  'Gas leak or suspected gas leak',
  'Flooding / water ingress',
  'Structural collapse risk',
  'Fire safety failure',
  'Sewage backup',
  'Total loss of electricity',
];

const SIGNIFICANT_EXAMPLES = [
  'Damp / mould affecting health',
  'Broken external door or window',
  'Pest infestation (rats, mice, cockroaches)',
  'Faulty electrics',
  'No working toilet',
];

interface HazardClassifierProps {
  requestId: string;
  category: MaintenanceCategory;
  description: string;
  urgency?: string;
  currentClassification?: HazardCategory | null;
  reportedAt?: string;
  onClassified?: (category: HazardCategory) => void;
}

export default function HazardClassifier({
  requestId,
  category,
  description,
  urgency,
  currentClassification,
  reportedAt,
  onClassified,
}: HazardClassifierProps) {
  const suggestedCategory = useMemo(
    () => autoClassifyHazard(category, description, urgency),
    [category, description, urgency]
  );

  const [selectedCategory, setSelectedCategory] = useState<HazardCategory>(
    currentClassification || suggestedCategory
  );

  const classifyMutation = useClassifyHazard();
  const config = HAZARD_CONFIG[selectedCategory];
  const Icon = config.icon;

  const deadlines = useMemo(() => {
    if (selectedCategory === 'not_hazard') return null;
    const reported = reportedAt ? new Date(reportedAt) : new Date();
    return calculateDeadlines(reported, selectedCategory);
  }, [selectedCategory, reportedAt]);

  const handleClassify = () => {
    classifyMutation.mutate(
      { requestId, hazardCategory: selectedCategory },
      { onSuccess: () => onClassified?.(selectedCategory) }
    );
  };

  return (
    <Card className={`border ${config.bgColor}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Awaab's Law — Hazard Classification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Auto-suggestion banner */}
        {!currentClassification && (
          <div className="flex items-start gap-2 text-sm bg-white/60 rounded-lg p-3 border">
            <Info className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
            <div>
              <p className="font-medium">Auto-classification suggests: <span className={config.color}>{HAZARD_CONFIG[suggestedCategory].label}</span></p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Based on category ({category}) and description keywords. You can override below.
              </p>
            </div>
          </div>
        )}

        {/* Classification selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Hazard Category</label>
          <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as HazardCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(HAZARD_CONFIG) as [HazardCategory, typeof config][]).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                    {cfg.label} — {cfg.description}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected classification detail */}
        <div className={`rounded-lg p-3 border ${config.bgColor}`}>
          <div className="flex items-center gap-2 mb-2">
            <Icon className={`h-5 w-5 ${config.color}`} />
            <span className={`font-semibold ${config.color}`}>{config.label}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-2">{config.description}</p>
          <p className="text-sm font-medium">{config.repairDeadline}</p>
        </div>

        {/* Calculated deadlines */}
        {deadlines && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Statutory Deadlines</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-white rounded-lg p-2.5 border text-center">
                <p className="text-xs text-muted-foreground">Investigation</p>
                <p className="text-sm font-semibold">{formatCountdown(deadlines.investigationDue)}</p>
                <p className="text-xs text-muted-foreground">10 working days</p>
              </div>
              <div className="bg-white rounded-lg p-2.5 border text-center">
                <p className="text-xs text-muted-foreground">Written Summary</p>
                <p className="text-sm font-semibold">After investigation</p>
                <p className="text-xs text-muted-foreground">3 working days</p>
              </div>
              <div className="bg-white rounded-lg p-2.5 border text-center">
                <p className="text-xs text-muted-foreground">Begin Repairs</p>
                <p className="text-sm font-semibold">{formatCountdown(deadlines.repairDue)}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedCategory === 'emergency' ? '24 hours' : selectedCategory === 'significant' ? '5 working days' : '28 working days'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Reference examples */}
        {(selectedCategory === 'emergency' || selectedCategory === 'significant') && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Examples of {selectedCategory} hazards
            </summary>
            <ul className="mt-1 space-y-0.5 list-disc list-inside text-muted-foreground">
              {(selectedCategory === 'emergency' ? EMERGENCY_EXAMPLES : SIGNIFICANT_EXAMPLES).map((ex) => (
                <li key={ex}>{ex}</li>
              ))}
            </ul>
          </details>
        )}

        {/* Fines warning */}
        <div className="text-xs bg-white/80 rounded-lg p-2.5 border border-red-200 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
          <p className="text-muted-foreground">
            <span className="font-medium text-red-700">Penalty warning:</span> Failure to comply
            can result in fines of up to <strong>£7,000</strong> (initial) or <strong>£40,000</strong> for
            serious/repeat breaches, plus potential criminal prosecution.
          </p>
        </div>

        {/* Action */}
        <Button
          onClick={handleClassify}
          disabled={classifyMutation.isPending}
          className="w-full"
          variant={selectedCategory === 'emergency' ? 'destructive' : 'default'}
        >
          {classifyMutation.isPending
            ? 'Saving...'
            : currentClassification
              ? 'Update Classification'
              : 'Confirm Classification'}
        </Button>
      </CardContent>
    </Card>
  );
}
