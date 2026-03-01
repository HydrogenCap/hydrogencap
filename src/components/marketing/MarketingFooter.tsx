import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import tenureIqLogo from '@/assets/tenure-iq-logo.png';

export const MarketingFooter = forwardRef<HTMLElement>(
  (_, ref) => {
    return (
      <footer ref={ref} className="border-t bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8 py-12">
          <div className="grid gap-8 md:grid-cols-4">
            {/* Brand */}
            <div className="space-y-4">
              <Link to="/" className="flex items-center gap-2">
                <img src={tenureIqLogo} alt="Tenure IQ" className="h-8 w-auto" />
                <div className="flex flex-col">
                  <span className="font-semibold text-sm leading-tight">Tenure IQ</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">Property Intelligence Platform</span>
                </div>
              </Link>
              <p className="text-sm text-muted-foreground">
                Portfolio tracking, compliance management, and investor-grade reporting for UK property portfolios.
              </p>
            </div>

            {/* Product */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/product" className="hover:text-foreground transition-colors">How It Works</Link></li>
                <li><Link to="/case-studies" className="hover:text-foreground transition-colors">Case Studies</Link></li>
                <li><Link to="/demo" className="hover:text-foreground transition-colors">Demo Dashboard</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/about" className="hover:text-foreground transition-colors">About Us</Link></li>
                <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
                <li>
                  <a href="mailto:office@tenureiq.com" className="hover:text-foreground transition-colors">
                    office@tenureiq.com
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
                <li><Link to="/cookies" className="hover:text-foreground transition-colors">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} Tenure IQ Ltd. All rights reserved.
              </p>
              <div className="flex gap-6 text-xs text-muted-foreground">
                <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                <Link to="/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
              </div>
            </div>
            <div className="text-center md:text-left">
            <p className="text-xs text-muted-foreground">
                Registered in England &amp; Wales. Company No. 10733342. ICO Registration No. ZB490980.
              </p>
            </div>
          </div>
        </div>
      </footer>
    );
  }
);

MarketingFooter.displayName = 'MarketingFooter';
