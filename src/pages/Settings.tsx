import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { User, Building2, Users } from 'lucide-react';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { BeneficialGroupsSettings } from '@/components/settings/BeneficialGroupsSettings';

export default function Settings() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account, organization, and beneficial groups</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="organization" className="gap-2">
              <Building2 className="h-4 w-4" />
              Organization
            </TabsTrigger>
            <TabsTrigger value="beneficial-groups" className="gap-2">
              <Users className="h-4 w-4" />
              Beneficial Groups
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6 max-w-2xl">
            {/* Profile Settings */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile
                </CardTitle>
                <CardDescription>Your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    className="bg-input border-border"
                  />
                </div>
                <Button>Save Changes</Button>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <SecuritySettings />
          </TabsContent>

          <TabsContent value="organization" className="space-y-6 max-w-2xl">
            {/* Organization Settings */}
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
                    placeholder="My Portfolio"
                    className="bg-input border-border"
                  />
                </div>
                <Button>Update Organization</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="beneficial-groups" className="space-y-6">
            <BeneficialGroupsSettings />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}