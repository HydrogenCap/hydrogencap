import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import {
  useReportData,
  useGenerateReport,
  REPORT_TEMPLATES,
  validateReportInputs,
  type ReportType,
  type MortgageBrokerPackData,
} from '@/hooks/useReportGeneration';
import { useReportHistory, deleteReport } from '@/hooks/useReportHistory';
import type { ReportFilters } from '@/lib/reportPdfGenerator';
import type { LifecycleFilter, LoanPurpose, SelectionMode } from '../utils/types';

export function useReportsState() {
  const { properties, portfolioSummary, companies, isLoading } = useReportData();
  const { data: reportHistory, isLoading: historyLoading, refetch: refetchHistory } = useReportHistory();
  const generateReport = useGenerateReport();

  const [lifecycleType, setLifecycleType] = useState<LifecycleFilter>('all');
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [brokerNotes, setBrokerNotes] = useState('');
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [showBrokerPackDialog, setShowBrokerPackDialog] = useState(false);
  const [loanPurpose, setLoanPurpose] = useState<LoanPurpose>('');
  const [targetLoanAmount, setTargetLoanAmount] = useState<string>('');
  const [targetLTV, setTargetLTV] = useState<string>('');
  const [preparedFor, setPreparedFor] = useState<string>('');

  const lifecycleFilteredProperties = useMemo(() => {
    if (lifecycleType === 'all') return properties;
    return properties.filter(p => p.lifecycle_type === lifecycleType);
  }, [properties, lifecycleType]);

  const filteredProperties = useMemo(() => {
    if (selectionMode === 'single' && selectedPropertyId) {
      return lifecycleFilteredProperties.filter(p => p.id === selectedPropertyId);
    }
    return lifecycleFilteredProperties;
  }, [lifecycleFilteredProperties, selectionMode, selectedPropertyId]);

  const filters: ReportFilters = useMemo(() => ({
    lifecycleType,
    propertyIds: 'all',
    asOfDate: new Date(),
    includeAttachments,
  }), [lifecycleType, includeAttachments]);

  const propertyForBrokerPack = useMemo(() => {
    return filteredProperties.find(p => p.legal_owner_company_id) || filteredProperties[0] || null;
  }, [filteredProperties]);

  const brokerPackData: MortgageBrokerPackData | null = useMemo(() => {
    if (!propertyForBrokerPack) return null;
    const company = companies?.find(c => c.id === propertyForBrokerPack.legal_owner_company_id);
    return {
      property: propertyForBrokerPack,
      company: company || null,
      portfolioSummary,
      loanPurpose,
      targetLoanAmount: targetLoanAmount ? parseFloat(targetLoanAmount) : null,
      targetLTV: targetLTV ? parseFloat(targetLTV) : null,
      brokerNotes,
      preparedFor,
    };
  }, [propertyForBrokerPack, companies, portfolioSummary, loanPurpose, targetLoanAmount, targetLTV, brokerNotes, preparedFor]);

  const [brokerPackValidation, setBrokerPackValidation] = useState<{ canGenerate: boolean; warnings: string[]; errors: string[] }>({ canGenerate: false, warnings: [], errors: ['No properties available'] });

  useEffect(() => {
    if (!brokerPackData) {
      setBrokerPackValidation({ canGenerate: false, warnings: [], errors: ['No properties available'] });
      return;
    }
    import('@/lib/mortgageBrokerPackGenerator').then(({ validateMortgageBrokerPack }) => {
      setBrokerPackValidation(validateMortgageBrokerPack(brokerPackData));
    });
  }, [brokerPackData]);

  const handleGenerateReport = async (reportType: ReportType) => {
    if (reportType === 'mortgage_broker_pack') {
      setShowBrokerPackDialog(true);
      return;
    }
    const template = REPORT_TEMPLATES.find(t => t.id === reportType);
    if (!template) return;
    const validation = validateReportInputs(template, filters, filteredProperties);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }
    try {
      await generateReport.mutateAsync({
        reportType,
        filters,
        properties: filteredProperties,
        brokerNotes: undefined,
      });
      toast.success(`${template.name} generated successfully!`);
      refetchHistory();
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate report');
    }
  };

  const handleGenerateBrokerPack = async () => {
    if (!brokerPackData || !brokerPackValidation.canGenerate) {
      toast.error(brokerPackValidation.errors[0] || 'Please complete all required fields');
      return;
    }
    try {
      await generateReport.mutateAsync({
        reportType: 'mortgage_broker_pack',
        filters,
        properties: filteredProperties,
        brokerNotes,
        brokerPackData,
      });
      toast.success('Mortgage Broker Pack generated successfully!');
      setShowBrokerPackDialog(false);
      refetchHistory();
      setLoanPurpose('');
      setTargetLoanAmount('');
      setTargetLTV('');
      setPreparedFor('');
    } catch (error) {
      console.error('Failed to generate broker pack:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate report');
    }
  };

  const handleDeleteReport = async (path: string) => {
    try {
      setDeletingPath(path);
      await deleteReport(path);
      toast.success('Report deleted');
      refetchHistory();
    } catch (error) {
      console.error('Failed to delete report:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete report');
    } finally {
      setDeletingPath(null);
    }
  };

  const companyForBrokerPack = useMemo(() => {
    if (!propertyForBrokerPack?.legal_owner_company_id) return null;
    return companies?.find(c => c.id === propertyForBrokerPack.legal_owner_company_id) || null;
  }, [propertyForBrokerPack, companies]);

  return {
    isLoading, reportHistory, historyLoading,
    generateReport,
    lifecycleType, setLifecycleType,
    selectionMode, setSelectionMode,
    selectedPropertyId, setSelectedPropertyId,
    includeAttachments, setIncludeAttachments,
    brokerNotes, setBrokerNotes,
    deletingPath,
    showBrokerPackDialog, setShowBrokerPackDialog,
    loanPurpose, setLoanPurpose,
    targetLoanAmount, setTargetLoanAmount,
    targetLTV, setTargetLTV,
    preparedFor, setPreparedFor,
    lifecycleFilteredProperties, filteredProperties,
    propertyForBrokerPack, brokerPackValidation,
    companyForBrokerPack,
    handleGenerateReport, handleGenerateBrokerPack, handleDeleteReport,
  };
}
