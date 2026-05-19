import { SEO } from '@/components/SEO';
import { breadcrumbList, faqPage, productWithOffers } from '@/lib/seo/jsonLd';
import { Link } from 'react-router-dom';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { MarketingLayout, SectionHeading } from '@/components/marketing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const plans = [
  {
    name: 'Starter',
    price: '£49',
    period: '/month',
    description: 'For landlords with a small portfolio getting started with professional management.',
    properties: 'Up to 10 properties',
    features: [
      'Portfolio dashboard & KPIs',
      'Compliance tracking & alerts',
      'Document storage',
      'Basic reporting',
      'Email support',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Professional',
    price: '£99',
    period: '/month',
    description: 'For growing portfolios that need multi-entity management and advanced reporting.',
    properties: 'Up to 50 properties',
    features: [
      'Everything in Starter',
      'Multi-entity / SPV management',
      'Mortgage & refinance tracking',
      'Broker pack generation',
      'Insurance schedule reports',
      'Compliance calendar',
      'Priority support',
    ],
    cta: 'Book a Demo',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large portfolios and fund operators requiring bespoke configuration.',
    properties: 'Unlimited properties',
    features: [
      'Everything in Professional',
      'Investor reporting suite',
      'Custom integrations',
      'Dedicated account manager',
      'Custom data migration',
      'SLA & uptime guarantee',
      'Audit trail & compliance exports',
    ],
    cta: 'Contact Us',
    popular: false,
  },
];

const faqs = [
  {
    q: 'Is there a free trial?',
    a: 'We offer a free 14-day trial on Starter and Professional plans. No credit card required — just book a demo and we\'ll get you set up.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes. You can upgrade or downgrade at any time. Changes take effect on your next billing cycle, and we pro-rate any differences.',
  },
  {
    q: 'What counts as a "property"?',
    a: 'Each address counts as one property, regardless of the number of rooms or units. An 8-bed HMO is one property. A block of 4 flats at the same address is also one property.',
  },
  {
    q: 'Do you offer annual billing?',
    a: 'Yes. Annual billing comes with a 20% discount. Contact us for details.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit and debit cards via Stripe. Enterprise customers can pay by invoice and bank transfer.',
  },
  {
    q: 'Can I cancel at any time?',
    a: 'Yes. There are no long-term contracts. You can cancel at any time and retain access until the end of your billing period.',
  },
];

export default function MarketingPricing() {
  return (
    <MarketingLayout>
      <SEO
        title="Pricing — Tenure IQ"
        description="Simple, transparent pricing for UK property portfolio management. Plans from £49/month for landlords managing HMOs and buy-to-lets."
        jsonLd={[
          breadcrumbList([
            { name: 'Home', path: '/' },
            { name: 'Pricing', path: '/pricing' },
          ]),
          faqPage(faqs),
          productWithOffers(
            'Tenure IQ',
            'Property portfolio management for UK landlords and investors.',
            [
              { name: 'Starter', priceGbp: 49, description: 'Up to 10 properties' },
              { name: 'Professional', priceGbp: 99, description: 'Up to 50 properties' },
              { name: 'Enterprise', description: 'Unlimited properties' },
            ],
          ),
        ]}
      />

      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
              Pricing
            </span>
            <h1 className="text-4xl md:text-5xl font-display tracking-tight">
              Simple, transparent pricing
            </h1>
            <p className="text-xl text-muted-foreground">
              No hidden fees. No per-user charges. Just one plan that fits your portfolio size.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative h-full flex flex-col ${plan.popular ? 'border-primary shadow-lg' : ''}`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <CardDescription className="mt-2">{plan.description}</CardDescription>
                  <p className="text-sm font-medium text-primary mt-2">{plan.properties}</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-3 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-6"
                    variant={plan.popular ? 'default' : 'outline'}
                    asChild
                  >
                    <Link to={plan.name === 'Enterprise' ? '/contact' : '/book-a-demo'}>
                      {plan.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <SectionHeading
              badge="FAQ"
              title="Frequently asked questions"
            />
            <Accordion type="single" collapsible className="mt-12">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Book a demo and we'll walk you through the platform with your portfolio in mind.
          </p>
          <Button size="lg" asChild>
            <Link to="/book-a-demo">
              Book a Demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
}
