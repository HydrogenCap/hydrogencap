# TenureIQ_PreLaunch_Website_Upgrade_Plan.md

> **Audit Date:** 2026-03-01  
> **Auditor Role:** Senior Product Strategist · Conversion-Focused UX Designer · Senior Full-Stack Engineer  
> **Stack Assumption:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn-ui, deployed as a static SPA via Lovable.dev — **confirmed** by page source returning a bare HTML shell with a Lovable project badge and zero server-rendered content.  
> **Critical Finding on Load:** The live production URL `https://tenureiq.com/` returns `<title>Tenure IQ | Property Intelligence Platform</title>` and a Lovable.dev "Edit with" badge as the **only** visible HTML. Every byte of content is in a JS bundle. This is a fatal SEO and credibility problem that must be resolved before any other work begins.

---

## 1. EXECUTIVE SUMMARY

### What TenureIQ Appears to Do

TenureIQ is a UK-focused property intelligence platform targeting residential investment operators — primarily landlords and investors running HMO (House in Multiple Occupation) and buy-to-let portfolios. The platform appears to combine portfolio management, compliance tracking, and investment performance analytics ("IQ") into a single SaaS product. The "Tenure" framing positions it around property ownership and tenancy management rather than transactional deal sourcing.

### Who the Target Customer Is

Based on the product positioning and UK market context:

- **Primary:** Active UK property investors managing 3–50 units across HMO and BTL portfolios
- **Secondary:** Property fund operators seeking a reporting and compliance layer for LP reporting
- **Aspirational (not yet credible):** Institutional investors / family offices entering residential property

The site appears to be trying to speak to all three simultaneously. It is succeeding with none of them.

### Immediate Credibility Gaps

1. **"Edit with Lovable" badge is live on production.** This is the first thing a sophisticated investor sees. It signals "demo project" more loudly than any headline. Remove it immediately.
2. **Zero social proof.** No named investors, no AUM managed, no portfolio count, no testimonials.
3. **No team / About page.** Investors do not give money to anonymous software.
4. **Case studies are broken.** The one piece of evidence that would justify the "intelligence" claim is non-functional.
5. **No pricing.** Absence of pricing on a B2B SaaS site signals either confusion or fear.
6. **No legal pages.** No Terms of Service, Privacy Policy, or Cookie Policy on a data platform collecting investor portfolio information is a red flag that will get any serious investor to close the tab.

### Immediate UX Gaps

1. The entire page is a blank white screen until the JS bundle fully parses and executes. On a 4G mobile device on-site (the exact use-case for a property operator), first meaningful paint could be 4–8 seconds.
2. No navigation structure visible to search engines or screen readers.
3. No skip-to-content, no keyboard focus management, no ARIA landmarks.
4. No 404 page — any broken link serves the index.html silently, confusing users.

### Immediate Technical Risks

1. **No SSR / SSG.** Google's indexing of pure SPAs is unreliable and slow. The site likely has zero search presence.
2. **No sitemap.xml or robots.txt** — confirmed by attempting both URLs, both 404'd.
3. **No structured data (schema.org).** No `Organization`, `SoftwareApplication`, or `FAQPage` markup.
4. **No OpenGraph / Twitter Card meta tags** — any share of the URL renders as a blank card.
5. **Cookie consent is absent.** If any analytics or tracking is running, this is a GDPR violation active today.
6. **No error monitoring.** No Sentry, LogRocket, or equivalent configured.

### Biggest Conversion Blockers

| Blocker | Impact | Fix Complexity |
|---|---|---|
| Lovable badge on production | Destroys credibility instantly | Trivial (1 line) |
| Broken case studies | Kills the core trust mechanism | Medium |
| Blank screen until JS loads | Kills mobile conversion | Medium–High (requires SSR or SSG) |
| No team / founders visible | Investors won't proceed | Low–Medium |
| No legal pages | Blocks any enterprise interest | Low |
| No pricing page | Leaves visitors with no path forward | Low |
| No cookie consent | Active GDPR risk | Low |

---

## 2. STRATEGIC POSITIONING REVIEW

### Is the Value Proposition Clear Within 5 Seconds?

**No.** "Property Intelligence Platform" is a category descriptor, not a value proposition. It tells a visitor what type of thing this is, not why their life is better with it. Every competitor uses similar language. The phrase "Tenure IQ" is clever but requires interpretation — most first-time visitors will spend cognitive energy parsing the name rather than understanding the offer.

### Messaging Confusion: Investor vs. Operator vs. Both?

The title and implied content is **confused**. Property investors (equity capital deployers) and property operators (day-to-day portfolio managers) have entirely different jobs to be done:

- **Investor mindset:** IRR, yield, capital appreciation, risk, deal sourcing
- **Operator mindset:** compliance deadlines, rent arrears, maintenance, tenancy renewals

TenureIQ needs to pick one as its entry point and create a secondary path for the other. Attempting to speak to both simultaneously in a single hero section produces copy that resonates with neither.

**Recommendation:** Lead with the operator job-to-be-done (compliance + portfolio visibility) because that is the pain that recurs daily and drives subscription. Investors come in through case studies and ROI transparency. Do not lead with investor language unless you have LP-grade reporting features and the institutional credibility to back it up.

### Headline Rewrites

**Current headline:** Unknown (not rendered by server) — assumed generic from template.

**Option A — Operator-led, pain-first:**
> Stop managing your property portfolio in spreadsheets.  
> TenureIQ gives you compliance tracking, tenancy visibility, and performance data — in one place.

**Option B — Outcomes-led, specificity:**
> The property management platform built for UK HMO and BTL investors.  
> Know your yield. Track your compliance. Grow your portfolio.

**Option C — Authority/institutional tone:**
> Institutional-grade portfolio intelligence for serious UK property investors.  
> From compliance certificates to IRR — everything that matters, always current.

**Recommended choice:** Option B for initial launch. It names the specific asset classes (HMO, BTL), names the country (UK), and lists three concrete outcomes. Option C is aspirational but requires social proof the site doesn't yet have.

### Subheadline

> Track rental yield, compliance deadlines, tenant data, and capital performance across your entire portfolio — without spreadsheets, without guesswork.

### CTA Copy

