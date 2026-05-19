import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  useDirectorAppointments,
  useCreateDirectorAppointment,
  useUpdateDirectorAppointment,
  useDeleteDirectorAppointment,
  type DirectorAppointment,
  type OfficerRole,
} from '@/hooks/useEntityCompliance';
import { useOrganization } from '@/hooks/useOrganization';
import { format } from 'date-fns';
import { Plus, Users, Trash2, Edit2, Shield, UserCheck, Briefcase } from 'lucide-react';

const ROLE_CONFIG: Record<OfficerRole, { label: string; icon: React.ReactNode; color: string }> = {
  director: { label: 'Director', icon: <Briefcase className="h-4 w-4" />, color: 'default' },
  secretary: { label: 'Secretary', icon: <UserCheck className="h-4 w-4" />, color: 'secondary' },
  psc: { label: 'PSC', icon: <Shield className="h-4 w-4" />, color: 'outline' },
};

interface Props {
  entityId: string;
}

export function DirectorRegister({ entityId }: Props) {
  const { toast } = useToast();
  const { data: org } = useOrganization();
  const { data: appointments, isLoading } = useDirectorAppointments(entityId);
  const createAppointment = useCreateDirectorAppointment();
  const updateAppointment = useUpdateDirectorAppointment();
  const deleteAppointment = useDeleteDirectorAppointment();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DirectorAppointment | null>(null);
  const [formData, setFormData] = useState({
    person_name: '',
    role: 'director' as OfficerRole,
    appointed_date: '',
    resigned_date: '',
    companies_house_id: '',
    nature_of_control: '',
  });

  const openCreate = () => {
    setEditing(null);
    setFormData({ person_name: '', role: 'director', appointed_date: '', resigned_date: '', companies_house_id: '', nature_of_control: '' });
    setShowForm(true);
  };

  const openEdit = (a: DirectorAppointment) => {
    setEditing(a);
    setFormData({
      person_name: a.person_name,
      role: a.role,
      appointed_date: a.appointed_date,
      resigned_date: a.resigned_date || '',
      companies_house_id: a.companies_house_id || '',
      nature_of_control: a.nature_of_control || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!org?.id || !formData.person_name || !formData.appointed_date) return;
    try {
      const payload = {
        ...formData,
        resigned_date: formData.resigned_date || null,
        companies_house_id: formData.companies_house_id || null,
        nature_of_control: formData.role === 'psc' ? (formData.nature_of_control || null) : null,
      };
      if (editing) {
        await updateAppointment.mutateAsync({ id: editing.id, ...payload });
        toast({ title: 'Officer updated' });
      } else {
        await createAppointment.mutateAsync({ entity_id: entityId, org_id: org.id, ...payload });
        toast({ title: 'Officer added' });
      }
      setShowForm(false);
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save', variant: 'destructive' });
    }
  };

  if (isLoading) return <Skeleton className="h-48" />;

  const current = (appointments || []).filter(a => !a.resigned_date);
  const former = (appointments || []).filter(a => !!a.resigned_date);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Officer Register
          </CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Add Officer
          </Button>
        </CardHeader>
        <CardContent>
          {(appointments || []).length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No officers registered. Add directors, secretaries, or PSCs.</p>
          ) : (
            <div className="space-y-4">
              {current.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Current Officers</h4>
                  <div className="space-y-2">
                    {current.map(a => (
                      <OfficerRow key={a.id} appointment={a} onEdit={openEdit} onDelete={async () => {
                        await deleteAppointment.mutateAsync({ id: a.id, entityId });
                        toast({ title: 'Officer removed' });
                      }} />
                    ))}
                  </div>
                </div>
              )}
              {former.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Former Officers</h4>
                  <div className="space-y-2">
                    {former.map(a => (
                      <OfficerRow key={a.id} appointment={a} onEdit={openEdit} onDelete={async () => {
                        await deleteAppointment.mutateAsync({ id: a.id, entityId });
                        toast({ title: 'Officer removed' });
                      }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Officer' : 'Add Officer'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update this officer\'s role and appointment dates.' : 'Add a new company officer — director, secretary, or PSC.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={formData.person_name} onChange={e => setFormData(p => ({ ...p, person_name: e.target.value }))} placeholder="Full name" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData(p => ({ ...p, role: v as OfficerRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="director">Director</SelectItem>
                  <SelectItem value="secretary">Secretary</SelectItem>
                  <SelectItem value="psc">Person with Significant Control (PSC)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Appointed Date</Label>
              <Input type="date" value={formData.appointed_date} onChange={e => setFormData(p => ({ ...p, appointed_date: e.target.value }))} />
            </div>
            <div>
              <Label>Resigned Date</Label>
              <Input type="date" value={formData.resigned_date} onChange={e => setFormData(p => ({ ...p, resigned_date: e.target.value }))} />
            </div>
            <div>
              <Label>Companies House ID</Label>
              <Input value={formData.companies_house_id} onChange={e => setFormData(p => ({ ...p, companies_house_id: e.target.value }))} placeholder="CH officer ID" />
            </div>
            {formData.role === 'psc' && (
              <div>
                <Label>Nature of Control</Label>
                <Input value={formData.nature_of_control} onChange={e => setFormData(p => ({ ...p, nature_of_control: e.target.value }))} placeholder="e.g. ownership-of-shares-75-to-100-percent" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createAppointment.isPending || updateAppointment.isPending}>
              {editing ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OfficerRow({
  appointment: a,
  onEdit,
  onDelete,
}: {
  appointment: DirectorAppointment;
  onEdit: (a: DirectorAppointment) => void;
  onDelete: () => void;
}) {
  const roleConfig = ROLE_CONFIG[a.role];
  const isResigned = !!a.resigned_date;

  return (
    <div className={`flex items-center justify-between border rounded-lg p-3 ${isResigned ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          {roleConfig.icon}
        </div>
        <div>
          <div className="font-medium">{a.person_name}</div>
          <div className="text-sm text-muted-foreground">
            <Badge variant={roleConfig.color as 'default' | 'secondary' | 'destructive' | 'outline'} className="mr-2 text-xs">{roleConfig.label}</Badge>
            Appointed: {format(new Date(a.appointed_date), 'dd MMM yyyy')}
            {a.resigned_date && <> &middot; Resigned: {format(new Date(a.resigned_date), 'dd MMM yyyy')}</>}
            {a.companies_house_id && <> &middot; CH: {a.companies_house_id}</>}
          </div>
          {a.role === 'psc' && a.nature_of_control && (
            <div className="text-xs text-muted-foreground mt-1">Control: {a.nature_of_control}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button aria-label="Edit" variant="ghost" size="icon" onClick={() => onEdit(a)}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button aria-label="Delete" variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
