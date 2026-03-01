import { SEO } from '@/components/SEO';
import { Link } from 'react-router-dom';
import {
  Shield,
  Lock,
  Server,
  Eye,
  Database,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { MarketingLayout, SectionHeading } from '@/components/marketing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const encryptionTable = [
  { layer: 'Data in transit', standard: 'TLS 1.3 (minimum TLS 1.2)' },
  { layer: 'Data at rest', standard: 'AES-256' },
  { layer: 'Database backups', standard: 'AES-256, stored in separate region' },
  { layer: 'Document storage', standard: 'AES-256 server-side encryption' },
];

const gdprRights = [
  { right: 'Right of access', detail: 'Request a copy of all data we hold about you' },
  { right: 'Right to erasure', detail: 'Request deletion of your account and all associated data' },
  { right: 'Right to portability', detail: 'Export your portfolio data at any time in CSV/JSON format' },
  { right: 'Right to rectification', detail: 'Correct any inaccurate personal data' },
];

const sections = [
  {
    icon: Server,
    title: 'Data Hosting & Infrastructure',
    content: 'Tenure IQ is hosted on secure, managed infrastructure in UK and EU data centres. Your data is stored with enterprise-grade hosting providers that hold SOC 2 Type II and ISO 27001 certifications. We use managed database services with automatic failover and server-side encryption enabled by default.',
  },
  {
    icon: Eye,
    title: 'Access Controls',
    items: [
      'Role-Based Access Control (RBAC): Owner, Admin, Manager, and Viewer roles. You control who can see what.',
      'Session management: Sessions expire after inactivity. JWT tokens are rotated on each login.',
      'API access: Service-role keys are never exposed to client-side code. All authenticated API calls require a valid user JWT.',
    ],
  },
  {
    icon: Database,
    title: 'Data Isolation',
    content: 'Each organisation\'s data is isolated at the database level using Row Level Security (RLS). It is architecturally impossible for one Tenure IQ customer to access another customer\'s data, even in the event of an application-level bug.',
  },
  {
    icon: FileText,
    title: 'Audit Trail',
    content: 'Every sensitive action in your account generates an immutable audit log entry — including logins, data changes, document uploads, role changes, and data exports. Audit logs cannot be edited or deleted, including by Tenure IQ staff.',
  },
  {
    icon: Clock,
    title: 'Backups & Recovery',
    items: [
      'Automated daily database backups',
      'Point-in-time recovery available for the last 35 days',
      'Backup data stored in a separate region from primary data',
      'Backup restoration tested quarterly',
    ],
  },
];

export default function MarketingSecurity() {
  return (
    <MarketingLayout>
      <SEO
        title="Security & Data Protection — Tenure IQ"
        description="Learn how Tenure IQ protects your property portfolio data with enterprise-grade encryption, UK data hosting, GDPR compliance, and immutable audit trails."
      />

      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
              Security
            </span>
            <h1 className="text-4xl md:text-5xl font-display tracking-tight">
              How we protect your portfolio data
            </h1>
            <p className="text-xl text-muted-foreground">
              Your property data is among the most sensitive financial information you hold. We take that seriously.
            </p>
          </div>
        </div>
      </section>

      {/* Encryption Table */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <SectionHeading
              badge="Encryption"
              title="End-to-end data protection"
              description="All data is encrypted both in transit and at rest using industry-standard protocols."
            />
            <div className="mt-12">
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Layer</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Standard</th>
                        </tr>
                      </thead>
                      <tbody>
                        {encryptionTable.map((row) => (
                          <tr key={row.layer} className="border-b last:border-0">
                            <td className="p-4 font-medium text-sm flex items-center gap-2">
                              <Lock className="h-4 w-4 text-primary" />
                              {row.layer}
                            </td>
                            <td className="p-4 text-sm text-muted-foreground">{row.standard}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Infrastructure & Controls */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {sections.map((section) => (
              <Card key={section.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <section.icon className="h-5 w-5 text-primary" />
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {section.content && (
                    <p className="text-muted-foreground">{section.content}</p>
                  )}
                  {section.items && (
                    <ul className="space-y-3">
                      {section.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-muted-foreground">
                          <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                          <span className="text-sm">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* GDPR */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <SectionHeading
              badge="GDPR & Privacy"
              title="Your rights under UK GDPR"
              description="Tenure IQ is operated by Oxygen Management Ltd, a registered Data Controller with the ICO. Registration No. ZB490980."
            />
            <div className="grid sm:grid-cols-2 gap-4 mt-12">
              {gdprRights.map((item) => (
                <Card key={item.right}>
                  <CardContent className="pt-6">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      {item.right}
                    </h4>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-8 p-6 rounded-lg border bg-muted/20">
              <p className="text-sm text-muted-foreground">
                <strong>Data retention:</strong> We retain your data for as long as your account is active. Upon account closure, all personal data is deleted within 30 days. To exercise any of your rights, email{' '}
                <a href="mailto:office@tenureiq.com" className="text-primary hover:underline">office@tenureiq.com</a>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Responsible Disclosure */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="py-8">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Responsible Disclosure</h3>
                    <p className="text-muted-foreground mb-4">
                      If you discover a security vulnerability in Tenure IQ, please email{' '}
                      <a href="mailto:office@tenureiq.com" className="text-primary hover:underline">office@tenureiq.com</a>.
                      We will acknowledge receipt within 48 hours. We ask that you do not publicly disclose vulnerabilities before we have had an opportunity to address them.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Questions about security?</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            We're happy to discuss our security practices in detail during a demo call.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/book-a-demo">
                Book a Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/privacy">Privacy Policy</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
