export type SectionKey =
  | 'lending'
  | 'investors'
  | 'distributions'
  | 'jobs'
  | 'voids'
  | 'capex';

export type SectionVisibility = Record<SectionKey, boolean>;

export const SECTION_LABELS: Record<SectionKey, string> = {
  lending: 'Lending',
  investors: 'Investors',
  distributions: 'Distributions',
  jobs: 'Jobs',
  voids: 'Voids',
  capex: 'CapEx',
};

export const SECTION_DESCRIPTIONS: Record<SectionKey, string> = {
  lending: 'Track loan facilities, LTV, interest, and lender contacts',
  investors: 'Manage investor records, equity split, and capital contributions',
  distributions: 'Log and schedule profit distributions to investors',
  jobs: 'Track maintenance jobs, contractors, and spend across properties',
  voids: 'Monitor vacant units, void duration, and financial impact',
  capex: 'Plan and track capital expenditure projects across the portfolio',
};

export const DEFAULT_SECTION_VISIBILITY: SectionVisibility = {
  lending: true,
  investors: true,
  distributions: true,
  jobs: true,
  voids: true,
  capex: true,
};

/** Maps section keys to their route prefixes */
export const SECTION_ROUTES: Record<SectionKey, string[]> = {
  lending: ['/lending'],
  investors: ['/investors'],
  distributions: ['/distributions'],
  jobs: ['/jobs'],
  voids: ['/voids'],
  capex: ['/capex'],
};

/** All section keys */
export const ALL_SECTION_KEYS: SectionKey[] = Object.keys(DEFAULT_SECTION_VISIBILITY) as SectionKey[];
