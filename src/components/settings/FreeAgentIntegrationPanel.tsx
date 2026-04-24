import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  RefreshCw, Unlink, CheckCircle2, XCircle, Clock, Zap,
  ArrowRight, Loader2, ExternalLink, FlaskConical,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useUserOrg } from '@/hooks/useUserOrg';
import {
  useFreeAgentConnections, useFreeAgentCategories, useDisconnectFreeAgent,
  useUpdateFreeAgentSettings, useSyncToFreeAgent, buildFreeAgentAuthUrl,
  type FreeAgentConnection,
} from '@/hooks/useFreeAgentIntegration';
import { supabase } from '@/integrations/supabase/client';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
  failed: <XCircle className="h-3 w-3 text-destructive" />,
  partial: <Clock className="h-3 w-3 text-amber-500" />,
};

function CategoryMapping({ connection }: { connection: FreeAgentConnection }) {
  const { data: catData, isLoading } = useFreeAgentCategories(connection.entity_id || connection.company_id);
  const updateSettings = useUpdateFreeAgentSettings();

  const incomeCategories = useMemo(
    () => (catData?.categories || []).filter(c => c.group === 'Income'),
    [catData]
  );
  const expenseCategories = useMemo(
    () => (catData?.categories || []).filter(c =>
      ['Admin Expenses', 'Cost of Sales', 'General'].includes(c.group)
    ),
    [catData]
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading FreeAgent categories…
      </div>
    );
  }

  if (!catData) return null;

  return (
    <div className="space-y-3 pt-2">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Rent Income Category</Label>
        <Select
          value={connection.rent_income_category_url || ''}
          onValueChange={v => updateSettings.mutate({ id: connection.id, rent_income_category_url: v })}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select income category…" /></SelectTrigger>
          <SelectContent>
            {incomeCategories.map(cat => (
              <SelectItem key={cat.url} value={cat.url} className="text-xs">
                {cat.nominal_code} — {cat.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Bank Account (for payments)</Label>
        <Select
          value={connection.bank_account_url || ''}
          onValueChange={v => updateSettings.mutate({ id: connection.id, bank_account_url: v })}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select bank account…" /></SelectTrigger>
          <SelectContent>
            {(catData.bank_accounts || []).map(ba => (
              <SelectItem key={ba.url} value={ba.url} className="text-xs">
                {ba.name} ({ba.currency})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Expense Category</Label>
        <Select
          value={connection.expense_category_url || ''}
          onValueChange={v => updateSettings.mutate({ id: connection.id, expense_category_url: v })}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select expense category…" /></SelectTrigger>
          <SelectContent>
            {expenseCategories.map(cat => (
              <SelectItem key={cat.url} value={cat.url} className="text-xs">
                {cat.nominal_code} — {cat.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function FreeAgentIntegrationPanel() {
  const [searchParams] = useSearchParams();
  const { data: entities, isLoading: _entitiesLoading } = useLegalEntities();
  const { data: orgId } = useUserOrg();
  const { data: connections, isLoading: connectionsLoading } = useFreeAgentConnections();
  const disconnect = useDisconnectFreeAgent();
  const updateSettings = useUpdateFreeAgentSettings();
  const syncToFreeAgent = useSyncToFreeAgent();

  const [connectingEntity, setConnectingEntity] = useState('');
  const [useSandbox, setUseSandbox] = useState(false);
  const [disconnecting, setDisconnecting] = useState<FreeAgentConnection | null>(null);

  const freeagentResult = searchParams.get('freeagent');

  const handleConnect = async () => {
    if (!connectingEntity || !orgId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const authUrl = buildFreeAgentAuthUrl(connectingEntity, orgId, user.id, useSandbox);
    window.open(authUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDisconnect = async () => {
    if (!disconnecting) return;
    await disconnect.mutateAsync(disconnecting.id);
    setDisconnecting(null);
  };

  const faConnectedEntityIds = new Set((connections || []).map(c => c.entity_id).filter(Boolean));
  const unconnectedEntities = (entities || []).filter(e => !faConnectedEntityIds.has(e.id));

  return (
    <div className="space-y-4">
      {/* OAuth result banner */}
      {freeagentResult === 'connected' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-3 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          FreeAgent connected successfully. Map your categories below, then sync your payments.
        </div>
      )}
      {freeagentResult === 'error' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-center gap-2">
          <XCircle className="h-4 w-4" />
          Failed to connect FreeAgent. ({searchParams.get('msg') || 'Unknown error'})
        </div>
      )}

      {/* Header */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400">FA</div>
            <div>
              <CardTitle>FreeAgent Integration</CardTitle>
              <CardDescription>
                One-way sync of rent payments to FreeAgent as invoices, with proper income categorisation and bank account matching.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connect a new entity */}
          {unconnectedEntities.length > 0 && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Connect an Entity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Entity</Label>
                  <Select value={connectingEntity} onValueChange={setConnectingEntity}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select entity…" /></SelectTrigger>
                    <SelectContent>
                      {unconnectedEntities.map(e => (
                        <SelectItem key={e.id} value={e.id} className="text-xs">{e.entity_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button size="sm" onClick={handleConnect} disabled={!connectingEntity} className="gap-1.5">
                  <ExternalLink className="h-3 w-3" />
                  Connect to FreeAgent
                  <ArrowRight className="h-3 w-3" />
                </Button>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={useSandbox}
                    onCheckedChange={v => setUseSandbox(v === true)}
                    className="scale-75"
                  />
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <FlaskConical className="h-3 w-3" /> Use sandbox (for testing)
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">
                  You'll be redirected to FreeAgent to authorise access. Each entity connects to its own FreeAgent account.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Loading */}
          {connectionsLoading && (
            <Card>
              <CardContent className="py-6">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </CardContent>
            </Card>
          )}

          {/* Connected entities */}
          {connections && connections.length > 0 ? (
            connections.map(conn => {
              const entity = entities?.find(e => e.id === conn.entity_id);
              return (
                <Card key={conn.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-[10px] font-bold text-emerald-700 dark:text-emerald-400">FA</div>
                        <CardTitle className="text-base">
                          {entity?.entity_name || conn.freeagent_company_name || 'Unknown Entity'}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">→ {conn.freeagent_company_name || 'FreeAgent Account'}</span>
                        {conn.use_sandbox && (
                          <Badge variant="outline" className="text-[10px] h-4 ml-1">
                            <FlaskConical className="h-2.5 w-2.5 mr-0.5" />Sandbox
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
                          <CheckCircle2 className="h-3 w-3 mr-1" />Connected
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => syncToFreeAgent.mutate(conn.entity_id || conn.company_id)}
                          disabled={syncToFreeAgent.isPending}
                        >
                          {syncToFreeAgent.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          Sync Now
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => setDisconnecting(conn)}
                        >
                          <Unlink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Last sync info */}
                    {conn.last_sync_at && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        {STATUS_ICONS[conn.last_sync_status || ''] || null}
                        Last sync: {format(new Date(conn.last_sync_at), 'dd MMM yyyy HH:mm')}
                        {conn.last_sync_items_count > 0 && ` — ${conn.last_sync_items_count} items`}
                      </div>
                    )}
                    {conn.last_sync_error && (
                      <p className="text-xs text-destructive">{conn.last_sync_error}</p>
                    )}

                    {/* Category mapping */}
                    <CategoryMapping connection={conn} />

                    {/* Toggles */}
                    <div className="flex flex-col gap-2 pt-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={conn.sync_rent_payments}
                          onCheckedChange={v => updateSettings.mutate({ id: conn.id, sync_rent_payments: v as boolean })}
                          className="scale-75"
                        />
                        <span className="text-xs">Sync rent payments</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={conn.auto_sync_enabled}
                          onCheckedChange={v => updateSettings.mutate({ id: conn.id, auto_sync_enabled: v as boolean })}
                          className="scale-75"
                        />
                        <span className="text-xs">Auto-sync weekly</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground pt-1">
                      Connected {format(new Date(conn.connected_at), 'dd MMM yyyy')}
                    </p>
                  </CardContent>
                </Card>
              );
            })
          ) : !connectionsLoading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Zap className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No FreeAgent connections</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Connect an entity above to start syncing rent payments to FreeAgent.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </CardContent>
      </Card>

      {/* Disconnect dialog */}
      <AlertDialog open={!!disconnecting} onOpenChange={() => setDisconnecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect FreeAgent</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the FreeAgent connection. Existing data in FreeAgent won't be affected, but new payments won't be synced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
