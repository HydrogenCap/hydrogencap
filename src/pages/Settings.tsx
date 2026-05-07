import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Building2, Users, FileSpreadsheet, Upload, MapPin, Shield, Bell, CreditCard, HardDrive, Plug, Landmark, Database, ToggleRight, Webhook } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProfileSettingsTab } from '@/components/settings/ProfileSettingsTab';
import { OrganizationSettingsTab } from '@/components/settings/OrganizationSettingsTab';
import { BeneficialGroupsSettings } from '@/components/settings/BeneficialGroupsSettings';
import { ImportPropertiesTab } from '@/components/settings/ImportPropertiesTab';
import { ImportPassportsTab } from '@/components/settings/ImportPassportsTab';
import { LocationSettingsTab } from '@/components/settings/LocationSettingsTab';
import { ShareholderManagement } from '@/components/settings/ShareholderManagement';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { ContractorDirectory } from '@/components/settings/ContractorDirectory';
import { BillingSettings } from '@/components/settings/BillingSettings';
import { TeamManagement } from '@/components/settings/TeamManagement';
import { FreeAgentIntegrationPanel } from '@/components/settings/FreeAgentIntegrationPanel';
import { BackupExportSection } from '@/components/settings/BackupExportSection';
import { DocumentRenamingSection } from '@/components/settings/DocumentRenamingSection';
import { BankAccountSettings } from '@/components/settings/BankAccountSettings';
import { DemoDataSection } from '@/components/settings/DemoDataSection';
import { SectionVisibilitySettings } from '@/components/settings/SectionVisibilitySettings';
import { useProfile } from '@/hooks/useProfile';
import { useOrganization } from '@/hooks/useOrganization';
import { SEO } from '@/components/SEO';

export default function Settings() {
  const urlParams = new URLSearchParams(window.location.search);
  const defaultTab = urlParams.get('tab') || 'profile';

  const navigate = useNavigate();
  const { isLoading: profileLoading } = useProfile();
  const { isLoading: orgLoading } = useOrganization();

  if (profileLoading || orgLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full max-w-3xl" />
          <Skeleton className="h-[400px]" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <SEO title="Settings — TenureIQ" description="Manage your account, organisation, and platform preferences." />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account, organization, data imports, and beneficial groups</p>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="flex-wrap">
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
            <TabsTrigger value="import-properties" className="gap-2">
              <Upload className="h-4 w-4" />
              Import Properties
            </TabsTrigger>
            <TabsTrigger value="import-passports" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Import Passports
            </TabsTrigger>
            <TabsTrigger value="locations" className="gap-2">
              <MapPin className="h-4 w-4" />
              Locations
            </TabsTrigger>
            <TabsTrigger value="shareholders" className="gap-2">
              <Shield className="h-4 w-4" />
              Shareholders
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              Team
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Plug className="h-4 w-4" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="backup" className="gap-2">
              <HardDrive className="h-4 w-4" />
              Backup
            </TabsTrigger>
            <TabsTrigger value="bank-accounts" className="gap-2">
              <Landmark className="h-4 w-4" />
              Bank Accounts
            </TabsTrigger>
            <TabsTrigger value="demo-data" className="gap-2">
              <Database className="h-4 w-4" />
              Demo Data
            </TabsTrigger>
            <TabsTrigger value="sections" className="gap-2">
              <ToggleRight className="h-4 w-4" />
              Sections
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2" onClick={() => navigate('/settings/webhooks')}>
              <Webhook className="h-4 w-4" />
              Webhooks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <ProfileSettingsTab />
          </TabsContent>

          <TabsContent value="organization" className="space-y-6">
            <OrganizationSettingsTab />
          </TabsContent>

          <TabsContent value="beneficial-groups" className="space-y-6">
            <BeneficialGroupsSettings />
          </TabsContent>

          <TabsContent value="import-properties" className="space-y-6">
            <ImportPropertiesTab />
          </TabsContent>

          <TabsContent value="import-passports" className="space-y-6">
            <ImportPassportsTab />
          </TabsContent>

          <TabsContent value="locations" className="space-y-6">
            <LocationSettingsTab />
          </TabsContent>

          <TabsContent value="shareholders" className="space-y-6">
            <ShareholderManagement />
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <NotificationSettings />
            <ContractorDirectory />
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <BillingSettings />
          </TabsContent>

          <TabsContent value="team" className="space-y-6 max-w-3xl">
            <TeamManagement />
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <FreeAgentIntegrationPanel />
          </TabsContent>

          <TabsContent value="backup" className="space-y-6 max-w-2xl">
            <BackupExportSection />
            <DocumentRenamingSection />
          </TabsContent>

          <TabsContent value="bank-accounts" className="space-y-6">
            <BankAccountSettings />
          </TabsContent>

          <TabsContent value="demo-data" className="space-y-6 max-w-2xl">
            <DemoDataSection />
          </TabsContent>

          <TabsContent value="sections" className="space-y-6 max-w-2xl">
            <SectionVisibilitySettings />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
