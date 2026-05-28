import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  useOwnershipFlowchartData,
  type FlowchartCompany,
  type FlowchartProperty,
  type FlowchartPerson,
  type FlowchartData,
} from '@/hooks/useOwnershipFlowchartData';

// ─── Layout constants ───────────────────────────────────────────
const CARD_W = 190;
const CARD_H_PERSON = 64;
const CARD_H_COMPANY = 82;
const CARD_H_PROPERTY = 78;
const GAP_X = 28;
const GAP_Y = 100;
const PADDING = 40;

// ─── Color palette (HSL-based for design system consistency) ────
const COLORS = {
  person: { bg: 'hsl(45 93% 91%)', border: 'hsl(38 92% 50%)', text: 'hsl(26 90% 30%)', icon: 'hsl(38 92% 50%)' },
  holdco: { bg: 'hsl(263 70% 94%)', border: 'hsl(263 83% 59%)', text: 'hsl(263 70% 34%)', icon: 'hsl(263 83% 57%)' },
  spv: { bg: 'hsl(214 95% 92%)', border: 'hsl(217 91% 60%)', text: 'hsl(217 71% 39%)', icon: 'hsl(217 91% 53%)' },
  opco: { bg: 'hsl(340 82% 94%)', border: 'hsl(340 82% 52%)', text: 'hsl(340 70% 30%)', icon: 'hsl(340 82% 47%)' },
  hmo: { bg: 'hsl(152 76% 91%)', border: 'hsl(160 84% 39%)', text: 'hsl(164 86% 16%)', icon: 'hsl(160 84% 36%)' },
  btl: { bg: 'hsl(226 100% 94%)', border: 'hsl(239 84% 67%)', text: 'hsl(234 63% 26%)', icon: 'hsl(239 84% 56%)' },
  sa: { bg: 'hsl(280 80% 94%)', border: 'hsl(280 80% 58%)', text: 'hsl(280 60% 30%)', icon: 'hsl(280 80% 50%)' },
  line: '#94a3b8',
  lineActive: 'hsl(217 91% 60%)',
};

function getCompanyColor(type: string) {
  const t = type?.toUpperCase();
  if (t === 'HOLDCO') return COLORS.holdco;
  if (t === 'OPCO') return COLORS.opco;
  return COLORS.spv;
}

function getPropertyColor(type: string | null) {
  if (type === 'HMO') return COLORS.hmo;
  if (type === 'SA' || type === 'Serviced Accommodation') return COLORS.sa;
  return COLORS.btl;
}

const fmt = (n: number) => n >= 1000000 ? `£${(n / 1000000).toFixed(1)}M` : `£${(n / 1000).toFixed(0)}k`;

// ─── Layout engine ──────────────────────────────────────────────
interface Pos { x: number; y: number; w: number; h: number }

