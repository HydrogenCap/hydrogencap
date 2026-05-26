import { SEO } from '@/components/SEO';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  TrendingUp,
  FileBarChart,
  Building2,
  CalendarClock,
  Wallet,
  Sparkles,
  Check,
} from 'lucide-react';
import { MarketingLayout } from '@/components/marketing';
import { Button } from '@/components/ui/button';

const pillars = [
  {
    icon: ShieldCheck,
    title: 'Compliance, on autopilot',
    body: 'EICR, Gas Safety, EPC, fire safety and HMO licences tracked with pre-expiry alerts and a full evidence trail.',
  },
  {
    icon: TrendingUp,
    title: 'Yield you can defend',
    body: 'Live LTV, DSCR, WAULT and cashflow — calculated from actual transactions, not last quarter’s spreadsheet.',
  },
  {
    icon: FileBarChart,
    title: 'Lender-grade reporting',
    body: 'One-click broker packs, insurance summaries and investor reports — properly branded, properly accurate.',
  },
  {
    icon: Building2,
    title: 'Built for SPV structures',
    body: 'Look-through ownership across SPVs, JVs and trusts. See beneficial ownership and true equity at a glance.',
  },
  {
    icon: CalendarClock,
    title: 'Refinance radar',
    body: 'Loans coming off fix in the next 180 days, surfaced months before the conversation with your broker.',
  },
  {
    icon: Wallet,
    title: 'Rent reconciliation',
    body: 'Bank-feed matching with confidence scoring. Arrears flagged the day they happen — not the month after.',
  },
];

const kpis = [
  { value: '£4.2M', label: 'Portfolio value' },
  { value: '57%', label: 'Weighted LTV' },
  { value: '£12,450', label: 'Monthly cashflow' },
  { value: '100%', label: 'Compliance cover' },
];

const proofPoints = [
  'No spreadsheets. No more lost certificates.',
  'Built around UK HMO, BTL and mixed-use portfolios.',
  'AI-assisted import — your portfolio live in under an hour.',
];

const locations = ['Oxfordshire', 'Cheltenham', 'Shropshire', 'Somerset', 'Gloucestershire', 'Bristol'];

