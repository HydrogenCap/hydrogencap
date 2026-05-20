import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, User, Home, ExternalLink } from 'lucide-react';
import { useOwnershipFlowchartData } from '@/hooks/useOwnershipFlowchartData';
import { formatGBP, formatPercent } from '@/lib/calculations';

export function OwnershipTable({ asOfDate }: { asOfDate?: string } = {}) {
  const { data, isLoading, error } = useOwnershipFlowchartData(asOfDate);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-sm text-muted-foreground">Failed to load ownership data.</p>;
  }

  const { people, companies, properties, personToCompany, companyToCompany, companyToProperty } = data;

  // Build effective ownership: person → property with effective %
  type EffectiveRow = {
    personName: string;
    personId: string;
    companyName: string;
    companyId: string;
    companyNumber: string | null;
    propertyAddress: string;
    propertyId: string;
    propertyType: string | null;
    effectivePercent: number;
    propertyValue: number | null;
    effectiveValue: number | null;
    path: string;
  };

  const rows: EffectiveRow[] = [];

  for (const person of people) {
    // Walk person → companies → properties
    // Direct company links
    const directCompanyEdges = personToCompany.filter(e => e.from === person.id);

    for (const pce of directCompanyEdges) {
      const company = companies.find(c => c.id === pce.to);
      if (!company) continue;

      // Direct properties of this company
      const propEdges = companyToProperty.filter(e => e.from === company.id);
      for (const pe of propEdges) {
        const prop = properties.find(p => p.id === pe.to);
        if (!prop) continue;
        const eff = (pce.percent * pe.percent) / 100;
        rows.push({
          personName: person.name,
          personId: person.id,
          companyName: company.name,
          companyId: company.companyId,
          companyNumber: company.companyNumber,
          propertyAddress: prop.address,
          propertyId: prop.id,
          propertyType: prop.type,
          effectivePercent: eff,
          propertyValue: prop.value,
          effectiveValue: prop.value != null ? (prop.value * eff) / 100 : null,
          path: `${person.name} → ${company.name} → ${prop.address}`,
        });
      }

      // Subsidiary companies (company → company → property)
      const subEdges = companyToCompany.filter(e => e.from === company.id);
      for (const sce of subEdges) {
        const subCompany = companies.find(c => c.id === sce.to);
        if (!subCompany) continue;
        const subPropEdges = companyToProperty.filter(e => e.from === subCompany.id);
        for (const spe of subPropEdges) {
          const prop = properties.find(p => p.id === spe.to);
          if (!prop) continue;
          const eff = (pce.percent * sce.percent * spe.percent) / 10000;
          rows.push({
            personName: person.name,
            personId: person.id,
            companyName: subCompany.name,
            companyId: subCompany.companyId,
            companyNumber: subCompany.companyNumber,
            propertyAddress: prop.address,
            propertyId: prop.id,
            propertyType: prop.type,
            effectivePercent: eff,
            propertyValue: prop.value,
            effectiveValue: prop.value != null ? (prop.value * eff) / 100 : null,
            path: `${person.name} → ${company.name} → ${subCompany.name} → ${prop.address}`,
          });
        }
      }
    }
  }

  // Sort by person, then company, then property
  rows.sort((a, b) => a.personName.localeCompare(b.personName) || a.companyName.localeCompare(b.companyName) || a.propertyAddress.localeCompare(b.propertyAddress));

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border/50 p-3">
          <p className="text-xs text-muted-foreground">People</p>
          <p className="text-xl font-bold">{people.length}</p>
        </div>
        <div className="rounded-lg border border-border/50 p-3">
          <p className="text-xs text-muted-foreground">Companies</p>
          <p className="text-xl font-bold">{companies.length}</p>
        </div>
        <div className="rounded-lg border border-border/50 p-3">
          <p className="text-xs text-muted-foreground">Properties</p>
          <p className="text-xl font-bold">{properties.length}</p>
        </div>
        <div className="rounded-lg border border-border/50 p-3">
          <p className="text-xs text-muted-foreground">Total Value</p>
          <p className="text-xl font-bold">{formatGBP(properties.reduce((s, p) => s + (p.value || 0), 0))}</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-semibold">Owner</TableHead>
              <TableHead className="font-semibold">Company</TableHead>
              <TableHead className="font-semibold">Property</TableHead>
              <TableHead className="text-right font-semibold">Effective %</TableHead>
              <TableHead className="text-right font-semibold">Property Value</TableHead>
              <TableHead className="text-right font-semibold">Effective Value</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No ownership chains found. Add shareholders and link properties to companies.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={`${row.personId}-${row.companyId}-${row.propertyId}-${i}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm">{row.personName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => navigate(`/companies/${row.companyId}`)}
                      className="flex items-center gap-2 hover:underline text-left"
                    >
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <span className="text-sm font-medium">{row.companyName}</span>
                        {row.companyNumber && (
                          <span className="text-xs text-muted-foreground ml-1">({row.companyNumber})</span>
                        )}
                      </div>
                    </button>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => navigate(`/properties/${row.propertyId}`)}
                      className="flex items-center gap-2 hover:underline text-left"
                    >
                      <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <span className="text-sm">{row.propertyAddress}</span>
                        {row.propertyType && (
                          <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">{row.propertyType}</Badge>
                        )}
                      </div>
                    </button>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-sm">
                    {formatPercent(row.effectivePercent)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {row.propertyValue != null ? formatGBP(row.propertyValue) : '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {row.effectiveValue != null ? formatGBP(row.effectiveValue) : '—'}
                  </TableCell>
                  <TableCell>
                    <Button aria-label="Open in new tab"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => navigate(`/properties/${row.propertyId}`)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
