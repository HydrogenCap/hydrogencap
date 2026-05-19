import { SEO } from '@/components/SEO';
import { breadcrumbList } from '@/lib/seo/jsonLd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Shield,
  Building2,
  FileText,
  Download,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { MarketingLayout } from '@/components/marketing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// Sample demo data
const kpis = [
  { label: 'Portfolio Value', value: '£4,250,000', trend: '+3.2%', trendUp: true },
  { label: 'Total Mortgage', value: '£2,423,500', trend: '-£12K', trendUp: true },
  { label: 'Average LTV', value: '57%', trend: '-2%', trendUp: true },
  { label: 'Monthly Cashflow', value: '£12,450', trend: '+£840', trendUp: true },
  { label: 'Compliance Issues', value: '3', trend: '', trendUp: false },
];

const properties = [
  { id: 1, name: '14 High Street', type: 'HMO 6-bed', value: 650000, ltv: 62, cashflow: 1850, status: 'compliant' },
  { id: 2, name: '8 Station Road', type: 'HMO 5-bed', value: 520000, ltv: 58, cashflow: 1420, status: 'review' },
  { id: 3, name: '22 Park Lane', type: 'BTL 3-bed', value: 380000, ltv: 45, cashflow: 890, status: 'compliant' },
  { id: 4, name: '5 Church View', type: 'HMO 7-bed', value: 720000, ltv: 68, cashflow: 2100, status: 'expired' },
  { id: 5, name: '31 Mill Lane', type: 'BTL 2-bed', value: 295000, ltv: 52, cashflow: 650, status: 'compliant' },
  { id: 6, name: '17 Bridge Street', type: 'HMO 8-bed', value: 850000, ltv: 55, cashflow: 2340, status: 'review' },
  { id: 7, name: '9 Oak Avenue', type: 'BTL 4-bed', value: 420000, ltv: 48, cashflow: 980, status: 'compliant' },
  { id: 8, name: '3 River View', type: 'HMO 5-bed', value: 415000, ltv: 61, cashflow: 1220, status: 'compliant' },
];

const riskItems = [
  { property: '5 Church View', issue: 'EICR Certificate', days: -15, severity: 'expired' },
  { property: '8 Station Road', issue: 'Gas Safety Certificate', days: 12, severity: 'urgent' },
  { property: '17 Bridge Street', issue: 'HMO Licence Renewal', days: 28, severity: 'warning' },
  { property: '14 High Street', issue: 'Fire Alarm Inspection', days: 45, severity: 'info' },
  { property: '31 Mill Lane', issue: 'EPC Rating', days: 67, severity: 'info' },
];

const complianceStats = [
  { label: 'Compliant', count: 45, color: 'bg-success' },
  { label: 'Expiring Soon', count: 5, color: 'bg-warning' },
  { label: 'Expired', count: 2, color: 'bg-destructive' },
  { label: 'Not Required', count: 8, color: 'bg-muted' },
];

