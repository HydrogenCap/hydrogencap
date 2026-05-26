import { SEO } from '@/components/SEO';
import { breadcrumbList } from '@/lib/seo/jsonLd';
import { Link } from 'react-router-dom';
import {
  Building2,
  Inbox,
  AlertTriangle,
  RefreshCw,
  FileText,
  CheckCircle,
  ArrowRight,
  BarChart3,
  Shield,
  Bell,
  Zap,
} from 'lucide-react';
import { MarketingLayout, SectionHeading, FAQAccordion } from '@/components/marketing';
import { Button } from '@/components/ui/button';

const featureGroups = [
  {
    title: 'Portfolio & Ownership',
    icon: Building2,
    features: [
      'Unlimited properties across SPVs and personal names',
      'Multi-entity beneficial ownership tracking',
      'Automatic equity attribution across shareholders',
      'Company compliance (accounts, confirmation statements)',
    ],
  },
  {
    title: 'Compliance Inbox',
    icon: Inbox,
    features: [
      'AI-powered document classification',
      'Automatic expiry date extraction',
      'Property matching with confidence scores',
      'Version history and audit trail',
    ],
  },
  {
    title: 'Risk Radar',
    icon: AlertTriangle,
    features: [
      'Expired / expiring / missing certificate tracking',
      '90 / 60 / 30 / 7 day warning bands',
      'High / Medium / Low priority categorisation',
      'Actionable remediation links',
    ],
  },
  {
    title: 'Refinance & Rate Diary',
    icon: RefreshCw,
    features: [
      'Fixed rate expiry tracking',
      'Reversion rate modelling',
      'LTV monitoring across portfolio',
      'Refinance opportunity alerts',
    ],
  },
  {
    title: 'Professional Reporting',
    icon: FileText,
    features: [
      'Mortgage broker pack generation (PDF)',
      'Insurance broker pack with schedules',
      'Council compliance summaries',
      'Custom property passport exports',
    ],
  },
  {
    title: 'Real-time Analytics',
    icon: BarChart3,
    features: [
      'Portfolio value and equity tracking',
      'Cashflow analysis with trends',
      'Geographic concentration insights',
      'AI-powered portfolio recommendations',
    ],
  },
];

const checklist = [
  'Unlimited properties and users',
  'All compliance certificate types',
  'Document storage and version history',
  'PDF report generation',
  'Email alerts and reminders',
  'Multi-entity ownership support',
  'API access (coming soon)',
  'Priority support',
];

const faqs = [
  {
    question: 'What types of properties does the dashboard support?',
    answer: 'All UK residential property types including HMOs, BTL, multi-lets, student accommodation, and social housing leases. Freehold, leasehold, and share of freehold are all supported.',
  },
  {
    question: 'How does the compliance tracking work?',
    answer: 'Manually add items or use our AI-powered inbox to upload documents. The system extracts expiry dates, classifies document types, and matches them to properties. Alerts arrive at 90, 60, 30, and 7 days before expiry.',
  },
  {
    question: 'Can I manage properties owned by different companies?',
    answer: 'Yes. Multi-entity ownership including SPVs, partnerships, and personal ownership is fully supported. Track beneficial ownership percentages with attributed equity and cashflow across the whole portfolio.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Bank-grade encryption for data at rest and in transit. Row-level security ensures users only see their own portfolio data. We do not share or sell any portfolio information.',
  },
  {
    question: 'Can I generate reports for my mortgage broker?',
    answer: 'Yes. The Reports module generates professional PDF packs including property schedules, compliance summaries, income verification, and mortgage details — designed to meet typical lender and broker requirements.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'We offer a live demo dashboard with sample data so you can explore everything. For a trial with your own data, book a demo and we will discuss your requirements.',
  },
];

export default function MarketingProduct() {
  return (
    <MarketingLayout>
      <SEO
        title="Product Features — Tenure IQ"
        description="Compliance tracking, rent collection, mortgage monitoring, AI document processing, and portfolio analytics. Everything UK landlords need in one platform."
        jsonLd={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Product', path: '/product' },
        ])}
      />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border bg-card">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-[60rem] rounded-full bg-gold/10 blur-3xl" aria-hidden="true" />
        <div className="container relative mx-auto px-4 lg:px-8 py-24 lg:py-32 text-center max-w-4xl">
          <p className="text-xs uppercase tracking-[0.18em] text-gold font-semibold mb-6">
            The Product
          </p>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.02] tracking-tight">
            Six modules.{' '}
            <span className="text-primary">One source of truth.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed">
            Built for the way UK landlords, asset managers and family offices
            actually run their portfolios — not a generic property CRM.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="font-display font-semibold tracking-wide bg-gold text-gold-foreground hover:bg-gold/90 shadow-lg shadow-gold/20" asChild>
              <Link to="/demo">
                Tour the dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="font-display font-semibold tracking-wide" asChild>
              <Link to="/contact">Book a call</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FEATURE GRID — bento style */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Features"
            title="Everything in one place"
            description="Six integrated modules. No bolt-ons, no surprise plug-in pricing."
          />
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border rounded-2xl overflow-hidden">
            {featureGroups.map((group) => (
              <div key={group.title} className="group bg-background p-8 transition-colors hover:bg-card">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/8 text-primary group-hover:bg-gold/15 group-hover:text-gold transition-colors">
                  <group.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 font-display text-xl font-bold tracking-tight text-foreground">
                  {group.title}
                </h3>
                <ul className="mt-4 space-y-2">
                  {group.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT YOU GET — split */}
      <section className="bg-card border-y border-border py-24 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <SectionHeading
                badge="What You Get"
                title="Professional-grade portfolio management"
                description="Everything you need to run your portfolio like an institutional asset manager — without the institutional headcount."
                align="left"
              />
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10">
                {checklist.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-gold shrink-0" />
                    <span className="text-foreground/85">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-10">
                <Button className="font-display font-semibold tracking-wide bg-gold text-gold-foreground hover:bg-gold/90" asChild>
                  <Link to="/contact">
                    Get started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { icon: Bell, title: 'Smart Alerts', body: 'Email notifications before anything expires — at 90, 60, 30 and 7 days.' },
                { icon: Zap, title: 'AI-Powered', body: 'Document classification, expiry extraction, and portfolio enrichment.' },
                { icon: Shield, title: 'Bank-Grade Security', body: 'Encrypted at rest and in transit. Row-level isolation per organisation.' },
              ].map((c) => (
                <div key={c.title} className="flex items-start gap-4 rounded-xl border border-border bg-background p-5 transition-shadow hover:shadow-lg">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-foreground">{c.title}</h4>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading badge="FAQ" title="Frequently asked questions" />
          <div className="max-w-3xl mx-auto mt-16">
            <FAQAccordion items={faqs} />
          </div>
        </div>
      </section>

      {/* CTA — navy slab */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-gold/20 blur-3xl" aria-hidden="true" />
        <div className="container relative mx-auto px-4 lg:px-8 py-24 text-center max-w-3xl">
          <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            See it with your own portfolio
            <span className="block text-gold">in under an hour.</span>
          </h2>
          <p className="mt-6 text-lg text-primary-foreground/75 font-light max-w-xl mx-auto">
            Explore the demo dashboard with sample data, or book a call so we
            can walk through it together.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="font-display font-semibold tracking-wide bg-gold text-gold-foreground hover:bg-gold/90" asChild>
              <Link to="/demo">View demo dashboard</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="font-display font-semibold tracking-wide bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              asChild
            >
              <Link to="/contact">Book a demo</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
