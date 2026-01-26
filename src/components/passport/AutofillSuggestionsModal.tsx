import React, { useState, useEffect, useMemo } from 'react';
import { Check, X, Sparkles, ExternalLink, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  useGenerateSuggestions,
  useApplySuggestions,
  usePendingSuggestions,
  categorizeSuggestions,
  FIELD_LABELS,
  SOURCE_LABELS,
  type PassportSuggestion,
  type AcceptedSuggestion,
} from '@/hooks/usePassportAutofill';

interface AutofillSuggestionsModalProps {
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Dropdown options for specific fields
const FIELD_OPTIONS: Record<string, string[]> = {
  council_tax_band: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  construction_type: [
    'Solid Brick',
    'Cavity Brick',
    'Timber Frame',
    'Stone',
    'Concrete/System Build',
  ],
  construction_date_band: [
    'Pre-1900',
    '1900-1929',
    '1930-1949',
    '1950-1966',
    '1967-1979',
    '1980-1990',
    '1991-2002',
    '2003+',
  ],
};

type SuggestionState = {
  accepted: boolean;
  rejected: boolean;
  editedValue: any;
};

export function AutofillSuggestionsModal({
  propertyId,
  open,
  onOpenChange,
}: AutofillSuggestionsModalProps) {
  const { toast } = useToast();
  const { data: suggestions = [], isLoading: loadingSuggestions } = usePendingSuggestions(propertyId);
  const generateSuggestions = useGenerateSuggestions();
  const applySuggestions = useApplySuggestions();

  // Track state for each suggestion
  const [suggestionStates, setSuggestionStates] = useState<Record<string, SuggestionState>>({});

  // Initialize states when suggestions change
  useEffect(() => {
    if (suggestions.length > 0) {
      const initialStates: Record<string, SuggestionState> = {};
      suggestions.forEach((s) => {
        // Pre-accept high confidence non-must-confirm fields
        const isHighConfidence = s.confidence >= 0.85;
        const isMustConfirm = ['local_authority', 'council_tax_band', 'construction_type'].includes(s.field_key);
        
        initialStates[s.id] = {
          accepted: isHighConfidence && !isMustConfirm && s.suggested_value != null,
          rejected: false,
          editedValue: s.suggested_value,
        };
      });
      setSuggestionStates(initialStates);
    }
  }, [suggestions]);

  const { mustConfirm, highConfidence, needsReview } = useMemo(
    () => categorizeSuggestions(suggestions),
    [suggestions]
  );

  const handleGenerate = async () => {
    try {
      await generateSuggestions.mutateAsync(propertyId);
      toast({
        title: 'Suggestions generated',
        description: 'AI has analyzed your property data and generated suggestions.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate suggestions',
        variant: 'destructive',
      });
    }
  };

  const handleAccept = (id: string) => {
    setSuggestionStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], accepted: true, rejected: false },
    }));
  };

  const handleReject = (id: string) => {
    setSuggestionStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], accepted: false, rejected: true },
    }));
  };

  const handleValueChange = (id: string, value: any) => {
    setSuggestionStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], editedValue: value },
    }));
  };

  const handleAcceptAll = () => {
    const newStates = { ...suggestionStates };
    suggestions.forEach((s) => {
      if (s.suggested_value != null && s.field_key !== 'has_floorplan') {
        newStates[s.id] = { ...newStates[s.id], accepted: true, rejected: false };
      }
    });
    setSuggestionStates(newStates);
  };

  const handleSave = async () => {
    const accepted: AcceptedSuggestion[] = [];
    const rejected: string[] = [];

    suggestions.forEach((s) => {
      const state = suggestionStates[s.id];
      if (!state) return;

      if (state.accepted && state.editedValue != null) {
        accepted.push({
          id: s.id,
          field_key: s.field_key,
          value: state.editedValue,
          source_type: s.source_type,
          source_ref: s.source_ref,
          confidence: s.confidence,
        });
      } else if (state.rejected) {
        rejected.push(s.id);
      }
    });

    if (accepted.length === 0 && rejected.length === 0) {
      toast({
        title: 'No changes',
        description: 'Accept or reject some suggestions before saving.',
      });
      return;
    }

    try {
      const result = await applySuggestions.mutateAsync({
        propertyId,
        acceptedSuggestions: accepted,
        rejectedSuggestionIds: rejected,
      });

      toast({
        title: 'Passport updated',
        description: `${result.updated_fields} field${result.updated_fields !== 1 ? 's' : ''} confirmed.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to apply suggestions',
        variant: 'destructive',
      });
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.85) {
      return <Badge className="bg-success/20 text-success border-success">High</Badge>;
    }
    if (confidence >= 0.5) {
      return <Badge className="bg-warning/20 text-warning border-warning">Medium</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground">Low</Badge>;
  };

  const renderSuggestionRow = (suggestion: PassportSuggestion) => {
    const state = suggestionStates[suggestion.id] || {
      accepted: false,
      rejected: false,
      editedValue: suggestion.suggested_value,
    };

    const fieldOptions = FIELD_OPTIONS[suggestion.field_key];
    const isDropdown = !!fieldOptions;

    return (
      <div
        key={suggestion.id}
        className={`p-3 rounded-lg border transition-colors ${
          state.accepted
            ? 'bg-success/10 border-success/30'
            : state.rejected
              ? 'bg-destructive/10 border-destructive/30 opacity-60'
              : 'bg-muted/50 border-border'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">
                {FIELD_LABELS[suggestion.field_key] || suggestion.field_key}
              </span>
              {getConfidenceBadge(suggestion.confidence)}
              <Badge variant="outline" className="text-xs">
                {SOURCE_LABELS[suggestion.source_type] || suggestion.source_type}
              </Badge>
            </div>

            {/* Editable value */}
            <div className="mt-2">
              {isDropdown ? (
                <Select
                  value={state.editedValue || ''}
                  onValueChange={(v) => handleValueChange(suggestion.id, v)}
                  disabled={state.rejected}
                >
                  <SelectTrigger className="w-full max-w-xs h-9">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={state.editedValue ?? ''}
                  onChange={(e) => handleValueChange(suggestion.id, e.target.value)}
                  disabled={state.rejected}
                  className="max-w-xs h-9"
                  placeholder="Enter value..."
                />
              )}
            </div>

            {/* Evidence excerpt */}
            {suggestion.evidence_excerpt && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {suggestion.evidence_excerpt}
              </p>
            )}
          </div>

          {/* Accept/Reject buttons */}
          <div className="flex gap-1">
            <Button
              variant={state.accepted ? 'default' : 'outline'}
              size="icon"
              className="h-8 w-8"
              onClick={() => handleAccept(suggestion.id)}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant={state.rejected ? 'destructive' : 'outline'}
              size="icon"
              className="h-8 w-8"
              onClick={() => handleReject(suggestion.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const hasSuggestions = suggestions.filter(s => s.field_key !== 'has_floorplan').length > 0;
  const acceptedCount = Object.values(suggestionStates).filter((s) => s.accepted).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Review AI Suggestions
          </DialogTitle>
          <DialogDescription>
            Review and confirm the suggested values for your property passport.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {loadingSuggestions || generateSuggestions.isPending ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                {generateSuggestions.isPending ? 'Generating suggestions...' : 'Loading...'}
              </span>
            </div>
          ) : !hasSuggestions ? (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground mb-4">
                No suggestions available. Upload EPC / floorplan / inventory to improve autofill.
              </p>
              <Button onClick={handleGenerate} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate Suggestions
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-6">
                {/* Section A: Must Confirm */}
                {mustConfirm.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-warning" />
                      Must Confirm
                    </h3>
                    <div className="space-y-2">
                      {mustConfirm.map(renderSuggestionRow)}
                    </div>
                  </div>
                )}

                {/* Section B: High Confidence */}
                {highConfidence.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-success" />
                      Suggested (High confidence)
                    </h3>
                    <div className="space-y-2">
                      {highConfidence.map(renderSuggestionRow)}
                    </div>
                  </div>
                )}

                {/* Section C: Needs Review */}
                {needsReview.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                      Suggested (Needs review)
                    </h3>
                    <div className="space-y-2">
                      {needsReview.map(renderSuggestionRow)}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
          <div className="flex items-center gap-2 mr-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={generateSuggestions.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${generateSuggestions.isPending ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {hasSuggestions && (
              <Button variant="outline" size="sm" onClick={handleAcceptAll}>
                Accept All
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={applySuggestions.isPending || acceptedCount === 0}
          >
            {applySuggestions.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              `Save ${acceptedCount} Field${acceptedCount !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
