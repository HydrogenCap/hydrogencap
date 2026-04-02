import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, XCircle, Download, Shield } from 'lucide-react';
import { format, addMonths, isAfter, isBefore } from 'date-fns';
import jsPDF from 'jspdf';

interface Section21ChecklistProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenancyId: string;
}

type CheckStatus = 'pass' | 'warning' | 'fail';

interface CheckItem {
  label: string;
  status: CheckStatus;
  detail: string;
  blocking: boolean;
  manualOverride?: boolean;
}

export function Section21Checklist({ open, onOpenChange, tenancyId }: Section21ChecklistProps) {
  const [manualChecks, setManualChecks] = useState<Record<string, boolean>>({});
  const today = useMemo(() => new Date(), []);

  // Fetch tenancy
  const { data: tenancy } = useQuery({
    queryKey: ['tenancy-s21', tenancyId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('tenancy_agreements')
        .select(`
          id, start_date, initial_end_date, actual_end_date, status, is_periodic,
          how_to_rent_served_date, deposit_protected_date, deposit_scheme, deposit_amount,
          prescribed_info_served_date,
          tenants_v2(first_name, last_name),
          rooms_v2(room_name, property_id,
            properties_v2(id, address_line_1, city, postcode)
          )
        `)
        .eq('id', tenancyId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const propertyId = tenancy?.rooms_v2?.properties_v2?.id;

  // Fetch compliance docs for property
  const { data: complianceDocs } = useQuery({
    queryKey: ['s21-compliance', propertyId],
    enabled: open && !!propertyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('compliance_documents_v2')
        .select('document_type, expiry_date, issue_date, status, is_current')
        .eq('property_id', propertyId!)
        .eq('is_current', true);
      if (error) throw error;
      return data || [];
    },
  });

  const checks = useMemo((): CheckItem[] => {
    if (!tenancy) return [];

    const findDoc = (keywords: string[]) =>
      complianceDocs?.find(d => keywords.some(k => d.document_type.toLowerCase().includes(k)));

    const gasCert = findDoc(['gas']);
    const epc = findDoc(['epc']);
    const eicr = findDoc(['eicr', 'electrical']);

    const isExpired = (expiryDate: string | null) => !expiryDate || isBefore(new Date(expiryDate), today);

    const items: CheckItem[] = [];

    // Gas Safety
    if (!gasCert) {
      items.push({ label: 'Gas Safety Certificate', status: 'fail', detail: 'Not found — BLOCKS Section 21', blocking: true });
    } else if (isExpired(gasCert.expiry_date)) {
      items.push({ label: 'Gas Safety Certificate', status: 'fail', detail: `Expired ${gasCert.expiry_date ? format(new Date(gasCert.expiry_date), 'dd/MM/yyyy') : ''} — BLOCKS Section 21`, blocking: true });
    } else {
      items.push({ label: 'Gas Safety Certificate', status: 'pass', detail: `Valid until ${format(new Date(gasCert.expiry_date!), 'dd/MM/yyyy')}`, blocking: false });
    }

    // EPC
    if (!epc) {
      items.push({ label: 'EPC', status: 'fail', detail: 'Not found — BLOCKS Section 21', blocking: true });
    } else if (isExpired(epc.expiry_date)) {
      items.push({ label: 'EPC', status: 'fail', detail: `Expired — BLOCKS Section 21`, blocking: true });
    } else {
      items.push({ label: 'EPC', status: 'pass', detail: `Valid until ${format(new Date(epc.expiry_date!), 'dd/MM/yyyy')}`, blocking: false });
    }

    // EICR
    if (!eicr) {
      items.push({ label: 'EICR', status: 'fail', detail: 'Not found — BLOCKS Section 21', blocking: true });
    } else if (isExpired(eicr.expiry_date)) {
      items.push({ label: 'EICR', status: 'fail', detail: `Expired — BLOCKS Section 21`, blocking: true });
    } else {
      items.push({ label: 'EICR', status: 'pass', detail: `Valid until ${format(new Date(eicr.expiry_date!), 'dd/MM/yyyy')}`, blocking: false });
    }

    // How to Rent Guide
    if (tenancy.how_to_rent_served_date) {
      items.push({ label: 'How to Rent Guide', status: 'pass', detail: `Served ${format(new Date(tenancy.how_to_rent_served_date), 'dd/MM/yyyy')}`, blocking: false });
    } else {
      items.push({ label: 'How to Rent Guide', status: 'warning', detail: 'Not recorded — manual confirmation needed', blocking: false, manualOverride: true });
    }

    // Deposit Protection
    if (tenancy.deposit_protected_date && tenancy.deposit_scheme) {
      items.push({ label: 'Deposit Protection', status: 'pass', detail: `${tenancy.deposit_scheme} — protected ${format(new Date(tenancy.deposit_protected_date), 'dd/MM/yyyy')}`, blocking: false });
    } else if (tenancy.deposit_amount && tenancy.deposit_amount > 0) {
      items.push({ label: 'Deposit Protection', status: 'warning', detail: 'Deposit taken but protection not confirmed', blocking: false, manualOverride: true });
    } else {
      items.push({ label: 'Deposit Protection', status: 'pass', detail: 'No deposit taken', blocking: false });
    }

    // Prescribed Information
    if (tenancy.prescribed_info_served_date) {
      items.push({ label: 'Prescribed Information', status: 'pass', detail: `Served ${format(new Date(tenancy.prescribed_info_served_date), 'dd/MM/yyyy')}`, blocking: false });
    } else if (tenancy.deposit_amount && tenancy.deposit_amount > 0) {
      items.push({ label: 'Prescribed Information', status: 'warning', detail: 'Not recorded — required if deposit taken', blocking: false, manualOverride: true });
    } else {
      items.push({ label: 'Prescribed Information', status: 'pass', detail: 'No deposit — not required', blocking: false });
    }

    // Fixed term check
    const endDate = tenancy.initial_end_date;
    if (endDate && isAfter(new Date(endDate), today)) {
      items.push({ label: 'Fixed Term', status: 'fail', detail: `Tenancy runs until ${format(new Date(endDate), 'dd/MM/yyyy')} — notice cannot expire before this date`, blocking: true });
    } else {
      items.push({ label: 'Fixed Term', status: 'pass', detail: endDate ? `Ended ${format(new Date(endDate), 'dd/MM/yyyy')}` : 'Periodic tenancy', blocking: false });
    }

    return items;
  }, [tenancy, complianceDocs, today]);

  const hasBlockers = checks.some(c => c.status === 'fail');
  const hasWarnings = checks.some(c => c.status === 'warning' && !manualChecks[c.label]);

  // Earliest valid notice expiry
  const earliestExpiry = useMemo(() => {
    const twoMonthsNotice = addMonths(today, 2);
    const endDate = tenancy?.initial_end_date ? new Date(tenancy.initial_end_date) : null;
    if (endDate && isAfter(endDate, twoMonthsNotice)) return endDate;
    return twoMonthsNotice;
  }, [tenancy, today]);

  const generateForm6A = () => {
    const doc = new jsPDF();
    const tenant = tenancy?.tenants_v2;
    const property = tenancy?.rooms_v2?.properties_v2;

    doc.setFontSize(16);
    doc.text('Housing Act 1988 — Section 21(1) / (4)', 20, 25);
    doc.text('Notice requiring possession', 20, 35);
    doc.setFontSize(11);
    doc.text(`To: ${tenant?.first_name} ${tenant?.last_name}`, 20, 50);
    doc.text(`Of: ${property?.address_line_1}, ${property?.city}, ${property?.postcode}`, 20, 60);
    if (tenancy?.rooms_v2?.room_name) {
      doc.text(`Room: ${tenancy.rooms_v2.room_name}`, 20, 70);
    }
    doc.text(`Notice date: ${format(today, 'dd MMMM yyyy')}`, 20, 85);
    doc.text(`Earliest valid expiry: ${format(earliestExpiry, 'dd MMMM yyyy')}`, 20, 95);
    doc.text('', 20, 110);
    doc.text('I/We give you notice that I/we require possession of the', 20, 115);
    doc.text('dwelling-house known as the above address after:', 20, 125);
    doc.setFontSize(14);
    doc.text(format(earliestExpiry, 'dd MMMM yyyy'), 20, 140);
    doc.setFontSize(11);
    doc.text('', 20, 155);
    doc.text('Signed: ____________________________', 20, 170);
    doc.text(`Date: ${format(today, 'dd MMMM yyyy')}`, 20, 180);

    doc.setFontSize(8);
    doc.text('DISCLAIMER: This is a template only. Seek independent legal advice', 20, 270);
    doc.text('before serving any notice. This does not constitute legal advice.', 20, 276);

    doc.save(`section-21-${tenant?.last_name}-${format(today, 'yyyy-MM-dd')}.pdf`);
  };

  const StatusIcon = ({ status }: { status: CheckStatus }) => {
    if (status === 'pass') return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (status === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  if (!tenancy) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Section 21 Pre-flight
          </DialogTitle>
          <DialogDescription>
            {tenancy.tenants_v2?.first_name} {tenancy.tenants_v2?.last_name} — {tenancy.rooms_v2?.properties_v2?.address_line_1}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {checks.map(item => (
            <div key={item.label} className="flex items-start gap-3 p-2 rounded-md border">
              <StatusIcon status={item.manualOverride && manualChecks[item.label] ? 'pass' : item.status} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.detail}</div>
              </div>
              {item.manualOverride && (
                <div className="flex items-center gap-1">
                  <Checkbox
                    checked={manualChecks[item.label] || false}
                    onCheckedChange={(v) => setManualChecks(prev => ({ ...prev, [item.label]: !!v }))}
                  />
                  <span className="text-xs text-muted-foreground">Confirm</span>
                </div>
              )}
              {item.blocking && <Badge variant="destructive" className="text-xs shrink-0">Blocks</Badge>}
            </div>
          ))}

          {/* Earliest date */}
          <div className="p-3 rounded-lg bg-muted text-sm">
            <span className="text-muted-foreground">Earliest valid expiry date: </span>
            <span className="font-semibold">{format(earliestExpiry, 'dd MMMM yyyy')}</span>
          </div>

          {/* Summary */}
          {hasBlockers ? (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Cannot serve Section 21 — blocking issues found
            </div>
          ) : hasWarnings ? (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Confirm manual checks before proceeding
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              All checks passed — ready to generate notice
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={generateForm6A} disabled={hasBlockers || hasWarnings}>
            <Download className="h-4 w-4 mr-1" /> Generate Form 6A
          </Button>
        </DialogFooter>

        <p className="text-[10px] text-muted-foreground text-center">
          This is a template only. Seek independent legal advice before serving any notice.
        </p>
      </DialogContent>
    </Dialog>
  );
}
