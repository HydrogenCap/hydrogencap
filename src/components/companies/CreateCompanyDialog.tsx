import React, { useState, useEffect } from 'react';
import { Building2, Loader2, Check, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CompanySearchInput } from './CompanySearchInput';
import { useCompaniesHouse, type CHCompanySearchResult, type CHLookupResult } from '@/hooks/useCompaniesHouse';
import { useCreateCompany, type CompanyType } from '@/hooks/useCompanies';
import { useToast } from '@/hooks/use-toast';

interface CreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: CompanyType;
  onSuccess?: (companyId: string) => void;
}

const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: 'SPV', label: 'SPV (Property Holding)' },
  { value: 'HOLDCO', label: 'Holding Company' },
  { value: 'OPCO', label: 'Operating Company' },
  { value: 'OTHER', label: 'Other' },
];

export function CreateCompanyDialog({
  open,
  onOpenChange,
  defaultType = 'SPV',
  onSuccess,
}: CreateCompanyDialogProps) {
  const { toast } = useToast();
  const { lookupCompany, isLookingUp, error: chError } = useCompaniesHouse();
  const createCompany = useCreateCompany();

  const [tab, setTab] = useState<'search' | 'manual'>('search');
  const [_selectedCompany, setSelectedCompany] = useState<CHCompanySearchResult | null>(null);
  const [chDetails, setChDetails] = useState<CHLookupResult | null>(null);

  // Manual entry fields
  const [legalName, setLegalName] = useState('');
  const [tradingName, setTradingName] = useState('');
  const [companyNumber, setCompanyNumber] = useState('');
  const [companyType, setCompanyType] = useState<CompanyType>(defaultType);

  const isSubmitting = createCompany.isPending;

  useEffect(() => {
    if (open) {
      setTab('search');
      setSelectedCompany(null);
      setChDetails(null);
      setLegalName('');
      setTradingName('');
      setCompanyNumber('');
      setCompanyType(defaultType);
    }
  }, [open, defaultType]);

  const handleSelectFromSearch = async (company: CHCompanySearchResult) => {
    setSelectedCompany(company);
    const details = await lookupCompany(company.company_number);
    if (details) {
      setChDetails(details);
      setLegalName(details.company.company_name);
      setCompanyNumber(details.company.company_number);
    }
  };

  const handleSubmit = async () => {
    if (!legalName.trim()) {
      toast({ title: 'Error', description: 'Company name is required', variant: 'destructive' });
      return;
    }

    try {
      const company = await createCompany.mutateAsync({
        legal_name: legalName.trim(),
        trading_name: tradingName.trim() || undefined,
        company_number: companyNumber.trim() || undefined,
        company_type: companyType,
        ch_registered_address: chDetails?.company?.registered_address,
        ch_incorporation_date: chDetails?.company?.date_of_creation,
      });

      toast({ title: 'Company created', description: `${legalName} has been added` });
      onOpenChange(false);
      onSuccess?.(company.id);
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Failed to create company';
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Add Company
          </DialogTitle>
          <DialogDescription>
            Register a new legal entity — search Companies House or enter details manually.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'search' | 'manual')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">Search Companies House</TabsTrigger>
            <TabsTrigger value="manual">Enter Manually</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4 pt-4">
            <CompanySearchInput onSelect={handleSelectFromSearch} />

            {isLookingUp && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Loading company details...</span>
              </div>
            )}

            {chError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{chError}</AlertDescription>
              </Alert>
            )}

            {chDetails && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">{chDetails.company.company_name}</p>
                  <p className="text-sm text-muted-foreground">
                      {chDetails.company.company_number} • {chDetails.company.company_status}
                    </p>
                    {chDetails.company.registered_address && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {chDetails.company.registered_address}
                      </p>
                    )}
                  </div>
                </div>

                {chDetails.significant_controllers?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Persons with Significant Control:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {chDetails.significant_controllers.map((psc, i) => (
                        <li key={i}>• {psc.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Legal Name *</Label>
              <Input
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="e.g., Galocha Properties Ltd"
              />
            </div>

            <div className="space-y-2">
              <Label>Trading Name (optional)</Label>
              <Input
                value={tradingName}
                onChange={(e) => setTradingName(e.target.value)}
                placeholder="e.g., Galocha Properties"
              />
            </div>

            <div className="space-y-2">
              <Label>Company Number (optional)</Label>
              <Input
                value={companyNumber}
                onChange={(e) => setCompanyNumber(e.target.value)}
                placeholder="e.g., 12345678"
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label>Company Type</Label>
          <Select value={companyType} onValueChange={(v) => setCompanyType(v as CompanyType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !legalName.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Add Company'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
