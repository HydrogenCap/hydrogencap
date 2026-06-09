import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribe-status handler that logs Realtime authorization / connection
 * problems but never throws. Use as the callback to `.subscribe(...)` so
 * unauthorised users gracefully fall back to non-realtime data.
 */
export function handleChannelStatus(topic: string) {
  return (status: string, err?: Error) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      // CHANNEL_ERROR is raised when realtime.messages RLS denies the user
      // access to this topic. The UI continues to work via TanStack Query
      // refetches; we only surface a console warning for diagnostics.
      console.warn(`[realtime] channel "${topic}" status=${status}`, err ?? '');
    }
  };
}

/**
 * Open a private Realtime channel that goes through `realtime.messages`
 * RLS authorization. Always set `config.private = true` so the server
 * checks the topic policy before delivering postgres_changes/broadcast.
 */
export function privateChannel(topic: string) {
  return supabase.channel(topic, { config: { private: true } });
}
