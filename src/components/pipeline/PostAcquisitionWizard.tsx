import { useState } from 'react';
import {
  Home,
  FileCheck,
  PoundSterling,
  Key,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatGBP } from '@/lib/calculations';
import { type DealPipelineItem } from '@/hooks/useDealPipeline';
import { toast } from "sonner";

const STEPS = [
  { id: 'property', label: 'Property Details', icon: Home },
  { id: 'compliance', label: 'Compliance Docs', icon: FileCheck },
  { id: 'finance', label: 'Finance Setup', icon: PoundSterling },
  { id: 'lettings', label: 'Lettings / Development', icon: Key },
] as const;

interface PropertyDetails {
  address_line: string;
  postcode: string;
  property_type: string;
  beds: number;
  purchase_price: number;
  current_value: number;
  lifecycle_type: 'standard' | 'hmo' | 'development';
}

interface ComplianceDocs {
  gas_cert: boolean;
  eicr: boolean;
  epc: boolean;
  epc_rating: string;
}

interface FinanceDetails {
  lender: string;
  mortgage_amount: number;
  interest_rate: number;
  mortgage_type: string;
  monthly_payment: number;
}

interface LettingsSetup {
  target_rent: number;
  strategy: 'buy_to_let' | 'hmo' | 'refurb_flip' | 'refurb_rent';
}

interface PostAcquisitionWizardProps {
  deal: DealPipelineItem;
  onComplete?: () => void;
}