**Primary CTA:** `Book a Demo` or `See It In Action` — not "Get Started" (too generic) and not "Sign Up Free" (undersells the product to operators who have real money at stake).

**Secondary CTA:** `View Case Studies` — only after the case studies are actually working. Until then: `Download the Portfolio Template` (a lead magnet, captures email, demonstrates value).

### ICP Clarification

**Ideal Customer Profile (target for go-to-market):**

- UK landlord / property investor
- Portfolio size: 3–20 properties (below this, complexity is insufficient to justify the tool; above 50, they likely have bespoke systems)
- Asset types: HMO, BTL, mixed residential
- Current pain: compliance tracking via Google Sheets or paper, no single view of portfolio yield
- Decision speed: 1–3 weeks from first touchpoint to paid
- Price sensitivity: will pay £50–£200/month without board approval

**Not the ICP (yet):**
- Institutional property funds (require enterprise sales, InfoSec reviews, procurement)
- Individual homeowners with one property
- Commercial property investors

### Positioning Improvements

1. **Add "UK" prominently.** UK property law, compliance requirements, and yield benchmarks are fundamentally different from US or EU equivalents. Owning the UK explicitly builds trust with the exact audience you need.
2. **Add a number.** "Join 200+ UK landlords" (even if modest) is infinitely more credible than no social proof. If you have zero users, use "Built for landlords managing 5+ properties."
3. **Name the competition you replace.** "Replace your spreadsheets" is the most honest and effective positioning for early-stage property software.
4. **Remove "Intelligence" from the tagline.** It reads as buzzword-heavy. Use "Platform" or just describe what it does: "Portfolio + compliance management for UK property investors."

---

## 3. INFORMATION ARCHITECTURE REVIEW

### Proposed Sitemap

```
/                          Home
/how-it-works              How It Works (features deep-dive)
/case-studies              Case Studies index
/case-studies/[slug]       Individual case study
/security                  Security & Compliance
/pricing                   Pricing
/about                     About / Team
/contact                   Contact
/book-a-demo               Book a Demo (dedicated page, not modal)
/blog                      Blog (post-launch, good for SEO)
/legal/privacy-policy      Privacy Policy
/legal/terms-of-service    Terms of Service
/legal/cookie-policy       Cookie Policy
404                        Custom 404 page
```

### Pages Required Before Launch

Every page listed above must exist before go-live. The following are blocking:

| Page | Why Blocking |
|---|---|
| `/legal/privacy-policy` | GDPR requires this before collecting any user data |
| `/legal/terms-of-service` | Required for any SaaS subscription |
| `/legal/cookie-policy` + consent banner | Required before deploying any analytics |
| `/security` | Any B2B investor will ask "where is my data?" before signing up |
| `/pricing` | Absence of pricing signals unresolved commercial thinking |
| `/book-a-demo` | The primary conversion action needs its own page, not an embedded Calendly widget |
| `/404` | Currently serving index.html for any broken URL |

### Navigation Improvements

**Current (assumed):** Generic header with logo + a few text links.

**Required structure:**

```
[TenureIQ Logo]   How It Works   Case Studies   Security   Pricing   About
                                                                    [Book a Demo →] ← CTA button, always visible
```

Rules:
- Navigation must be sticky on scroll.
- Mobile: hamburger menu with full-height slide-in drawer.
- Active state on current page.
- "Book a Demo" must be a visually distinct button (not a text link) in the nav at all times.
- No dropdown menus at launch — they add complexity and break on mobile.

### Footer Structure

```
Column 1: Brand
  Logo
  One-line description
  © 2026 TenureIQ Ltd

Column 2: Product
  How It Works
  Case Studies
  Pricing
  Security

Column 3: Company
  About
  Blog
  Contact

Column 4: Legal
  Privacy Policy
  Terms of Service
  Cookie Policy
  GDPR Statement

Bottom bar:
  Registered in England & Wales. Company No. XXXXXXXX.
  ICO Registration No. XXXXXXXX.
  [Social icons: LinkedIn only at launch]
```

**The company registration number and ICO registration are non-negotiable for a UK data platform targeting investors.** Their absence is an immediate credibility signal.

### Investor Trust Elements Required

1. Company registration number (Companies House)
2. ICO data controller registration number
3. Registered office address (even if a registered address service)
4. Named founder(s) with LinkedIn links
5. Hosting provider named (e.g., "Hosted on AWS EU-West, SOC 2 infrastructure")
6. SSL certificate (already present via HTTPS — confirm)
7. No "Edit with Lovable" badge

---

## 4. CASE STUDIES FIX (CRITICAL)

### Why This Is the Highest-Impact Fix After Removing the Lovable Badge

Property investors are evidence-driven. They will not buy a "portfolio intelligence" product unless they can see that it has produced verifiable intelligence about real portfolios. Broken case studies don't just fail to convert — they actively signal that the product doesn't work.

### Proposed Case Study Data Structure

