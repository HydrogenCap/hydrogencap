import { useEffect, useState } from 'react';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'] as const;

/**
 * Reports whether the user has been idle (no input + tab hidden) for at least
 * `timeoutMs`. Components can use this to pause polling, animations, or
 * background refreshes when nobody is watching.
 */
export function useIsUserIdle(timeoutMs: number = IDLE_TIMEOUT_MS): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let lastActivity = Date.now();
    let timer: number | undefined;

    const schedule = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.hidden && Date.now() - lastActivity >= timeoutMs) {
          setIdle(true);
        } else {
          schedule();
        }
      }, timeoutMs);
    };

    const reset = () => {
      lastActivity = Date.now();
      if (idle) setIdle(false);
      schedule();
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, reset, { passive: true }));
    document.addEventListener('visibilitychange', reset);
    schedule();

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset));
      document.removeEventListener('visibilitychange', reset);
    };
  }, [timeoutMs, idle]);

  return idle;
}
