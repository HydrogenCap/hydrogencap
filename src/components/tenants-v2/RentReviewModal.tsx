import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, Download, CheckCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import { format, addMonths } from 'date-fns';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);

interface RentReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenancyId: string;
}

export function RentReviewModal({ open, onOpenChange, tenancyId }: RentReviewModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cpiPercent, setCpiPercent] = useState('3');
  const [customRent, setCustomRent] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(format(addMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);

  // Fetch tenancy with room, property, tenant
  const { data: tenancy } = useQuery({
    queryKey: ['tenancy-for-review', tenancyId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenancy_agreements')
        .select(`
          id, rent_amount_pcm, rent_frequency, start_date, initial_end_date, status,
          tenants_v2(id, first_name, last_name, email),
          rooms_v2(id, room_name, current_rent_pcm, property_id,
            properties_v2(id, address_line_1, city, postcode)
          )
        `)
        .eq('id', tenancyId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Area average rent query
  const outwardCode = tenancy?.rooms_v2?.properties_v2?.postcode?.split(' ')[0] || '';
  const { data: areaAverage } = useQuery({
    queryKey: ['area-average-rent', outwardCode],
    enabled: open && !!outwardCode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms_v2')
        .select('current_rent_pcm, properties_v2!inner(postcode)')
        .ilike('properties_v2.postcode', `${outwardCode}%`)
        .gt('current_rent_pcm', 0);
      if (error) throw error;
      if (!data?.length) return null;
      const avg = data.reduce((s, r) => s + Number(r.current_rent_pcm), 0) / data.length;
      return { average: Math.round(avg), sampleSize: data.length };
    },
  });

  const currentRent = Number(tenancy?.rent_amount_pcm || 0);
  const cpiAdjusted = Math.round(currentRent * (1 + parseFloat(cpiPercent || '0') / 100));
  const areaAvg = areaAverage?.average || 0;
  const suggestedRent = Math.max(cpiAdjusted, areaAvg);
  const selectedRent = customRent ? parseFloat(customRent) : suggestedRent;
  const increase = selectedRent - currentRent;
  const increasePercent = currentRent > 0 ? ((increase / currentRent) * 100).toFixed(1) : '0';

  // Accept mutation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      // Update tenancy rent
      await supabase.from('tenancy_agreements').update({
        rent_amount_pcm: selectedRent,
        last_rent_review_date: new Date().toISOString(),
        last_rent_review_amount: selectedRent,
      }).eq('id', tenancyId);

      // Update room rent
      if (tenancy?.rooms_v2?.id) {
        await supabase.from('rooms_v2').update({
          current_rent_pcm: selectedRent,
        }).eq('id', tenancy.rooms_v2.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenancy-for-review'] });
      queryClient.invalidateQueries({ queryKey: ['tenancy-events'] });
      toast({ title: 'Rent updated', description: `New rent: ${fmt(selectedRent)}/month from ${format(new Date(effectiveDate), 'dd MMM yyyy')}` });
      onOpenChange(false);
    },
    onError: (error: unknown) =>
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update rent.',
        variant: 'destructive',
      }),
  });

  const generatePDF = () => {
    const doc = new jsPDF();
    const tenant = tenancy?.tenants_v2;
    const property = tenancy?.rooms_v2?.properties_v2;

    doc.setFontSize(18);
    doc.text('Notice of Rent Increase', 20, 30);
    doc.setFontSize(11);
    doc.text(`Date: ${format(new Date(), 'dd MMMM yyyy')}`, 20, 45);
    doc.text(`To: ${tenant?.first_name} ${tenant?.last_name}`, 20, 55);
    doc.text(`Property: ${property?.address_line_1}, ${property?.city}, ${property?.postcode}`, 20, 65);
    if (tenancy?.rooms_v2?.room_name) {
      doc.text(`Room: ${tenancy.rooms_v2.room_name}`, 20, 75);
    }
    doc.text('', 20, 85);
    doc.text(`Current Rent: ${fmt(currentRent)} per calendar month`, 20, 95);
    doc.text(`New Rent: ${fmt(selectedRent)} per calendar month`, 20, 105);
    doc.text(`Effective Date: ${format(new Date(effectiveDate), 'dd MMMM yyyy')}`, 20, 115);
    doc.text('', 20, 130);
    doc.text('Yours sincerely,', 20, 145);
    doc.text('____________________________', 20, 165);
    doc.text('Landlord Signature', 20, 175);
    doc.setFontSize(8);
    doc.text('This is a template only. Seek independent legal advice before serving any notice.', 20, 280);

    doc.save(`rent-increase-${tenant?.last_name}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const handleStatusChange = (status: string) => {
    setReviewStatus(status);
    if (status === 'accepted') {
      acceptMutation.mutate();
    }
  };

  if (!tenancy) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Rent Review
          </DialogTitle>
          <DialogDescription>
            {tenancy.tenants_v2?.first_name} {tenancy.tenants_v2?.last_name} — {tenancy.rooms_v2?.properties_v2?.address_line_1}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current rent */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
            <span className="text-sm font-medium">Current Rent</span>
            <span className="text-lg font-bold">{fmt(currentRent)}/mo</span>
          </div>

          {/* Suggestions */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Suggestions</Label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="border rounded-md p-2">
                <div className="text-muted-foreground text-xs">CPI Adjusted</div>
                <div className="font-semibold">{fmt(cpiAdjusted)}</div>
              </div>
              <div className="border rounded-md p-2">
                <div className="text-muted-foreground text-xs">Area Average ({areaAverage?.sampleSize || 0} rooms)</div>
                <div className="font-semibold">{areaAvg > 0 ? fmt(areaAvg) : 'N/A'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">CPI %</Label>
              <Input type="number" value={cpiPercent} onChange={e => setCpiPercent(e.target.value)} className="w-20 h-8" />
            </div>
          </div>

          {/* New rent */}
          <div className="space-y-1">
            <Label>New Rent (£/month)</Label>
            <Input
              type="number"
              value={customRent || suggestedRent}
              onChange={e => setCustomRent(e.target.value)}
              placeholder={suggestedRent.toString()}
            />
            <div className="text-xs text-muted-foreground">
              {increase > 0 ? `+${fmt(increase)} (+${increasePercent}%)` : increase < 0 ? `${fmt(increase)} (${increasePercent}%)` : 'No change'}
            </div>
          </div>

          {/* Effective date */}
          <div>
            <Label>Effective Date</Label>
            <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={generatePDF}>
              <Download className="h-3 w-3 mr-1" /> Download PDF
            </Button>
          </div>

          {/* Track response */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Tenant Response</Label>
            <div className="flex flex-wrap gap-2">
              {['accepted', 'negotiating', 'tribunal', 'no_response'].map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={reviewStatus === s ? 'default' : 'outline'}
                  onClick={() => handleStatusChange(s)}
                  disabled={acceptMutation.isPending}
                >
                  {s === 'accepted' && <CheckCircle className="h-3 w-3 mr-1" />}
                  {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </Button>
              ))}
            </div>
            {reviewStatus === 'accepted' && (
              <p className="text-xs text-green-600">Rent updated to {fmt(selectedRent)}/month</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