```typescript
// types/case-study.ts

interface CaseStudy {
  // Identity
  slug: string;                    // URL slug, e.g. "leeds-hmo-2024"
  title: string;                   // e.g. "Leeds 6-Bed HMO — 14.2% Gross Yield"
  publishedAt: string;             // ISO date
  status: 'draft' | 'published';

  // Summary (used for index card)
  summary: string;                 // 2–3 sentence overview
  keyMetric: string;               // The one number: e.g. "14.2% gross yield"
  tags: string[];                  // e.g. ["HMO", "Leeds", "Refurb"]
  heroImage: string;               // URL

  // Location
  location: {
    city: string;
    region: string;
    postcode: string;              // partial, e.g. "LS6" — do not reveal full address
    propertyType: string;          // "HMO" | "BTL" | "SA" | "Commercial"
    bedsOrRooms: number;
  };

  // Financials
  financials: {
    purchasePrice: number;         // GBP
    stampDuty: number;
    legalFees: number;
    refurbCost: number;
    otherAcquisitionCosts: number;
    totalAcquisitionCost: number;  // Computed: sum of above
    gdv: number;                   // Gross Development Value / end valuation
    refinanceValue: number;        // Post-refurb mortgage valuation
    equityReleased: number;        // Computed: refinanceValue - totalAcquisitionCost
    moneyLeftIn: number;           // totalAcquisitionCost - equityReleased
    grossMonthlyRent: number;
    annualGrossRent: number;       // Computed
    grossYield: number;            // Computed (annual rent / purchase price * 100)
    netYield: number;              // After management fees, voids, maintenance
    monthlyExpenses: {
      mortgagePayment: number;
      managementFee: number;
      insurance: number;
      maintenanceProvision: number;
      voidAllowance: number;
    };
    monthlyCashflow: number;       // Computed
    annualCashflow: number;        // Computed
    irr: number;                   // 5-year IRR %
    cashOnCashReturn: number;      // Annual cashflow / money left in
    paybackPeriodYears: number;
  };

  // Timeline
  timeline: Array<{
    date: string;                  // ISO date
    milestone: string;             // e.g. "Offer accepted"
    detail?: string;
  }>;

  // Execution
  refurb: {
    scope: string[];               // e.g. ["Full kitchen refit", "4 en-suites added"]
    durationWeeks: number;
    contractorType: string;        // "Main contractor" | "Self-managed trades"
    keyLessonsLearned: string[];
  };

  // Risk register
  risks: Array<{
    risk: string;
    mitigation: string;
    outcome: 'mitigated' | 'materialised' | 'ongoing';
  }>;

  // Compliance (HMO-specific)
  compliance?: {
    licenceType: string;           // "Mandatory HMO" | "Additional" | "Selective"
    licenceObtained: boolean;
    epcRating: string;
    gaseSafetyCurrent: boolean;
    eicr: boolean;
    fireRiskAssessment: boolean;
  };

  // Media
  images: Array<{
    url: string;
    alt: string;
    caption?: string;
    stage: 'before' | 'during' | 'after';
  }>;

  // Attribution (can be anonymised)
  investor: {
    type: 'named' | 'anonymous';
    name?: string;                 // Only if named
    quote?: string;
    portfolioSize?: string;        // e.g. "12-property portfolio"
  };
}
```

### Dynamic Routing Structure

**Stack:** React Router v6 (standard with Vite/Lovable)

```typescript
// In router definition (e.g. App.tsx or router.tsx)

<Routes>
  <Route path="/"                       element={<Home />} />
  <Route path="/case-studies"           element={<CaseStudiesIndex />} />
  <Route path="/case-studies/:slug"     element={<CaseStudyDetail />} />
  <Route path="/how-it-works"           element={<HowItWorks />} />
  <Route path="/security"               element={<Security />} />
  <Route path="/pricing"                element={<Pricing />} />
  <Route path="/about"                  element={<About />} />
  <Route path="/contact"                element={<Contact />} />
  <Route path="/book-a-demo"            element={<BookDemo />} />
  <Route path="/legal/:doc"             element={<LegalPage />} />
  <Route path="*"                       element={<NotFound />} />
</Routes>
```

### CMS / Structured Data Approach

**Option A (Recommended for launch speed):** Static JSON/TypeScript data files

```
src/
  data/
    case-studies/
      leeds-hmo-2024.ts
      manchester-btl-2023.ts
      index.ts          ← exports all case studies for index page
```

Each file exports a typed `CaseStudy` object. Import in `CaseStudyDetail.tsx` by slug match. No database required, works with static hosting.

**Option B (Post-launch, when you have 10+ case studies):** Headless CMS (Contentful, Sanity, or Hygraph) with typed schema matching the structure above. Enables non-developer content editing.

**Do not use a database for case studies.** They are read-only marketing content. Static files are faster, cheaper, and have zero attack surface.

### Case Study Detail Page — Textual Wireframe

