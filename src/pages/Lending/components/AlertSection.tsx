import { Link } from 'react-router-dom';
import type { LoanAlert } from '@/hooks/useLoanFacilities';
import type { AlertCircle } from 'lucide-react';
import { getAlertDescription } from '../utils/alertDescriptions';

export function AlertSection({ title, alerts, icon: Icon, color, bgColor }: {
  title: string; alerts: LoanAlert[]; icon: typeof AlertCircle; color: string; bgColor: string;
}) {
  return (
    <div>
      <h3 className={`text-sm font-semibold ${color} mb-2`}>{title}</h3>
      <div className="space-y-1">
        {alerts.map((a, i) => (
          <div key={`${a.loan_id}-${i}`} className={`flex items-start gap-2 px-3 py-2 rounded text-xs ${bgColor} ${color}`}>
            <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div className="flex-1">
              <Link to={`/properties-v2/${a.property_id}`} className="font-medium hover:underline">{a.property_address}</Link>
              <span className="mx-1">·</span>
              <span>{a.lender_name}</span>
              <span className="mx-1">·</span>
              <span>{getAlertDescription(a)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