function computeLayout(
  data: FlowchartData,
  selectedPerson: string | null,
  selectedCompany: string | null,
) {
  let { people, companies, properties, personToCompany, companyToCompany, companyToProperty } = data;

  if (selectedPerson) {
    const ownedCompanyIds = new Set(personToCompany.filter(e => e.from === selectedPerson).map(e => e.to));
    companyToCompany.forEach(e => { if (ownedCompanyIds.has(e.from)) ownedCompanyIds.add(e.to); });
    companies = companies.filter(c => ownedCompanyIds.has(c.id));
    personToCompany = personToCompany.filter(e => e.from === selectedPerson);
    companyToCompany = companyToCompany.filter(e => ownedCompanyIds.has(e.from));
    const visCompIds = new Set(companies.map(c => c.id));
    companyToProperty = companyToProperty.filter(e => visCompIds.has(e.from));
    properties = properties.filter(p => companyToProperty.some(e => e.to === p.id));
    people = people.filter(p => p.id === selectedPerson);
  }

  if (selectedCompany) {
    const relatedCompanyIds = new Set([selectedCompany]);
    companyToCompany.forEach(e => {
      if (e.from === selectedCompany || e.to === selectedCompany) {
        relatedCompanyIds.add(e.from);
        relatedCompanyIds.add(e.to);
      }
    });
    companies = companies.filter(c => relatedCompanyIds.has(c.id));
    personToCompany = personToCompany.filter(e => relatedCompanyIds.has(e.to));
    const personIds = new Set(personToCompany.map(e => e.from));
    people = people.filter(p => personIds.has(p.id));
    companyToCompany = companyToCompany.filter(e => relatedCompanyIds.has(e.from) || relatedCompanyIds.has(e.to));
    companyToProperty = companyToProperty.filter(e => relatedCompanyIds.has(e.from));
    properties = properties.filter(p => companyToProperty.some(e => e.to === p.id));
  }

  const row1Width = people.length * CARD_W + Math.max(0, people.length - 1) * GAP_X;
  const row2Width = companies.length * CARD_W + Math.max(0, companies.length - 1) * GAP_X;
  const row3Width = properties.length * CARD_W + Math.max(0, properties.length - 1) * GAP_X;
  const totalWidth = Math.max(row1Width, row2Width, row3Width, 600) + PADDING * 2;

  const positions: Record<string, Pos> = {};

  const r1Start = (totalWidth - row1Width) / 2;
  people.forEach((p, i) => {
    positions[p.id] = { x: r1Start + i * (CARD_W + GAP_X), y: PADDING, w: CARD_W, h: CARD_H_PERSON };
  });

  const r2Start = (totalWidth - row2Width) / 2;
  companies.forEach((c, i) => {
    positions[c.id] = { x: r2Start + i * (CARD_W + GAP_X), y: PADDING + CARD_H_PERSON + GAP_Y, w: CARD_W, h: CARD_H_COMPANY };
  });

  const r3Start = (totalWidth - row3Width) / 2;
  properties.forEach((p, i) => {
    positions[p.id] = { x: r3Start + i * (CARD_W + GAP_X), y: PADDING + CARD_H_PERSON + GAP_Y + CARD_H_COMPANY + GAP_Y, w: CARD_W, h: CARD_H_PROPERTY };
  });

  const totalHeight = PADDING * 2 + CARD_H_PERSON + GAP_Y + CARD_H_COMPANY + GAP_Y + CARD_H_PROPERTY;

  return { positions, totalWidth, totalHeight, people, companies, properties, personToCompany, companyToCompany, companyToProperty };
}

// ─── SVG line component ─────────────────────────────────────────
function ConnectionLine({ x1, y1, x2, y2, label, highlighted }: {
  x1: number; y1: number; x2: number; y2: number; label?: string; highlighted: boolean;
}) {
  const midY = (y1 + y2) / 2;
  const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  const labelX = (x1 + x2) / 2;

  return (
    <g>
      <path d={path} fill="none" stroke={highlighted ? COLORS.lineActive : COLORS.line}
        strokeWidth={highlighted ? 2.5 : 1.5} opacity={highlighted ? 1 : 0.4}
        style={{ transition: 'all 0.3s ease' }} />
      {label && (
        <>
          <rect x={labelX - 20} y={midY - 9} width={40} height={18} rx={9}
            fill="white" stroke={highlighted ? COLORS.lineActive : COLORS.line} strokeWidth={1} opacity={highlighted ? 1 : 0.7} />
          <text x={labelX} y={midY + 4} textAnchor="middle" fontSize={10} fontWeight={600}
            fill={highlighted ? COLORS.lineActive : '#64748b'} style={{ transition: 'all 0.3s ease' }}>
            {label}
          </text>
        </>
      )}
    </g>
  );
}