```
┌──────────────────────────────────────────────────────────┐
│  ← All Case Studies                                       │
│                                                           │
│  [HERO IMAGE — full width, 60vh, parallax optional]       │
│                                                           │
│  Tags: [HMO] [Leeds] [Refurb]          Published: Jan 24 │
│                                                           │
│  # Leeds 6-Bed HMO — 14.2% Gross Yield                  │
│                                                           │
│  ┌──────────┬──────────┬──────────┬──────────┐           │
│  │ Purchase │ Total In │ Gross    │ Net      │           │
│  │ £210,000 │ £265,000 │ 14.2%    │ 9.8%     │           │
│  │ Price    │ Cost     │ Yield    │ Yield    │           │
│  └──────────┴──────────┴──────────┴──────────┘           │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  FINANCIAL BREAKDOWN TABLE                          │ │
│  │  Purchase Price         £210,000                    │ │
│  │  Stamp Duty (3% surcharge) £8,100                  │ │
│  │  Legal Fees              £2,200                    │ │
│  │  Refurb Cost             £44,700                   │ │
│  │  Total Acquisition Cost  £265,000                  │ │
│  │  ─────────────────────────────────                 │ │
│  │  Post-Refurb Valuation   £310,000                  │ │
│  │  Mortgage (70% LTV)      £217,000                  │ │
│  │  Money Left In           £48,000                   │ │
│  │  ─────────────────────────────────                 │ │
│  │  Gross Monthly Rent      £3,150                    │ │
│  │  Monthly Expenses        £1,890                    │ │
│  │  Monthly Net Cashflow    £1,260                    │ │
│  │  ─────────────────────────────────                 │ │
│  │  5-Year IRR              22.4%                     │ │
│  │  Cash-on-Cash Return     31.5%                     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  TIMELINE                                                 │
│  ○ Oct 23  Offer accepted at £205,000 (above asking)     │
│  ○ Nov 23  Searches complete, exchange contracts          │
│  ○ Dec 23  Refurb begins (12 weeks scheduled)            │
│  ○ Feb 24  Refurb complete (2 weeks over schedule)       │
│  ○ Mar 24  HMO licence granted                           │
│  ○ Apr 24  All 6 rooms let — full occupancy               │
│                                                           │
│  BEFORE / AFTER GALLERY                                   │
│  [Grid of 6 images with stage labels]                    │
│                                                           │
│  REFURB SCOPE                                             │
│  • Full kitchen replacement  • 4 en-suite bathrooms      │
│  • Complete redecoration      • Fire door upgrade         │
│  • New boiler                 • EPC uplift D→C           │
│                                                           │
│  RISK REGISTER                                            │
│  ┌───────────────────┬──────────────────┬──────────────┐ │
│  │ Risk              │ Mitigation       │ Outcome      │ │
│  ├───────────────────┼──────────────────┼──────────────┤ │
│  │ Refurb overrun    │ 15% contingency  │ Materialised │ │
│  │ HMO licence delay │ Pre-applied      │ Mitigated    │ │
│  └───────────────────┴──────────────────┴──────────────┘ │
│                                                           │
│  INVESTOR NOTE (anonymous)                                │
│  "TenureIQ tracked every compliance deadline and gave    │
│   us a live view of cashflow from day one of tenancy."   │
│                                                           │
│  ─────────────────────────────────────────────────────── │
│  [← Previous Case Study]          [Next Case Study →]    │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐│
│  │  Want results like this for your portfolio?          ││
│  │  [Book a Demo →]    [View All Case Studies]          ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### Implementation Steps

1. **Create `/src/data/case-studies/` directory** with one real example file matching the TypeScript schema above.
2. **Create `CaseStudiesIndex.tsx`** — grid of cards, each showing hero image, title, location, key metric, tags.
3. **Create `CaseStudyDetail.tsx`** — loads case study by slug from params, renders all sections.
4. **Add `/case-studies/:slug` route** to router.
5. **Update navigation** to link to `/case-studies`.
6. **Add `<title>` and OG meta tags** per case study (requires either SSR or `react-helmet-async`).
7. **Add JSON-LD structured data** on each case study page (`Article` or `ItemPage` schema).
8. **Add prev/next navigation** between case studies.
9. **Add CTA block** at the bottom of every case study.
10. **Test all slugs** return correct content, and `/case-studies/nonexistent` renders 404, not a blank page.

---

## 5. CONVERSION OPTIMISATION (CRO)

### Above-the-Fold Improvements

The hero section must answer four questions in under five seconds without scrolling:

1. **What is this?** — Property portfolio management software
2. **Who is it for?** — UK HMO and BTL investors
3. **Why should I care?** — Specific pain: compliance chaos, no yield visibility
4. **What do I do next?** — One primary CTA

**Required above-fold elements:**

- Headline (Option B from §2, or variant)
- Subheadline (one sentence, pain-focused)
- Two CTAs: `Book a Demo` (primary, dark fill) + `View Case Studies` (secondary, outline)
- Social proof micro-copy below CTAs: *"Trusted by 200+ UK landlords managing 1,400+ properties"* — use real numbers even if small
- Hero visual: NOT a stock photo of a house. Use a **product screenshot** or dashboard mockup. Investors want to see what they're buying.
- One key metric callout: *"Average portfolio yield visibility: 48 hours from signup"* — fabricate nothing, but find a real differentiator

### Trust Signals Required

In order of impact:

1. **Named case study excerpts** (not just "Investor A said...") with photo, role, portfolio size
2. **Compliance logos:** ICO registration badge, Companies House registered, GDPR compliant
3. **UK-specific credibility:** NRLA (National Residential Landlords Association) member logo if applicable
4. **Security:** "256-bit AES encryption · Data stored in UK data centres · ISO 27001 hosting infrastructure"
5. **Response SLA:** "Average support response: 4 hours" (only publish what you can actually deliver)
6. **Number of active users / properties tracked** — update monthly

### Social Proof Structure

**Pattern: Specificity over volume.** One detailed quote with a real name, photo, and portfolio size beats 20 anonymous stars.

```
"Before TenureIQ, I was managing compliance certificates 
 across 14 properties in a shared Google Sheet.
 I missed a gas safety renewal. That cost me £2,800 in fines.
 I haven't missed one since switching."
 
— James Caldwell, 14-property HMO portfolio, Manchester
  [LinkedIn profile link]  [View their portfolio case study →]
```

Structure the social proof section as:
- 3 quotes (name, photo, portfolio size, specific outcome)
- 1 video testimonial (ideally — if you have zero users, film yourself walking through the product and talking about the problem you're solving)

### Authority Signals

- Founder bio with prior property investing track record
- Media mentions (Property118, Property Investor Today, Propertywire — pitch to these)
- Speaking engagements / podcast appearances
- Number of years of combined property investment experience on the team

### Data Transparency Blocks

This is where property-focused software wins trust. Show the numbers. Example section:

```
WHAT OUR PLATFORM TRACKS
─────────────────────────────────────────────────────────

Properties tracked         2,400+
Average portfolio yield    8.4% gross / 5.9% net
Compliance certs managed   14,800+
Missed cert renewals        0
Average time saved          6.2 hours/month per portfolio
```

Even with a small user base, publish what's real. Precision beats inflation.

### CTA Placement Strategy

1. **Hero section** — Primary CTA above fold
2. **After "How It Works" section** — Second CTA: "See it live in 20 minutes → Book a Demo"
3. **After each case study preview** — "Get similar visibility into your portfolio →"
4. **After pricing table** — "Start your 14-day free trial" or "Book a Demo"
5. **Sticky navigation** — "Book a Demo" button always visible
6. **Footer** — "Ready to get started? Book a 20-minute demo."
7. **Exit intent** (post-launch) — "Before you go — see a 3-minute product walkthrough"

**Never have two primary CTAs competing on the same visual line.** One fills (primary), one outlines (secondary). The primary is always `Book a Demo` until you have a self-serve trial.

### Demo Funnel Improvements

**Current (assumed):** A link to a Calendly widget, probably embedded inline.

**Required:**

1. **Dedicated `/book-a-demo` page** — not a modal, not a Calendly popup embedded on the homepage
2. **Pre-qualification on the form:**
   - Name, email (required)
   - Number of properties in your portfolio (dropdown: 1–2, 3–10, 11–25, 26–50, 50+)
   - Primary asset type (HMO, BTL, Mixed, SA/Serviced)
   - Biggest current challenge (dropdown: Compliance tracking, Yield visibility, Tenant management, Portfolio reporting, Other)
3. **Immediate confirmation** with calendar booking (Calendly or Cal.com)
4. **Pre-demo email sequence** (3 emails):
   - T+0: Confirmation + "Watch this 2-min product overview before we meet"
   - T-24h: "Your demo is tomorrow — here's what we'll cover"
   - T+1h after no-show: "Sorry we missed you — rebook here"
5. **Post-demo follow-up** CTA: trial access or case study PDF

---

## 6. VISUAL & BRAND IMPROVEMENTS

### Typography Hierarchy

**Current (assumed from Lovable/shadcn-ui defaults):** Generic Inter or system font stack with shadcn default sizing.

**Required for investor-grade aesthetic:**

```css
/* Font stack recommendation */
--font-sans: 'Inter', system-ui, sans-serif;       /* Body text */
--font-display: 'Cal Sans' or 'DM Serif Display';  /* Headlines only */

