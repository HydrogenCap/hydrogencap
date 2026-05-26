import { SEO } from '@/components/SEO';
import { breadcrumbList } from '@/lib/seo/jsonLd';
import { Link } from 'react-router-dom';
import { Target, Eye, Zap, Shield, ArrowRight } from 'lucide-react';
import { MarketingLayout, SectionHeading } from '@/components/marketing';
import { Button } from '@/components/ui/button';

const values = [
  { icon: Eye, title: 'Transparency', description: 'Clear visibility into every aspect of your portfolio. No hidden data, no surprises.' },
  { icon: Shield, title: 'Compliance-First', description: 'Built around UK regulatory requirements. Compliance is core, not an afterthought.' },
  { icon: Zap, title: 'Speed', description: 'Fast to set up, fast to use. Get value from day one — without lengthy implementations.' },
  { icon: Target, title: 'Data Accuracy', description: 'Enriched, validated, and cross-referenced data you can trust for decisions.' },
];

const team = [
  { initials: 'DK', name: 'David K.', role: 'Founder & CEO', bio: 'Property investor and technologist with 10+ years building portfolio management systems.' },
  { initials: 'SM', name: 'Sarah M.', role: 'Head of Product', bio: 'Former asset manager with deep expertise in HMO operations and compliance.' },
  { initials: 'JT', name: 'James T.', role: 'Technical Lead', bio: 'Full-stack engineer specialising in real estate technology and data platforms.' },
];

const beliefs = [
  'Compliance should be proactive, not reactive',
  'Every landlord should know their true equity position',
  'Professional reporting builds investor and partner confidence',
  'Multi-entity ownership shouldn’t mean multi-spreadsheet chaos',
  'Good data leads to better decisions',
];

export default function MarketingAbout() {
  return (
    <MarketingLayout>
      <SEO
        title="About Us — Tenure IQ"
        description="Tenure IQ was built by UK property investors who were frustrated with spreadsheets. Our mission is to make portfolio management effortless."
        jsonLd={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'About', path: '/about' },
        ])}
      />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border bg-card">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-[60rem] rounded-full bg-gold/10 blur-3xl" aria-hidden="true" />
        <div className="container relative mx-auto px-4 lg:px-8 py-24 lg:py-32 text-center max-w-4xl">
          <p className="text-xs uppercase tracking-[0.18em] text-gold font-semibold mb-6">
            Our Story
          </p>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.02] tracking-tight">
            Professionalising property{' '}
            <span className="text-primary">for the rest of us.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed">
            Every landlord deserves investor-grade tools. No more spreadsheets,
            no more missed renewals, no more guesswork.
          </p>
        </div>
      </section>

      {/* MISSION — editorial two-column */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16">
            <div className="lg:col-span-5">
              <p className="text-xs uppercase tracking-[0.18em] text-gold font-semibold mb-4">
                Our Mission
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
                Making professional asset management accessible.
              </h2>
            </div>
            <div className="lg:col-span-7 space-y-5 text-muted-foreground text-lg font-light leading-relaxed">
              <p>
                Institutional property managers have had access to sophisticated
                portfolio tracking and compliance systems for decades. Independent
                landlords and smaller asset managers have been left with spreadsheets
                and paper files.
              </p>
              <p>
                We’re changing that. Our platform brings the same level of visibility,
                reporting and risk management to portfolios of all sizes — from 3
                properties to 300.
              </p>
              <p>
                Built specifically for the UK market, we understand the nuances of
                HMO licensing, EPC regulations, Companies House filings, and the
                realities of multi-SPV ownership.
              </p>
            </div>
          </div>

          {/* values grid */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-2xl overflow-hidden">
            {values.map((value) => (
              <div key={value.title} className="bg-background p-8">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold">
                  <value.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 font-display text-lg font-bold tracking-tight">{value.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section className="bg-card border-y border-border py-24 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Team"
            title="Built by property people, for property people"
            description="Deep property investment experience meets modern technology expertise."
          />
          <div className="mt-16 grid md:grid-cols-3 gap-6">
            {team.map((member) => (
              <div key={member.name} className="rounded-2xl border border-border bg-background p-8 text-center transition-shadow hover:shadow-lg">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground font-display text-xl font-bold">
                  {member.initials}
                </div>
                <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{member.name}</h3>
                <p className="mt-1 text-sm uppercase tracking-widest text-gold font-semibold">{member.role}</p>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BELIEFS */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <SectionHeading badge="What We Believe" title="Principles that guide the product." />
          <ol className="mt-16 space-y-px rounded-2xl border border-border overflow-hidden">
            {beliefs.map((belief, i) => (
              <li
                key={i}
                className="flex items-center gap-6 bg-background hover:bg-card transition-colors p-6"
              >
                <span className="font-display text-2xl font-bold text-gold/60 w-10 shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-display text-lg font-semibold text-foreground tracking-tight">
                  {belief}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gold/20 blur-3xl" aria-hidden="true" />
        <div className="container relative mx-auto px-4 lg:px-8 py-24 text-center max-w-3xl">
          <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Ready to operate like
            <span className="block text-gold">an institution?</span>
          </h2>
          <p className="mt-6 text-lg text-primary-foreground/75 font-light max-w-xl mx-auto">
            Join the operators across the UK who trust Tenure IQ as their
            single source of portfolio truth.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="font-display font-semibold tracking-wide bg-gold text-gold-foreground hover:bg-gold/90" asChild>
              <Link to="/contact">
                Get in touch
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="font-display font-semibold tracking-wide bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <Link to="/demo">View demo</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
