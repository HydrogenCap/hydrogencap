import * as React from 'react';
import { AlertCircle, Inbox } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export interface ListStateProps {
  isLoading: boolean;
  error: Error | null;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  emptyAction?: { label: string; onClick: () => void };
  onRetry: () => void;
  children: React.ReactNode;
}

const SKELETON_ROWS = 5;

function isLeakyMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('pgrst') || lower.includes('supabase');
}

/**
 * Universal wrapper for list-based UIs handling the four canonical states:
 * loading, error, empty, and populated. Visuals follow the project's
 * navy/Shadcn token system.
 */
export function ListState({
  isLoading,
  error,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyIcon: EmptyIcon = Inbox,
  emptyAction,
  onRetry,
  children,
}: ListStateProps) {
  if (isLoading) {
    return (
      <div
        className="space-y-3"
        role="status"
        aria-busy="true"
        aria-label="Loading list"
        data-testid="list-state-loading"
      >
        {Array.from({ length: SKELETON_ROWS }).map((_, idx) => (
          <Skeleton key={idx} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    const safeMessage =
      error.message && !isLeakyMessage(error.message)
        ? error.message
        : 'Please try again.';
    return (
      <Card role="alert" data-testid="list-state-error">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            Something went wrong loading this list
          </h3>
          <p className="text-muted-foreground mb-4 max-w-md break-words">
            {safeMessage}
          </p>
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isEmpty) {
    return (
      <Card data-testid="list-state-empty">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <EmptyIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">{emptyTitle}</h3>
          <p className="text-muted-foreground mb-4 max-w-md">{emptyDescription}</p>
          {emptyAction && (
            <Button onClick={emptyAction.onClick}>{emptyAction.label}</Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

export default ListState;