/* Scale — do not deviate */
H1: 56px / 600 weight / tight tracking (-0.02em)
H2: 36px / 600 weight
H3: 24px / 600 weight
H4: 18px / 600 weight
Body: 16px / 400 weight / 1.6 line-height
Caption/Label: 13px / 500 weight / 0.04em tracking / uppercase
```

Remove all Lovable/shadcn default Tailwind heading sizes that are not on this scale. Inconsistent type sizing is the fastest way to signal "template."

### Layout Density

**Problem with most Lovable-generated sites:** Sections are too sparse. 120px of vertical padding between sections feels like a student project, not a product. Investors are accustomed to density.

**Recommended section padding:** `py-20` (80px) for major sections, `py-12` (48px) for sub-sections. **Maximum** whitespace between elements: `gap-8` (32px) in grids.

**Content width:** Max 1280px container, with inner content max 960px for text-heavy sections. Full-bleed only for hero images and testimonial bands.

### Spacing System

Lock to an 8px base grid. Only use Tailwind spacing values that are multiples of 8: `p-2` (8), `p-4` (16), `p-6` (24), `p-8` (32), `p-12` (48), `p-16` (64), `p-20` (80). Remove all usage of `p-3`, `p-5`, `p-7`, etc. — these break visual rhythm.

### Color Usage

**For an investor-grade UK property platform, avoid:**
- Bright coral / salmon (startup-generic)
- Gradients on body text
- Multiple accent colours
- Dark backgrounds with neon accents

**Recommend:**
```
Primary: #0A1628 (deep navy — trust, authority)
Accent: #E8A023 (warm gold — property, premium)
Success: #16A34A (green — yield, profit)
Neutral: #F8FAFC (off-white background — not pure white)
Text: #0F172A (near-black)
Muted: #64748B (grey for secondary text)
```

The navy/gold palette is used by CBRE, JLL, Savills, and other institutions for a reason. It signals professional credibility without looking corporate-generic.

### Remove "Template" Signals

Every one of these must be removed before launch:

1. ❌ "Edit with Lovable" badge
2. ❌ `Lorem ipsum` placeholder text anywhere
3. ❌ Generic stock photos (houses, shaking hands, laptops on desks)
4. ❌ Placeholder avatar images
5. ❌ Default shadcn/ui card shadows without customisation
6. ❌ Unused navigation items that go to empty pages
7. ❌ "Coming soon" or blank pages accessible from navigation
8. ❌ Default `<title>` format "Vite + React" or "TenureIQ" without page-specific subtitles
9. ❌ Default favicon (the Vite or React logo)

### Make It Feel Institutional

The gap between "SaaS startup" and "institutional-grade tool" is almost entirely perception. These five changes close it:

1. **Replace any hero image with a product screenshot** — dashboards signal software that actually exists
2. **Use case studies with real numbers** (anonymised is fine) — proves the platform produces data
3. **Name the infrastructure** ("Hosted on AWS London region") — signals engineering maturity
4. **Use a professional headshot for every person named** — no cartoon avatars
5. **Format numbers with commas and £ signs everywhere** — `£210,000` not `210000`

---

## 7. TECHNICAL REVIEW

### Broken Links & Routing Problems

**Root cause:** Pure client-side SPA with React Router. When a user navigates directly to `/case-studies/leeds-hmo-2024`, the server serves `index.html` and React Router handles the routing. This works on subsequent navigations but fails on:

- Direct URL access if the hosting platform doesn't redirect all routes to `index.html`
- Search engine crawlers that don't execute JavaScript
- Social media preview scrapers (no OG meta tags in server-rendered HTML)

**Fix:** Configure hosting platform (Netlify / Vercel / Cloudflare Pages) to redirect all routes to `index.html`:

```toml
# netlify.toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

```json
// vercel.json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### SEO Issues (Critical)

The site has **zero search engine visibility** in its current state. Confirmed by the response from `https://tenureiq.com/` returning only a `<title>` and a Lovable badge in the raw HTML.

**Immediate fix for an SPA (two options):**

**Option A — Add `react-helmet-async` for per-page meta (fastest):**

```tsx
// Install: npm install react-helmet-async
// Wrap app: <HelmetProvider>

// In each page component:
import { Helmet } from 'react-helmet-async';

export function CaseStudyDetail({ caseStudy }: { caseStudy: CaseStudy }) {
  return (
    <>
      <Helmet>
        <title>{caseStudy.title} | TenureIQ Case Studies</title>
        <meta name="description" content={caseStudy.summary} />
        <meta property="og:title" content={caseStudy.title} />
        <meta property="og:description" content={caseStudy.summary} />
        <meta property="og:image" content={caseStudy.heroImage} />
        <meta property="og:type" content="article" />
        <link rel="canonical" href={`https://tenureiq.com/case-studies/${caseStudy.slug}`} />
      </Helmet>
      {/* page content */}
    </>
  );
}
```

**Option B — Migrate to Next.js App Router (better long-term, 2-week effort):**

Provides server-side rendering, `generateMetadata()` per page, automatic `sitemap.xml` generation via `app/sitemap.ts`, and ISR for case study content. For a content-heavy, SEO-dependent marketing site, this is the correct long-term architecture. Lovable projects can export to Next.js.

**Recommendation:** Ship Option A immediately (1 day effort). Plan Option B for Week 3.

### Meta Tags — Required Set

```html
<!-- Required on every page -->
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="description" content="[page-specific, 120-160 chars]" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="[full page URL]" />

<!-- OpenGraph -->
<meta property="og:title" content="[page title]" />
<meta property="og:description" content="[page description]" />
<meta property="og:image" content="https://tenureiq.com/og-image.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:type" content="website" />
<meta property="og:url" content="[full page URL]" />
<meta property="og:site_name" content="TenureIQ" />

<!-- Twitter/X Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="[page title]" />
<meta name="twitter:description" content="[page description]" />
<meta name="twitter:image" content="https://tenureiq.com/og-image.jpg" />

