import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Watches navigator.onLine and surfaces:
 *  - a dismissible offline banner pinned to the bottom of the screen
 *  - a toast when the connection drops or returns
 *
 * Avoids firing a "back online" toast on initial mount.
 */
export function ConnectionStatus() {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const wasOffline = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      if (wasOffline.current) {
        toast.success('Back online', { description: 'Reconnected to Tenure IQ.' });
        wasOffline.current = false;
      }
    };
    const handleOffline = () => {
      setOnline(false);
      wasOffline.current = true;
      toast.error('You are offline', {
        description: 'Changes will be saved when the connection returns.',
        duration: 6000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 print:hidden"
    >
      <div className="flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive shadow-lg backdrop-blur">
        <WifiOff className="h-4 w-4" aria-hidden />
        <span>Offline — changes may not save</span>
        <Wifi className="h-4 w-4 opacity-0" aria-hidden />
      </div>
    </div>
  );
}
