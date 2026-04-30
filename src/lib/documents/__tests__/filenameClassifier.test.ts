import { describe, it, expect } from 'vitest';
import { classifyFilename } from '../filenameClassifier';

describe('classifyFilename', () => {
  it('matches gas safety / CP12 variants', () => {
    expect(classifyFilename('CP12_2025.pdf').category).toBe('gas_safety_certificate');
    expect(classifyFilename('gas safety cert.pdf').category).toBe('gas_safety_certificate');
    expect(classifyFilename('gas-cert-flat-3.jpg').category).toBe('gas_safety_certificate');
  });

  it('matches EICR / electrical', () => {
    expect(classifyFilename('EICR_2024.pdf').category).toBe('electrical_certificate');
    expect(classifyFilename('electric_test.pdf').category).toBe('electrical_certificate');
  });

  it('matches EPC and HMO licence with high confidence', () => {
    const epc = classifyFilename('EPC-flat-2.pdf');
    expect(epc.category).toBe('epc');
    expect(epc.confidence).toBeGreaterThan(0.9);

    const hmo = classifyFilename('HMO Licence Banbury.pdf');
    expect(hmo.category).toBe('hmo_licence');
    expect(hmo.confidence).toBeGreaterThan(0.9);
  });

  it('matches insurance, valuation, floorplan, survey', () => {
    expect(classifyFilename('building-insurance-2026.pdf').category).toBe('building_insurance');
    expect(classifyFilename('Valuation_Report.pdf').category).toBe('valuation_report');
    expect(classifyFilename('Ground_Floor_Plan.pdf').category).toBe('floorplan');
    expect(classifyFilename('homebuyer survey.pdf').category).toBe('property_survey');
  });

  it('matches tenancy / inventory / fire / PAT / legionella', () => {
    expect(classifyFilename('AST_signed.pdf').category).toBe('tenancy_agreement');
    expect(classifyFilename('inventory_check-in.pdf').category).toBe('inventory');
    expect(classifyFilename('Fire Risk Assessment.pdf').category).toBe('fire_alarm_certificate');
    expect(classifyFilename('PAT_2025.pdf').category).toBe('pat_certificate');
    expect(classifyFilename('LRA_water.pdf').category).toBe('legionella_risk_assessment');
  });

  it('returns null on unknown filenames', () => {
    const result = classifyFilename('IMG_2034.jpg');
    expect(result.category).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('handles empty filename gracefully', () => {
    expect(classifyFilename('').category).toBeNull();
  });
});
