import { useState } from 'react';
import { Sparkles, Check, X, Loader2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useGenerateSuggestions,
  usePendingSuggestions,
  useApplySuggestions,
  categorizeSuggestions,
  FIELD_LABELS,
  SOURCE_LABELS,
  type PassportSuggestion,
  type AcceptedSuggestion,
} from '@/hooks/usePassportAutofill';

interface AIAutofillButtonProps {
  propertyId: string;
  onComplete?: () => void;
}

export function AIAutofillButton({ propertyId, onComplete }: AIAutofillButtonProps) {
  const [showReview, setShowReview] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['highConfidence']));

  const { data: pendingSuggestions, isLoading: loadingSuggestions } = usePendingSuggestions(propertyId);
  const generateMutation = useGenerateSuggestions();
  const applyMutation = useApplySuggestions();

  const { mustConfirm, highConfidence, needsReview } = categorizeSuggestions(pendingSuggestions || []);

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync(propertyId);
      setShowReview(true);
      // Auto-select high confidence suggestions
      const autoSelect = new Set<string>();
      highConfidence.forEach(s => autoSelect.add(s.id));
      setSelectedIds(autoSelect);
      toast.success('AI suggestions generated');
    } catch (error) {
      toast.error('Failed to generate suggestions');
    }
  };

  const handleApply = async () => {
    const accepted: AcceptedSuggestion[] = [];
    const rejected: string[] = [];

    (pendingSuggestions || []).forEach(suggestion => {
      if (selectedIds.has(suggestion.id)) {
        accepted.push({
          id: suggestion.id,
          field_key: suggestion.field_key,
          value: suggestion.suggested_value,
          source_type: suggestion.source_type,
          source_ref: suggestion.source_ref,
          confidence: suggestion.confidence,
        });
      } else {
        rejected.push(suggestion.id);
      }
    });

    try {
      await applyMutation.mutateAsync({
        propertyId,
        acceptedSuggestions: accepted,
        rejectedSuggestionIds: rejected,
      });
      toast.success(`Applied ${accepted.length} suggestions`);
      setShowReview(false);
      setSelectedIds(new Set());
      onComplete?.();
    } catch (error) {
      toast.error('Failed to apply suggestions');
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set<string>();
    (pendingSuggestions || []).forEach(s => {
      if (s.suggested_value !== null) all.add(s.id);
    });
    setSelectedIds(all);
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const renderSuggestionRow = (suggestion: PassportSuggestion) => {
    const isSelected = selectedIds.has(suggestion.id);
    const hasValue = suggestion.suggested_value !== null;

    return (
      <div
        key={suggestion.id}
        className={cn(
          'flex items-start gap-3 p-3 rounded-lg border transition-colors',
          isSelected ? 'bg-primary/5 border-primary/30' : 'bg-muted/30',
          !hasValue && 'opacity-50'
        )}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleSelection(suggestion.id)}
          disabled={!hasValue}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              {FIELD_LABELS[suggestion.field_key] || suggestion.field_key}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {SOURCE_LABELS[suggestion.source_type] || suggestion.source_type}
            </Badge>
            <Badge
              variant={suggestion.confidence >= 0.85 ? 'default' : suggestion.confidence >= 0.5 ? 'secondary' : 'outline'}
              className="text-[10px]"
            >
              {Math.round(suggestion.confidence * 100)}%
            </Badge>
          </div>
          <p className="text-sm text-foreground mt-1">
            {hasValue ? String(suggestion.suggested_value) : 'No value found'}
          </p>
          {suggestion.evidence_excerpt && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {suggestion.evidence_excerpt}
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderSection = (
    title: string,
    description: string,
    suggestions: PassportSuggestion[],
    sectionKey: string
  ) => {
    if (suggestions.length === 0) return null;

    const isExpanded = expandedSections.has(sectionKey);
    const selectedCount = suggestions.filter(s => selectedIds.has(s.id)).length;

    return (
      <Collapsible open={isExpanded} onOpenChange={() => toggleSection(sectionKey)}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{title}</span>
              <Badge variant="secondary" className="text-xs">
                {selectedCount}/{suggestions.length}
              </Badge>
            </div>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p className="text-xs text-muted-foreground px-3 mb-2">{description}</p>
          <div className="space-y-2 px-1">
            {suggestions.map(renderSuggestionRow)}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // If we have pending suggestions and review is open, show the review panel
  if (showReview && pendingSuggestions && pendingSuggestions.length > 0) {
    const totalSelected = selectedIds.size;
    const totalWithValue = pendingSuggestions.filter(s => s.suggested_value !== null).length;

    return (
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">AI Suggestions</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowReview(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Review and select suggestions to apply to this property
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick actions */}
          <div className="flex items-center gap-2 text-xs">
            <Button variant="link" size="sm" className="h-auto p-0" onClick={selectAll}>
              Select all
            </Button>
            <span className="text-muted-foreground">·</span>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={selectNone}>
              Select none
            </Button>
            <span className="text-muted-foreground ml-auto">
              {totalSelected} of {totalWithValue} selected
            </span>
          </div>

          {/* Sections */}
          <div className="space-y-2">
            {renderSection(
              'High Confidence',
              'These values have high confidence and are auto-selected',
              highConfidence,
              'highConfidence'
            )}
            {renderSection(
              'Requires Review',
              'Lower confidence - please verify before applying',
              needsReview,
              'needsReview'
            )}
            {renderSection(
              'Manual Confirmation',
              'Important fields that always require your confirmation',
              mustConfirm,
              'mustConfirm'
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              onClick={handleApply}
              disabled={applyMutation.isPending || totalSelected === 0}
              className="flex-1"
            >
              {applyMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Apply {totalSelected} suggestion{totalSelected !== 1 ? 's' : ''}
            </Button>
            <Button variant="outline" onClick={() => setShowReview(false)}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default: Show the generate button
  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleGenerate}
        disabled={generateMutation.isPending || loadingSuggestions}
        variant="outline"
        className="gap-2"
      >
        {generateMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        AI Auto-fill
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Info className="h-4 w-4 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">
            Uses AI to extract property details from uploaded documents, EPC data, and public records.
            Review suggestions before applying.
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
