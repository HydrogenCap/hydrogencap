import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton' | 'card';
  text?: string;
  className?: string;
}

export function LoadingState({ 
  variant = 'spinner', 
  text = 'Loading...', 
  className = '' 
}: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <div className={`space-y-4 ${className}`} aria-busy="true" aria-label="Loading content">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <Card className={className} aria-busy="true" aria-label="Loading content">
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div role="status" className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" aria-hidden="true" />
      <span className="text-muted-foreground">{text}</span>
    </div>
  );
}
