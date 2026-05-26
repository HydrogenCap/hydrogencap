import { SEO } from '@/components/SEO';
import { breadcrumbList, faqPage, productWithOffers } from '@/lib/seo/jsonLd';
import { Link } from 'react-router-dom';
import { CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { MarketingLayout, SectionHeading } from '@/components/marketing';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

const plans = [
  {
    name: 'Starter',
    price: '£49',
    period: '/month',
    description: 'For landlords getting their portfolio onto a proper system.',
    properties: 'Up to 10 properties',
    features: [
      'Portfolio dashboard & KPIs',
      'Compliance tracking & alerts',
      'Document storage',
      'Basic reporting',
      'Email support',
    ],
    cta: 'Get started',
    popular: false,
  },
  {
    name: 'Professional',
    price: '£99',
    period: '/month',
    description: 'For growing portfolios that need multi-entity management.',
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
    cta: 'Book a demo',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large portfolios and fund operators with bespoke needs.',
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
    cta: 'Contact us',
    popular: false,
  },
];

const faqs = [
  {
    q: 'Is there a free trial?',
    a: 'We offer a free 14-day trial on Starter and Professional plans. No credit card required — just book a demo and we will get you set up.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes. Upgrade or downgrade at any time. Changes take effect on your next billing cycle, and we pro-rate any differences.',
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
    a: 'All major credit and debit cards via Stripe. Enterprise customers can pay by invoice and bank transfer.',
  },
  {
    q: 'Can I cancel at any time?',
    a: 'Yes. There are no long-term contracts. Cancel any time and retain access until the end of your billing period.',
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

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border bg-card">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-[60rem] rounded-full bg-gold/10 blur-3xl" aria-hidden="true" />
        <div className="container relative mx-auto px-4 lg:px-8 py-24 lg:py-28 text-center max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-gold font-semibold mb-6">
            Pricing
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-extrabold leading-[1.02] tracking-tight">
            Simple, transparent,{' '}
            <span className="text-primary">no per-user fees.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground font-light leading-relaxed">
            One price per portfolio band. Everyone on your team gets full access —
            no surprise charges as you grow.
          </p>
        </div>
      </section>

      {/* PRICING TABLE */}
      <section className="py-24 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  'relative flex flex-col rounded-2xl border bg-background p-8 transition-shadow',
                  plan.popular
                    ? 'border-primary shadow-2xl shadow-primary/10 lg:-translate-y-2'
                    : 'border-border hover:shadow-lg'
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-[10px] uppercase tracking-widest font-bold text-gold-foreground">
                    <Sparkles className="h-3 w-3" />
                    Most popular
                  </div>
                )}

                <p className="text-xs uppercase tracking-[0.18em] font-semibold text-muted-foreground">
                  {plan.name}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-5xl font-extrabold tracking-tight text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {plan.description}
                </p>
                <p className="mt-3 inline-flex self-start rounded-full bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary">
                  {plan.properties}
                </p>

                <div className="my-6 h-px bg-border" />

                <ul className="space-y-3 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="mt-0.5 h-4 w-4 text-gold shrink-0" />
                      <span className="text-foreground/85">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn(
                    'w-full mt-8 font-display font-semibold tracking-wide',
                    plan.popular && 'bg-gold text-gold-foreground hover:bg-gold/90'
                  )}
                  variant={plan.popular ? 'default' : 'outline'}
                  asChild
                >
                  <Link to={plan.name === 'Enterprise' ? '/contact' : '/book-a-demo'}>
                    {plan.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-card border-y border-border py-24 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <SectionHeading badge="FAQ" title="Frequently asked questions" />
          <Accordion type="single" collapsible className="mt-12">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left font-display font-semibold text-base">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-gold/20 blur-3xl" aria-hidden="true" />
        <div className="container relative mx-auto px-4 lg:px-8 py-24 text-center max-w-3xl">
          <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Try it before you decide.
          </h2>
          <p className="mt-6 text-lg text-primary-foreground/75 font-light max-w-xl mx-auto">
            Book a 20-minute demo and we will walk through the platform with
            your portfolio in mind — no commitment.
          </p>
          <div className="mt-10">
            <Button size="lg" className="font-display font-semibold tracking-wide bg-gold text-gold-foreground hover:bg-gold/90" asChild>
              <Link to="/book-a-demo">
                Book a demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
