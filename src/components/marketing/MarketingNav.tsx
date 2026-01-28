import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navLinks = [
  { label: 'Product', href: '/product' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Case Studies', href: '/case-studies' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">O</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm leading-tight">Oxygen</span>
            <span className="text-[10px] text-muted-foreground leading-tight">Portfolio Dashboard</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                location.pathname === link.href
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/demo">View Demo</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/contact">Book a Demo</Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-background animate-fade-in">
          <div className="container mx-auto px-4 py-4 space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'block text-sm font-medium py-2 transition-colors',
                  location.pathname === link.href
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-4 border-t">
              <Button variant="outline" size="sm" asChild>
                <Link to="/demo" onClick={() => setMobileOpen(false)}>View Demo</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/contact" onClick={() => setMobileOpen(false)}>Book a Demo</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