export function PostAcquisitionWizard({ deal, onComplete }: PostAcquisitionWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Pre-fill from deal data
  const [property, setProperty] = useState<PropertyDetails>({
    address_line: deal.address,
    postcode: deal.postcode || '',
    property_type: deal.property_type || '',
    beds: deal.beds || 0,
    purchase_price: deal.offer_amount || deal.asking_price || 0,
    current_value: deal.asking_price || 0,
    lifecycle_type: 'standard',
  });

  const [compliance, setCompliance] = useState<ComplianceDocs>({
    gas_cert: false,
    eicr: false,
    epc: false,
    epc_rating: '',
  });

  const [finance, setFinance] = useState<FinanceDetails>({
    lender: '',
    mortgage_amount: 0,
    interest_rate: 0,
    mortgage_type: 'repayment',
    monthly_payment: 0,
  });

  const [lettings, setLettings] = useState<LettingsSetup>({
    target_rent: deal.estimated_rental || 0,
    strategy: 'buy_to_let',
  });

  const step = STEPS[currentStep];
  const progressPercent = ((currentStep + 1) / STEPS.length) * 100;

  const handleComplete = () => {
    toast('Onboarding complete', { description: `${property.address_line} has been set up in TenureIQ.` });
    onComplete?.();
  };

  const canAdvance = () => {
    switch (step.id) {
      case 'property':
        return property.address_line && property.purchase_price > 0;
      case 'compliance':
        return true;
      case 'finance':
        return true;
      case 'lettings':
        return lettings.target_rent > 0;
      default:
        return true;
    }
  };

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          return (
            <div key={s.id} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-border" />}
              <button
                onClick={() => i <= currentStep && setCurrentStep(i)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  isActive && 'bg-primary text-primary-foreground',
                  isDone && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                  !isActive && !isDone && 'bg-muted text-muted-foreground'
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      <Progress value={progressPercent} className="h-1.5" />

      {/* Step content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{step.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Property Details */}
          {step.id === 'property' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Address</Label>
                  <Input
                    value={property.address_line}
                    onChange={e =>
                      setProperty(p => ({ ...p, address_line: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Postcode</Label>
                  <Input
                    value={property.postcode}
                    onChange={e =>
                      setProperty(p => ({ ...p, postcode: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Property Type</Label>
                  <Input
                    value={property.property_type}
                    onChange={e =>
                      setProperty(p => ({ ...p, property_type: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Beds</Label>
                  <Input
                    type="number"
                    min={0}
                    value={property.beds}
                    onChange={e =>
                      setProperty(p => ({ ...p, beds: Number(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <Label>Lifecycle</Label>
                  <Select
                    value={property.lifecycle_type}
                    onValueChange={v =>
                      setProperty(p => ({
                        ...p,
                        lifecycle_type: v as PropertyDetails['lifecycle_type'],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard BTL</SelectItem>
                      <SelectItem value="hmo">HMO</SelectItem>
                      <SelectItem value="development">Development / Refurb</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Purchase Price (£)</Label>
                  <Input
                    type="number"
                    value={property.purchase_price}
                    onChange={e =>
                      setProperty(p => ({
                        ...p,
                        purchase_price: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Current Value (£)</Label>
                  <Input
                    type="number"
                    value={property.current_value}
                    onChange={e =>
                      setProperty(p => ({
                        ...p,
                        current_value: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 2: Compliance */}
          {step.id === 'compliance' && (
            <>
              <p className="text-sm text-muted-foreground">
                Upload or confirm initial compliance documents for this property.
              </p>
              <div className="space-y-3">
                {([
                  { key: 'gas_cert' as const, label: 'Gas Safety Certificate (CP12)' },
                  { key: 'eicr' as const, label: 'EICR (Electrical Safety)' },
                  { key: 'epc' as const, label: 'Energy Performance Certificate' },
                ] as const).map(doc => (
                  <div
                    key={doc.key}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setCompliance(c => ({ ...c, [doc.key]: !c[doc.key] }))
                        }
                        className={cn(
                          'h-5 w-5 rounded border flex items-center justify-center transition-colors',
                          compliance[doc.key]
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-input'
                        )}
                      >
                        {compliance[doc.key] && (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <span className="text-sm">{doc.label}</span>
                    </div>
                    <Badge
                      variant={compliance[doc.key] ? 'default' : 'secondary'}
                    >
                      {compliance[doc.key] ? 'Uploaded' : 'Pending'}
                    </Badge>
                  </div>
                ))}
              </div>
              {compliance.epc && (
                <div>
                  <Label>EPC Rating</Label>
                  <Select
                    value={compliance.epc_rating}
                    onValueChange={v =>
                      setCompliance(c => ({ ...c, epc_rating: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(r => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* Step 3: Finance */}
          {step.id === 'finance' && (
            <>
              <p className="text-sm text-muted-foreground">
                Set up mortgage or loan details for {formatGBP(property.purchase_price)} purchase.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Lender</Label>
                  <Input
                    placeholder="The Mortgage Works"
                    value={finance.lender}
                    onChange={e =>
                      setFinance(f => ({ ...f, lender: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Mortgage Type</Label>
                  <Select
                    value={finance.mortgage_type}
                    onValueChange={v =>
                      setFinance(f => ({ ...f, mortgage_type: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="repayment">Repayment</SelectItem>
                      <SelectItem value="interest_only">Interest Only</SelectItem>
                      <SelectItem value="bridging">Bridging</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                      <SelectItem value="cash">Cash (No Mortgage)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mortgage Amount (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={finance.mortgage_amount || ''}
                    onChange={e =>
                      setFinance(f => ({
                        ...f,
                        mortgage_amount: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Interest Rate (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={finance.interest_rate || ''}
                    onChange={e =>
                      setFinance(f => ({
                        ...f,
                        interest_rate: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Monthly Payment (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={finance.monthly_payment || ''}
                    onChange={e =>
                      setFinance(f => ({
                        ...f,
                        monthly_payment: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="flex items-end">
                  <div className="p-2 bg-muted/50 rounded text-sm">
                    <span className="text-muted-foreground">LTV: </span>
                    <span className="font-medium">
                      {property.purchase_price > 0 && finance.mortgage_amount > 0
                        ? `${((finance.mortgage_amount / property.purchase_price) * 100).toFixed(1)}%`
                        : '\u2014'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step 4: Lettings / Development */}
          {step.id === 'lettings' && (
            <>
              <p className="text-sm text-muted-foreground">
                Choose your strategy and set up the next step.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Strategy</Label>
                  <Select
                    value={lettings.strategy}
                    onValueChange={v =>
                      setLettings(l => ({
                        ...l,
                        strategy: v as LettingsSetup['strategy'],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy_to_let">Buy to Let</SelectItem>
                      <SelectItem value="hmo">HMO</SelectItem>
                      <SelectItem value="refurb_flip">Refurb & Flip</SelectItem>
                      <SelectItem value="refurb_rent">Refurb & Rent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Target Monthly Rent (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={lettings.target_rent || ''}
                    onChange={e =>
                      setLettings(l => ({
                        ...l,
                        target_rent: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              {/* Preview summary */}
              <Card className="bg-muted/30">
                <CardContent className="p-4 space-y-2">
                  <h4 className="text-sm font-medium">Onboarding Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Address: </span>
                      {property.address_line}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Purchase: </span>
                      {formatGBP(property.purchase_price)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Target Rent: </span>
                      {formatGBP(lettings.target_rent)}/mo
                    </div>
                    <div>
                      <span className="text-muted-foreground">Gross Yield: </span>
                      {property.purchase_price > 0 && lettings.target_rent > 0
                        ? `${(((lettings.target_rent * 12) / property.purchase_price) * 100).toFixed(2)}%`
                        : '\u2014'}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Strategy: </span>
                      {lettings.strategy.replace(/_/g, ' ')}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Compliance: </span>
                      {[compliance.gas_cert, compliance.eicr, compliance.epc].filter(Boolean).length}/3
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(s => s - 1)}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button
            onClick={() => setCurrentStep(s => s + 1)}
            disabled={!canAdvance()}
          >
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleComplete} disabled={!canAdvance()}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Complete Onboarding
          </Button>
        )}
      </div>
    </div>
  );
}
