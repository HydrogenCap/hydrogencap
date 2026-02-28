import { SEO } from '@/components/SEO';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Calendar, TrendingUp, CheckCircle } from 'lucide-react';
import { MarketingLayout, SectionHeading } from '@/components/marketing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const caseStudies = [
  {
    id: 'shropshire-hmo',
    title: '5-Bed HMO Social Housing Lease',
    location: 'Shropshire',
    type: 'HMO',
    summary: 'Conversion of a traditional family home into a compliant 5-bed HMO with long-term social housing lease.',
    problem: 'The property required significant works to meet HMO licensing requirements while maintaining profitability under a fixed-income lease structure.',
    approach: [
      'Comprehensive compliance audit using the dashboard',
      'Fire safety and means of escape planning',
      'Room sizing and amenity ratio optimisation',
      'Lease negotiation with council-approved provider',
    ],
    timeline: '8 months from acquisition to first rent',
    outcomes: [
      'Full HMO licence obtained first application',
      'Zero compliance gaps at inspection',
      '5-year lease with CPI-linked increases',
      'Net yield above regional average',
    ],
  },
  {
    id: 'cheltenham-conversion',
    title: '6-Bed Conversion with Refinance Plan',
    location: 'Cheltenham',
    type: 'HMO',
    summary: 'A Victorian property conversion with integrated refinance modelling from day one.',
    problem: 'Bridge finance required exit within 12 months. The project needed clear milestones and documentation for lender confidence.',
    approach: [
      'Tracked all works phases in the dashboard',
      'Compliance documents uploaded as completed',
      'Refinance modelling with target LTV scenarios',
      'Broker pack generated directly from system',
    ],
    timeline: '10 months to refinance completion',
    outcomes: [
      'Refinanced 2 weeks ahead of bridge expiry',
      'Achieved target valuation for exit LTV',
      'Seamless broker pack submission',
      'Retained equity for next acquisition',
    ],
  },
  {
    id: 'bridgwater-care-home',
    title: '17-Bed Care Home to HMO Conversion',
    location: 'Bridgwater, Somerset',
    type: 'Large HMO',
    summary: 'Complex conversion of a former residential care home into a large-scale HMO with Article 4 considerations.',
    problem: 'Large HMOs (7+ beds) face intense scrutiny. Previous use as care home meant navigating change of use and enhanced compliance.',
    approach: [
      'Planning and licensing timeline tracked centrally',
      'All 15+ compliance certificates managed in one place',
      'Room-by-room condition and spec documented',
      'Regular reports generated for investors',
    ],
    timeline: '14 months including planning',
    outcomes: [
      'Successful change of use approval',
      'Large HMO licence granted',
      'Institutional-quality compliance file',
      'Investor updates delivered monthly',
    ],
  },
];

export default function MarketingCaseStudies() {
  return (
    <MarketingLayout>
      <SEO
        title="Case Studies — HydrogenCap"
        description="See how UK landlords use HydrogenCap to manage compliance, track rent, and grow their property portfolios."
      />
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
              Case Studies
            </span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Real projects. Real results.
            </h1>
            <p className="text-xl text-muted-foreground">
              Explore how portfolio managers use the dashboard to track acquisitions, conversions, and refinancing.
            </p>
          </div>
        </div>
      </section>

      {/* Case Studies Grid */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            {caseStudies.map((study) => (
              <Card key={study.id} className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{study.type}</Badge>
                    <Badge variant="secondary">{study.location}</Badge>
                  </div>
                  <CardTitle className="text-xl">{study.title}</CardTitle>
                  <CardDescription>{study.summary}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to={`/case-studies/${study.id}`}>
                      Read Case Study
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Case Study Detail */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Featured"
            title={caseStudies[0].title}
            description={caseStudies[0].summary}
          />
          
          <div className="grid md:grid-cols-2 gap-12 mt-12">
            <div className="space-y-8">
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  The Challenge
                </h3>
                <p className="text-muted-foreground">{caseStudies[0].problem}</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Our Approach
                </h3>
                <ul className="space-y-2">
                  {caseStudies[0].approach.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="space-y-8">
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Timeline
                </h3>
                <p className="text-muted-foreground">{caseStudies[0].timeline}</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Outcomes
                </h3>
                <ul className="space-y-2">
                  {caseStudies[0].outcomes.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-emerald-500 mt-1 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Have a similar project?</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Let's discuss how the dashboard can support your next acquisition or conversion.
          </p>
          <Button size="lg" asChild>
            <Link to="/contact">
              Book a Consultation
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
}
