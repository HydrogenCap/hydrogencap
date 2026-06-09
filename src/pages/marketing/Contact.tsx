import { SEO } from '@/components/SEO';
import { breadcrumbList } from '@/lib/seo/jsonLd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Calendar, CheckCircle, Send } from 'lucide-react';
import { MarketingLayout } from '@/components/marketing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";

export default function MarketingContact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    message: '',
    website: '', // honeypot — must stay empty
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('submit-demo-request', {
        body: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          company: formData.company || null,
          message: formData.message || null,
          website: formData.website,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setIsSubmitted(true);
      toast.success('Message sent!', { description: 'We\'ll be in touch within 24 hours.' });
    } catch (error) {
      console.error('Submission error:', error);
      const msg = error instanceof Error ? error.message : 'Please try again or email us directly.';
      toast.error('Submission failed', { description: msg });
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
        title="Contact Us — Tenure IQ"
        description="Get in touch with the Tenure IQ team. Book a demo, ask a question, or tell us about your portfolio management needs."
        jsonLd={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Contact', path: '/contact' },
        ])}
      />
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
              Contact
            </span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Let's talk about your portfolio
            </h1>
            <p className="text-xl text-muted-foreground">
              Book a demo, ask a question, or just say hello. We typically respond within 24 hours.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Form */}
            <Card>
              <CardHeader>
                <CardTitle>Book a Demo</CardTitle>
                <CardDescription>
                  Fill in the form and we'll schedule a call to walk you through the platform.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isSubmitted ? (
                  <div className="py-12 text-center">
                     <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                       <CheckCircle className="h-8 w-8 text-success" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Thank you!</h3>
                    <p className="text-muted-foreground mb-6">
                      We've received your message and will be in touch within 24 hours.
                    </p>
                    <Button variant="outline" onClick={() => setIsSubmitted(false)}>
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Honeypot — hidden from real users, bots typically fill all fields. */}
                    <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
                      <Label htmlFor="contact-website">Website</Label>
                      <Input
                        id="contact-website"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={formData.website}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          placeholder="Your name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          placeholder="you@company.com"
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone (optional)</Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="+44 7XXX XXXXXX"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company">Company (optional)</Label>
                        <Input
                          id="company"
                          name="company"
                          value={formData.company}
                          onChange={handleChange}
                          placeholder="Your company"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        placeholder="Tell us about your portfolio and what you're looking for..."
                        rows={4}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        'Sending...'
                      ) : (
                        <>
                          Send Message
                          <Send className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold mb-6">Other ways to reach us</h3>
                <div className="space-y-4">
                  <a
                    href="mailto:office@oxygen.rocks"
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">office@oxygen.rocks</p>
                    </div>
                  </a>
                  <div className="flex items-center gap-4 p-4 rounded-lg border">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Location</p>
                      <p className="text-sm text-muted-foreground">United Kingdom</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Calendar Placeholder */}
              <Card>
                <CardContent className="py-8 text-center">
                  <Calendar className="h-12 w-12 text-primary/30 mx-auto mb-4" />
                  <h4 className="font-semibold mb-2">Prefer to book directly?</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Schedule a 30-minute demo call at a time that suits you.
                  </p>
                  <Button variant="outline" disabled>
                    Calendar Integration Coming Soon
                  </Button>
                </CardContent>
              </Card>

              {/* FAQ Prompt */}
              <div className="p-6 rounded-lg bg-muted/30 border">
                <h4 className="font-semibold mb-2">Have questions?</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Check our FAQ section for answers to common questions about the platform.
                </p>
                <Button variant="link" className="p-0 h-auto" asChild>
                  <Link to="/product#faq">View FAQ →</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
