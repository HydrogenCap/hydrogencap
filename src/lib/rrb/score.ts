/**
 * Renters' Rights Bill (RRB) readiness scorer.
 *
 * Pure function — no IO, no React. Each sub-score is out of 20, total = sum (max 100).
 */

export interface RRBTenancyInput {
  id: string;
  status?: string;
  agreement_text?: string | null;
  deposit_protection_scheme?: string | null;
  deposit_protection_id?: string | null;
}

export interface RRBRentEntry {
  tenancy_id: string;
  due_date: string; // ISO
  rent_amount: number;
}

export interface RRBComplianceCert {
  /** one of 'gas' | 'eicr' | 'epc' | 'fire_alarm' (case-insensitive accepted) */
  type: string;
  expiry_date?: string | null; // ISO; if null treated as no expiry / unknown
}

export interface RRBHmoInput {
  is_hmo: boolean;
  has_active_licence?: boolean;
  licence_type_matches?: boolean;
}

export interface RRBScoreInput {
  propertyId?: string;
  tenancies: RRBTenancyInput[];
  rentSchedule: RRBRentEntry[];
  compliance: RRBComplianceCert[];
  hmo: RRBHmoInput;
  /** Date used for "now" — defaults to new Date(). Useful for deterministic tests. */
  now?: Date;
}

export interface RRBSubScores {
  tenancyTerms: number;
  depositProtection: number;
  rentIncreases: number;
  complianceCerts: number;
  hmoLicence: number;
}

export interface RRBScoreResult {
  total: number;
  subScores: RRBSubScores;
  missingData: string[];
}

const REQUIRED_CERTS = ['gas', 'eicr', 'epc', 'fire_alarm'] as const;
type RequiredCert = (typeof REQUIRED_CERTS)[number];

/** Returns true when text uses fixed-term language WITHOUT a nearby break clause. */
function isFixedTermWithoutBreak(text: string | null | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  const fixedRe = /fixed[\s-]term/g;
  if (!fixedRe.test(lower)) return false;
  // If "break" appears anywhere we treat as having a break clause.
  return !/break/.test(lower);
}

function normaliseCertType(t: string): RequiredCert | null {
  const k = t.toLowerCase().replace(/[\s-]/g, '_');
  if (k.includes('gas')) return 'gas';
  if (k.includes('eicr') || k.includes('electric')) return 'eicr';
  if (k.includes('epc') || k.includes('energy')) return 'epc';
  if (k.includes('fire') || k.includes('alarm')) return 'fire_alarm';
  return null;
}

export function computeRRBScore(input: RRBScoreInput): RRBScoreResult {
  const now = input.now ?? new Date();
  const missingData: string[] = [];

  const activeTenancies = input.tenancies.filter(
    (t) => !t.status || ['active', 'live', 'current'].includes(t.status.toLowerCase()),
  );

  // 1. Tenancy terms (0–20). Proportional credit for tenancies that are NOT fixed-term-without-break.
  let tenancyTerms = 20;
  if (activeTenancies.length > 0) {
    const passing = activeTenancies.filter((t) => !isFixedTermWithoutBreak(t.agreement_text)).length;
    tenancyTerms = Math.round((passing / activeTenancies.length) * 20);
    if (passing < activeTenancies.length) {
      missingData.push(
        `tenancy terms: ${activeTenancies.length - passing} fixed-term tenancy/ies without break clause`,
      );
    }
  }

  // 2. Deposit protection (0 or 20).
  let depositProtection = 20;
  if (activeTenancies.length > 0) {
    const offenders = activeTenancies.filter(
      (t) => !t.deposit_protection_scheme || !t.deposit_protection_id,
    );
    if (offenders.length > 0) {
      depositProtection = 0;
      for (const o of offenders) {
        missingData.push(`missing deposit protection: tenancy ${o.id}`);
      }
    }
  }

  // 3. Rent increases (0/10/20). Two increases for the same tenancy within 12 months → 0.
  let rentIncreases = 20;
  const byTenancy = new Map<string, RRBRentEntry[]>();
  for (const r of input.rentSchedule) {
    const arr = byTenancy.get(r.tenancy_id) ?? [];
    arr.push(r);
    byTenancy.set(r.tenancy_id, arr);
  }

  let earliest: number | null = null;
  let latest: number | null = null;
  let doubleIncrease = false;

  for (const entries of byTenancy.values()) {
    const sorted = [...entries].sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
    );
    for (let i = 0; i < sorted.length; i++) {
      const ts = new Date(sorted[i].due_date).getTime();
      if (earliest === null || ts < earliest) earliest = ts;
      if (latest === null || ts > latest) latest = ts;
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].rent_amount === sorted[i].rent_amount) continue;
        const diffDays = Math.abs(
          (new Date(sorted[j].due_date).getTime() - new Date(sorted[i].due_date).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (diffDays < 365) {
          doubleIncrease = true;
          break;
        }
      }
      if (doubleIncrease) break;
    }
    if (doubleIncrease) break;
  }

  if (doubleIncrease) {
    rentIncreases = 0;
    missingData.push('rent increased more than once within 12 months');
  } else if (earliest === null || latest === null || latest - earliest < 365 * 24 * 60 * 60 * 1000) {
    rentIncreases = 10;
    missingData.push('insufficient rent history');
  }

  // 4. Compliance certs (0–20, 5 per cert).
  let complianceCerts = 0;
  const presentByType = new Map<RequiredCert, RRBComplianceCert[]>();
  for (const c of input.compliance) {
    const k = normaliseCertType(c.type);
    if (!k) continue;
    const arr = presentByType.get(k) ?? [];
    arr.push(c);
    presentByType.set(k, arr);
  }
  for (const cert of REQUIRED_CERTS) {
    const found = presentByType.get(cert) ?? [];
    const valid = found.some((c) => !c.expiry_date || new Date(c.expiry_date) >= now);
    if (valid) {
      complianceCerts += 5;
    } else if (found.length === 0) {
      missingData.push(`missing compliance certificate: ${cert}`);
    } else {
      missingData.push(`expired compliance certificate: ${cert}`);
    }
  }

  // 5. HMO licence (0 or 20).
  let hmoLicence = 20;
  if (input.hmo.is_hmo) {
    const ok = !!input.hmo.has_active_licence && input.hmo.licence_type_matches !== false;
    if (!ok) {
      hmoLicence = 0;
      missingData.push('missing HMO licence');
    }
  }

  const subScores: RRBSubScores = {
    tenancyTerms,
    depositProtection,
    rentIncreases,
    complianceCerts,
    hmoLicence,
  };
  const total =
    subScores.tenancyTerms +
    subScores.depositProtection +
    subScores.rentIncreases +
    subScores.complianceCerts +
    subScores.hmoLicence;

  return { total, subScores, missingData };
}
