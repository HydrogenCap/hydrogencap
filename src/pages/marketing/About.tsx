import { SEO } from '@/components/SEO';
import { breadcrumbList } from '@/lib/seo/jsonLd';
import { Link } from 'react-router-dom';
import { Target, Eye, Zap, Shield, Users, CheckCircle } from 'lucide-react';
import { MarketingLayout, SectionHeading } from '@/components/marketing';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const values = [
  {
    icon: Eye,
    title: 'Transparency',
    description: 'Clear visibility into every aspect of your portfolio. No hidden data, no surprises.',
  },
  {
    icon: Shield,
    title: 'Compliance-First',
    description: 'Built around UK regulatory requirements. Compliance is core, not an afterthought.',
  },
  {
    icon: Zap,
    title: 'Speed',
    description: 'Fast to set up, fast to use. Get value from day one without lengthy implementations.',
  },
  {
    icon: Target,
    title: 'Data Accuracy',
    description: 'Enriched, validated, and cross-referenced data you can trust for decisions.',
  },
];

const team = [
  {
    name: 'David K.',
    role: 'Founder & CEO',
    bio: 'Property investor and technologist with 10+ years building portfolio management systems.',
  },
  {
    name: 'Sarah M.',
    role: 'Head of Product',
    bio: 'Former asset manager with deep expertise in HMO operations and compliance.',
  },
  {
    name: 'James T.',
    role: 'Technical Lead',
    bio: 'Full-stack engineer specialising in real estate technology and data platforms.',
  },
];

export default function MarketingAbout() {
  return (
    <MarketingLayout>
      <SEO
        title="About Us — Tenure IQ"
        description="Tenure IQ was built by UK property investors who were frustrated with spreadsheets. We're on a mission to make portfolio management effortless."
        jsonLd={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'About', path: '/about' },
        ])}
      />
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
              About Us
            </span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Professionalising property portfolio operations
            </h1>
            <p className="text-xl text-muted-foreground">
              We believe every landlord deserves investor-grade tools. No more spreadsheets, no more missed renewals, no more guesswork.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <SectionHeading
                badge="Our Mission"
                title="Making professional asset management accessible"
                align="left"
              />
              <div className="mt-6 space-y-4 text-muted-foreground">
                <p>
                  Institutional property managers have had access to sophisticated portfolio tracking and compliance systems for decades. Independent landlords and smaller asset managers have been left with spreadsheets and paper files.
                </p>
                <p>
                  We're changing that. Our platform brings the same level of visibility, reporting, and risk management to portfolios of all sizes — from 3 properties to 300.
                </p>
                <p>
                  Built specifically for the UK market, we understand the nuances of HMO licensing, EPC regulations, Companies House filings, and the realities of multi-SPV ownership.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {values.map((value) => (
                <Card key={value.title} className="h-full">
                  <CardContent className="pt-6">
                    <value.icon className="h-8 w-8 text-primary mb-3" />
                    <h3 className="font-semibold mb-2">{value.title}</h3>
                    <p className="text-sm text-muted-foreground">{value.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Team"
            title="Built by property people, for property people"
            description="Our team combines deep property investment experience with modern technology expertise."
          />
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {team.map((member) => (
              <Card key={member.name} className="text-center">
                <CardContent className="pt-8">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Users className="h-10 w-10 text-primary/50" />
                  </div>
                  <h3 className="font-semibold text-lg">{member.name}</h3>
                  <p className="text-sm text-primary mb-3">{member.role}</p>
                  <p className="text-sm text-muted-foreground">{member.bio}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* What We Believe */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="What We Believe"
            title="Principles that guide our product"
          />
          <div className="max-w-3xl mx-auto mt-12 space-y-6">
            {[
              'Compliance should be proactive, not reactive',
              'Every landlord should know their true equity position',
              'Professional reporting builds investor and partner confidence',
              'Multi-entity ownership shouldn\'t mean multi-spreadsheet chaos',
              'Good data leads to better decisions',
            ].map((belief, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-lg border bg-muted/20">
                <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="font-medium">{belief}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to professionalise your operations?</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Join portfolio managers across the UK who trust our platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/contact">Get in Touch</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/demo">View Demo</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
