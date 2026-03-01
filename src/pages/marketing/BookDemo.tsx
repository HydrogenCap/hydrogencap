import { SEO } from '@/components/SEO';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, CheckCircle, ArrowRight, Building2, Shield, BarChart3 } from 'lucide-react';
import { MarketingLayout, SectionHeading } from '@/components/marketing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const benefits = [
  {
    icon: Building2,
    title: 'See your portfolio in one view',
    description: 'We\'ll show you how your properties, entities, and compliance data come together in a single dashboard.',
  },
  {
    icon: Shield,
    title: 'Compliance tracking walkthrough',
    description: 'See how the platform tracks Gas Safety, EICRs, EPCs, HMO licences and more — with automatic renewal alerts.',
  },
  {
    icon: BarChart3,
    title: 'Reporting & refinance tools',
    description: 'Generate mortgage broker packs, insurance schedules, and investor reports in minutes.',
  },
];

export default function MarketingBookDemo() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    portfolioSize: '',
    assetType: '',
    challenge: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('demo_requests')
        .insert({
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          company: formData.company || null,
          message: `Portfolio: ${formData.portfolioSize} | Asset type: ${formData.assetType} | Challenge: ${formData.challenge}${formData.message ? ` | Notes: ${formData.message}` : ''}`,
        });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: 'Demo request received!',
        description: 'We\'ll be in touch within 24 hours to schedule your call.',
      });
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: 'Submission failed',
        description: 'Please try again or email us at office@tenureiq.com.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <MarketingLayout>
      <SEO
        title="Book a Demo — Tenure IQ"
        description="Book a free 20-minute demo of Tenure IQ. See how UK landlords manage HMO compliance, track portfolio yield, and generate professional reports."
      />

      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
              Book a Demo
            </span>
            <h1 className="text-4xl md:text-5xl font-display tracking-tight">
              See your portfolio in Tenure IQ
            </h1>
            <p className="text-xl text-muted-foreground">
              A free 20-minute call to walk through the platform with your data in mind. No commitment, no hard sell.
            </p>
          </div>
        </div>
      </section>

      {/* Form + Benefits */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Form */}
            <Card>
              <CardHeader>
                <CardTitle>Request your demo</CardTitle>
                <CardDescription>
                  Tell us a bit about your portfolio so we can tailor the walkthrough.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isSubmitted ? (
                  <div className="py-12 text-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">We'll be in touch!</h3>
                    <p className="text-muted-foreground mb-6">
                      Expect an email within 24 hours to schedule your personalised demo.
                    </p>
                    <Button variant="outline" onClick={() => setIsSubmitted(false)}>
                      Submit Another Request
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input id="name" name="name" value={formData.name} onChange={handleChange} required placeholder="Your name" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="you@company.com" />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone (optional)</Label>
                        <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="+44 7XXX XXXXXX" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company">Company (optional)</Label>
                        <Input id="company" name="company" value={formData.company} onChange={handleChange} placeholder="Your company" />
                      </div>
                    </div>

                    {/* Pre-qualification fields */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Portfolio size *</Label>
                        <Select value={formData.portfolioSize} onValueChange={(v) => setFormData({ ...formData, portfolioSize: v })} required>
                          <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1-2">1–2 properties</SelectItem>
                            <SelectItem value="3-10">3–10 properties</SelectItem>
                            <SelectItem value="11-25">11–25 properties</SelectItem>
                            <SelectItem value="26-50">26–50 properties</SelectItem>
                            <SelectItem value="50+">50+ properties</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Primary asset type *</Label>
                        <Select value={formData.assetType} onValueChange={(v) => setFormData({ ...formData, assetType: v })} required>
                          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hmo">HMO</SelectItem>
                            <SelectItem value="btl">Buy-to-Let</SelectItem>
                            <SelectItem value="mixed">Mixed (HMO + BTL)</SelectItem>
                            <SelectItem value="sa">Serviced Accommodation</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Biggest current challenge *</Label>
                      <Select value={formData.challenge} onValueChange={(v) => setFormData({ ...formData, challenge: v })} required>
                        <SelectTrigger><SelectValue placeholder="Select challenge" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compliance">Compliance tracking</SelectItem>
                          <SelectItem value="yield">Yield & performance visibility</SelectItem>
                          <SelectItem value="tenants">Tenant management</SelectItem>
                          <SelectItem value="reporting">Portfolio reporting</SelectItem>
                          <SelectItem value="multi-entity">Multi-entity / SPV management</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Anything else? (optional)</Label>
                      <Textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        placeholder="Tell us more about your portfolio or what you'd like to see..."
                        rows={3}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? 'Sending...' : (
                        <>
                          Request Demo
                          <Send className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Benefits */}
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold mb-2">What to expect</h3>
                <p className="text-muted-foreground">
                  A 20-minute call with a product specialist. We'll tailor the demo to your portfolio type and show you the features that matter most.
                </p>
              </div>

              <div className="space-y-6">
                {benefits.map((benefit) => (
                  <div key={benefit.title} className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">{benefit.title}</h4>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Social proof */}
              <div className="p-6 rounded-lg bg-muted/30 border">
                <blockquote className="text-sm italic text-muted-foreground mb-3">
                  "The demo showed me exactly how my 14-property portfolio would look in the system. I signed up the same day."
                </blockquote>
                <p className="text-sm font-medium">— HMO portfolio manager, Manchester</p>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>Prefer to explore first?</p>
                <Button variant="link" className="p-0 h-auto" asChild>
                  <Link to="/demo">View the interactive demo dashboard →</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
