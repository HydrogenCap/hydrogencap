/**
 * Vocab guard: every value in DOC_TYPE_TO_V2_DOC_TYPE must satisfy the
 * `compliance_documents_v2_document_type_check` DB CHECK constraint.
 *
 * If this test fails, either:
 *   (a) the mapping was set to a value the DB rejects — fix the mapping, OR
 *   (b) the DB CHECK constraint changed — update V2_DOC_TYPE_ALLOWED to match
 *       the new constraint definition.
 */
import { describe, it, expect } from 'vitest';
import {
  DOC_TYPE_TO_V2_DOC_TYPE,
  V2_DOC_TYPE_ALLOWED,
  toV2DocumentType,
} from '@/hooks/useComplianceIntake';

describe('compliance vocab — DOC_TYPE_TO_V2_DOC_TYPE ↔ DB CHECK', () => {
  it('every mapped value is in the DB-allowed set', () => {
    const bad = Object.entries(DOC_TYPE_TO_V2_DOC_TYPE).filter(
      ([, v]) => !V2_DOC_TYPE_ALLOWED.has(v),
    );
    expect(bad).toEqual([]);
  });

  it('toV2DocumentType falls back to "other" for unknown slugs', () => {
    expect(toV2DocumentType('totally_made_up_type')).toBe('other');
  });

  it('toV2DocumentType maps the previously-silently-dropped slugs', () => {
    expect(toV2DocumentType('fire_suppression_certificate')).toBe('fire_alarm_cert');
    expect(toV2DocumentType('fire_door_certification')).toBe('fire_alarm_cert');
    expect(toV2DocumentType('fire_panel_commissioning')).toBe('fire_alarm_cert');
    expect(toV2DocumentType('planning_building_control')).toBe('building_regs_completion');
    expect(toV2DocumentType('public_liability_insurance')).toBe('landlord_liability_insurance');
    expect(toV2DocumentType('building_insurance')).toBe('buildings_insurance');
    expect(toV2DocumentType('epc_certificate')).toBe('epc');
    expect(toV2DocumentType('electrical_certificate')).toBe('eicr');
  });
});
