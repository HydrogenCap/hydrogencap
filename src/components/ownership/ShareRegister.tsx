import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, ArrowRightLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useShareClasses,
  useAddShareClass,
  useShareholdings,
  useAddShareholding,
  useShareTransfers,
  useAddShareTransfer,
  calculateStampDuty,
  formatCurrency,
  type ShareClass,
  type Shareholding,
} from '@/hooks/useShareRegister';

interface ShareRegisterProps {
  entityId: string;
  orgId: string;
}

export function ShareRegister({ entityId, orgId }: ShareRegisterProps) {
  const { toast } = useToast();
  const { data: shareClasses = [], isLoading: loadingClasses } = useShareClasses(entityId);
  const { data: shareholdings = [], isLoading: loadingHoldings } = useShareholdings(entityId);

  const [showClassDialog, setShowClassDialog] = useState(false);
  const [showHolderDialog, setShowHolderDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);

  return (
    <div className="space-y-6">
      {/* Share Classes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-semibold">Share Classes</CardTitle>
          <Button size="sm" onClick={() => setShowClassDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Class
          </Button>
        </CardHeader>
        <CardContent>
          {loadingClasses ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : shareClasses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No share classes defined. Add one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Nominal Value</TableHead>
                  <TableHead className="text-right">Total Issued</TableHead>
                  <TableHead>Voting</TableHead>
                  <TableHead>Dividend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shareClasses.map((sc) => (
                  <TableRow key={sc.id}>
                    <TableCell className="font-medium">{sc.class_name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(sc.nominal_value)}</TableCell>
                    <TableCell className="text-right">{sc.total_issued.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={sc.voting_rights ? 'default' : 'secondary'}>
                        {sc.voting_rights ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={sc.dividend_rights ? 'default' : 'secondary'}>
                        {sc.dividend_rights ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Shareholdings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-semibold">Shareholdings</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowTransferDialog(true)} disabled={shareholdings.length === 0}>
              <ArrowRightLeft className="h-4 w-4 mr-1" /> Transfer
            </Button>
            <Button size="sm" onClick={() => setShowHolderDialog(true)} disabled={shareClasses.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Add Holder
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingHoldings ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : shareholdings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shareholdings recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Holder</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead>Allotment Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shareholdings.map((sh) => (
                  <TableRow key={sh.id}>
                    <TableCell className="font-medium">{sh.holder_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{sh.holder_type}</Badge>
                    </TableCell>
                    <TableCell>{sh.share_class?.class_name ?? '—'}</TableCell>
                    <TableCell className="text-right">{sh.shares_held.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{sh.percentage.toFixed(2)}%</TableCell>
                    <TableCell>{sh.allotment_date ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddShareClassDialog
        open={showClassDialog}
        onOpenChange={setShowClassDialog}
        entityId={entityId}
        orgId={orgId}
      />
      <AddShareholderDialog
        open={showHolderDialog}
        onOpenChange={setShowHolderDialog}
        entityId={entityId}
        orgId={orgId}
        shareClasses={shareClasses}
      />
      <RecordTransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        entityId={entityId}
        orgId={orgId}
        shareClasses={shareClasses}
        shareholdings={shareholdings}
      />
    </div>
  );
}

// ─── Add Share Class Dialog ──────────────────────────────────────────────────

function AddShareClassDialog({
  open,
  onOpenChange,
  entityId,
  orgId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityId: string;
  orgId: string;
}) {
  const { toast } = useToast();
  const addShareClass = useAddShareClass();
  const [className, setClassName] = useState('Ordinary');
  const [nominalValue, setNominalValue] = useState('1.00');
  const [totalIssued, setTotalIssued] = useState('100');
  const [votingRights, setVotingRights] = useState(true);
  const [dividendRights, setDividendRights] = useState(true);

  const handleSubmit = async () => {
    try {
      await addShareClass.mutateAsync({
        org_id: orgId,
        entity_id: entityId,
        class_name: className,
        nominal_value: parseFloat(nominalValue),
        total_issued: parseInt(totalIssued, 10),
        voting_rights: votingRights,
        dividend_rights: dividendRights,
      });
      toast({ title: 'Share class added' });
      onOpenChange(false);
      setClassName('Ordinary');
      setNominalValue('1.00');
      setTotalIssued('100');
      setVotingRights(true);
      setDividendRights(true);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Share Class</DialogTitle>
          <DialogDescription>
            Define a new class of shares for this entity (ordinary, preference, etc).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Class Name</Label>
            <Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. Ordinary, Preference A" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nominal Value (£)</Label>
              <Input type="number" step="0.01" min="0.01" value={nominalValue} onChange={(e) => setNominalValue(e.target.value)} />
            </div>
            <div>
              <Label>Total Issued</Label>
              <Input type="number" min="1" value={totalIssued} onChange={(e) => setTotalIssued(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Checkbox id="voting" checked={votingRights} onCheckedChange={(v) => setVotingRights(!!v)} />
              <Label htmlFor="voting">Voting Rights</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="dividend" checked={dividendRights} onCheckedChange={(v) => setDividendRights(!!v)} />
              <Label htmlFor="dividend">Dividend Rights</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={addShareClass.isPending || !className}>
            {addShareClass.isPending ? 'Adding...' : 'Add Class'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Shareholder Dialog ──────────────────────────────────────────────────

function AddShareholderDialog({
  open,
  onOpenChange,
  entityId,
  orgId,
  shareClasses,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityId: string;
  orgId: string;
  shareClasses: ShareClass[];
}) {
  const { toast } = useToast();
  const addShareholding = useAddShareholding();
  const [holderName, setHolderName] = useState('');
  const [holderType, setHolderType] = useState<'individual' | 'corporate' | 'trust' | 'nominee'>('individual');
  const [shareClassId, setShareClassId] = useState('');
  const [sharesHeld, setSharesHeld] = useState('');
  const [percentage, setPercentage] = useState('');
  const [allotmentDate, setAllotmentDate] = useState('');

  const handleSubmit = async () => {
    try {
      await addShareholding.mutateAsync({
        org_id: orgId,
        entity_id: entityId,
        share_class_id: shareClassId,
        holder_name: holderName,
        holder_type: holderType,
        shares_held: parseInt(sharesHeld, 10),
        percentage: parseFloat(percentage),
        allotment_date: allotmentDate || null,
      });
      toast({ title: 'Shareholder added' });
      onOpenChange(false);
      setHolderName('');
      setSharesHeld('');
      setPercentage('');
      setAllotmentDate('');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Shareholder</DialogTitle>
          <DialogDescription>
            Record a new shareholder — individual or entity — against a share class.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Holder Name</Label>
            <Input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="Full name or company name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Holder Type</Label>
              <Select value={holderType} onValueChange={(v: any) => setHolderType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="trust">Trust</SelectItem>
                  <SelectItem value="nominee">Nominee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Share Class</Label>
              <Select value={shareClassId} onValueChange={setShareClassId}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {shareClasses.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id}>{sc.class_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Shares Held</Label>
              <Input type="number" min="1" value={sharesHeld} onChange={(e) => setSharesHeld(e.target.value)} />
            </div>
            <div>
              <Label>Percentage (%)</Label>
              <Input type="number" step="0.01" min="0" max="100" value={percentage} onChange={(e) => setPercentage(e.target.value)} />
            </div>
            <div>
              <Label>Allotment Date</Label>
              <Input type="date" value={allotmentDate} onChange={(e) => setAllotmentDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={addShareholding.isPending || !holderName || !shareClassId || !sharesHeld || !percentage}>
            {addShareholding.isPending ? 'Adding...' : 'Add Shareholder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Record Transfer Dialog ──────────────────────────────────────────────────

function RecordTransferDialog({
  open,
  onOpenChange,
  entityId,
  orgId,
  shareClasses,
  shareholdings,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityId: string;
  orgId: string;
  shareClasses: ShareClass[];
  shareholdings: Shareholding[];
}) {
  const { toast } = useToast();
  const addTransfer = useAddShareTransfer();
  const [shareClassId, setShareClassId] = useState('');
  const [fromHolder, setFromHolder] = useState('');
  const [toHolder, setToHolder] = useState('');
  const [sharesTransferred, setSharesTransferred] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [consideration, setConsideration] = useState('0');

  const considerationNum = parseFloat(consideration) || 0;
  const stampDuty = calculateStampDuty(considerationNum);

  const uniqueHolders = [...new Set(shareholdings.map((s) => s.holder_name))];

  const handleSubmit = async () => {
    try {
      await addTransfer.mutateAsync({
        org_id: orgId,
        entity_id: entityId,
        share_class_id: shareClassId,
        from_holder: fromHolder,
        to_holder: toHolder,
        shares_transferred: parseInt(sharesTransferred, 10),
        transfer_date: transferDate,
        consideration: considerationNum,
        stamp_duty: stampDuty,
        notes: null,
      });
      toast({ title: 'Transfer recorded' });
      onOpenChange(false);
      setShareClassId('');
      setFromHolder('');
      setToHolder('');
      setSharesTransferred('');
      setConsideration('0');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Share Transfer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Share Class</Label>
            <Select value={shareClassId} onValueChange={setShareClassId}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {shareClasses.map((sc) => (
                  <SelectItem key={sc.id} value={sc.id}>{sc.class_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>From</Label>
              <Select value={fromHolder} onValueChange={setFromHolder}>
                <SelectTrigger><SelectValue placeholder="Select holder" /></SelectTrigger>
                <SelectContent>
                  {uniqueHolders.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To</Label>
              <Input value={toHolder} onChange={(e) => setToHolder(e.target.value)} placeholder="Recipient name" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Shares</Label>
              <Input type="number" min="1" value={sharesTransferred} onChange={(e) => setSharesTransferred(e.target.value)} />
            </div>
            <div>
              <Label>Transfer Date</Label>
              <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
            </div>
            <div>
              <Label>Consideration (£)</Label>
              <Input type="number" step="0.01" min="0" value={consideration} onChange={(e) => setConsideration(e.target.value)} />
            </div>
          </div>
          {considerationNum > 1000 && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Stamp Duty (0.5%): {formatCurrency(stampDuty)}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Payable on transfers where consideration exceeds £1,000
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={addTransfer.isPending || !shareClassId || !fromHolder || !toHolder || !sharesTransferred}
          >
            {addTransfer.isPending ? 'Recording...' : 'Record Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
