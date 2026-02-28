import { SEO } from '@/components/SEO';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Filter,
  Search,
  BedDouble,
  TrendingUp,
  Shield,
  Calendar,
  Eye,
} from 'lucide-react';
import { MarketingLayout, SectionHeading, KPIStat } from '@/components/marketing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Sample anonymised data
const sampleProperties = [
  { id: 1, name: '14 High Street', area: 'Cheltenham', type: 'HMO', beds: 6, status: 'Operational', epc: 'C', nextDue: '15/03/2026', nextType: 'EICR' },
  { id: 2, name: '8 Station Road', area: 'Shropshire', type: 'HMO', beds: 5, status: 'Operational', epc: 'D', nextDue: '28/02/2026', nextType: 'Gas Safety' },
  { id: 3, name: '22 Park Lane', area: 'Oxfordshire', type: 'BTL', beds: 3, status: 'Operational', epc: 'B', nextDue: '10/05/2026', nextType: 'EPC' },
  { id: 4, name: '5 Church View', area: 'Somerset', type: 'HMO', beds: 7, status: 'Development', epc: 'E', nextDue: 'N/A', nextType: 'N/A' },
  { id: 5, name: '31 Mill Lane', area: 'Gloucestershire', type: 'BTL', beds: 2, status: 'Operational', epc: 'C', nextDue: '01/04/2026', nextType: 'Fire Alarm' },
  { id: 6, name: '17 Bridge Street', area: 'Cheltenham', type: 'HMO', beds: 8, status: 'Operational', epc: 'C', nextDue: '22/01/2026', nextType: 'HMO Licence' },
];

const kpis = [
  { label: 'Portfolio Value', value: '£4.2M' },
  { label: 'Total Equity', value: '£1.8M' },
  { label: 'Average LTV', value: '57%' },
  { label: 'Properties', value: '12' },
  { label: 'Compliance Rate', value: '94%' },
];

export default function MarketingPortfolio() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredProperties = sampleProperties.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.area.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesType = typeFilter === 'all' || p.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <MarketingLayout>
      <SEO
        title="Portfolio Dashboard — HydrogenCap"
        description="See how HydrogenCap gives you a real-time overview of your property portfolio with KPIs, compliance status, and financial metrics."
      />
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-16 lg:py-20">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary mb-4">
                Portfolio Showcase
              </span>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Sample Portfolio View
              </h1>
              <p className="text-muted-foreground mt-2 max-w-lg">
                Explore how the dashboard displays portfolio data. All data shown is anonymised for demonstration.
              </p>
            </div>
            <Badge variant="outline" className="self-start lg:self-center">
              <Eye className="h-3 w-3 mr-1" />
              Anonymised Demo Data
            </Badge>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="py-8 border-b">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {kpis.map((kpi) => (
              <KPIStat key={kpi.label} {...kpi} />
            ))}
          </div>
        </div>
      </section>

      {/* Filters & Table */}
      <section className="py-12">
        <div className="container mx-auto px-4 lg:px-8">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search properties..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Operational">Operational</SelectItem>
                <SelectItem value="Development">Development</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="HMO">HMO</SelectItem>
                <SelectItem value="BTL">BTL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Property</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Area</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Beds</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">EPC</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Next Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProperties.map((property) => (
                      <tr key={property.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{property.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground">{property.area}</td>
                        <td className="p-4">
                          <Badge variant="outline">{property.type}</Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <BedDouble className="h-4 w-4 text-muted-foreground" />
                            {property.beds}
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant={property.status === 'Operational' ? 'default' : 'secondary'}>
                            {property.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className={
                            property.epc === 'A' || property.epc === 'B' ? 'border-emerald-500 text-emerald-600' :
                            property.epc === 'C' || property.epc === 'D' ? 'border-amber-500 text-amber-600' :
                            'border-destructive text-destructive'
                          }>
                            {property.epc}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {property.nextDue !== 'N/A' ? (
                            <div className="text-sm">
                              <div className="font-medium">{property.nextDue}</div>
                              <div className="text-muted-foreground text-xs">{property.nextType}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Map Placeholder */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            title="Geographic Distribution"
            description="Visualise property locations across your portfolio."
            align="left"
          />
          <Card className="mt-8">
            <CardContent className="h-[400px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-4 text-primary/30" />
                <p className="text-lg font-medium">Interactive Map</p>
                <p className="text-sm">Map view available in the full dashboard</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link to="/demo">View Demo Dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Want to see your own portfolio?</h2>
          <p className="text-muted-foreground mb-6">
            Book a demo to see how your data would look in the dashboard.
          </p>
          <Button asChild>
            <Link to="/contact">Book a Demo</Link>
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
}
