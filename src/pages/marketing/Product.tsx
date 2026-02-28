import { SEO } from '@/components/SEO';
import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  Inbox,
  AlertTriangle,
  RefreshCw,
  FileText,
  CheckCircle,
  ArrowRight,
  BarChart3,
  Shield,
  TrendingUp,
  Calendar,
  Bell,
  Zap,
} from 'lucide-react';
import { MarketingLayout, SectionHeading, FAQAccordion } from '@/components/marketing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const featureGroups = [
  {
    title: 'Portfolio & Ownership',
    icon: Building2,
    features: [
      'Unlimited properties across SPVs and personal names',
      'Multi-entity beneficial ownership tracking',
      'Automatic equity attribution across shareholders',
      'Company compliance tracking (accounts, confirmation statements)',
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
      'Visual expired/expiring/missing certificate tracking',
      '90/60/30/7 day warning bands',
      'High/Medium/Low priority categorisation',
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
    answer: 'The dashboard supports all UK residential property types including HMOs (Houses in Multiple Occupation), standard BTL (Buy-to-Let), multi-lets, student accommodation, and social housing leases. It handles freehold, leasehold, and share of freehold tenure types.',
  },
  {
    question: 'How does the compliance tracking work?',
    answer: 'You can either manually add compliance items or use our AI-powered inbox to upload documents. The system automatically extracts expiry dates, classifies document types, and matches them to properties. You receive alerts at 90, 60, 30, and 7 days before expiry.',
  },
  {
    question: 'Can I manage properties owned by different companies?',
    answer: 'Yes. The dashboard supports multi-entity ownership including SPVs, partnerships, and personal ownership. You can track beneficial ownership percentages and see attributed equity and cashflow across the entire portfolio.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Absolutely. We use bank-grade encryption for all data at rest and in transit. Access is controlled via row-level security policies, ensuring users only see their own portfolio data. We do not share or sell any portfolio information.',
  },
  {
    question: 'Can I generate reports for my mortgage broker?',
    answer: 'Yes. The Reports module can generate professional PDF packs including property schedules, compliance summaries, income verification, and mortgage details. These are designed to meet typical lender and broker requirements.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'We offer a live demo dashboard with sample data so you can explore all features. For a trial with your own data, please book a demo and we can discuss your requirements.',
  },
];

export default function MarketingProduct() {
  return (
    <MarketingLayout>
      <SEO
        title="Product Features — HydrogenCap"
        description="Compliance tracking, rent collection, mortgage monitoring, AI document processing, and portfolio analytics. Everything UK landlords need in one platform."
      />
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
              Product
            </span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              The complete dashboard for UK property portfolios
            </h1>
            <p className="text-xl text-muted-foreground">
              Built specifically for HMO landlords, asset managers, and family offices managing multi-entity portfolios.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" asChild>
                <Link to="/demo">
                  Try the Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/contact">Book a Call</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Groups */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Features"
            title="Everything in one place"
            description="Six integrated modules designed for professional portfolio management."
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            {featureGroups.map((group) => (
              <Card key={group.title} className="h-full">
                <CardHeader>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <group.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{group.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {group.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <SectionHeading
                badge="What You Get"
                title="Professional-grade portfolio management"
                description="Everything you need to run your portfolio like a professional asset manager."
                align="left"
              />
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
                {checklist.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button asChild>
                  <Link to="/contact">Get Started</Link>
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              {/* Mini feature cards */}
              <Card>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bell className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Smart Alerts</h4>
                    <p className="text-sm text-muted-foreground">Email notifications before anything expires</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">AI-Powered</h4>
                    <p className="text-sm text-muted-foreground">Document classification and data enrichment</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Bank-Grade Security</h4>
                    <p className="text-sm text-muted-foreground">Encrypted, isolated, and compliant</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="FAQ"
            title="Frequently asked questions"
          />
          <div className="max-w-3xl mx-auto mt-12">
            <FAQAccordion items={faqs} />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to see it in action?</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Explore the demo dashboard with sample data, or book a call to discuss your portfolio.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/demo">View Demo Dashboard</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/contact">Book a Demo</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