// ─── Card components ────────────────────────────────────────────
function PersonCard({ person, pos, selected, onSelect, highlighted }: {
  person: FlowchartPerson; pos: Pos; selected: boolean; onSelect: (id: string) => void; highlighted: boolean;
}) {
  const c = COLORS.person;
  return (
    <foreignObject x={pos.x} y={pos.y} width={pos.w} height={pos.h}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Select person ${person.name}`}
        onClick={() => onSelect(person.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(person.id);
          }
        }}
        style={{
        width: '100%', height: '100%',
        background: selected || highlighted ? c.bg : 'white',
        border: `2px solid ${selected ? c.border : highlighted ? c.border : '#e2e8f0'}`,
        borderRadius: 12, padding: '10px 12px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10,
        transition: 'all 0.2s ease',
        boxShadow: selected ? `0 0 0 3px ${c.border}33, 0 4px 12px rgba(0,0,0,0.08)` : '0 1px 3px rgba(0,0,0,0.06)',
        transform: selected ? 'scale(1.03)' : 'scale(1)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: `linear-gradient(135deg, ${c.icon}, ${c.border})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 15, fontWeight: 700, flexShrink: 0,
        }}>
          {person.name[0]}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {person.name}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>
            {person.companyCount} compan{person.companyCount === 1 ? 'y' : 'ies'}
          </div>
        </div>
      </div>
    </foreignObject>
  );
}

function CompanyCard({ company, pos, selected, onSelect, highlighted, onNavigate }: {
  company: FlowchartCompany; pos: Pos; selected: boolean; onSelect: (id: string) => void; highlighted: boolean;
  onNavigate: (companyId: string) => void;
}) {
  const c = getCompanyColor(company.companyType);
  return (
    <foreignObject x={pos.x} y={pos.y} width={pos.w} height={pos.h}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Select company ${company.name}`}
        onClick={() => onSelect(company.id)}
        onDoubleClick={() => onNavigate(company.companyId)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(company.id);
          }
        }}
        style={{
          width: '100%', height: '100%',
          background: selected || highlighted ? c.bg : 'white',
          border: `2px solid ${selected ? c.border : highlighted ? c.border : '#e2e8f0'}`,
          borderRadius: 12, padding: '10px 12px', cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: selected ? `0 0 0 3px ${c.border}33, 0 4px 12px rgba(0,0,0,0.08)` : '0 1px 3px rgba(0,0,0,0.06)',
          transform: selected ? 'scale(1.03)' : 'scale(1)',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.icon} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
          </svg>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: c.icon }}>
            {company.companyType}
          </span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: c.text, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}
          title={company.name}>
          {company.name}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b' }}>
          <span>{company.propertyCount} propert{company.propertyCount === 1 ? 'y' : 'ies'}</span>
          {company.totalValue > 0 && <span style={{ fontWeight: 600 }}>{fmt(company.totalValue)}</span>}
        </div>
      </div>
    </foreignObject>
  );
}

function PropertyCard({ property, pos, highlighted, onNavigate }: {
  property: FlowchartProperty; pos: Pos; highlighted: boolean;
  onNavigate: (propertyId: string) => void;
}) {
  const c = getPropertyColor(property.type);
  return (
    <foreignObject x={pos.x} y={pos.y} width={pos.w} height={pos.h}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open property`}
        onClick={() => onNavigate(property.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNavigate(property.id);
          }
        }}
        style={{
        width: '100%', height: '100%',
        background: highlighted ? c.bg : 'white',
        border: `2px solid ${highlighted ? c.border : '#e2e8f0'}`,
        borderRadius: 12, padding: '10px 12px', cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: highlighted ? `0 0 0 3px ${c.border}33, 0 4px 12px rgba(0,0,0,0.08)` : '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c.icon} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: c.icon }}>
            {property.type || 'BTL'}
          </span>
          {property.beds && <span style={{ fontSize: 10, color: '#64748b', marginLeft: 'auto' }}>{property.beds} bed</span>}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}
          title={property.address}>
          {property.address}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b' }}>
          <span>{property.postcode || ''}</span>
          {property.value && property.value > 0 && <span style={{ fontWeight: 600 }}>{fmt(property.value)}</span>}
        </div>
      </div>
    </foreignObject>
  );
}

