import { ErrorBoundary } from './ErrorBoundary';
import { useNavigate } from 'react-router-dom';
import { ReactNode, useCallback } from 'react';

interface RouteBoundaryProps {
  children: ReactNode;
}

/**
 * Route-level ErrorBoundary that resets on navigation.
 * Prevents a crash in one route from taking down the whole app.
 */
export function RouteBoundary({ children }: RouteBoundaryProps) {
  const navigate = useNavigate();

  const handleReset = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  return (
    <ErrorBoundary onReset={handleReset}>
      {children}
    </ErrorBoundary>
  );
}
