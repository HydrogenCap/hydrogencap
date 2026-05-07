import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransactionLedger } from '@/components/accounting/TransactionLedger';
import { BankReconciliation } from '@/components/accounting/BankReconciliation';
import { ProfitAndLoss } from '@/components/accounting/ProfitAndLoss';
import { AccountingExport } from '@/components/accounting/AccountingExport';
import { ExportWizard } from '@/components/accounting/ExportWizard';
import { MappingsSection } from '@/components/accounting/MappingsSection';
import { ExportHistory } from '@/components/accounting/ExportHistory';
import { SEO } from '@/components/SEO';

export default function Accounting() {
  const [activeTab, setActiveTab] = useState('ledger');

  return (
    <AppLayout>
      <SEO title="Accounting — TenureIQ" description="Sync transactions to Xero, QuickBooks, or FreeAgent and keep your books current." />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounting</h1>
          <p className="text-muted-foreground">
            Manage transactions, reconcile bank statements, review P&L, and export to your accounting software
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
            <TabsTrigger value="pnl">P&L</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="mappings">Mappings</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="mt-6">
            <TransactionLedger />
          </TabsContent>

          <TabsContent value="reconciliation" className="mt-6">
            <BankReconciliation />
          </TabsContent>

          <TabsContent value="pnl" className="mt-6">
            <ProfitAndLoss />
          </TabsContent>

          <TabsContent value="export" className="mt-6">
            <AccountingExport />
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Legacy Export Wizard</h3>
              <ExportWizard />
            </div>
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