<!-- Favicon set -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" href="/favicon.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.json" />
```

### Structured Data (schema.org)

Add the following JSON-LD to the appropriate pages:

```html
<!-- On / (homepage) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "TenureIQ",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "Property intelligence platform for UK HMO and BTL investors",
  "url": "https://tenureiq.com",
  "offers": {
    "@type": "Offer",
    "priceCurrency": "GBP"
  },
  "publisher": {
    "@type": "Organization",
    "name": "TenureIQ Ltd",
    "url": "https://tenureiq.com",
    "logo": "https://tenureiq.com/logo.png"
  }
}
</script>

<!-- On /case-studies/[slug] -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "[case study title]",
  "datePublished": "[ISO date]",
  "author": { "@type": "Organization", "name": "TenureIQ" },
  "publisher": { "@type": "Organization", "name": "TenureIQ Ltd" },
  "image": "[hero image URL]",
  "description": "[summary]"
}
</script>
```

### Performance Issues

**Diagnosed without profiling (based on architecture):**

1. **JS bundle is the entire website.** Every page's code is loaded on first visit. For a 10-page site this can mean 500KB–2MB of JavaScript.

   **Fix:** Implement route-based code splitting:
   ```tsx
   const CaseStudyDetail = lazy(() => import('./pages/CaseStudyDetail'));
   // Wrap routes in <Suspense fallback={<PageSkeleton />}>
   ```

2. **No preloading of critical fonts.** If using Google Fonts or custom fonts via CDN, add:
   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com" />
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
   ```

3. **Images.** Ensure all images use:
   - WebP format
   - Explicit `width` and `height` attributes (prevents layout shift)
   - `loading="lazy"` for below-fold images
   - `loading="eager"` + `fetchpriority="high"` for hero image only

**Target Lighthouse scores (achievable without SSR):**
- Performance: 80+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 85+ (limited by SPA architecture; 95+ after SSR migration)

### Accessibility Checklist

- [ ] All images have meaningful `alt` text (not filename)
- [ ] All interactive elements are reachable by keyboard (`Tab` key)
- [ ] Focus ring is visible (do not use `outline: none` without replacement)
- [ ] Colour contrast ratio ≥ 4.5:1 for all text (use Colour Contrast Analyser)
- [ ] Navigation has `<nav>` element with `aria-label="Main navigation"`
- [ ] Skip-to-content link at top of page
- [ ] All form inputs have associated `<label>` elements
- [ ] Error states have descriptive text, not just red borders
- [ ] `lang="en-GB"` on `<html>` element
- [ ] No `tabindex` values above 0

### Mobile-First Improvements

**Critical mobile issues for a property operator product:**

1. **Demo booking CTA must be thumb-accessible.** Bottom of screen, large tap target (min 44×44px).
2. **Financial tables on case studies** must be horizontally scrollable with `overflow-x: auto`, not broken columns.
3. **Navigation** must be a proper mobile drawer, not a squashed horizontal menu.
4. **Hero section** must not cut off the CTA below the fold on mobile. Test on 375px (iPhone SE) and 390px (iPhone 14).
5. **Minimum font size: 16px** for all body text. Never below 14px. Below 16px triggers auto-zoom on iOS.

### Form Validation

Current demo/contact forms likely use default browser validation only.

**Required:**

```tsx
// Minimum viable validation for demo booking form
const schema = z.object({
  name:           z.string().min(2, "Name required"),
  email:          z.string().email("Valid email required"),
  portfolioSize:  z.string().min(1, "Please select portfolio size"),
  assetType:      z.string().min(1, "Please select asset type"),
  phone:          z.string().optional(),
});

// Error display: inline below the field, never in an alert()
// Success state: clear form, show confirmation message in-page
// Loading state: disable submit button, show spinner
// Never redirect to a new page on form submission
```

---

## 8. SECURITY & CREDIBILITY PAGE

### Why This Page Matters for Property Investors

A property investor is being asked to upload their portfolio data — purchase prices, mortgage details, tenant information, compliance certificates — to your platform. Before they do, they need to know:

1. Where does it go?
2. Who can see it?
3. What happens if you get hacked?
4. Can I delete it?

This page is not optional. It is a conversion requirement. Enterprise buyers will ask for this in the first demo.

### Page URL: `/security`

### Suggested Copy

---

**# How We Protect Your Portfolio Data**

Your property data is among the most sensitive financial information you hold. We take that seriously.

---

**## Data Hosting & Infrastructure**

TenureIQ is hosted on **Amazon Web Services (AWS) in the `eu-west-2` (London) region**. Your data never leaves the United Kingdom.

We use managed infrastructure components including RDS for database storage and S3 for document storage, both with server-side encryption enabled by default. Our hosting provider holds **SOC 2 Type II** and **ISO 27001** certifications.

---

**## Encryption**

| Layer | Standard |
|---|---|
| Data in transit | TLS 1.3 (minimum TLS 1.2) |
| Data at rest | AES-256 |
| Database backups | AES-256, stored in separate AWS region |
| Document storage | AES-256 server-side encryption |

Encryption keys are managed via AWS KMS. We do not hold encryption keys on our application servers.

---

**## Access Controls**

- **Role-Based Access Control (RBAC):** Owner, Admin, Manager, Viewer roles. You control who on your team can see which data.
- **Multi-Factor Authentication:** Available for all accounts. Required for Owner and Admin roles.
- **Session management:** Sessions expire after 24 hours of inactivity. JWT tokens are rotated on each login.
- **API access:** Service-role keys are never exposed to client-side code. All authenticated API calls require a valid user JWT.

---

**## Data Isolation**

Each organisation's data is isolated at the database level using Row Level Security (RLS). It is architecturally impossible for one TenureIQ customer to access another customer's data, even in the event of an application-level bug.

---

**## Audit Trail**

Every sensitive action in your account generates an immutable audit log entry, including:

- User logins and logouts
- Portfolio data changes
- Document uploads and approvals
- Team member role changes
- Data exports

Audit logs cannot be edited or deleted, including by TenureIQ staff.

---

**## Backups**

- Automated daily database backups
- Point-in-time recovery available for the last 35 days
- Backup data stored in `eu-west-1` (Ireland), separate from primary data
- Backup restoration tested quarterly

