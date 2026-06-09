/**
 * Public marketing routes: home, product, portfolio, policy pages, install.
 * No auth required.
 */
import { lazy } from "react";
import { Route } from "react-router-dom";

const MarketingHome = lazy(() => import("@/pages/marketing/Home"));
const MarketingProduct = lazy(() => import("@/pages/marketing/Product"));
const MarketingPortfolio = lazy(() => import("@/pages/marketing/Portfolio"));
const MarketingCaseStudies = lazy(() => import("@/pages/marketing/CaseStudies"));
const MarketingAbout = lazy(() => import("@/pages/marketing/About"));
const MarketingContact = lazy(() => import("@/pages/marketing/Contact"));
const MarketingDemo = lazy(() => import("@/pages/marketing/Demo"));
const MarketingBookDemo = lazy(() => import("@/pages/marketing/BookDemo"));
const MarketingSecurity = lazy(() => import("@/pages/marketing/Security"));
const MarketingPricing = lazy(() => import("@/pages/marketing/Pricing"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("@/pages/TermsOfService"));
const CookiePolicy = lazy(() => import("@/pages/CookiePolicy"));
const Install = lazy(() => import("@/pages/Install"));

export const marketingRoutes = (
  <>
    <Route path="/" element={<MarketingHome />} />
    <Route path="/product" element={<MarketingProduct />} />
    <Route path="/portfolio" element={<MarketingPortfolio />} />
    <Route path="/case-studies" element={<MarketingCaseStudies />} />
    <Route path="/about" element={<MarketingAbout />} />
    <Route path="/contact" element={<MarketingContact />} />
    <Route path="/demo" element={<MarketingDemo />} />
    <Route path="/book-a-demo" element={<MarketingBookDemo />} />
    <Route path="/security" element={<MarketingSecurity />} />
    <Route path="/pricing" element={<MarketingPricing />} />
    <Route path="/privacy" element={<PrivacyPolicy />} />
    <Route path="/terms" element={<TermsOfService />} />
    <Route path="/cookies" element={<CookiePolicy />} />
    <Route path="/install" element={<Install />} />
  </>
);
