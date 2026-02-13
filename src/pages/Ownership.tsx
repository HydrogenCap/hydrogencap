import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OwnershipFlowchart } from '@/components/ownership/OwnershipFlowchart';
import { OwnershipTable } from '@/components/ownership/OwnershipTable';
import { GitBranch, TableProperties } from 'lucide-react';

export default function Ownership() {
  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Ownership Structure</h1>
          <p className="text-muted-foreground text-sm">
            Click a person or company to filter · Double-click for full details
          </p>
        </div>
        <Tabs defaultValue="chart" className="w-full">
          <TabsList>
            <TabsTrigger value="chart" className="gap-1.5">
              <GitBranch className="h-4 w-4" />
              Chart
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-1.5">
              <TableProperties className="h-4 w-4" />
              Table
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chart" className="mt-4">
            <OwnershipFlowchart />
          </TabsContent>
          <TabsContent value="table" className="mt-4">
            <OwnershipTable />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
