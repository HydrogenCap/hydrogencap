import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActivitySidebar, type ActivityTab } from '@/state/activitySidebar';
import { NotificationsPanel } from './NotificationsPanel';
import { InboxPanel } from './InboxPanel';
import { CommunicationsPanel } from './CommunicationsPanel';
import { ActionsPanel } from './ActionsPanel';
import { MissingInfoPanel } from './MissingInfoPanel';
import { AuditPanel } from './AuditPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';

interface ActivitySidebarProps {
  /** For testing — render inline open with a fixed tab. */
  initialTab?: ActivityTab;
  forceOpen?: boolean;
}

function PanelContent({ tab, onTabChange }: { tab: ActivityTab; onTabChange: (t: ActivityTab) => void }) {
  return (
    <Tabs value={tab} onValueChange={(v) => onTabChange(v as ActivityTab)} className="flex flex-col h-full">
      <TabsList className="grid grid-cols-4 mx-4 mt-2">
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="inbox">Inbox</TabsTrigger>
        <TabsTrigger value="actions">Actions</TabsTrigger>
        <TabsTrigger value="audit">Audit</TabsTrigger>
      </TabsList>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <TabsContent value="notifications" data-testid="activity-tab-notifications">
          <NotificationsPanel />
        </TabsContent>
        <TabsContent value="inbox" data-testid="activity-tab-inbox" className="space-y-8">
          <InboxPanel />
          <CommunicationsPanel />
        </TabsContent>
        <TabsContent value="actions" data-testid="activity-tab-actions" className="space-y-8">
          <ActionsPanel />
          <MissingInfoPanel />
        </TabsContent>
        <TabsContent value="audit" data-testid="activity-tab-audit">
          <AuditPanel />
        </TabsContent>
      </div>
    </Tabs>
  );
}

export function ActivitySidebar({ initialTab, forceOpen }: ActivitySidebarProps = {}) {
  const { open: storeOpen, tab: storeTab, setTab, close } = useActivitySidebar();
  const isMobile = useIsMobile();

  const open = forceOpen ?? storeOpen;
  const tab = initialTab ?? storeTab;
  const onOpenChange = (next: boolean) => { if (!next) close(); };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Activity</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden">
            <PanelContent tab={tab} onTabChange={setTab} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <SheetTitle>Activity</SheetTitle>
        </SheetHeader>
        <PanelContent tab={tab} onTabChange={setTab} />
      </SheetContent>
    </Sheet>
  );
}
