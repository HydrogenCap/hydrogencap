import { describe, it, expect } from 'vitest';
import {
  partitionReadyDocs,
  countUnreviewedAISuggestions,
  isUnreviewedAISuggestion,
  type InboxGateDoc,
} from '../inboxBulkGate';

const mk = (over: Partial<InboxGateDoc> & { id: string }): InboxGateDoc => ({
  property_id: null,
  ai_suggested_doc_type: 'gas_safety',
  ai_doc_type_confidence: 0.9,
  ai_suggested_property_id: 'prop-1',
  ai_property_confidence: 0.9,
  ...over,
});

describe('partitionReadyDocs (Inbox bulk-accept gate, #57 follow-up)', () => {
  it('classifies fully-scored ≥0.7 docs as highConfidence', () => {
    const out = partitionReadyDocs([mk({ id: 'a' })]);
    expect(out.highConfidence.map(d => d.id)).toEqual(['a']);
    expect(out.nullConfidence).toHaveLength(0);
    expect(out.lowConfidence).toHaveLength(0);
  });

  it('routes NULL-confidence rows to the manual-review bucket (does NOT silently drop them)', () => {
    // Mirrors the 5 stuck rows from the triage: suggestion present, score NULL.
    const stuck = mk({ id: 'stuck-1', ai_property_confidence: null });
    const out = partitionReadyDocs([stuck]);
    expect(out.highConfidence).toHaveLength(0);
    expect(out.nullConfidence.map(d => d.id)).toEqual(['stuck-1']);
    expect(out.lowConfidence).toHaveLength(0);
  });

  it('routes scored-but-low rows to lowConfidence', () => {
    const out = partitionReadyDocs([mk({ id: 'low', ai_property_confidence: 0.3 })]);
    expect(out.lowConfidence.map(d => d.id)).toEqual(['low']);
    expect(out.nullConfidence).toHaveLength(0);
  });

  it('partitions a mixed batch correctly', () => {
    const docs = [
      mk({ id: 'h1' }),
      mk({ id: 'n1', ai_property_confidence: null }),
      mk({ id: 'n2', ai_doc_type_confidence: null }),
      mk({ id: 'l1', ai_property_confidence: 0.2 }),
    ];
    const out = partitionReadyDocs(docs);
    expect(out.highConfidence.map(d => d.id)).toEqual(['h1']);
    expect(out.nullConfidence.map(d => d.id).sort()).toEqual(['n1', 'n2']);
    expect(out.lowConfidence.map(d => d.id)).toEqual(['l1']);
  });
});

describe('countUnreviewedAISuggestions (Inbox header chip)', () => {
  it('counts rows where AI suggested a property but the user has not confirmed', () => {
    const docs: InboxGateDoc[] = [
      mk({ id: '1', property_id: null, ai_suggested_property_id: 'p1' }),
      mk({ id: '2', property_id: 'p1', ai_suggested_property_id: 'p1' }), // confirmed
      mk({ id: '3', property_id: null, ai_suggested_property_id: null }), // no suggestion
      mk({ id: '4', property_id: null, ai_suggested_property_id: 'p2', ai_property_confidence: null }), // null-conf still counts
    ];
    expect(countUnreviewedAISuggestions(docs)).toBe(2);
    expect(isUnreviewedAISuggestion(docs[0])).toBe(true);
    expect(isUnreviewedAISuggestion(docs[1])).toBe(false);
    expect(isUnreviewedAISuggestion(docs[3])).toBe(true);
  });

  it('matches the expected query semantics for the 5 stuck rows scenario', () => {
    // Five docs, all with suggestions, none confirmed, all NULL confidence.
    const five = Array.from({ length: 5 }, (_, i) =>
      mk({ id: `stuck-${i}`, property_id: null, ai_property_confidence: null }),
    );
    expect(countUnreviewedAISuggestions(five)).toBe(5);
  });
});
