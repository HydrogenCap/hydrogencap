import { AlertTriangle, FileCheck, CheckCircle2, List } from 'lucide-react';
import { ComplianceStatusCard, type StatusType } from '@/components/compliance/ComplianceStatusCard';

interface Stats {
  expired: { length: number };
  within30: { length: number };
  within90: { length: number };
  valid: { length: number };
  all: { length: number };
}

interface Props {
  stats: Stats;
  selectedStatus: StatusType | null;
  onClick: (status: StatusType) => void;
}

export function StatusCardsRow({ stats, selectedStatus, onClick }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <ComplianceStatusCard
        label="Expired"
        count={stats.expired.length}
        icon={AlertTriangle}
        status="expired"
        isActive={selectedStatus === 'expired'}
        onClick={() => onClick('expired')}
      />
      <ComplianceStatusCard
        label="Within 30 Days"
        count={stats.within30.length}
        icon={FileCheck}
        status="expiring_soon"
        isActive={selectedStatus === 'expiring_soon'}
        onClick={() => onClick('expiring_soon')}
      />
      <ComplianceStatusCard
        label="Within 90 Days"
        count={stats.within90.length}
        icon={FileCheck}
        status="within_90"
        isActive={selectedStatus === 'within_90'}
        onClick={() => onClick('within_90')}
      />
      <ComplianceStatusCard
        label="Valid"
        count={stats.valid.length}
        icon={CheckCircle2}
        status="valid"
        isActive={selectedStatus === 'valid'}
        onClick={() => onClick('valid')}
      />
      <ComplianceStatusCard
        label="All Items"
        count={stats.all.length}
        icon={List}
        status="all"
        isActive={selectedStatus === 'all'}
        onClick={() => onClick('all')}
      />
    </div>
  );
}
