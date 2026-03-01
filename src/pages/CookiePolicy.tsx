import { MarketingLayout } from '@/components/marketing';
import { SEO } from '@/components/SEO';

export default function CookiePolicy() {
  return (
    <MarketingLayout>
      <SEO
        title="Cookie Policy | Tenure IQ"
        description="Learn how Tenure IQ uses cookies and similar technologies on our property management platform."
      />
      <div className="container max-w-3xl py-16 space-y-8">
        <h1 className="text-3xl font-bold text-foreground">Cookie Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: 1 March 2026</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">1. What Are Cookies</h2>
          <p className="text-muted-foreground">
            Cookies are small text files stored on your device when you visit a website. They help the
            site remember your preferences and understand how you use our platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">2. Cookies We Use</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-muted-foreground border">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-foreground">Cookie</th>
                  <th className="text-left p-3 font-medium text-foreground">Type</th>
                  <th className="text-left p-3 font-medium text-foreground">Purpose</th>
                  <th className="text-left p-3 font-medium text-foreground">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-3">sb-*-auth-token</td>
                  <td className="p-3">Essential</td>
                  <td className="p-3">Keeps you signed in securely</td>
                  <td className="p-3">Session</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3">cookie-consent</td>
                  <td className="p-3">Essential</td>
                  <td className="p-3">Remembers your cookie preferences</td>
                  <td className="p-3">1 year</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3">theme</td>
                  <td className="p-3">Functional</td>
                  <td className="p-3">Stores your light/dark mode preference</td>
                  <td className="p-3">1 year</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">3. Essential Cookies</h2>
          <p className="text-muted-foreground">
            These cookies are necessary for the platform to function. They enable core features like
            authentication and security. You cannot opt out of essential cookies while using the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">4. Analytics Cookies</h2>
          <p className="text-muted-foreground">
            We do not currently use third-party analytics cookies. If we introduce analytics in the
            future, they will only be activated after you provide explicit consent via our cookie banner.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">5. Managing Cookies</h2>
          <p className="text-muted-foreground">
            You can manage your cookie preferences at any time through your browser settings. Note that
            disabling essential cookies may prevent you from using the platform. You can also update your
            consent by clearing your browser's local storage and revisiting the site.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">6. Contact</h2>
          <p className="text-muted-foreground">
            For questions about our use of cookies, contact us at{' '}
            <a href="mailto:privacy@tenureiq.com" className="text-primary hover:text-primary/80 underline">
              privacy@tenureiq.com
            </a>.
          </p>
        </section>
      </div>
    </MarketingLayout>
  );
}
