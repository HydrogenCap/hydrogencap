import React, { useState, useMemo } from 'react';
import { FileText, Download, Loader2, Image, PoundSterling, ScrollText, Shield } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePropertiesCompat as useProperties } from '@/hooks/usePropertiesCompat';
import { useAllPropertyCoverPhotos } from '@/hooks/useAllPropertyCoverPhotos';
import { useAllCompliance } from '@/hooks/useCompliance';
import type { EnhancedPresentationOptions } from '@/lib/bankPresentationGenerator';
import { calculatePortfolioStats } from '@/lib/portfolioStats';
import { getPropertyMetrics } from '@/lib/propertyMetrics';
import { getComplianceItemStatus } from '@/lib/complianceTypes';
import { useReportData } from '@/hooks/useReportData';
import { toast } from 'sonner';

interface BankPresentationDialogProps {
  trigger?: React.ReactNode;
}

export function BankPresentationDialog({ trigger }: BankPresentationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [options, setOptions] = useState({
    title: 'Portfolio Overview',
    preparedFor: '',
    includePhotos: true,
    includeFinancials: true,
    includeExecutiveSummary: true,
    includeCompliance: true,
  });

  const { data: properties, isLoading: loadingProperties } = useProperties();
  const { data: coverPhotos, isLoading: loadingPhotos } = useAllPropertyCoverPhotos();
  const { data: allComplianceData, isLoading: loadingCompliance } = useAllCompliance();
  const allCompliance = allComplianceData?.items;
  // Single source of truth for portfolio totals — guarantees parity with the dashboard.
  const reportData = useReportData();

  // Build photo map for PDF
  const coverPhotoMap = useMemo(() => {
    const map = new Map<string, string>();
    coverPhotos?.forEach(photo => {
      if (photo.is_cover && photo.file_url) {
        map.set(photo.property_id, photo.file_url);
      }
    });
    return map;
  }, [coverPhotos]);

  // Calculate compliance summary
  const complianceSummary = useMemo(() => {
    if (!allCompliance || allCompliance.length === 0) return undefined;
    
    let compliant = 0;
    let expiringSoon = 0;
    let expired = 0;

    allCompliance.forEach(item => {
      const status = getComplianceItemStatus(item.expiry_date);
      if (status === 'valid') compliant++;
      else if (status === 'expiring_soon') expiringSoon++;
      else if (status === 'expired') expired++;
    });

    return {
      totalItems: allCompliance.length,
      compliant,
      expiringSoon,
      expired,
    };
  }, [allCompliance]);

  // Filter core rental properties
  const coreProperties = useMemo(() => {
    return properties?.filter(p => p.lifecycle_type === 'core_rental') || [];
  }, [properties]);

  // Calculate portfolio stats
  const portfolioStats = useMemo(() => {
    if (!coreProperties.length) return null;

    const metricsMap = new Map<string, ReturnType<typeof getPropertyMetrics>>();
    coreProperties.forEach(p => {
      metricsMap.set(p.id, getPropertyMetrics(p));
    });

    const stats = calculatePortfolioStats(coreProperties, metricsMap);
    
    return {
      totalValue: stats.totalValue,
      totalMortgage: stats.totalMortgageBalance,
      totalEquity: stats.totalEquity,
      averageLTV: stats.portfolioLTV,
      monthlyCashflow: stats.totalMonthlyCashflow,
      propertyCount: stats.count,
      averageYield: stats.weightedAvgYield,
    };
  }, [coreProperties]);

  const handleGenerate = async () => {
    if (!coreProperties.length || !portfolioStats) {
      toast.error('No properties available to generate report');
      return;
    }

    setIsGenerating(true);
    try {
      const presentationOptions: EnhancedPresentationOptions = {
        title: options.title || 'Portfolio Overview',
        subtitle: 'Confidential Bank Presentation',
        preparedFor: options.preparedFor || undefined,
        showPropertyDetails: true,
        showFinancials: options.includeFinancials,
        showPhotos: options.includePhotos,
        includeExecutiveSummary: options.includeExecutiveSummary,
        propertyPhotos: options.includePhotos ? coverPhotoMap : new Map(),
        complianceSummary: options.includeCompliance ? complianceSummary : undefined,
      };

      const { generateBankPresentation, downloadPDF } = await import('@/lib/bankPresentationGenerator');
      const blob = await generateBankPresentation(
        coreProperties, 
        portfolioStats, 
        presentationOptions
      );

      const filename = `Portfolio_Bank_Presentation_${new Date().toISOString().split('T')[0]}.pdf`;
      downloadPDF(blob, filename);
      
      toast.success('Bank presentation generated successfully');
      setOpen(false);
    } catch (error) {
      console.error('Generation failed:', error);
      toast.error('Failed to generate presentation');
    } finally {
      setIsGenerating(false);
    }
  };

  const isLoading = loadingProperties || loadingPhotos || loadingCompliance;
  const hasPhotos = coverPhotoMap.size > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Generate Bank Pack
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generate Bank Presentation</DialogTitle>
          <DialogDescription>
            Create a professional PDF portfolio pack for lenders and investors
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Report Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Report Title</Label>
              <Input
                id="title"
                value={options.title}
                onChange={(e) => setOptions({ ...options, title: e.target.value })}
                placeholder="Portfolio Overview"
              />
            </div>

            {/* Prepared For */}
            <div className="space-y-2">
              <Label htmlFor="preparedFor">Prepared For (optional)</Label>
              <Input
                id="preparedFor"
                value={options.preparedFor}
                onChange={(e) => setOptions({ ...options, preparedFor: e.target.value })}
                placeholder="e.g., HSBC Commercial Banking"
              />
            </div>

            <Separator />

            {/* Include Sections */}
            <div className="space-y-4">
              <Label>Include Sections</Label>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="executiveSummary"
                    checked={options.includeExecutiveSummary}
                    onCheckedChange={(checked) => 
                      setOptions({ ...options, includeExecutiveSummary: !!checked })
                    }
                  />
                  <label htmlFor="executiveSummary" className="flex items-center gap-2 cursor-pointer text-sm">
                    <ScrollText className="h-4 w-4 text-muted-foreground" />
                    Executive Summary
                  </label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="photos"
                    checked={options.includePhotos}
                    onCheckedChange={(checked) => 
                      setOptions({ ...options, includePhotos: !!checked })
                    }
                    disabled={!hasPhotos}
                  />
                  <label 
                    htmlFor="photos" 
                    className={`flex items-center gap-2 cursor-pointer text-sm ${!hasPhotos ? 'text-muted-foreground' : ''}`}
                  >
                    <Image className="h-4 w-4 text-muted-foreground" />
                    Property Photos
                    {!hasPhotos && <span className="text-xs">(no photos available)</span>}
                    {hasPhotos && <span className="text-xs text-muted-foreground">({coverPhotoMap.size} photos)</span>}
                  </label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="financials"
                    checked={options.includeFinancials}
                    onCheckedChange={(checked) => 
                      setOptions({ ...options, includeFinancials: !!checked })
                    }
                  />
                  <label htmlFor="financials" className="flex items-center gap-2 cursor-pointer text-sm">
                    <PoundSterling className="h-4 w-4 text-muted-foreground" />
                    Financial Analysis
                  </label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="compliance"
                    checked={options.includeCompliance}
                    onCheckedChange={(checked) => 
                      setOptions({ ...options, includeCompliance: !!checked })
                    }
                    disabled={!complianceSummary}
                  />
                  <label 
                    htmlFor="compliance" 
                    className={`flex items-center gap-2 cursor-pointer text-sm ${!complianceSummary ? 'text-muted-foreground' : ''}`}
                  >
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    Compliance Status
                    {complianceSummary && (
                      <span className="text-xs text-muted-foreground">
                        ({complianceSummary.compliant}/{complianceSummary.totalItems} valid)
                      </span>
                    )}
                  </label>
                </div>
              </div>
            </div>

            {/* Summary */}
            <Alert>
              <AlertDescription>
                {coreProperties.length} core rental {coreProperties.length === 1 ? 'property' : 'properties'} will be included
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || isLoading || !coreProperties.length}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generate PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
