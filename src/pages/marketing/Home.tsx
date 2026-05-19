import { SEO } from '@/components/SEO';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Shield,
  FileText,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { MarketingLayout, SectionHeading, FeatureCard, TestimonialCard } from '@/components/marketing';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const features = [
  {
    icon: BarChart3,
    title: 'Portfolio KPIs',
    description: 'Track value, LTV, cashflow, and occupancy across your entire portfolio in real-time.',
  },
  {
    icon: Shield,
    title: 'Compliance & Renewals',
    description: 'Never miss an EICR, Gas Safety, EPC, Fire Safety certificate or HMO licence renewal.',
  },
  {
    icon: FileText,
    title: 'Professional Reporting',
    description: 'Generate mortgage broker packs, insurance summaries, and council compliance reports.',
  },
];

const howItWorks = [
  {
    step: '01',
    title: 'Import Your Portfolio',
    description: 'Upload via CSV or add properties manually. We auto-enrich with EPC, Land Registry, and market data.',
  },
  {
    step: '02',
    title: 'Track Everything',
    description: 'Monitor compliance dates, mortgage terms, rental income, and property performance in one place.',
  },
  {
    step: '03',
    title: 'Stay Ahead',
    description: 'Get alerts before certificates expire. Generate professional reports when you need them.',
  },
];

const testimonials = [
  {
    quote: 'Finally, a system that understands how UK HMO portfolios actually work. The compliance tracking alone has saved us countless hours.',
    author: 'Sarah M.',
    role: 'Property Director',
    company: 'Midlands Portfolio Ltd',
  },
  {
    quote: 'The refinance modelling and broker pack generation made our last remortgage process significantly smoother.',
    author: 'James T.',
    role: 'Managing Director',
    company: 'West Country Investments',
  },
  {
    quote: 'We manage properties across multiple SPVs. This dashboard finally gives us a single view of beneficial ownership and true equity.',
    author: 'David K.',
    role: 'Portfolio Manager',
  },
];

const socialProof = [
  'Oxfordshire',
  'Cheltenham',
  'Shropshire',
  'Somerset',
  'Gloucestershire',
];

