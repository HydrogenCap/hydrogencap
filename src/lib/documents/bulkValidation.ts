/**
 * Post-import validation for the Bulk Document Scanner v2.
 *
 * Surfaces actionable issues per queue item so the user can fix them before
 * approving the batch. Pure / synchronous so it can be unit-tested easily and
 * re-run on the fly in the summary panel.
 */
import type { QueueItem } from '@/hooks/useBulkDocumentUpload';

export type ValidationSeverity = 'critical' | 'warning' | 'info';

export interface ValidationIssue {
  itemId: string;
  fileName: string;
  severity: ValidationSeverity;
  /** Machine code — stable for tests / analytics. */
  code: string;
  /** Human-readable message shown in the summary panel. */
  message: string;
}

/**
 * Categories that MUST have an expiry date to be useful (compliance certs).
 * Aligns with the categories defined in filenameClassifier + documents enum.
 */
const EXPIRY_REQUIRED = new Set([
  'gas_safety_certificate',
  'electrical_certificate',
  'epc',
  'fire_alarm_certificate',
  'pat_certificate',
  'legionella_risk_assessment',
  'building_insurance',
  'hmo_licence',
]);

function effectiveCategory(item: QueueItem): string | null {
  return item.classification.category || item.filenameHint?.category || null;
}

export function validateItem(item: QueueItem): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const fileName = item.file.name;
  const push = (
    severity: ValidationSeverity,
    code: string,
    message: string,
  ) => out.push({ itemId: item.id, fileName, severity, code, message });

  if (item.status === 'error') {
    push('critical', 'processing_failed', item.error || 'Processing failed');
    return out;
  }

  if (item.status !== 'done') return out;

  // Property routing
  if (!item.matchedPropertyId && !item.selectedPropertyId) {
    push('critical', 'no_property', 'Could not match to a property');
  }

  // Category disagreement between filename and AI
  const aiCat = item.classification.category;
  const fnCat = item.filenameHint?.category;
  if (aiCat && fnCat && aiCat !== fnCat) {
    push(
      'warning',
      'category_disagreement',
      `Filename suggests ${fnCat.replace(/_/g, ' ')}, AI suggests ${aiCat.replace(/_/g, ' ')}`,
    );
  }

  // No category at all
  if (!aiCat && !fnCat) {
    push('warning', 'no_category', 'No category detected — choose one manually');
  }

  // AI category low confidence
  if (aiCat && item.classification.confidence > 0 && item.classification.confidence < 0.7) {
    push(
      'warning',
      'low_category_confidence',
      `Category confidence ${Math.round(item.classification.confidence * 100)}%`,
    );
  }

  // Required expiry missing
  const cat = effectiveCategory(item);
  if (cat && EXPIRY_REQUIRED.has(cat) && !item.extraction.expiryDate) {
    push('warning', 'missing_expiry', `${cat.replace(/_/g, ' ')} has no expiry date`);
  }

  // Expired certificate
  if (item.extraction.expiryDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (item.extraction.expiryDate < today) {
      push(
        'critical',
        'expired',
        `Already expired (${item.extraction.expiryDate})`,
      );
    }
  }

  // Low-confidence extracted fields
  const lowFields = Object.entries(item.extraction.fieldConfidences || {})
    .filter(([, c]) => c > 0 && c < 0.6)
    .map(([k]) => k);
  if (lowFields.length) {
    push(
      'info',
      'low_field_confidence',
      `Low confidence on: ${lowFields.join(', ')}`,
    );
  }

  return out;
}

export function validateBatch(items: QueueItem[]): ValidationIssue[] {
  const all: ValidationIssue[] = [];
  for (const item of items) {
    all.push(...validateItem(item));
  }

  // Cross-item: duplicate filenames in same batch.
  const counts = new Map<string, QueueItem[]>();
  for (const item of items) {
    const arr = counts.get(item.file.name) || [];
    arr.push(item);
    counts.set(item.file.name, arr);
  }
  for (const [name, group] of counts) {
    if (group.length > 1) {
      for (const item of group) {
        all.push({
          itemId: item.id,
          fileName: name,
          severity: 'warning',
          code: 'duplicate_filename',
          message: `Duplicate filename in batch (${group.length} copies)`,
        });
      }
    }
  }

  return all;
}

export function summariseIssues(issues: ValidationIssue[]) {
  return {
    critical: issues.filter((i) => i.severity === 'critical').length,
    warning: issues.filter((i) => i.severity === 'warning').length,
    info: issues.filter((i) => i.severity === 'info').length,
    total: issues.length,
  };
}
