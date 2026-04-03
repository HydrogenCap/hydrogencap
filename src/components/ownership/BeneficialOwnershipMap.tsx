import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Plus, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useBeneficialOwnersPSC,
  useAddBeneficialOwnerPSC,
  useUpdateBeneficialOwnerPSC,
  useDeleteBeneficialOwnerPSC,
  type BeneficialOwner,
} from '@/hooks/useShareRegister';

const NATURE_OF_CONTROL_OPTIONS = [
  'Ownership of shares – more than 25% but not more than 50%',
  'Ownership of shares – more than 50% but less than 75%',
  'Ownership of shares – 75% or more',
  'Ownership of voting rights – more than 25% but not more than 50%',
  'Ownership of voting rights – more than 50% but less than 75%',
  'Ownership of voting rights – 75% or more',
  'Right to appoint or remove directors',
  'Significant influence or control',
];

interface BeneficialOwnershipMapProps {
  entityId: string;
  orgId: string;
}

export function BeneficialOwnershipMap({ entityId, orgId }: BeneficialOwnershipMapProps) {
  const { toast } = useToast();
  const { data: owners = [], isLoading } = useBeneficialOwnersPSC(entityId);
  const deleteBeneficialOwner = useDeleteBeneficialOwnerPSC();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const unverifiedCount = owners.filter((o) => !o.verified).length;
  const noOwners = owners.length === 0;

  const handleDelete = async (id: string) => {
    try {
      await deleteBeneficialOwner.mutateAsync({ id, entityId });
      toast({ title: 'Beneficial owner removed' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Compliance Alerts */}
      {noOwners && !isLoading && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>PSC Register Empty</AlertTitle>
          <AlertDescription>
            Every UK company must maintain a PSC register. Add at least one person with significant control.
          </AlertDescription>
        </Alert>
      )}
      {unverifiedCount > 0 && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{unverifiedCount} Unverified PSC{unverifiedCount > 1 ? 's' : ''}</AlertTitle>
          <AlertDescription>
            Verification is required to confirm the identity and control of persons with significant control.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-semibold">Persons with Significant Control (PSC)</CardTitle>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add PSC
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : owners.length === 0 ? (
            <p className="text-sm text-muted-foreground">No persons with significant control recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Nature of Control</TableHead>
                  <TableHead>PSC Register Date</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {owners.map((owner) => (
                  <TableRow key={owner.id}>
                    <TableCell className="font-medium">
                      <div>
                        {owner.person_name}
                        {owner.country_of_residence && (
                          <span className="text-xs text-muted-foreground ml-1">({owner.country_of_residence})</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {owner.nature_of_control.map((noc, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {noc.length > 50 ? noc.slice(0, 47) + '...' : noc}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{owner.psc_register_date ?? '—'}</TableCell>
                    <TableCell>{owner.nationality ?? '—'}</TableCell>
                    <TableCell>
                      {owner.verified ? (
                        <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <ShieldCheck className="h-3 w-3" /> Verified
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <ShieldAlert className="h-3 w-3" /> Unverified
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(owner.id)}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddBeneficialOwnerDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        entityId={entityId}
        orgId={orgId}
      />
    </div>
  );
}

// ─── Add Beneficial Owner Dialog ─────────────────────────────────────────────

function AddBeneficialOwnerDialog({
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
  const addOwner = useAddBeneficialOwnerPSC();
  const [personName, setPersonName] = useState('');
  const [natureOfControl, setNatureOfControl] = useState<string[]>([]);
  const [verified, setVerified] = useState(false);
  const [pscRegisterDate, setPscRegisterDate] = useState('');
  const [nationality, setNationality] = useState('');
  const [countryOfResidence, setCountryOfResidence] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');

  const toggleControl = (control: string) => {
    setNatureOfControl((prev) =>
      prev.includes(control) ? prev.filter((c) => c !== control) : [...prev, control]
    );
  };

  const handleSubmit = async () => {
    try {
      await addOwner.mutateAsync({
        org_id: orgId,
        entity_id: entityId,
        person_name: personName,
        nature_of_control: natureOfControl,
        verified,
        psc_register_date: pscRegisterDate || null,
        nationality: nationality || null,
        country_of_residence: countryOfResidence || null,
        date_of_birth: null,
        service_address: serviceAddress || null,
        notes: null,
      });
      toast({ title: 'Beneficial owner added' });
      onOpenChange(false);
      setPersonName('');
      setNatureOfControl([]);
      setVerified(false);
      setPscRegisterDate('');
      setNationality('');
      setCountryOfResidence('');
      setServiceAddress('');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Person with Significant Control</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Full Name</Label>
            <Input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Full legal name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nationality</Label>
              <Input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g. British" />
            </div>
            <div>
              <Label>Country of Residence</Label>
              <Input value={countryOfResidence} onChange={(e) => setCountryOfResidence(e.target.value)} placeholder="e.g. United Kingdom" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>PSC Register Date</Label>
              <Input type="date" value={pscRegisterDate} onChange={(e) => setPscRegisterDate(e.target.value)} />
            </div>
            <div>
              <Label>Service Address</Label>
              <Input value={serviceAddress} onChange={(e) => setServiceAddress(e.target.value)} placeholder="Registered address" />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Nature of Control</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
              {NATURE_OF_CONTROL_OPTIONS.map((option) => (
                <div key={option} className="flex items-start gap-2">
                  <Checkbox
                    checked={natureOfControl.includes(option)}
                    onCheckedChange={() => toggleControl(option)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">{option}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={verified} onCheckedChange={(v) => setVerified(!!v)} />
            <Label>Mark as verified</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={addOwner.isPending || !personName || natureOfControl.length === 0}>
            {addOwner.isPending ? 'Adding...' : 'Add PSC'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