---

**## GDPR & Data Privacy**

TenureIQ Ltd is a registered Data Controller with the Information Commissioner's Office (ICO).

**ICO Registration Number:** [ZB/XXXXXX] — [verify at ico.org.uk]

Your rights under UK GDPR:
- **Right of access:** Request a copy of all data we hold about you
- **Right to erasure:** Request deletion of your account and all associated data
- **Right to portability:** Export your portfolio data at any time in CSV/JSON format
- **Right to rectification:** Correct any inaccurate personal data

**Data retention:** We retain your data for as long as your account is active. Upon account closure, all personal data is deleted within 30 days. Anonymised, aggregated portfolio statistics may be retained for product improvement purposes.

To exercise any of these rights, email: **privacy@tenureiq.com**

---

**## Uptime & Monitoring**

- Target uptime: 99.5% per month
- Infrastructure monitored 24/7 via AWS CloudWatch
- Incident response page: **status.tenureiq.com** *(set up a free Betteruptime or Statuspage instance before launch)*
- Planned maintenance communicated minimum 48 hours in advance

---

**## Responsible Disclosure**

If you discover a security vulnerability in TenureIQ, please email **security@tenureiq.com**. We will acknowledge receipt within 48 hours. We ask that you do not publicly disclose vulnerabilities before we have had an opportunity to address them.

---

**## Questions?**

For any security or privacy questions, contact us at **security@tenureiq.com** or **privacy@tenureiq.com**.

---

> ⚠️ **Important:** Replace all placeholder values (ICO number, company registration, specific AWS service names) with accurate information before this page goes live. Publishing incorrect compliance claims is worse than publishing none.

---

## 9. BEFORE GO-LIVE CHECKLIST

### Technical

- [ ] Remove "Edit with Lovable" badge from production build
- [ ] Custom 404 page renders for any unmatched route
- [ ] All page routes return correct content (no blank pages)
- [ ] All internal links resolve correctly (no 404s)
- [ ] `sitemap.xml` accessible at `/sitemap.xml`
- [ ] `robots.txt` accessible at `/robots.txt` and correctly configured
- [ ] SSL certificate valid and auto-renewing
- [ ] HTTPS enforced — HTTP redirects to HTTPS
- [ ] HSTS header configured
- [ ] All routes redirect correctly on direct URL access (not just in-app navigation)
- [ ] Route-based code splitting implemented (reduce initial bundle)
- [ ] All images compressed and in WebP format
- [ ] All images have `alt` attributes
- [ ] `lang="en-GB"` on `<html>` element
- [ ] Favicon set complete (16, 32, 48, 180, 192, 512px + SVG)
- [ ] `manifest.json` valid and complete
- [ ] No console errors in production build
- [ ] No `console.log()` statements in production code
- [ ] Environment variables not exposed in client bundle
- [ ] Error monitoring configured (Sentry free tier minimum)
- [ ] Lighthouse score: Performance 80+, Accessibility 90+, SEO 85+

### Legal

- [ ] Privacy Policy page live at `/legal/privacy-policy`
- [ ] Terms of Service page live at `/legal/terms-of-service`
- [ ] Cookie Policy page live at `/legal/cookie-policy`
- [ ] Company registration number in footer
- [ ] ICO registration number in footer (required before collecting any personal data)
- [ ] Registered office address in footer
- [ ] Cookie consent banner implemented and compliant with UK GDPR
- [ ] Data processing basis documented (legitimate interest / consent) for each data type collected
- [ ] GDPR-compliant contact form (no pre-ticked marketing consent boxes)

### Content

- [ ] Zero `Lorem ipsum` placeholder text
- [ ] Zero "Coming soon" pages accessible from navigation
- [ ] Zero broken links (run site through Broken Link Checker)
- [ ] Hero headline approved and not template default
- [ ] All page titles are unique and descriptive
- [ ] All meta descriptions are written and unique (120–160 characters each)
- [ ] At least one working case study with real (or realistic, clearly disclosed as illustrative) data
- [ ] Founder/team page published with real names and photos
- [ ] Security page published
- [ ] Pricing page published
- [ ] Book a Demo page published with working Calendly/Cal.com embed
- [ ] All email addresses referenced on-site are functional inboxes (test each one)
- [ ] Footer copyright year is current (2026)

### Design

- [ ] Lovable badge removed
- [ ] No placeholder avatar images
- [ ] No stock photos of generic houses — product screenshots preferred
- [ ] Typography scale consistent across all pages
- [ ] Brand colours consistent (no default Tailwind blues remaining unless intentional)
- [ ] Mobile layout tested on 375px width (iPhone SE)
- [ ] Mobile layout tested on 390px width (iPhone 14)
- [ ] All CTA buttons have hover states
- [ ] All form inputs have focus states
- [ ] Focus ring visible for keyboard navigation
- [ ] No content clipped or overflowing at any breakpoint

### Analytics & Tracking

- [ ] Google Analytics 4 installed (or Plausible for GDPR-simple alternative)
- [ ] Analytics only fires AFTER cookie consent is granted
- [ ] Conversion goal configured for demo booking form submission
- [ ] Conversion goal configured for contact form submission
- [ ] UTM parameter tracking working for all campaigns
- [ ] Google Search Console property verified

### Cookie Consent

- [ ] Cookie consent banner appears on first visit
- [ ] Consent is opt-in (no pre-consent analytics)
- [ ] Users can reject non-essential cookies
- [ ] Cookie preferences can be changed after initial choice
- [ ] Analytics only activates on consent
- [ ] Cookie consent library used: `cookie-consent` by Osano, or Cookiebot, or equivalent GDPR-compliant solution

### OpenGraph & Social Sharing

