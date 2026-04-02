import { AppLayout } from '@/components/layout/AppLayout';
import { TeamManagement as TeamManagementPanel } from '@/components/settings/TeamManagement';

export default function TeamManagement() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Management</h1>
          <p className="text-muted-foreground">
            Manage team members, roles, and invitations for your organization
          </p>
        </div>
        <TeamManagementPanel />
      </div>
    </AppLayout>
  );
}
