import { X, ExternalLink, Building2, User, Calendar } from 'lucide-react';
import { format, isPast, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type {
  FlowchartPerson,
  FlowchartCompany,
  FlowchartProperty,
  EffectiveOwnership,
} from '@/hooks/useOwnershipFlowchart';

const fmt = (n: number) => n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(2)}M` : `£${Math.round(n / 1_000)}k`;

interface FlowchartDetailPanelProps {
  type: 'person' | 'company';
  id: string;
  data: {
    persons: FlowchartPerson[];
    companies: FlowchartCompany[];
    properties: FlowchartProperty[];
    edges: Array<{ fromId: string; toId: string; percent: number; type: string }>;
    effectiveOwnership: EffectiveOwnership[];
  };
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export function FlowchartDetailPanel({ type, id, data, onClose, onNavigate }: FlowchartDetailPanelProps) {
  if (type === 'person') {
    const person = data.persons.find(p => p.id === id);
    if (!person) return null;

    const ownedEdges = data.edges.filter(e => e.type === 'person_to_company' && e.fromId === id);
    const effectiveProps = data.effectiveOwnership.filter(eo => eo.personId === id);
    const totalEffectiveValue = effectiveProps.reduce((s, eo) => {
      const prop = data.properties.find(p => p.id === eo.propertyId);
      return s + ((prop?.value || 0) * eo.effectivePercent / 100);
    }, 0);

    return (
      <PanelShell title={person.name} subtitle="Individual Shareholder" icon={<User className="h-5 w-5" />} onClose={onClose}>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard label="Companies" value={person.companyCount} />
          <StatCard label="Properties (effective)" value={effectiveProps.length} />
          <StatCard label="Effective Value" value={fmt(totalEffectiveValue)} />
          <StatCard label="Email" value={person.email || '—'} small />
        </div>

        <SectionTitle>Direct Shareholdings</SectionTitle>
        <div className="space-y-2 mb-6">
          {ownedEdges.map(edge => {
            const company = data.companies.find(c => c.id === edge.toId);
            if (!company) return null;
            return (
              <div key={edge.toId} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onNavigate(`/companies/${company.id}`)}>
                <div>
                  <p className="text-sm font-medium">{company.name}</p>
                  <p className="text-xs text-muted-foreground">{company.type} · {company.propertyCount} properties</p>
                </div>
                <Badge variant="outline" className="font-mono">{edge.percent}%</Badge>
              </div>
            );
          })}
        </div>

        <SectionTitle>Effective Property Ownership</SectionTitle>
        <div className="space-y-2">
          {effectiveProps
            .sort((a, b) => b.effectivePercent - a.effectivePercent)
            .map(eo => {
              const prop = data.properties.find(p => p.id === eo.propertyId);
              return (
                <div key={eo.propertyId} className="rounded-lg border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onNavigate(`/properties/${eo.propertyId}`)}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{eo.propertyAddress}</p>
                    <Badge variant="outline" className="font-mono">{eo.effectivePercent.toFixed(1)}%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{eo.path}</p>
                  {prop?.value && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Effective value: {fmt(prop.value * eo.effectivePercent / 100)}
                    </p>
                  )}
                </div>
              );
            })}
        </div>
      </PanelShell>
    );
  }

  if (type === 'company') {
    const company = data.companies.find(c => c.id === id);
    if (!company) return null;

    const shareholders = data.edges.filter(
      e => (e.type === 'person_to_company' || e.type === 'company_to_company') && e.toId === id
    );
    const companyProperties = data.properties.filter(p => p.companyId === id);
    const totalPercent = shareholders.reduce((s, e) => s + e.percent, 0);
    const equity = company.totalValue - company.totalMortgage;

    return (
      <PanelShell
        title={company.name}
        subtitle={`${company.type} · ${company.companyNumber || 'No CH number'}`}
        icon={<Building2 className="h-5 w-5" />}
        onClose={onClose}
        headerAction={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onNavigate(`/companies/${id}`)}>
            <ExternalLink className="h-3.5 w-3.5" />
            Full Details
          </Button>
        }
      >
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard label="Total Value" value={fmt(company.totalValue)} />
          <StatCard label="Mortgage" value={fmt(company.totalMortgage)} />
          <StatCard label="Equity" value={fmt(equity)} highlight={equity > 0} />
        </div>

        {(company.accountsDue || company.confirmationStatementDue) && (
          <>
            <SectionTitle>Companies House</SectionTitle>
            <div className="space-y-2 mb-6">
              {company.accountsDue && (
                <DeadlineRow label="Accounts due" date={company.accountsDue} />
              )}
              {company.confirmationStatementDue && (
                <DeadlineRow label="Confirmation statement due" date={company.confirmationStatementDue} />
              )}
            </div>
          </>
        )}

        <SectionTitle>
          Shareholders
          {Math.abs(totalPercent - 100) > 1 && (
            <Badge variant="destructive" className="ml-2 text-[10px]">
              {totalPercent.toFixed(1)}% total
            </Badge>
          )}
        </SectionTitle>
        <div className="space-y-2 mb-6">
          {shareholders.map(edge => {
            const isPerson = edge.type === 'person_to_company';
            const entity = isPerson
              ? data.persons.find(p => p.id === edge.fromId)
              : data.companies.find(c => c.id === edge.fromId);
            if (!entity) return null;
            return (
              <div key={edge.fromId} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  {isPerson ? <User className="h-4 w-4 text-amber-600" /> : <Building2 className="h-4 w-4 text-blue-600" />}
                  <span className="text-sm font-medium">{entity.name}</span>
                </div>
                <Badge variant="outline" className="font-mono">{edge.percent}%</Badge>
              </div>
            );
          })}
        </div>

        <SectionTitle>Properties ({companyProperties.length})</SectionTitle>
        <div className="space-y-2">
          {companyProperties.map(prop => (
            <div key={prop.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => onNavigate(`/properties/${prop.id}`)}>
              <div>
                <p className="text-sm font-medium">{prop.address}</p>
                <p className="text-xs text-muted-foreground">{prop.postcode} · {prop.type} · {prop.beds} bed</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{prop.value ? fmt(prop.value) : '—'}</p>
                <div className="flex items-center gap-1">
                  <span className={`inline-block h-2 w-2 rounded-full ${
                    prop.complianceHealth === 'green' ? 'bg-green-500' :
                    prop.complianceHealth === 'amber' ? 'bg-amber-500' :
                    prop.complianceHealth === 'red' ? 'bg-red-500' : 'bg-gray-400'
                  }`} />
                  <span className="text-[10px] text-muted-foreground">
                    {prop.complianceHealth === 'green' ? 'Compliant' :
                     prop.complianceHealth === 'amber' ? 'Expiring' :
                     prop.complianceHealth === 'red' ? `${prop.complianceIssues} expired` : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PanelShell>
    );
  }

  return null;
}

// ─── Shared sub-components ───────────────────────────────────────

function PanelShell({
  title, subtitle, icon, onClose, headerAction, children,
}: {
  title: string; subtitle: string; icon: React.ReactNode; onClose: () => void;
  headerAction?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-background border-l shadow-xl z-50 flex flex-col animate-in slide-in-from-right-full duration-200">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {headerAction}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        {children}
      </ScrollArea>
    </div>
  );
}

function StatCard({ label, value, small, highlight }: { label: string; value: string | number; small?: boolean; highlight?: boolean }) {
  return (
    <div className="rounded-lg border p-2.5 text-center">
      <div className={`font-bold ${small ? 'text-xs truncate' : 'text-base'} ${highlight ? 'text-green-600' : ''}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center">{children}</h4>;
}

function DeadlineRow({ label, date }: { label: string; date: string }) {
  const d = new Date(date);
  const overdue = isPast(d);
  const daysAway = differenceInDays(d, new Date());

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Calendar className={`h-4 w-4 ${overdue ? 'text-red-500' : 'text-muted-foreground'}`} />
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-right">
        <span className={`text-sm font-medium ${overdue ? 'text-red-600' : ''}`}>
          {format(d, 'dd MMM yyyy')}
        </span>
        {overdue && <span className="text-[10px] text-red-500 block">Overdue</span>}
        {!overdue && daysAway <= 30 && <span className="text-[10px] text-amber-500 block">{daysAway} days</span>}
      </div>
    </div>
  );
}