// ─── Legend ──────────────────────────────────────────────────────
function Legend() {
  const items = [
    { color: COLORS.person.border, label: 'Individual' },
    { color: COLORS.holdco.border, label: 'Holding Co' },
    { color: COLORS.spv.border, label: 'SPV' },
    { color: COLORS.opco.border, label: 'OpCo' },
    { color: COLORS.hmo.border, label: 'HMO' },
    { color: COLORS.btl.border, label: 'BTL' },
  ];
  return (
    <div className="flex gap-4 flex-wrap justify-center mt-4">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Summary bar ────────────────────────────────────────────────
function SummaryBar({ data }: { data: FlowchartData }) {
  const totalValue = data.properties.reduce((s, p) => s + (p.value || 0), 0);
  const stats = [
    { label: 'Companies', value: data.companies.length.toString() },
    { label: 'Properties', value: data.properties.length.toString() },
    { label: 'Shareholders', value: data.people.length.toString() },
    { label: 'Portfolio Value', value: totalValue > 0 ? fmt(totalValue) : '—' },
  ];
  return (
    <div className="grid grid-cols-4 gap-px bg-border rounded-lg overflow-hidden">
      {stats.map(s => (
        <div key={s.label} className="bg-card p-3 text-center">
          <div className="text-lg font-extrabold text-foreground">{s.value}</div>
          <div className="text-[10px] text-muted-foreground font-medium">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────
export function OwnershipFlowchart({ asOfDate }: { asOfDate?: string } = {}) {
  const { data, isLoading, error } = useOwnershipFlowchartData(asOfDate);
  const navigate = useNavigate();
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  const handleSelectPerson = useCallback((id: string) => {
    setSelectedCompany(null);
    setSelectedPerson(prev => prev === id ? null : id);
  }, []);

  const handleSelectCompany = useCallback((id: string) => {
    setSelectedPerson(null);
    setSelectedCompany(prev => prev === id ? null : id);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPerson(null);
    setSelectedCompany(null);
  }, []);

  const layout = useMemo(() => {
    if (!data) return null;
    return computeLayout(data, selectedPerson, selectedCompany);
  }, [data, selectedPerson, selectedCompany]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data || !layout) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Failed to load ownership data
        </CardContent>
      </Card>
    );
  }

  const { positions, totalWidth, totalHeight, people, companies, properties, personToCompany, companyToCompany, companyToProperty } = layout;
  const anySelected = selectedPerson || selectedCompany;

  // Determine highlighted sets
  const highlightedCompanies = new Set<string>();
  const highlightedProperties = new Set<string>();
  const highlightedPeople = new Set<string>();

  if (selectedPerson) {
    highlightedPeople.add(selectedPerson);
    personToCompany.forEach(e => highlightedCompanies.add(e.to));
    companyToCompany.forEach(e => { highlightedCompanies.add(e.from); highlightedCompanies.add(e.to); });
    companyToProperty.forEach(e => highlightedProperties.add(e.to));
  }
  if (selectedCompany) {
    highlightedCompanies.add(selectedCompany);
    personToCompany.forEach(e => highlightedPeople.add(e.from));
    companyToCompany.forEach(e => { highlightedCompanies.add(e.from); highlightedCompanies.add(e.to); });
    companyToProperty.forEach(e => highlightedProperties.add(e.to));
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <SummaryBar data={data} />

      {/* Controls */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Click a person or company to filter · Double-click to navigate</p>
        {anySelected && (
          <Button variant="outline" size="sm" onClick={clearSelection}>Show All</Button>
        )}
      </div>

      {/* Flowchart */}
      <Card className="overflow-hidden">
        <div className="flex justify-between px-5 py-3 border-b border-border/50">
          {['Shareholders', 'Companies', 'Properties'].map(label => (
            <span key={label} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
          ))}
        </div>
        <div className="overflow-x-auto overflow-y-hidden p-2">
          <svg width={Math.max(totalWidth, 860)} height={totalHeight}
            viewBox={`0 0 ${Math.max(totalWidth, 860)} ${totalHeight}`}
            style={{ display: 'block' }}>

            {/* Person → Company lines */}
            {personToCompany.map(edge => {
              const from = positions[edge.from];
              const to = positions[edge.to];
              if (!from || !to) return null;
              const hl = !anySelected || highlightedPeople.has(edge.from) || highlightedCompanies.has(edge.to);
              return (
                <ConnectionLine key={`p2c-${edge.from}-${edge.to}`}
                  x1={from.x + from.w / 2} y1={from.y + from.h}
                  x2={to.x + to.w / 2} y2={to.y}
                  label={`${Math.round(edge.percent)}%`} highlighted={hl} />
              );
            })}

            {/* Company → Company lines */}
            {companyToCompany.map(edge => {
              const from = positions[edge.from];
              const to = positions[edge.to];
              if (!from || !to) return null;
              const hl = !anySelected || highlightedCompanies.has(edge.from) || highlightedCompanies.has(edge.to);
              const x1 = from.x + from.w;
              const y1 = from.y + from.h / 2;
              const x2 = to.x;
              const y2 = to.y + to.h / 2;
              const midX = (x1 + x2) / 2;
              return (
                <g key={`c2c-${edge.from}-${edge.to}`}>
                  <path d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none" stroke={hl ? COLORS.holdco.border : COLORS.line}
                    strokeWidth={hl ? 2.5 : 1.5} strokeDasharray="6 4" opacity={hl ? 0.8 : 0.35} />
                  <rect x={midX - 16} y={(y1 + y2) / 2 - 9} width={32} height={18} rx={9}
                    fill="white" stroke={COLORS.holdco.border} strokeWidth={1} opacity={hl ? 1 : 0.6} />
                  <text x={midX} y={(y1 + y2) / 2 + 4} textAnchor="middle" fontSize={9} fontWeight={700} fill={COLORS.holdco.icon}>
                    {Math.round(edge.percent)}%
                  </text>
                </g>
              );
            })}

            {/* Company → Property lines */}
            {companyToProperty.map(edge => {
              const from = positions[edge.from];
              const to = positions[edge.to];
              if (!from || !to) return null;
              const hl = !anySelected || highlightedCompanies.has(edge.from) || highlightedProperties.has(edge.to);
              return (
                <ConnectionLine key={`c2p-${edge.from}-${edge.to}`}
                  x1={from.x + from.w / 2} y1={from.y + from.h}
                  x2={to.x + to.w / 2} y2={to.y} highlighted={hl} />
              );
            })}

            {/* Person cards */}
            {people.map(person => positions[person.id] && (
              <PersonCard key={person.id} person={person} pos={positions[person.id]}
                selected={selectedPerson === person.id} onSelect={handleSelectPerson}
                highlighted={highlightedPeople.has(person.id)} />
            ))}

            {/* Company cards */}
            {companies.map(company => positions[company.id] && (
              <CompanyCard key={company.id} company={company} pos={positions[company.id]}
                selected={selectedCompany === company.id} onSelect={handleSelectCompany}
                highlighted={highlightedCompanies.has(company.id)}
                onNavigate={(companyId) => navigate(`/companies/${companyId}`)} />
            ))}

            {/* Property cards */}
            {properties.map(property => positions[property.id] && (
              <PropertyCard key={property.id} property={property} pos={positions[property.id]}
                highlighted={highlightedProperties.has(property.id)}
                onNavigate={(propertyId) => navigate(`/properties/${propertyId}`)} />
            ))}
          </svg>
        </div>
      </Card>

      <Legend />
    </div>
  );
}
