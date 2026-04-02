import { describe, it, expect } from 'vitest';
import {
  SEVERITY,
  CARD,
  TEXT,
  COMPLIANCE_SEVERITY,
  ACTION_SEVERITY,
  getSeverityClasses,
  type SeverityLevel,
} from '../design-tokens';

describe('SEVERITY tokens', () => {
  const levels: SeverityLevel[] = ['critical', 'warning', 'info', 'success', 'neutral'];

  it('defines all five severity levels', () => {
    for (const level of levels) {
      expect(SEVERITY[level]).toBeDefined();
    }
  });

  it('each level has bg, text, border, badge, and dot classes', () => {
    for (const level of levels) {
      const classes = SEVERITY[level];
      expect(classes.bg).toBeTruthy();
      expect(classes.text).toBeTruthy();
      expect(classes.border).toBeTruthy();
      expect(classes.badge).toBeTruthy();
      expect(classes.dot).toBeTruthy();
    }
  });

  it('critical uses red colours', () => {
    expect(SEVERITY.critical.dot).toContain('red');
    expect(SEVERITY.critical.bg).toContain('red');
  });

  it('warning uses amber colours', () => {
    expect(SEVERITY.warning.dot).toContain('amber');
  });

  it('success uses green colours', () => {
    expect(SEVERITY.success.dot).toContain('green');
  });

  it('info uses blue colours', () => {
    expect(SEVERITY.info.dot).toContain('blue');
  });
});

describe('getSeverityClasses', () => {
  it('returns the same object as direct lookup', () => {
    expect(getSeverityClasses('critical')).toBe(SEVERITY.critical);
    expect(getSeverityClasses('success')).toBe(SEVERITY.success);
  });
});

describe('COMPLIANCE_SEVERITY mapping', () => {
  it('maps expired to critical', () => {
    expect(COMPLIANCE_SEVERITY.expired).toBe('critical');
  });

  it('maps expiring to warning', () => {
    expect(COMPLIANCE_SEVERITY.expiring).toBe('warning');
  });

  it('maps valid to success', () => {
    expect(COMPLIANCE_SEVERITY.valid).toBe('success');
  });

  it('maps missing to critical', () => {
    expect(COMPLIANCE_SEVERITY.missing).toBe('critical');
  });

  it('maps not_applicable to neutral', () => {
    expect(COMPLIANCE_SEVERITY.not_applicable).toBe('neutral');
  });

  it('maps pending to info', () => {
    expect(COMPLIANCE_SEVERITY.pending).toBe('info');
  });
});

describe('ACTION_SEVERITY mapping', () => {
  it('maps critical to critical', () => {
    expect(ACTION_SEVERITY.critical).toBe('critical');
  });

  it('maps high to warning', () => {
    expect(ACTION_SEVERITY.high).toBe('warning');
  });

  it('maps medium to info', () => {
    expect(ACTION_SEVERITY.medium).toBe('info');
  });

  it('maps low to neutral', () => {
    expect(ACTION_SEVERITY.low).toBe('neutral');
  });
});

describe('CARD tokens', () => {
  it('has compact, standard, and spacious variants', () => {
    expect(CARD.compact).toContain('p-4');
    expect(CARD.standard).toContain('p-6');
    expect(CARD.spacious).toContain('p-8');
  });
});

describe('TEXT tokens', () => {
  it('defines common typography classes', () => {
    expect(TEXT.pageTitle).toContain('font-bold');
    expect(TEXT.sectionHeading).toContain('font-semibold');
    expect(TEXT.body).toContain('text-sm');
    expect(TEXT.label).toContain('text-xs');
  });
});
