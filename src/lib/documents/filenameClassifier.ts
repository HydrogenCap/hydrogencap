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
