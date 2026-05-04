/**
 * Pure helpers for the Inbox bulk-accept gate.
 *
 * #57 follow-up (2026-05-04): NULL-confidence AI suggestions were silently
 * excluded from "Accept All" because `(NULL || 0) >= 0.7` evaluated false.
 * They now land in a separate "Review manually before bulk-accept" bucket
 * and require explicit user confirmation before bulk acceptance.
 *
 * "Unreviewed AI suggestion" = the AI proposed an `ai_suggested_property_id`
 * but the user has not yet confirmed by setting `property_id`. Confirmation
 * is implicit via `documents.property_id IS NOT NULL` (no separate
 * `ai_suggestion_confirmed_at` column exists — see triage doc §1).
 */

const HIGH_CONFIDENCE_THRESHOLD = 0.7;

export interface InboxGateDoc {
  id: string;
  property_id?: string | null;
  ai_suggested_doc_type?: string | null;
  ai_doc_type_confidence?: number | null;
  ai_suggested_property_id?: string | null;
  ai_property_confidence?: number | null;
}

export interface PartitionedReadyDocs<T extends InboxGateDoc> {
  /** Both doc-type and property suggestions scored ≥ 0.7 — eligible for silent bulk-accept. */
  highConfidence: T[];
  /** Has an AI suggestion but at least one confidence score is NULL — eligible for bulk-accept ONLY after explicit confirmation. */
  nullConfidence: T[];
  /** Has an AI suggestion but a numeric score below the threshold — must be reviewed per-row. */
  lowConfidence: T[];
}

function isHighConfidence(d: InboxGateDoc): boolean {
  return Boolean(
    d.ai_suggested_doc_type &&
    (d.ai_doc_type_confidence ?? 0) >= HIGH_CONFIDENCE_THRESHOLD &&
    d.ai_suggested_property_id &&
    (d.ai_property_confidence ?? 0) >= HIGH_CONFIDENCE_THRESHOLD,
  );
}

function hasAnyNullConfidence(d: InboxGateDoc): boolean {
  if (!d.ai_suggested_property_id && !d.ai_suggested_doc_type) return false;
  return (
    (d.ai_suggested_doc_type !== null && d.ai_suggested_doc_type !== undefined && (d.ai_doc_type_confidence === null || d.ai_doc_type_confidence === undefined)) ||
    (d.ai_suggested_property_id !== null && d.ai_suggested_property_id !== undefined && (d.ai_property_confidence === null || d.ai_property_confidence === undefined))
  );
}

export function partitionReadyDocs<T extends InboxGateDoc>(docs: readonly T[]): PartitionedReadyDocs<T> {
  const highConfidence: T[] = [];
  const nullConfidence: T[] = [];
  const lowConfidence: T[] = [];
  for (const d of docs) {
    if (isHighConfidence(d)) {
      highConfidence.push(d);
    } else if (hasAnyNullConfidence(d)) {
      nullConfidence.push(d);
    } else {
      lowConfidence.push(d);
    }
  }
  return { highConfidence, nullConfidence, lowConfidence };
}

/**
 * Count of documents where the AI proposed a property but the user has not yet
 * confirmed (i.e. `property_id IS NULL AND ai_suggested_property_id IS NOT NULL`).
 * Drives the "X unreviewed AI suggestions" header chip.
 */
export function countUnreviewedAISuggestions(docs: readonly InboxGateDoc[]): number {
  let n = 0;
  for (const d of docs) {
    if (d.ai_suggested_property_id && !d.property_id) n++;
  }
  return n;
}

export function isUnreviewedAISuggestion(d: InboxGateDoc): boolean {
  return Boolean(d.ai_suggested_property_id) && !d.property_id;
}
