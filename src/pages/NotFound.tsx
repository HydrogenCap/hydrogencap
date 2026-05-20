import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Home,
  Building2,
  ArrowLeft,
  Search,
  LayoutDashboard,
  ShieldCheck,
  Banknote,
  Users,
} from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

const QUICK_LINKS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Properties", href: "/properties", icon: Building2 },
  { label: "Compliance", href: "/compliance", icon: ShieldCheck },
  { label: "Rent", href: "/rent-reconciliation", icon: Banknote },
  { label: "Tenants", href: "/tenants", icon: Users },
];

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isPropertyRoute = location.pathname.startsWith("/properties/");
  const [query, setQuery] = useState("");

  usePageTitle("Page not found");

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // Route via the global search results page if it exists, else fall back to properties.
    navigate(`/properties?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-lg text-center">
        <div className="mb-4 text-7xl font-bold text-muted-foreground/40 tabular-nums">404</div>
        <h1 className="mb-2 text-2xl font-semibold">Page not found</h1>
        <p className="mb-6 text-sm text-muted-foreground break-all">
          {isPropertyRoute
            ? "This property may have been deleted, moved, or you don't have access to it."
            : "The page you're looking for doesn't exist or has been moved."}
          <br />
          <span className="text-xs opacity-70">
            Tried: <code className="font-mono">{location.pathname}</code>
          </span>
        </p>

        <form onSubmit={onSearch} className="mb-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search properties by address or postcode…"
              className="pl-9"
              aria-label="Search portfolio"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          {QUICK_LINKS.map(({ label, href, icon: Icon }) => (
            <Button key={href} asChild variant="outline" size="sm">
              <Link to={href}>
                <Icon className="mr-2 h-3.5 w-3.5" />
                {label}
              </Link>
            </Button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="default">
            <Link to="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
