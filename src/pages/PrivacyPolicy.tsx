import { MarketingLayout } from '@/components/marketing';

export default function PrivacyPolicy() {
  return (
    <MarketingLayout>
      <div className="container max-w-3xl py-16 space-y-8">
        <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: 12 February 2026</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
          <p className="text-muted-foreground">
            Tenure IQ ("we", "us", "our") is committed to protecting your personal data.
            This policy explains how we collect, use, and safeguard information when you use our
            property management platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">2. Data We Collect</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Account information: name, email address, password (hashed)</li>
            <li>Property data: addresses, financial details, compliance records</li>
            <li>Usage data: pages visited, features used, device and browser type</li>
            <li>Payment data: processed securely by Stripe; we do not store card details</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">3. How We Use Your Data</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>To provide, maintain, and improve our services</li>
            <li>To send compliance reminders and account notifications</li>
            <li>To process payments and manage subscriptions</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">4. Legal Basis (GDPR)</h2>
          <p className="text-muted-foreground">
            We process data under: (a) contractual necessity to provide our service,
            (b) legitimate interest in improving our platform, (c) legal obligation for
            compliance records, and (d) your consent where required.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">5. Data Retention</h2>
          <p className="text-muted-foreground">
            We retain your data for as long as your account is active. Upon deletion request,
            we remove personal data within 30 days, except where required by law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">6. Your Rights</h2>
          <p className="text-muted-foreground">
            Under GDPR, you have the right to access, rectify, erase, restrict processing,
            data portability, and object to processing. Contact us at privacy@tenureiq.com
            to exercise these rights.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">7. Data Security</h2>
          <p className="text-muted-foreground">
            We use industry-standard encryption (TLS 1.3), row-level security policies,
            and secure authentication to protect your data. Sensitive fields are encrypted at rest.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">8. Contact</h2>
          <p className="text-muted-foreground">
            For privacy inquiries, contact our Data Protection Officer at privacy@tenureiq.com.
          </p>
        </section>
      </div>
    </MarketingLayout>
  );
}
