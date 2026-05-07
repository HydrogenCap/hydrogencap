import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Wraps the global search popover so a runtime error (e.g. a failing RPC,
 * a malformed Supabase query, or an RLS denial) shows a friendly message
 * instead of silently producing "No results found".
 */
export class SearchErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
     
    console.error('Global search crashed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          Search is temporarily unavailable.
        </div>
      );
    }
    return this.props.children;
  }
}

export default SearchErrorBoundary;
