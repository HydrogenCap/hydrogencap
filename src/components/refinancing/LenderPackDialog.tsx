import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, FileText, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useReportData } from '@/hooks/useReportGeneration';
import { useLenderPackVaultDocs } from '@/hooks/useLenderPackVaultDocs';
import { logActivity } from '@/hooks/useActivityLog';
import {
  computePropertyChecklist,
  countMissing,
  type LenderPackChecklistItem,
  type LenderPackChecklistStatus,
} from '@/lib/pdf/lenderPack/checklist';
import { generateLenderPack } from '@/lib/pdf/lenderPack/generateLenderPackBundle';
import type { MortgageBrokerPackData } from '@/lib/pdf/lenderPack/context';
import { Link } from 'react-router-dom';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, pre-selects this property and locks scope to single. */
  initialPropertyId?: string;
  /** Optional list of property ids to pre-select (portfolio mode). */
  initialSelection?: string[];
}

const STATUS_LABEL: Record<LenderPackChecklistStatus, string> = {
  uploaded: 'Uploaded',
  missing: 'Missing',
  expired: 'Expired',
  expiring_soon: 'Expiring soon',
  na: 'N/A',
};

const STATUS_BADGE: Record<LenderPackChecklistStatus, string> = {
  uploaded: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  missing: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  expired: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  expiring_soon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  na: 'bg-muted text-muted-foreground',
};

export function LenderPackDialog({ open, onOpenChange, initialPropertyId, initialSelection }: Props) {
  const { properties, portfolioSummary, isLoading } = useReportData();

  const [selected, setSelected] = useState<string[]>(
    initialPropertyId ? [initialPropertyId] : initialSelection ?? [],
  );
  const [output, setOutput] = useState<'pdf' | 'zip'>('pdf');
  const [generating, setGenerating] = useState(false);

  const selectedProps = useMemo(
    () => properties.filter(p => selected.includes(p.id)),
    [properties, selected],
  );

  const { data: vaultDocs = [], isLoading: vaultLoading } = useLenderPackVaultDocs(selected);

  const checklists = useMemo(
    () => selectedProps.map(p => ({ prop: p, items: computePropertyChecklist(p, vaultDocs) })),
    [selectedProps, vaultDocs],
  );

  const totalMissing = checklists.reduce((sum, c) => sum + countMissing(c.items), 0);

  const togglePick = (id: string, checked: boolean) => {
    setSelected(prev => (checked ? [...prev, id] : prev.filter(x => x !== id)));
  };

  const handleGenerate = async () => {
    if (selected.length === 0) return;
    setGenerating(true);
    try {
      const packs: MortgageBrokerPackData[] = selectedProps.map(p => ({
        property: p,
        company: null,
        portfolioSummary,
        loanPurpose: 'refinance',
        targetLoanAmount: null,
        targetLTV: null,
        brokerNotes: '',
        preparedFor: 'Mortgage Broker / Lender',
      }));
      const { blob, filename } = await generateLenderPack({
        packs,
        vaultDocs,
        output,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Audit-log entry per property
      await Promise.all(
        selectedProps.map(p =>
          logActivity({
            property_id: p.id,
            entry_type: 'document_uploaded',
            title: `Generated Lender Pack (${output.toUpperCase()})`,
            body: `Lender pack generated covering ${selectedProps.length} ${selectedProps.length === 1 ? 'property' : 'properties'}`,
            metadata: { report_type: 'lender_pack', output, property_count: selectedProps.length },
          }).catch(err => console.warn('Failed to log lender pack activity:', err)),
        ),
      );

      toast.success(`Lender pack ready — ${filename}`);
      onOpenChange(false);
    } catch (err) {
      console.error('Lender pack generation failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate lender pack');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Generate lender pack</DialogTitle>
          <DialogDescription>
            Build a complete refinancing pack covering rent schedule, tenancy ledger,
            compliance certificates, EPC, ownership and accounts. Existing vault links
            are reused — nothing is re-uploaded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Property picker */}
          <div>
            <Label className="text-sm font-medium">Properties</Label>
            <div className="mt-2 rounded-md border">
              <ScrollArea className="max-h-44">
                {isLoading ? (
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                ) : properties.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">No properties found.</p>
                ) : (
                  <ul className="divide-y">
                    {properties.map(p => (
                      <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                        <Checkbox
                          id={`prop-${p.id}`}
                          checked={selected.includes(p.id)}
                          onCheckedChange={(c) => togglePick(p.id, !!c)}
                        />
                        <label htmlFor={`prop-${p.id}`} className="text-sm flex-1 cursor-pointer">
                          {p.address_line}
                          {p.postcode ? <span className="text-muted-foreground"> · {p.postcode}</span> : null}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{selected.length} selected</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => setSelected(properties.map(p => p.id))}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => setSelected([])}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Output format */}
          <div>
            <Label className="text-sm font-medium">Output format</Label>
            <RadioGroup
              value={output}
              onValueChange={(v) => setOutput(v as 'pdf' | 'zip')}
              className="mt-2 grid grid-cols-2 gap-2"
            >
              <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent/40">
                <RadioGroupItem value="pdf" id="out-pdf" className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Single PDF</div>
                  <div className="text-xs text-muted-foreground">
                    Combined lender-ready PDF document.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent/40">
                <RadioGroupItem value="zip" id="out-zip" className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">ZIP bundle</div>
                  <div className="text-xs text-muted-foreground">
                    PDF plus every linked compliance / vault document.
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Checklist */}
          {selectedProps.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Document checklist</Label>
                {totalMissing > 0 ? (
                  <Badge variant="outline" className="text-amber-700 border-amber-300">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {totalMissing} missing
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    All required items present
                  </Badge>
                )}
              </div>
              <ScrollArea className="mt-2 max-h-60 rounded-md border">
                {vaultLoading ? (
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                ) : (
                  <div className="divide-y">
                    {checklists.map(({ prop, items }) => (
                      <ChecklistGroup
                        key={prop.id}
                        title={prop.address_line}
                        propertyId={prop.id}
                        items={items}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generating || selected.length === 0}
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>
            ) : (
              <><FileText className="h-4 w-4 mr-2" />Generate {output.toUpperCase()}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChecklistGroup({
  title,
  propertyId,
  items,
}: {
  title: string;
  propertyId: string;
  items: LenderPackChecklistItem[];
}) {
  return (
    <div className="p-3">
      <div className="text-sm font-semibold mb-2">{title}</div>
      <ul className="space-y-1.5">
        {items.map(item => (
          <li key={item.key} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate">{item.label}</span>
              {!item.required && <span className="text-xs text-muted-foreground">(optional)</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {item.vaultLinks[0] && (
                <a
                  href={item.vaultLinks[0].fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  title={item.vaultLinks[0].fileName}
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <Badge variant="outline" className={STATUS_BADGE[item.status]}>
                {STATUS_LABEL[item.status]}
              </Badge>
              {item.status === 'missing' && item.required && (
                <Link
                  to={`/properties-v2/${propertyId}?tab=documents`}
                  className="text-xs text-primary hover:underline"
                >
                  Fix
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
