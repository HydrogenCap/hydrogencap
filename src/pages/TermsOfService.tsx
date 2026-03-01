import { MarketingLayout } from '@/components/marketing';
import { SEO } from '@/components/SEO';

export default function TermsOfService() {
  return (
    <MarketingLayout>
      <SEO
        title="Terms of Service | Tenure IQ"
        description="Terms and conditions for using the Tenure IQ property portfolio management platform."
      />
      <div className="container max-w-3xl py-16 space-y-8">
        <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: 12 February 2026</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground">
            By accessing or using Tenure IQ, you agree to be bound by these Terms of Service.
            If you do not agree, you may not use the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">2. Description of Service</h2>
          <p className="text-muted-foreground">
            Tenure IQ provides a property portfolio management platform including compliance
            tracking, financial analysis, document management, and reporting tools.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">3. User Accounts</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>You must provide accurate and complete registration information</li>
            <li>You are responsible for maintaining the security of your account</li>
            <li>You must notify us immediately of any unauthorized use</li>
            <li>One person or entity per account; no shared accounts</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">4. Subscriptions & Billing</h2>
          <p className="text-muted-foreground">
            Paid plans are billed monthly. You can cancel at any time. Cancellation takes effect
            at the end of your current billing period. Refunds are issued at our discretion.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">5. Acceptable Use</h2>
          <p className="text-muted-foreground">
            You agree not to: (a) violate laws, (b) upload malicious content, (c) attempt to
            access other users' data, (d) reverse-engineer the platform, or (e) use the service
            for any unlawful purpose.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">6. Intellectual Property</h2>
          <p className="text-muted-foreground">
            The platform, including its design, code, and content, is owned by Tenure IQ.
            You retain ownership of any data you upload. We do not claim rights to your content.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">7. Limitation of Liability</h2>
          <p className="text-muted-foreground">
            The platform is provided "as is". We are not liable for any indirect, incidental, or
            consequential damages. Our total liability is limited to the amount you paid in the
            preceding 12 months.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">8. Governing Law</h2>
          <p className="text-muted-foreground">
            These terms are governed by the laws of England and Wales.
          </p>
        </section>
      </div>
    </MarketingLayout>
  );
}