export default function MarketingHome() {
  return (
    <MarketingLayout>
      <SEO
        title="Tenure IQ — UK Property Portfolio Management"
        description="Know your yield, track your compliance, grow your portfolio. Built for UK landlords managing HMO and buy-to-let investments."
        ogImage="https://tenureiq.com/og-image.jpg"
      />
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 lg:px-8 py-20 lg:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display tracking-tight">
              The property management platform built for{' '}
              <span className="text-primary">UK HMO and BTL investors.</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Know your yield. Track your compliance. Grow your portfolio — without spreadsheets, without guesswork.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/book-a-demo">
                  Book a Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/demo">View Demo Dashboard</Link>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <Link to="/auth">Login</Link>
              </Button>
            </div>
          </div>
        </div>
        {/* Decorative gradient orbs */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </section>

      {/* Social Proof */}
      <section className="border-y bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8 py-6">
          <p className="text-center text-sm text-muted-foreground">
            Used for HMO portfolios across{' '}
            {socialProof.map((location, i) => (
              <span key={location}>
                <span className="font-medium text-foreground">{location}</span>
                {i < socialProof.length - 1 && ', '}
              </span>
            ))}{' '}
            and beyond
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Features"
            title="Everything you need to manage a UK property portfolio"
            description="Purpose-built for landlords, asset managers, and family offices managing HMOs, BTLs, and mixed-use portfolios."
          />
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Dashboard"
            title="Your portfolio at a glance"
            description="Real-time visibility into every property, loan, and compliance item."
          />
          <div className="mt-12">
            <Card className="overflow-hidden border-2">
              <CardContent className="p-0">
                {/* Mock Dashboard UI */}
                <div className="bg-background p-6 space-y-6">
                  {/* KPI Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Portfolio Value', value: '£4.2M' },
                      { label: 'Total Equity', value: '£1.8M' },
                      { label: 'Average LTV', value: '57%' },
                      { label: 'Monthly Cashflow', value: '£12,450' },
                    ].map((stat) => (
                      <div key={stat.label} className="p-4 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <p className="text-xl font-bold">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                  {/* Chart placeholder */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="h-48 rounded-lg bg-muted/50 flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <TrendingUp className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">Cashflow Trend</p>
                      </div>
                    </div>
                    <div className="h-48 rounded-lg bg-muted/50 flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <Shield className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">Compliance Status</p>
                      </div>
                    </div>
                  </div>
                  {/* Table preview */}
                  <div className="rounded-lg border overflow-hidden">
                    <div className="grid grid-cols-5 gap-4 p-3 bg-muted/30 text-xs font-medium text-muted-foreground">
                      <span>Property</span>
                      <span>Type</span>
                      <span>Value</span>
                      <span>LTV</span>
                      <span>Status</span>
                    </div>
                    {[
                      { name: '14 High Street', type: 'HMO 6-bed', value: '£650K', ltv: '62%', status: 'Compliant' },
                      { name: '8 Station Road', type: 'HMO 5-bed', value: '£520K', ltv: '58%', status: 'Review Due' },
                      { name: '22 Park Lane', type: 'BTL', value: '£380K', ltv: '45%', status: 'Compliant' },
                    ].map((row) => (
                      <div key={row.name} className="grid grid-cols-5 gap-4 p-3 border-t text-sm">
                        <span className="font-medium">{row.name}</span>
                        <span className="text-muted-foreground">{row.type}</span>
                        <span>{row.value}</span>
                        <span>{row.ltv}</span>
                        <span className={row.status === 'Compliant' ? 'text-success' : 'text-warning'}>
                          {row.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Video Walkthrough */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="See It In Action"
            title="Watch a 3-minute walkthrough"
            description="See how Tenure IQ helps you track compliance, monitor cashflow, and manage your entire portfolio from one dashboard."
          />
          <div className="mt-12 max-w-4xl mx-auto">
            <Card className="overflow-hidden border-2">
              <CardContent className="p-0">
                <div className="relative aspect-video bg-primary/5 flex items-center justify-center group cursor-pointer">
                  {/* Replace the div below with your Loom/YouTube embed:
                      <iframe 
                        src="https://www.loom.com/embed/YOUR_VIDEO_ID" 
                        frameBorder="0" 
                        allowFullScreen 
                        className="absolute inset-0 w-full h-full"
                      /> 
                  */}
                  <div className="text-center space-y-4">
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto group-hover:bg-primary/20 transition-colors">
                      <svg
                        className="h-8 w-8 text-primary ml-1"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-lg">Product Walkthrough</p>
                      <p className="text-sm text-muted-foreground">3 min · See compliance tracking, portfolio analytics & reporting in action</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Prefer a live demo?{' '}
              <Link to="/book-a-demo" className="text-primary font-medium hover:underline">
                Book a 20-minute call →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="How It Works"
            title="Get started in minutes"
            description="From import to insights in three simple steps."
          />
          <div className="grid md:grid-cols-3 gap-8 mt-12">
            {howItWorks.map((item) => (
              <div key={item.step} className="relative">
                <span className="text-6xl font-bold text-primary/10">{item.step}</span>
                <h3 className="text-lg font-semibold mt-2 mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Testimonials"
            title="Trusted by portfolio managers"
          />
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {testimonials.map((testimonial, i) => (
              <TestimonialCard key={i} {...testimonial} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground overflow-hidden relative">
            <CardContent className="py-16 text-center relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to professionalise your portfolio operations?
              </h2>
              <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8">
                Join portfolio managers across the UK who trust our platform for compliance, reporting, and investor-grade visibility.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="secondary" asChild>
                  <Link to="/book-a-demo">
                    Book a Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
                  <Link to="/demo">Try the Demo</Link>
                </Button>
              </div>
            </CardContent>
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/5 rounded-full blur-3xl" />
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
}
