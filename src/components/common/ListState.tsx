import { ReactNode } from 'react';
import { AlertCircle, LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';

interface ListStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface ListStateProps<T> {
  /** Loading flag — when true, render the loading variant */
  isLoading?: boolean;
  /** Error object/message — when present, render the error variant */
  error?: Error | string | null;
  /** The data array. If empty (or undefined) and not loading/error, the empty state renders */
  data?: T[] | null;
  /** Render function for the populated state */
  children: (data: T[]) => ReactNode;

  /** Loading variant config */
  loadingVariant?: 'spinner' | 'skeleton' | 'card';
  loadingText?: string;

  /** Empty state config */
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ListStateAction;
  emptySecondaryAction?: ListStateAction;

  /** Error state config */
  errorTitle?: string;
  onRetry?: () => void;

  className?: string;
}

/**
 * Universal wrapper for list-based UIs. Handles the four canonical states:
 *  - loading
 *  - error
 *  - empty
 *  - populated (renders via children render-prop)
 *
 * @example
 * <ListState
 *   isLoading={isLoading}
 *   error={error}
 *   data={documents}
 *   emptyTitle="No documents yet"
 *   emptyDescription="Upload your first document to get started."
 *   emptyAction={{ label: 'Upload', onClick: openUpload }}
 *   onRetry={refetch}
 * >
 *   {(items) => <DocumentTable rows={items} />}
 * </ListState>
 */
export function ListState<T>({
  isLoading,
  error,
  data,
  children,
  loadingVariant = 'skeleton',
  loadingText,
  emptyIcon,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  emptySecondaryAction,
  errorTitle = 'Something went wrong',
  onRetry,
  className,
}: ListStateProps<T>) {
  if (isLoading) {
    return (
      <LoadingState
        variant={loadingVariant}
        text={loadingText}
        className={className}
      />
    );
  }

  if (error) {
    const message = typeof error === 'string' ? error : error.message;
    return (
      <Card className={className} role="alert">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold mb-2">{errorTitle}</h3>
          {message && (
            <p className="text-muted-foreground mb-4 max-w-md break-words">{message}</p>
          )}
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              Try again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        secondaryAction={emptySecondaryAction}
        className={className}
      />
    );
  }

  return <>{children(data)}</>;
}
