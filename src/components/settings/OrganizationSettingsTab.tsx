import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2 } from 'lucide-react';
import { useOrganization, useUpdateOrganization } from '@/hooks/useOrganization';
import { toast } from "sonner";

export function OrganizationSettingsTab() {
  const { data: organization } = useOrganization();
  const updateOrganization = useUpdateOrganization();
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    if (organization?.name) setOrgName(organization.name);
  }, [organization?.name]);

  const handleSaveOrganization = () => {
    if (!organization?.id) return;
    if (!orgName.trim()) {
      toast.error('Name required', { description: 'Please enter an organization name' });
      return;
    }
    updateOrganization.mutate({ orgId: organization.id, name: orgName.trim() });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization
          </CardTitle>
          <CardDescription>Manage your portfolio organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="My Portfolio"
              className="bg-input border-border"
            />
          </div>
          <Button onClick={handleSaveOrganization} disabled={updateOrganization.isPending}>
            {updateOrganization.isPending ? 'Updating...' : 'Update Organization'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