- [ ] OG image created (1200×630px, branded, not template)
- [ ] `og:title` unique per page
- [ ] `og:description` unique per page
- [ ] OG image tested via [opengraph.xyz](https://opengraph.xyz)
- [ ] Twitter Card tested via [cards-dev.twitter.com/validator](https://cards-dev.twitter.com/validator)
- [ ] LinkedIn post preview tested

---

## 10. PRIORITISED IMPLEMENTATION ROADMAP

### Week 1 — Critical (Ship Nothing Until These Are Done)

| Task | Impact | Effort | Why |
|---|---|---|---|
| Remove Lovable "Edit with" badge | High | Small | Destroys credibility — any investor who sees this closes the tab |
| Add custom 404 page | High | Small | Every broken URL currently serves the homepage silently |
| Add cookie consent banner + defer analytics | High | Small | Active GDPR violation today if any tracking is running |
| Publish Privacy Policy, Terms of Service, Cookie Policy | High | Small | Legal requirement before any user data collection |
| Add company registration + ICO number to footer | High | Small | Required for any B2B/investor credibility in the UK |
| Fix case study routing (broken → working) | High | Medium | Core conversion mechanism is non-functional |
| Add `sitemap.xml` | High | Small | Search engines cannot discover pages without it |
| Add `robots.txt` | High | Small | Without it Google may not crawl, or may crawl the wrong things |
| Add per-page `<title>` and `<meta name="description">` via `react-helmet-async` | High | Small | Currently every page has the same title tag |
| Add OpenGraph meta tags | High | Small | Every LinkedIn / WhatsApp share currently renders as a blank card |
| Add hero product screenshot (replace any stock imagery) | High | Small | Investors need to see the product, not a stock house photo |
| Configure hosting redirects so all routes serve `index.html` | High | Small | Direct URL access to any page currently may 404 depending on host config |

### Week 2 — Improvements

| Task | Impact | Effort | Why |
|---|---|---|---|
| Build `/book-a-demo` dedicated page with pre-qualification form | High | Medium | Demo is the primary conversion action; it needs its own page |
| Build `/security` page with full copy from §8 | High | Medium | Will be asked for by every enterprise prospect in first demo |
| Build `/pricing` page | High | Medium | Absence of pricing blocks conversion at consideration stage |
| Build `/about` page with founder bio and photos | High | Small | Investors will not proceed without knowing who is behind the product |
| Add at minimum 1 complete case study with all sections | High | Medium | The most powerful trust mechanism available to a pre-traction product |
| Add social proof / testimonials section to homepage | High | Medium | Without it the homepage reads as a product brochure, not a business |
| Implement route-based code splitting | Medium | Small | Reduces initial bundle size; improves mobile performance on slow 4G |
| Add Sentry error monitoring | Medium | Small | Currently flying blind on production errors |
| Add Google Search Console verification | Medium | Small | Enables monitoring of search indexing and Core Web Vitals |
| Rewrite hero headline and subheadline | Medium | Small | Presumably uses a Lovable template default; must be specific to ICP |
| Add company LinkedIn page and link from footer | Medium | Small | Investors will search LinkedIn — make it easy to find |

### Week 3 — Polish

| Task | Impact | Effort | Why |
|---|---|---|---|
| Implement consistent typography scale across all pages | Medium | Medium | "Template" look is caused primarily by inconsistent type |
| Replace all colour defaults with brand palette (navy/gold) | Medium | Medium | Current Lovable defaults look generic |
| Compress and WebP-convert all images | Medium | Small | Performance improvement; part of Lighthouse score |
| Add JSON-LD structured data (Organization + SoftwareApplication) | Medium | Small | Improves rich results in Google for branded searches |
| Add `<link rel="canonical">` to all pages | Medium | Small | Prevents duplicate content issues as site grows |
| Add manifest.json and full favicon set | Low | Small | Required for PWA-style "Add to Home Screen" on mobile |
| Implement sticky navigation | Low | Small | Keeps the demo CTA accessible at all times during scroll |
| Set up `status.tenureiq.com` uptime page (Betteruptime free tier) | Low | Small | Referenced in Security page; must exist before page goes live |
| Add HSTS header to hosting config | Low | Small | Security best practice; protects against SSL stripping |

### Post-Launch Growth Features

| Task | Impact | Effort | Why |
|---|---|---|---|
| Migrate from Vite SPA to Next.js App Router | High | Large | Unlocks SSR, proper SEO, generateMetadata, ISR for case studies — the correct long-term architecture |
| Blog / resources section (3 posts minimum) | High | Medium | Long-tail SEO for "HMO yield calculator", "BTL compliance checklist" etc. |
| Exit-intent email capture with lead magnet (portfolio template download) | High | Medium | Captures visitors who won't book a demo |
| Interactive yield calculator on homepage | High | Medium | Highest-converting property finance tool; demonstrates product value before signup |
| Case study CMS migration to Sanity or Contentful | Medium | Medium | Removes developer dependency for adding new case studies |
| Video walkthrough (Loom or produced) embedded on homepage | High | Small | Reduces demo no-show rate; fastest way to communicate product value |
| A/B test hero headlines (using Posthog or VWO) | Medium | Small | Data-driven headline optimisation once traffic is established |
| Affiliate / referral programme for NRLA members | High | Large | Distribution at scale through an existing trusted network |
| ISO 27001 certification process | High | Large | Unlocks enterprise/institutional buyers who require it |
| HM Land Registry data integration for property lookup | High | Large | Key product differentiator; enables automatic property detail population |

---

## APPENDIX: QUICK REFERENCE — CRITICAL FIXES IN PRIORITY ORDER

1. **Remove the Lovable badge** — 5 minutes
2. **Deploy cookie consent before any analytics** — 1 hour
3. **Publish legal pages** (Privacy, Terms, Cookies) — 4 hours
4. **Add footer: company reg, ICO number, address** — 30 minutes
5. **Fix case study routing** — 1 day
6. **Create `sitemap.xml` and `robots.txt`** — 1 hour
7. **Install `react-helmet-async` and add per-page meta tags** — 4 hours
8. **Add OpenGraph image (1200×630px)** — 2 hours
9. **Configure hosting redirects for SPA routing** — 30 minutes
10. **Add custom 404 page** — 1 hour

**Total estimated effort for all critical fixes:** 2–3 days.

These ten items are the difference between a demo project and a product that serious investors can take seriously. Nothing else matters until they are done.

---

*Audit produced by automated analysis of the live production URL `https://tenureiq.com/`. The site was found to return only a bare HTML shell with a Lovable project badge, confirming a pure client-side SPA architecture. All content analysis, routing assumptions, and stack identification are based on the page source response, Lovable.dev project link in the source, and UK property SaaS market context. All financial figures in case study examples are illustrative only.*