export default function MarketingHome() {
  return (
    <MarketingLayout>
      <SEO
        title="Tenure IQ — Property Intelligence for UK Portfolios"
        description="Track HMO and BTL compliance, rent collection and portfolio performance from one investor-grade dashboard. Built for UK landlords and asset managers."
        ogImage="https://tenureiq.com/og-image.jpg"
      />

      {/* ─────────────────── HERO — split screen ─────────────────── */}
      <section className="relative overflow-hidden border-b border-border bg-background">
        {/* subtle navy wash on right column */}
        <div className="absolute inset-y-0 right-0 hidden lg:block lg:w-1/2 bg-gradient-to-br from-primary via-primary to-[hsl(220_55%_20%)]" aria-hidden="true" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gold/20 blur-3xl" aria-hidden="true" />

        <div className="container relative mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 px-4 lg:px-8 py-20 lg:py-28">
          {/* LEFT — copy */}
          <div className="flex flex-col justify-center max-w-xl">
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Property Intelligence Platform
            </div>

            <h1 className="font-display text-5xl md:text-6xl lg:text-[4.25rem] font-extrabold leading-[1.02] tracking-tight text-foreground">
              The operating system for{' '}
              <span className="relative inline-block">
                <span className="relative z-10">UK property</span>
                <span className="absolute inset-x-0 bottom-1 h-3 bg-gold/40 -z-0" aria-hidden="true" />
              </span>{' '}
              portfolios.
            </h1>

            <p className="mt-6 text-lg md:text-xl font-light text-muted-foreground leading-relaxed">
              Know your yield. Prove your compliance. Refinance with confidence —
              all from one investor-grade dashboard built for HMO and BTL operators.
            </p>

            <ul className="mt-8 space-y-2.5">
              {proofPoints.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm text-foreground/80">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  {p}
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Button size="lg" className="font-display font-semibold tracking-wide bg-gold text-gold-foreground hover:bg-gold/90 shadow-lg shadow-gold/20" asChild>
                <Link to="/book-a-demo">
                  Book a demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="font-display font-semibold tracking-wide" asChild>
                <Link to="/demo">Tour the dashboard</Link>
              </Button>
            </div>

            <p className="mt-8 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Used by portfolios across {locations.slice(0, 4).join(' · ')} + more
            </p>
          </div>

          {/* RIGHT — dashboard mock */}
          <div className="relative flex items-center justify-center">
            <div className="relative w-full max-w-lg">
              {/* glow */}
              <div className="absolute -inset-8 bg-gold/10 blur-3xl rounded-full" aria-hidden="true" />

              <div className="relative rounded-2xl border border-white/10 bg-[hsl(220_40%_12%)] p-5 shadow-2xl backdrop-blur ring-1 ring-white/5">
                <div className="flex items-center justify-between text-white/70">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-gold" />
                    <span className="text-xs font-medium tracking-wide">PORTFOLIO OVERVIEW</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest">Live</span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {kpis.map((k) => (
                    <div key={k.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-[10px] uppercase tracking-widest text-white/50">{k.label}</p>
                      <p className="mt-1 font-display text-2xl font-bold text-white">{k.value}</p>
                    </div>
                  ))}
                </div>

                {/* Sparkline */}
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">12-month cashflow</span>
                    <span className="text-xs font-medium text-gold flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3" /> +18.4%
                    </span>
                  </div>
                  <svg viewBox="0 0 200 60" className="mt-3 h-16 w-full">
                    <defs>
                      <linearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity="0.55" />
                        <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,45 L20,42 L40,38 L60,40 L80,30 L100,32 L120,22 L140,25 L160,15 L180,18 L200,8 L200,60 L0,60 Z"
                      fill="url(#spark)"
                    />
                    <path
                      d="M0,45 L20,42 L40,38 L60,40 L80,30 L100,32 L120,22 L140,25 L160,15 L180,18 L200,8"
                      fill="none"
                      stroke="hsl(var(--gold))"
                      strokeWidth="1.75"
                    />
                  </svg>
                </div>

                {/* Compliance row */}
                <div className="mt-4 space-y-2">
                  {[
                    { label: 'EICR · 14 High Street', status: 'Valid', tone: 'good' },
                    { label: 'Gas Safety · 8 Station Rd', status: '23 days', tone: 'warn' },
                    { label: 'HMO Licence · 22 Park Ln', status: 'Valid', tone: 'good' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/80">
                      <span className="truncate pr-2">{row.label}</span>
                      <span
                        className={
                          row.tone === 'good'
                            ? 'rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-medium text-success'
                            : 'rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-medium text-gold'
                        }
                      >
                        {row.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* floating "alert" card */}
              <div className="absolute -left-6 bottom-10 hidden md:flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xl">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/15">
                  <Sparkles className="h-4 w-4 text-gold" />
                </div>
                <div className="pr-2">
                  <p className="text-xs font-semibold text-foreground">Refinance window</p>
                  <p className="text-[11px] text-muted-foreground">3 loans fix-expire in 90d</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────── METRIC STRIP ─────────────────── */}
      <section className="border-b border-border bg-card">
        <div className="container mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-border px-4 lg:px-8">
          {[
            { v: '2,400+', l: 'Compliance docs tracked' },
            { v: '£180M', l: 'Portfolio AUM monitored' },
            { v: '99.9%', l: 'Uptime · UK hosted' },
            { v: '< 1hr', l: 'From signup to live' },
          ].map((m) => (
            <div key={m.l} className="py-8 px-4 text-center">
              <p className="font-display text-3xl md:text-4xl font-bold text-primary">{m.v}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{m.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────── PILLAR GRID ─────────────────── */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-16">
            <div className="lg:col-span-1">
              <p className="text-xs uppercase tracking-[0.18em] text-gold font-semibold mb-4">
                What you get
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-extrabold leading-tight tracking-tight text-foreground">
                Every workflow a serious portfolio actually runs.
              </h2>
            </div>
            <div className="lg:col-span-2 flex items-end">
              <p className="text-lg text-muted-foreground font-light leading-relaxed">
                Replace the patchwork of spreadsheets, calendar reminders and inboxes
                with a single source of truth — designed around how UK landlords,
                asset managers and family offices already work.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border rounded-2xl overflow-hidden">
            {pillars.map((p) => (
              <div
                key={p.title}
                className="group bg-background p-8 transition-colors hover:bg-card"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/8 text-primary group-hover:bg-gold/15 group-hover:text-gold transition-colors">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 font-display text-xl font-bold tracking-tight text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── HOW IT WORKS — editorial steps ─────────────────── */}
      <section className="bg-card border-y border-border py-24 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-2xl mb-16">
            <p className="text-xs uppercase tracking-[0.18em] text-gold font-semibold mb-4">
              How it works
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
              From scattered to investor-ready in three moves.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border rounded-2xl overflow-hidden">
            {[
              {
                n: '01',
                t: 'Import your portfolio',
                d: 'CSV, PDF certificates or manual entry. We auto-enrich with EPC, Land Registry and Companies House data.',
              },
              {
                n: '02',
                t: 'Configure your stack',
                d: 'Map SPVs, lenders and tenancies. Set compliance cadences and refinance windows once — re-use forever.',
              },
              {
                n: '03',
                t: 'Operate with conviction',
                d: 'Daily alerts, monthly investor reports, on-demand broker packs. Built for boards, banks and regulators.',
              },
            ].map((s) => (
              <div key={s.n} className="bg-background p-10">
                <div className="font-display text-6xl font-bold text-gold/40 leading-none">
                  {s.n}
                </div>
                <h3 className="mt-6 font-display text-2xl font-bold tracking-tight">{s.t}</h3>
                <p className="mt-3 text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── TESTIMONIAL — single, large ─────────────────── */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <p className="text-xs uppercase tracking-[0.18em] text-gold font-semibold mb-6 text-center">
            From the field
          </p>
          <blockquote className="font-display text-2xl md:text-4xl font-medium leading-[1.25] tracking-tight text-center text-foreground">
            <span className="text-gold">“</span>
            Finally a system that understands how UK HMO portfolios actually work.
            The compliance tracking alone has saved us countless hours — and the
            refinance modelling made our last remortgage genuinely painless.
            <span className="text-gold">”</span>
          </blockquote>
          <div className="mt-8 flex items-center justify-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-display font-bold text-primary">
              SM
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">Sarah M.</p>
              <p className="text-sm text-muted-foreground">Property Director · Midlands Portfolio Ltd</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────── CTA — navy slab ─────────────────── */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-gold/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" aria-hidden="true" />

        <div className="container relative mx-auto px-4 lg:px-8 py-24 lg:py-32 text-center max-w-3xl">
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            Professionalise your portfolio
            <span className="block text-gold">in a single afternoon.</span>
          </h2>
          <p className="mt-6 text-lg text-primary-foreground/75 font-light max-w-xl mx-auto">
            Join the operators across the UK who replaced their spreadsheet stack
            with one investor-grade source of truth.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="font-display font-semibold tracking-wide bg-gold text-gold-foreground hover:bg-gold/90" asChild>
              <Link to="/book-a-demo">
                Book a demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="font-display font-semibold tracking-wide bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              asChild
            >
              <Link to="/demo">Tour the dashboard</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
