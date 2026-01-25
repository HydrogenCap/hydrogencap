import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, Building2, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const isPropertyRoute = location.pathname.startsWith("/properties/");

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center max-w-md px-4">
        <div className="mb-6 text-6xl font-bold text-muted-foreground/50">404</div>
        <h1 className="mb-2 text-2xl font-semibold">Page not found</h1>
        
        {isPropertyRoute ? (
          <>
            <p className="mb-6 text-muted-foreground">
              This property may have been deleted or you don't have access to it.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="default">
                <Link to="/properties">
                  <Building2 className="mr-2 h-4 w-4" />
                  View All Properties
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/dashboard">
                  <Home className="mr-2 h-4 w-4" />
                  Go to Dashboard
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-6 text-muted-foreground">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="default">
                <Link to="/dashboard">
                  <Home className="mr-2 h-4 w-4" />
                  Go to Dashboard
                </Link>
              </Button>
              <Button asChild variant="outline" onClick={() => window.history.back()}>
                <span className="cursor-pointer">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Back
                </span>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NotFound;