export default function MarketingDemo() {
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      case 'urgent':
        return <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">Due in 7-30 days</Badge>;
      case 'warning':
        return <Badge variant="secondary">Due in 30-60 days</Badge>;
      default:
        return <Badge variant="outline">60+ days</Badge>;
    }
  };

  return (
    <MarketingLayout>
      <SEO
        title="Book a Demo — Tenure IQ"
        description="See Tenure IQ in action. Book a free 15-minute demo to see how we can simplify your property portfolio management."
        jsonLd={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Demo', path: '/demo' },
        ])}
      />
      {/* Demo Header */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-8 border-b">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <Badge variant="secondary" className="mb-2">Demo Mode</Badge>
              <h1 className="text-2xl font-bold">Tenure IQ Dashboard</h1>
              <p className="text-muted-foreground">Exploring with sample data • 8 properties</p>
            </div>
            <div className="flex gap-3">
              <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Generate Report</DialogTitle>
                    <DialogDescription>
                      Select a report type to generate. In the full version, these export as professional PDFs.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3 mt-4">
                    {['Portfolio Summary', 'Compliance Report', 'Mortgage Broker Pack', 'Insurance Schedule'].map((type) => (
                      <Button key={type} variant="outline" className="justify-start" onClick={() => setReportDialogOpen(false)}>
                        <Download className="h-4 w-4 mr-2" />
                        {type}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    PDF generation available in the full dashboard.
                  </p>
                </DialogContent>
              </Dialog>
              <Button asChild>
                <Link to="/contact">Book Real Demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="py-6 border-b">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {kpis.map((kpi) => (
              <Card key={kpi.label} className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">{kpi.value}</span>
                  {kpi.trend && (
                    <span className={`text-xs flex items-center ${kpi.trendUp ? 'text-success' : 'text-destructive'}`}>
                      {kpi.trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {kpi.trend}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Main Dashboard Content */}
      <section className="py-8">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Charts Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Cashflow Chart Placeholder */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Cashflow Trend (12 Months)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-end justify-between gap-1 px-4">
                    {[65, 72, 68, 75, 82, 78, 85, 88, 92, 95, 91, 98].map((height, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div 
                          className="w-full bg-primary/20 rounded-t hover:bg-primary/30 transition-colors"
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i]}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Properties Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Properties
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground">Property</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground">Type</th>
                          <th className="text-right p-3 text-xs font-medium text-muted-foreground">Value</th>
                          <th className="text-right p-3 text-xs font-medium text-muted-foreground">LTV</th>
                          <th className="text-right p-3 text-xs font-medium text-muted-foreground">Cashflow</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {properties.map((property) => (
                          <tr key={property.id} className="border-b hover:bg-muted/20 transition-colors">
                            <td className="p-3 font-medium text-sm">{property.name}</td>
                            <td className="p-3 text-sm text-muted-foreground">{property.type}</td>
                            <td className="p-3 text-sm text-right">£{property.value.toLocaleString()}</td>
                            <td className="p-3 text-sm text-right">
                              <span className={property.ltv > 65 ? 'text-warning' : ''}>
                                {property.ltv}%
                              </span>
                            </td>
                            <td className="p-3 text-sm text-right text-success">
                              £{property.cashflow.toLocaleString()}
                            </td>
                            <td className="p-3">
                              <Badge variant={
                                property.status === 'compliant' ? 'default' :
                                property.status === 'review' ? 'secondary' : 'destructive'
                              }>
                                {property.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Compliance Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Compliance Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {complianceStats.map((stat) => (
                      <div key={stat.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${stat.color}`} />
                          <span className="text-sm">{stat.label}</span>
                        </div>
                        <span className="font-semibold">{stat.count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden mt-4">
                    <div className="bg-success" style={{ width: '75%' }} />
                    <div className="bg-warning" style={{ width: '8%' }} />
                    <div className="bg-destructive" style={{ width: '3%' }} />
                    <div className="bg-muted" style={{ width: '14%' }} />
                  </div>
                </CardContent>
              </Card>

              {/* Risk Radar */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-primary" />
                    Risk Radar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {riskItems.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-medium text-sm">{item.property}</span>
                          {getSeverityBadge(item.severity)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.issue} • {item.days < 0 ? `${Math.abs(item.days)} days overdue` : `Due in ${item.days} days`}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* LTV by Entity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    LTV by Entity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { name: 'Pinwydd Ltd', ltv: 58, value: '£1.2M' },
                      { name: 'Tamise Ltd', ltv: 62, value: '£980K' },
                      { name: 'Personal Name', ltv: 48, value: '£870K' },
                      { name: 'Eilsberi Ltd', ltv: 55, value: '£1.1M' },
                    ].map((entity) => (
                      <div key={entity.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{entity.name}</span>
                          <span className="text-muted-foreground">{entity.ltv}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${entity.ltv > 60 ? 'bg-warning' : 'bg-primary'}`}
                            style={{ width: `${entity.ltv}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{entity.value} value</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to see your own data?</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Book a personalised demo and we'll show you how your portfolio would look in the dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/contact">Book a Demo</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/product">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
