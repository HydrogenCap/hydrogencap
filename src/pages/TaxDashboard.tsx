import { useState } from 'react';
import {
  Receipt,
  Calculator,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Info,
  Building2,
  User2,
  PoundSterling,
  Home,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { getCurrentTaxYear, getRecentTaxYears } from '@/lib/accountingTypes';
import { useTaxCalculation, useTaxProfile, useUpsertTaxProfile } from '@/hooks/useTaxEngine';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { toast } from 'sonner';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${n.toFixed(1)}%`;

export default function TaxDashboard() {
  const [taxYear, setTaxYear] = useState(getCurrentTaxYear());
  const [activeTab, setActiveTab] = useState('overview');
  const taxYears = getRecentTaxYears(5);

  const { data: taxProfile } = useTaxProfile(taxYear);
  const upsertProfile = useUpsertTaxProfile();
  const { data: calculation, isLoading } = useTaxCalculation(taxYear);

  // Profile form state
  const [otherIncome, setOtherIncome] = useState('');
  const [personalAllowance, setPersonalAllowance] = useState('12570');
  const [taxpayerType, setTaxpayerType] = useState<'individual' | 'partnership' | 'company'>('individual');

  // Sync from loaded profile
  const profileLoaded = taxProfile != null;
  if (profileLoaded && otherIncome === '' && taxProfile.other_income > 0) {
    setOtherIncome(String(taxProfile.other_income));
  }
  if (profileLoaded && taxProfile.personal_allowance !== Number(personalAllowance)) {
    setPersonalAllowance(String(taxProfile.personal_allowance));
  }
  if (profileLoaded && taxProfile.taxpayer_type !== taxpayerType) {
    setTaxpayerType(taxProfile.taxpayer_type as typeof taxpayerType);
  }

  const handleSaveProfile = () => {
    upsertProfile.mutate(
      {
        taxYear,
        taxpayerType,
        otherIncome: parseFloat(otherIncome) || 0,
        personalAllowance: parseFloat(personalAllowance) || 12570,
      },
      {
        onSuccess: () => toast.success('Tax profile saved'),
      },
    );
  };

  // Section 24 chart data
  const s24ChartData = calculation
    ? [
        {
          name: 'Old System\n(pre-S24)',
          tax: Math.round(calculation.section24Impact.oldSystemTax),
          fill: 'hsl(var(--chart-2))',
        },
        {
          name: 'New System\n(Section 24)',
          tax: Math.round(calculation.section24Impact.newSystemTax),
          fill: 'hsl(var(--chart-1))',
        },
      ]
    : [];

  const s24Additional = calculation?.section24Impact.additionalTaxDueToSection24 ?? 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6 text-primary" />
              Tax Engine
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              UK property tax — Section 24, SA105 &amp; Capital Gains estimates
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={taxYear} onValueChange={setTaxYear}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {taxYears.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2 text-sm text-destructive">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Estimates only — consult a qualified accountant for tax advice.</span>
        </div>

        {/* Tax Profile Setup */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tax Profile</CardTitle>
            <CardDescription>Configure your taxpayer details for accurate calculations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Taxpayer Type</Label>
                <Select value={taxpayerType} onValueChange={(v) => setTaxpayerType(v as typeof taxpayerType)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Other Income (£)</Label>
                <Input
                  type="number"
                  className="w-[130px]"
                  placeholder="0"
                  value={otherIncome}
                  onChange={(e) => setOtherIncome(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Personal Allowance (£)</Label>
                <Input
                  type="number"
                  className="w-[130px]"
                  value={personalAllowance}
                  onChange={(e) => setPersonalAllowance(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={handleSaveProfile} disabled={upsertProfile.isPending}>
                Save Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Calculating...</div>
        ) : !calculation ? (
          <div className="text-center py-12 text-muted-foreground">No property data for {taxYear}</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                icon={PoundSterling}
                label="Total Property Income"
                value={fmt(calculation.sa105.totalRents)}
              />
              <KpiCard
                icon={Receipt}
                label="Tax Liability"
                value={fmt(calculation.totalTaxLiability)}
                accent
              />
              <KpiCard
                icon={s24Additional > 0 ? TrendingDown : TrendingUp}
                label="Section 24 Impact"
                value={s24Additional > 0 ? `+${fmt(s24Additional)}` : fmt(0)}
                destructive={s24Additional > 0}
              />
              <KpiCard
                icon={Calculator}
                label="Effective Tax Rate"
                value={pct(calculation.effectiveTaxRate)}
              />
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="sa105">SA105</TabsTrigger>
                <TabsTrigger value="cgt">Capital Gains</TabsTrigger>
              </TabsList>

              {/* ── OVERVIEW TAB ── */}
              <TabsContent value="overview" className="mt-6 space-y-6">
                {/* Section 24 Impact Visualisation */}
                {calculation.section24Impact.financeCredit > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartContainer
                      title="Section 24 Impact"
                      subtitle="Old system vs current rules — additional tax burden"
                    >
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={s24ChartData} barGap={20}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12 }}
                            className="fill-muted-foreground"
                          />
                          <YAxis
                            tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                            className="fill-muted-foreground"
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip
                            formatter={(value: number) => [fmt(value), 'Tax']}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                          />
                          <Bar dataKey="tax" radius={[6, 6, 0, 0]} maxBarSize={80}>
                            {s24ChartData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>

                    <Card className="border-amber-500/30">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Section 24 Breakdown
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Total finance costs</span>
                            <p className="font-semibold">{fmt(calculation.sa105.totalFinanceCosts)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">20% tax credit</span>
                            <p className="font-semibold text-primary">
                              -{fmt(calculation.section24Impact.financeCredit)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tax under old rules</span>
                            <p className="font-semibold">{fmt(calculation.section24Impact.oldSystemTax)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tax under Section 24</span>
                            <p className="font-semibold">{fmt(calculation.section24Impact.newSystemTax)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Additional tax due to S24</span>
                            <p className="font-semibold text-destructive">{fmt(s24Additional)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Effective rate (new)</span>
                            <p className="font-semibold">{pct(calculation.section24Impact.effectiveRate)}</p>
                          </div>
                        </div>
                        {s24Additional > 0 && (
                          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                            Consider: SPV structures could reduce this impact for higher-rate taxpayers.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Per-Property Breakdown Table */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Per-Property Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Property</TableHead>
                          <TableHead className="text-right">Gross Rent</TableHead>
                          <TableHead className="text-right">Expenses</TableHead>
                          <TableHead className="text-right">Finance Costs</TableHead>
                          <TableHead className="text-right">Net Income</TableHead>
                          <TableHead className="text-right">Tax</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calculation.perPropertyTax.map((p) => (
                          <TableRow key={p.propertyId}>
                            <TableCell className="font-medium max-w-[220px] truncate">
                              {p.propertyAddress}
                            </TableCell>
                            <TableCell className="text-right">{fmt(p.grossRent)}</TableCell>
                            <TableCell className="text-right">{fmt(p.allowableExpenses)}</TableCell>
                            <TableCell className="text-right">{fmt(p.financeCosts)}</TableCell>
                            <TableCell className="text-right">{fmt(p.netIncome)}</TableCell>
                            <TableCell className="text-right font-semibold">{fmt(p.taxLiability)}</TableCell>
                          </TableRow>
                        ))}
                        {calculation.perPropertyTax.length > 1 && (
                          <TableRow className="font-semibold border-t-2">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-right">
                              {fmt(calculation.perPropertyTax.reduce((s, p) => s + p.grossRent, 0))}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmt(calculation.perPropertyTax.reduce((s, p) => s + p.allowableExpenses, 0))}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmt(calculation.perPropertyTax.reduce((s, p) => s + p.financeCosts, 0))}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmt(calculation.totalPropertyIncome)}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmt(calculation.totalTaxLiability)}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── SA105 TAB ── */}
              <TabsContent value="sa105" className="mt-6 space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-primary" />
                      SA105 Property Income Summary
                    </CardTitle>
                    <CardDescription>
                      UK Self Assessment — SA105 supplementary page values
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* SA105 Summary Boxes */}
                    <div className="rounded-lg border p-4 space-y-3">
                      <h4 className="font-semibold text-sm">Portfolio Totals</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <SA105Box label="Box 20 — Total rents" value={fmt(calculation.sa105.totalRents)} />
                        <SA105Box label="Box 26-29 — Total allowable" value={fmt(calculation.sa105.totalAllowableExpenses)} />
                        <SA105Box label="Box 27 — Finance costs" value={fmt(calculation.sa105.totalFinanceCosts)} />
                        <SA105Box label="Box 31 — Adjusted profit" value={fmt(calculation.sa105.totalAdjustedProfit)} />
                        <SA105Box label="Box 38 — Basic rate reduction" value={fmt(calculation.sa105.totalBasicRateReduction)} />
                      </div>
                    </div>

                    <Separator />

                    {/* Per-Property SA105 Lines */}
                    <h4 className="font-semibold text-sm">Per-Property Detail</h4>
                    {calculation.sa105.lines.map((line) => (
                      <div key={line.propertyId} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Home className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{line.propertyAddress}</span>
                          <Badge variant="outline" className="text-xs ml-auto">
                            {line.entityType === 'spv' || line.entityType === 'limited_company' ? (
                              <>
                                <Building2 className="h-3 w-3 mr-1" />
                                SPV
                              </>
                            ) : (
                              <>
                                <User2 className="h-3 w-3 mr-1" />
                                Personal
                              </>
                            )}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <SA105Box label="Box 20 — Rents" value={fmt(line.box20_totalRents)} />
                          <SA105Box label="Box 26 — Repairs" value={fmt(line.box26_repairsMaintenance)} />
                          <SA105Box label="Box 27 — Finance" value={fmt(line.box27_financeCosts)} />
                          <SA105Box label="Box 28 — Legal/Mgmt" value={fmt(line.box28_legalManagement)} />
                          <SA105Box label="Box 29 — Other" value={fmt(line.box29_otherExpenses)} />
                          <SA105Box label="Box 30 — Total allowable" value={fmt(line.box30_totalAllowable)} />
                          <SA105Box label="Box 31 — Adjusted profit" value={fmt(line.box31_adjustedProfit)} />
                          <SA105Box label="Box 38 — 20% reduction" value={fmt(line.box38_basicRateReduction)} />
                        </div>
                      </div>
                    ))}

                    {calculation.sa105.lines.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No personally-held properties found for SA105
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── CGT TAB ── */}
              <TabsContent value="cgt" className="mt-6 space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Capital Gains Tax Estimates
                    </CardTitle>
                    <CardDescription>
                      Unrealised gains and estimated CGT on disposal (2025-26 rates: 18% basic / 24% higher)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    {calculation.cgtEstimates.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Property</TableHead>
                            <TableHead className="text-right">Purchase Price</TableHead>
                            <TableHead className="text-right">Current Value</TableHead>
                            <TableHead className="text-right">Unrealised Gain</TableHead>
                            <TableHead className="text-right">Annual Exempt</TableHead>
                            <TableHead className="text-right">Taxable Gain</TableHead>
                            <TableHead className="text-right">CGT Rate</TableHead>
                            <TableHead className="text-right">Estimated CGT</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {calculation.cgtEstimates.map((cgt) => (
                            <TableRow key={cgt.propertyId}>
                              <TableCell className="font-medium max-w-[200px] truncate">
                                {cgt.propertyAddress}
                              </TableCell>
                              <TableCell className="text-right">
                                {fmt(cgt.purchasePrice)}
                              </TableCell>
                              <TableCell className="text-right">
                                {fmt(cgt.currentValue)}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={cgt.result.gain > 0 ? 'text-green-600' : 'text-destructive'}>
                                  {fmt(cgt.result.gain)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">{fmt(cgt.result.annualExemptAmount)}</TableCell>
                              <TableCell className="text-right">{fmt(cgt.result.taxableGain)}</TableCell>
                              <TableCell className="text-right">{pct(cgt.result.rate * 100)}</TableCell>
                              <TableCell className="text-right font-semibold">{fmt(cgt.result.cgt)}</TableCell>
                            </TableRow>
                          ))}
                          {calculation.cgtEstimates.length > 1 && (
                            <TableRow className="font-semibold border-t-2">
                              <TableCell>Total</TableCell>
                              <TableCell />
                              <TableCell />
                              <TableCell className="text-right">
                                {fmt(calculation.cgtEstimates.reduce((s, c) => s + c.result.gain, 0))}
                              </TableCell>
                              <TableCell />
                              <TableCell className="text-right">
                                {fmt(calculation.cgtEstimates.reduce((s, c) => s + c.result.taxableGain, 0))}
                              </TableCell>
                              <TableCell />
                              <TableCell className="text-right">
                                {fmt(calculation.cgtEstimates.reduce((s, c) => s + c.result.cgt, 0))}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No properties with both purchase price and current valuation data
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* CGT Rates Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">2025-26 CGT Rates — Residential Property</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="rounded-lg bg-muted/50 p-3">
                        <span className="text-muted-foreground">Annual exempt amount</span>
                        <p className="font-semibold">£3,000</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <span className="text-muted-foreground">Basic rate taxpayer</span>
                        <p className="font-semibold">18%</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <span className="text-muted-foreground">Higher/additional rate</span>
                        <p className="font-semibold">24%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
}

// ── Sub-components ──

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
  destructive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
  destructive?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <p
          className={`text-xl font-bold ${
            destructive ? 'text-destructive' : accent ? 'text-primary' : ''
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function SA105Box({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  );
}
