import { toast } from '@/hooks/use-toast';

/**
 * Standard error toast for mutations.
 * Extracts a user-friendly message from various error shapes.
 */
export function showMutationError(error: unknown, fallbackTitle: string = 'Something went wrong') {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : 'Please try again or contact support if the problem persists.';

  toast({
    title: fallbackTitle,
    description: message,
    variant: 'destructive',
  });
}

/**
 * Standard success toast for mutations.
 */
export function showMutationSuccess(title: string, description?: string) {
  toast({
    title,
    description,
  });
}
