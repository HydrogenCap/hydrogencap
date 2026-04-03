import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OwnershipFlowchart } from '@/components/ownership/OwnershipFlowchart';
import { OwnershipTable } from '@/components/ownership/OwnershipTable';
import { ShareRegister } from '@/components/ownership/ShareRegister';
import { BeneficialOwnershipMap } from '@/components/ownership/BeneficialOwnershipMap';
import { DividendTracker } from '@/components/ownership/DividendTracker';
import { useShareTransfers, formatCurrency } from '@/hooks/useShareRegister';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useOrganization } from '@/hooks/useOrganization';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitBranch, TableProperties, BookOpen, Users, PoundSterling, ArrowRightLeft } from 'lucide-react';

export default function Ownership() {
  const { data: org } = useOrganization();
  const { data: entities = [] } = useLegalEntities();
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');

  const activeEntityId = selectedEntityId || entities[0]?.id || '';
  const orgId = org?.id || '';

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ownership Structure</h1>
            <p className="text-muted-foreground text-sm">
              Click a person or company to filter · Double-click for full details
            </p>
          </div>
          {entities.length > 0 && (
            <Select value={activeEntityId} onValueChange={setSelectedEntityId}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Select entity" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.entity_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Tabs defaultValue="chart" className="w-full">
          <TabsList>
            <TabsTrigger value="chart" className="gap-1.5">
              <GitBranch className="h-4 w-4" />
              Structure
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-1.5">
              <TableProperties className="h-4 w-4" />
              Table
            </TabsTrigger>
            <TabsTrigger value="register" className="gap-1.5">
              <BookOpen className="h-4 w-4" />
              Share Register
            </TabsTrigger>
            <TabsTrigger value="beneficial" className="gap-1.5">
              <Users className="h-4 w-4" />
              Beneficial Owners
            </TabsTrigger>
            <TabsTrigger value="dividends" className="gap-1.5">
              <PoundSterling className="h-4 w-4" />
              Dividends
            </TabsTrigger>
            <TabsTrigger value="transfers" className="gap-1.5">
              <ArrowRightLeft className="h-4 w-4" />
              Transfers
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chart" className="mt-4">
            <OwnershipFlowchart />
          </TabsContent>
          <TabsContent value="table" className="mt-4">
            <OwnershipTable />
          </TabsContent>
          <TabsContent value="register" className="mt-4">
            {activeEntityId && orgId ? (
              <ShareRegister entityId={activeEntityId} orgId={orgId} />
            ) : (
              <p className="text-sm text-muted-foreground">Select an entity to view its share register.</p>
            )}
          </TabsContent>
          <TabsContent value="beneficial" className="mt-4">
            {activeEntityId && orgId ? (
              <BeneficialOwnershipMap entityId={activeEntityId} orgId={orgId} />
            ) : (
              <p className="text-sm text-muted-foreground">Select an entity to view beneficial owners.</p>
            )}
          </TabsContent>
          <TabsContent value="dividends" className="mt-4">
            {activeEntityId && orgId ? (
              <DividendTracker entityId={activeEntityId} orgId={orgId} />
            ) : (
              <p className="text-sm text-muted-foreground">Select an entity to view dividends.</p>
            )}
          </TabsContent>
          <TabsContent value="transfers" className="mt-4">
            {activeEntityId && orgId ? (
              <TransferHistory entityId={activeEntityId} />
            ) : (
              <p className="text-sm text-muted-foreground">Select an entity to view transfers.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function TransferHistory({ entityId }: { entityId: string }) {
  const { data: transfers = [], isLoading } = useShareTransfers(entityId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Transfer History</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transfers recorded. Record transfers from the Share Register tab.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Share Class</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Consideration</TableHead>
                <TableHead className="text-right">Stamp Duty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.transfer_date}</TableCell>
                  <TableCell>{t.share_class?.class_name ?? '—'}</TableCell>
                  <TableCell>{t.from_holder}</TableCell>
                  <TableCell>{t.to_holder}</TableCell>
                  <TableCell className="text-right">{t.shares_transferred.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{formatCurrency(t.consideration)}</TableCell>
                  <TableCell className="text-right">
                    {t.stamp_duty > 0 ? (
                      <Badge variant="outline">{formatCurrency(t.stamp_duty)}</Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
