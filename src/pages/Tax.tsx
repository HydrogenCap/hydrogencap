import { useState } from 'react';
import { Receipt, Download, Plus, Trash2, AlertTriangle, Building2, User2, Info } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getCurrentTaxYear, getRecentTaxYears } from '@/lib/accountingTypes';
import { calculateSection24, generateSA105CSV, TAX_EXPENSE_CATEGORIES } from '@/lib/propertyTax';
import { useTaxSummary, useTaxExpenses, useAddTaxExpense, useDeleteTaxExpense, useTaxSettings, useUpdateTaxSettings } from '@/hooks/useTaxData';
import { useOrganization } from '@/hooks/useOrganization';
import { MtdItsaCard } from '@/components/tax/MtdItsaCard';

const fmt = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${n.toFixed(1)}%`;

export default function Tax() {
  const [taxYear, setTaxYear] = useState(getCurrentTaxYear());
  const { data: org } = useOrganization();
  const { data: summary, isLoading } = useTaxSummary(taxYear);
  const { data: taxSettings } = useTaxSettings();
  const updateSettings = useUpdateTaxSettings();
  const { data: manualExpenses } = useTaxExpenses(taxYear);
  const addExpense = useAddTaxExpense();
  const deleteExpense = useDeleteTaxExpense();

  // Add expense dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({ property_id: '', category: 'insurance', description: '', amount: '' });

  const taxYears = getRecentTaxYears(5);

  // Section 24 calc for personal properties
  const personalProps = summary?.properties.filter(p => {
    const t = p.entityType;
    return !t || t === 'personal' || t === 'partnership';
  }) || [];
  const personalInterest = personalProps.reduce((s, p) => s + p.residentialFinanceCosts, 0);
  const personalProfit = personalProps.reduce((s, p) => s + p.adjustedProfit, 0);
  const s24 = taxSettings
    ? calculateSection24(personalInterest, personalProfit, taxSettings.marginalTaxRate)
    : null;

  const handleExportCSV = () => {
    if (!summary) return;
    const csv = generateSA105CSV(summary.properties);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SA105_${taxYear.replace('/', '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('SA105 CSV exported');
  };

  const handleAddExpense = async () => {
    if (!org || !newExpense.property_id || !newExpense.amount) return;
    await addExpense.mutateAsync({
      org_id: org.id,
      property_id: newExpense.property_id,
      tax_year: taxYear,
      category: newExpense.category,
      description: newExpense.description || undefined,
      amount: parseFloat(newExpense.amount),
    });
    setAddOpen(false);
    setNewExpense({ property_id: '', category: 'insurance', description: '', amount: '' });
    toast.success('Expense added');
  };

  const rateOptions: { value: string; label: string }[] = [
    { value: '0.20', label: 'Basic (20%)' },
    { value: '0.40', label: 'Higher (40%)' },
    { value: '0.45', label: 'Additional (45%)' },
  ];

  return (
    <AppLayout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Tax & Section 24
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            UK property tax estimates — SA105 data & Section 24 impact
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={taxYear} onValueChange={setTaxYear}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {taxYears.map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!summary}>
            <Download className="h-4 w-4 mr-2" />
            Export SA105
          </Button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2 text-sm text-destructive">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>This is an estimate only. Consult a qualified accountant for tax advice.</span>
      </div>

      {/* Tax settings row */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tax Settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Marginal Tax Rate</Label>
            <Select
              value={String(taxSettings?.marginalTaxRate || 0.40)}
              onValueChange={v => updateSettings.mutate({ marginal_tax_rate: parseFloat(v) })}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rateOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Corporation Tax Rate</Label>
            <Input
              type="number"
              className="w-[100px]"
              value={(taxSettings?.corporationTaxRate || 0.25) * 100}
              onChange={e => updateSettings.mutate({ corporation_tax_rate: parseFloat(e.target.value) / 100 })}
            />
          </div>
        </CardContent>
      </Card>

      <MtdItsaCard taxYear={taxYear} grossIncome={summary?.totalRentalIncome ?? 0} />

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Calculating…</div>
      ) : !summary ? (
        <div className="text-center py-12 text-muted-foreground">No data for this tax year</div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Total Rental Income" value={fmt(summary.totalRentalIncome)} />
            <KpiCard label="Total Expenses" value={fmt(summary.totalAllowableExpenses)} />
            <KpiCard label="Net Taxable Profit" value={fmt(summary.netPropertyIncome)} />
            <KpiCard label="Estimated Tax" value={fmt(summary.estimatedTaxLiability)} accent />
          </div>

          {/* Section 24 Impact */}
          {s24 && personalInterest > 0 && (
            <Card className="border-amber-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Section 24 Impact
                </CardTitle>
                <CardDescription>For personally-held properties only (not SPVs)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total mortgage interest</span>
                    <p className="font-semibold">{fmt(s24.totalMortgageInterest)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tax credit (20%)</span>
                    <p className="font-semibold text-primary">-{fmt(s24.taxReliefAt20Percent)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Additional tax due to S24</span>
                    <p className="font-semibold text-destructive">{fmt(s24.additionalTaxDueToS24)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Effective tax rate</span>
                    <p className="font-semibold">{pct(s24.effectiveTaxRate)}</p>
                  </div>
                </div>
                {s24.additionalTaxDueToS24 > 0 && (
                  <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                    💡 Consider: Moving properties into an SPV could save {fmt(s24.additionalTaxDueToS24)}/year in tax.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Property Breakdown Table */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Per-Property Breakdown</CardTitle>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" /> Add Expense
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Manual Tax Expense</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1">
                      <Label>Property</Label>
                      <Select value={newExpense.property_id} onValueChange={v => setNewExpense(e => ({ ...e, property_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                        <SelectContent>
                          {summary.properties.map(p => (
                            <SelectItem key={p.propertyId} value={p.propertyId}>{p.propertyAddress}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Select value={newExpense.category} onValueChange={v => setNewExpense(e => ({ ...e, category: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TAX_EXPENSE_CATEGORIES.map(c => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Description (optional)</Label>
                      <Input value={newExpense.description} onChange={e => setNewExpense(ex => ({ ...ex, description: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Amount (£)</Label>
                      <Input type="number" value={newExpense.amount} onChange={e => setNewExpense(ex => ({ ...ex, amount: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddExpense} disabled={addExpense.isPending}>Add</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead className="text-right">Income</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Tax Credit</TableHead>
                    <TableHead>Entity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.properties.map(p => (
                    <Collapsible key={p.propertyId} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell className="font-medium max-w-[200px] truncate">{p.propertyAddress}</TableCell>
                            <TableCell className="text-right">{fmt(p.totalRentalIncome)}</TableCell>
                            <TableCell className="text-right">{fmt(p.totalAllowableExpenses)}</TableCell>
                            <TableCell className="text-right">{fmt(p.residentialFinanceCosts)}</TableCell>
                            <TableCell className="text-right">{fmt(p.adjustedProfit)}</TableCell>
                            <TableCell className="text-right">{fmt(p.taxCreditAt20Percent)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {p.entityType === 'spv' || p.entityType === 'limited_company' ? (
                                  <><Building2 className="h-3 w-3 mr-1" />SPV</>
                                ) : (
                                  <><User2 className="h-3 w-3 mr-1" />Personal</>
                                )}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={7}>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-2 text-sm">
                                <div><span className="text-muted-foreground">Repairs:</span> {fmt(p.repairs)}</div>
                                <div><span className="text-muted-foreground">Insurance:</span> {fmt(p.insurance)}</div>
                                <div><span className="text-muted-foreground">Management:</span> {fmt(p.managementFees)}</div>
                                <div><span className="text-muted-foreground">Accounting:</span> {fmt(p.accountingFees)}</div>
                                <div><span className="text-muted-foreground">Ground Rent:</span> {fmt(p.groundRent)}</div>
                                <div><span className="text-muted-foreground">Service Charges:</span> {fmt(p.serviceCharges)}</div>
                                <div><span className="text-muted-foreground">Other:</span> {fmt(p.otherAllowableExpenses)}</div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Manual Expenses List */}
          {manualExpenses && manualExpenses.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Manual Tax Expenses ({taxYear})</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-[40px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualExpenses.map((exp) => (
                      <TableRow key={exp.id}>
                        <TableCell className="capitalize">{exp.category?.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-muted-foreground">{exp.description || '—'}</TableCell>
                        <TableCell className="text-right">{fmt(Number(exp.amount))}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { deleteExpense.mutate(exp.id); toast.success('Deleted'); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Per-Entity Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Per-Entity Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {summary.perEntityBreakdown.map(entity => (
                <div key={entity.entityId || 'personal'} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {entity.entityType === 'spv' || entity.entityType === 'limited_company' ? (
                        <Building2 className="h-4 w-4 text-primary" />
                      ) : (
                        <User2 className="h-4 w-4 text-primary" />
                      )}
                      <span className="font-semibold">{entity.entityName}</span>
                      <Badge variant="secondary" className="text-xs">
                        {entity.entityType === 'spv' || entity.entityType === 'limited_company' ? 'SPV' : 'Personal'}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">{entity.properties.length} properties</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Income:</span>{' '}
                      <span className="font-medium">{fmt(entity.totalIncome)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Profit:</span>{' '}
                      <span className="font-medium">{fmt(entity.totalProfit)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {entity.entityType === 'spv' || entity.entityType === 'limited_company'
                          ? `Corp tax (${(entity.applicableTaxRate * 100).toFixed(0)}%):`
                          : `Income tax (${(entity.applicableTaxRate * 100).toFixed(0)}%):`}
                      </span>{' '}
                      <span className="font-medium">{fmt(entity.estimatedTax)}</span>
                    </div>
                  </div>
                  {entity.section24Credit > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Section 24 credit:</span>{' '}
                      <span className="text-primary font-medium">-{fmt(entity.section24Credit)}</span>
                      <span className="mx-2">→</span>
                      <span className="text-muted-foreground">Net tax:</span>{' '}
                      <span className="font-semibold">{fmt(entity.netTax)}</span>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
    </AppLayout>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold mt-1 ${accent ? 'text-primary' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
