/**
 * Filename heuristic classifier for the Bulk Document Scanner v2.
 *
 * Runs BEFORE the AI extraction to give the user a tentative document
 * category derived purely from the filename. The result is stored on
 * `documents.filename_category_hint` and surfaced in BulkReviewQueue
 * alongside the AI's `ai_suggested_doc_type`.
 *
 * Returned `category` values must be members of the documents.category
 * enum — DO NOT add new values here without a matching enum migration.
 */

export interface FilenameClassification {
  /** documents.category enum value, or null if no keyword matched. */
  category: string | null;
  /** 0..1 confidence based on keyword specificity. */
  confidence: number;
  /** Human-readable explanation (which keyword matched). */
  reason: string;
}

interface Rule {
  /** Keyword fragments — case-insensitive, matched against the normalised filename. */
  keywords: string[];
  category: string;
  /** Confidence ceiling for this rule. */
  confidence: number;
}

// Order matters: earlier, more specific rules win over generic ones.
// Confidence is a rough specificity heuristic (longer / more unique
// fragments → higher confidence).
const RULES: Rule[] = [
  {
    keywords: ['gas-cert', 'gas-safety', 'gascert', 'gassafety', 'cp12'],
    category: 'gas_safety_certificate',
    confidence: 0.92,
  },
  {
    keywords: ['eicr', 'electric'],
    category: 'electrical_certificate',
    confidence: 0.9,
  },
  {
    keywords: ['epc', 'energy-cert', 'energy-performance'],
    category: 'epc',
    confidence: 0.92,
  },
  {
    keywords: ['fire-risk', 'fra', 'fire-alarm', 'firealarm'],
    category: 'fire_alarm_certificate',
    confidence: 0.88,
  },
  { keywords: ['pat'], category: 'pat_certificate', confidence: 0.85 },
  {
    keywords: ['legionella', 'lra'],
    category: 'legionella_risk_assessment',
    confidence: 0.9,
  },
  {
    keywords: ['building-insurance', 'insurance'],
    category: 'building_insurance',
    confidence: 0.78,
  },
  {
    keywords: ['tenancy-agreement', 'ast'],
    category: 'tenancy_agreement',
    confidence: 0.88,
  },
  {
    keywords: ['inventory', 'check-in', 'checkin', 'check-out', 'checkout'],
    category: 'inventory',
    confidence: 0.85,
  },
  {
    keywords: ['hmo-licence', 'hmo-license', 'hmolicence', 'hmolicense'],
    category: 'hmo_licence',
    confidence: 0.95,
  },
  {
    keywords: ['home-buyer', 'homebuyer', 'survey'],
    category: 'property_survey',
    confidence: 0.8,
  },
  { keywords: ['valuation'], category: 'valuation_report', confidence: 0.85 },
  {
    keywords: ['floor-plan', 'floorplan'],
    category: 'floorplan',
    confidence: 0.92,
  },
];

/**
 * Normalise the filename to make matching robust:
 *  - strip extension
 *  - lowercase
 *  - collapse spaces / underscores into single dashes so "gas safety", "gas_safety"
 *    and "gas-safety" all match the same fragment.
 */
function normalise(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  return base
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

export function classifyFilename(filename: string): FilenameClassification {
  if (!filename) {
    return { category: null, confidence: 0, reason: 'empty filename' };
  }
  const norm = normalise(filename);

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (norm.includes(kw)) {
        return {
          category: rule.category,
          confidence: rule.confidence,
          reason: `matched keyword "${kw}"`,
        };
      }
    }
  }

  return { category: null, confidence: 0, reason: 'no keyword matched' };
}

/**
 * Best-effort ISO date (YYYY-MM-DD) extracted from a filename.
 * Recognised patterns (case-insensitive):
 *   - 2025-03-15, 2025_03_15, 2025.03.15
 *   - 15-03-2025, 15/03/2025  (UK day-first)
 *   - 15-Mar-2025, 15Mar2025
 *   - Mar-2025 → 2025-03-01 (month-precision fallback)
 *
 * Returns null if no plausible date is found, or if the parsed date is
 * outside a sensible window (1990–2100) to avoid matching reference numbers.
 */
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function withinRange(y: number): boolean {
  return y >= 1990 && y <= 2100;
}

export function extractDateFromFilename(filename: string): string | null {
  if (!filename) return null;
  const base = filename.replace(/\.[^.]+$/, '');

  // ISO-like: 2025-03-15 / 2025_03_15 / 2025.03.15
  const iso = base.match(/(20\d{2}|19\d{2})[-_.](1[0-2]|0?[1-9])[-_.](3[01]|[12]\d|0?[1-9])/);
  if (iso) {
    const y = +iso[1], m = +iso[2], d = +iso[3];
    if (withinRange(y)) return `${y}-${pad(m)}-${pad(d)}`;
  }

  // Day-first: 15-03-2025 / 15/03/2025 / 15.03.2025
  const dmy = base.match(/(3[01]|[12]\d|0?[1-9])[-/.](1[0-2]|0?[1-9])[-/.](20\d{2}|19\d{2})/);
  if (dmy) {
    const d = +dmy[1], m = +dmy[2], y = +dmy[3];
    if (withinRange(y)) return `${y}-${pad(m)}-${pad(d)}`;
  }

  // Day-month-year with month name: 15-Mar-2025, 15Mar2025, 15 Mar 2025
  const dMonY = base.match(/(3[01]|[12]\d|0?[1-9])[-_ ]?([A-Za-z]{3,4})[-_ ]?(20\d{2}|19\d{2})/);
  if (dMonY) {
    const d = +dMonY[1];
    const m = MONTHS[dMonY[2].toLowerCase()];
    const y = +dMonY[3];
    if (m && withinRange(y)) return `${y}-${pad(m)}-${pad(d)}`;
  }

  // Month-year only: Mar-2025, March 2025 → assume the 1st.
  const monY = base.match(/\b([A-Za-z]{3,9})[-_ ](20\d{2}|19\d{2})\b/);
  if (monY) {
    const m = MONTHS[monY[1].slice(0, 3).toLowerCase()];
    const y = +monY[2];
    if (m && withinRange(y)) return `${y}-${pad(m)}-01`;
  }

  return null;
}

