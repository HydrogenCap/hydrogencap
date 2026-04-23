import { CheckCircle, AlertTriangle, Info, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityVerification } from '@/hooks/useCompaniesHouseV2';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  verification: EntityVerification | null;
  isSyncing: boolean;
  onSync: () => void;
}

export function CHVerificationBanner({ verification, isSyncing, onSync }: Props) {
  if (!verification) return null;

  const status = verification.verification_status;
  const lastSynced = verification.last_synced
    ? formatDistanceToNow(new Date(verification.last_synced), { addSuffix: true })
    : null;

  if (status === 'not_synced' || status === 'no_company_number') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 p-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
        <div className="flex-1 text-sm">
          <span className="font-medium text-blue-800 dark:text-blue-300">
            {status === 'no_company_number'
              ? 'No company number set — add one to enable Companies House verification.'
              : 'This entity has not been verified against Companies House.'}
          </span>
        </div>
        {status === 'not_synced' && (
          <Button size="sm" variant="outline" onClick={onSync} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Sync Now
          </Button>
        )}
      </div>
    );
  }

  if (status === 'verified') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 p-3">
        <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div className="flex-1 text-sm">
          <span className="font-medium text-emerald-800 dark:text-emerald-300">
            Verified against Companies House
          </span>
          {lastSynced && (
            <span className="text-emerald-600 dark:text-emerald-500"> — Last synced {lastSynced}</span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onSync} disabled={isSyncing}>
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Re-sync
        </Button>
      </div>
    );
  }

  // status_mismatch
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
      <div className="flex-1 text-sm">
        <span className="font-medium text-amber-800 dark:text-amber-300">
          Discrepancies detected between local data and Companies House.
        </span>
        {lastSynced && (
          <span className="text-amber-600 dark:text-amber-500"> — Last synced {lastSynced}</span>
        )}
      </div>
      <Button size="sm" variant="outline" onClick={onSync} disabled={isSyncing}>
        {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
        Re-sync
      </Button>
    </div>
  );
}
