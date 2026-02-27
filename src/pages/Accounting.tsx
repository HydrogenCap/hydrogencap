import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExportWizard } from '@/components/accounting/ExportWizard';
import { TaxYearSection } from '@/components/accounting/TaxYearSection';
import { MappingsSection } from '@/components/accounting/MappingsSection';
import { ExportHistory } from '@/components/accounting/ExportHistory';

export default function Accounting() {
  const [activeTab, setActiveTab] = useState('export');

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounting</h1>
          <p className="text-muted-foreground">Export financial data for your accountant, generate tax summaries, and configure account mappings</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="tax">Tax Summaries</TabsTrigger>
            <TabsTrigger value="mappings">Account Mappings</TabsTrigger>
            <TabsTrigger value="history">Export History</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="mt-6">
            <ExportWizard />
          </TabsContent>

          <TabsContent value="tax" className="mt-6">
            <TaxYearSection />
          </TabsContent>

          <TabsContent value="mappings" className="mt-6">
            <MappingsSection />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <ExportHistory />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
