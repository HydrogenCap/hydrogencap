import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { SeverityBadge } from '@/components/common/SeverityBadge';
import { Plus, Pencil, Trash2, Play, Eye, EyeOff, Copy, RefreshCw, Webhook } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_CATEGORIES, type WebhookEventType } from '@/lib/webhook-events';
import {
  useWebhookEndpoints,
  useCreateEndpoint,
  useUpdateEndpoint,
  useDeleteEndpoint,
  useWebhookDeliveries,
  useTestWebhook,
  type WebhookEndpoint,
} from '@/hooks/useWebhooks';
import type { SeverityLevel } from '@/lib/design-tokens';

const DELIVERY_STATUS_SEVERITY: Record<string, SeverityLevel> = {
  delivered: 'success',
  retrying: 'warning',
  failed: 'critical',
  pending: 'info',
};

export default function WebhookSettings() {
  const { data: endpoints, isLoading } = useWebhookEndpoints();
  const createEndpoint = useCreateEndpoint();
  const updateEndpoint = useUpdateEndpoint();
  const deleteEndpoint = useDeleteEndpoint();
  const testWebhook = useTestWebhook();

  const [addOpen, setAddOpen] = useState(false);
  const [editEndpoint, setEditEndpoint] = useState<WebhookEndpoint | null>(null);
  const [detailEndpoint, setDetailEndpoint] = useState<WebhookEndpoint | null>(null);

  if (isLoading) {
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Webhooks</h1>
            <p className="text-muted-foreground">
              Receive real-time HTTP callbacks when events occur in your portfolio
            </p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Endpoint
              </Button>
            </DialogTrigger>
            <EndpointFormDialog
              onSubmit={(values) => {
                createEndpoint.mutate(values, { onSuccess: () => setAddOpen(false) });
              }}
              isPending={createEndpoint.isPending}
            />
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Endpoints</CardTitle>
            <CardDescription>Manage your webhook endpoints and subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            {!endpoints?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Webhook className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No webhook endpoints configured yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpoints.map((ep) => (
                    <TableRow key={ep.id}>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate">
                        {ep.url}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {ep.description || '—'}
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity="info">{ep.events.length} events</SeverityBadge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={ep.is_active}
                          onCheckedChange={(checked) =>
                            updateEndpoint.mutate({ id: ep.id, is_active: checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetailEndpoint(ep)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditEndpoint(ep)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => testWebhook.mutate(ep.id)}
                            disabled={testWebhook.isPending}
                            title="Send test ping"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteEndpoint.mutate(ep.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit dialog */}
        <Dialog open={!!editEndpoint} onOpenChange={(open) => !open && setEditEndpoint(null)}>
          {editEndpoint && (
            <EndpointFormDialog
              defaultValues={editEndpoint}
              onSubmit={(values) => {
                updateEndpoint.mutate(
                  { id: editEndpoint.id, ...values },
                  { onSuccess: () => setEditEndpoint(null) }
                );
              }}
              isPending={updateEndpoint.isPending}
            />
          )}
        </Dialog>

        {/* Detail sheet */}
        <Sheet open={!!detailEndpoint} onOpenChange={(open) => !open && setDetailEndpoint(null)}>
          {detailEndpoint && (
            <EndpointDetailSheet
              endpoint={detailEndpoint}
              onTest={() => testWebhook.mutate(detailEndpoint.id)}
              onRegenerateSecret={() =>
                updateEndpoint.mutate({
                  id: detailEndpoint.id,
                  secret: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
                })
              }
              isTestPending={testWebhook.isPending}
            />
          )}
        </Sheet>
      </div>
    </AppLayout>
  );
}

/* ----- Add / Edit Endpoint Form Dialog ----- */

function EndpointFormDialog({
  defaultValues,
  onSubmit,
  isPending,
}: {
  defaultValues?: WebhookEndpoint;
  onSubmit: (values: { url: string; description?: string; events: string[] }) => void;
  isPending: boolean;
}) {
  const [url, setUrl] = useState(defaultValues?.url ?? '');
  const [description, setDescription] = useState(defaultValues?.description ?? '');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(
    new Set(defaultValues?.events ?? [])
  );

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  };

  const toggleCategory = (events: readonly string[]) => {
    const allSelected = events.every((e) => selectedEvents.has(e));
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      events.forEach((e) => (allSelected ? next.delete(e) : next.add(e)));
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ url, description: description || undefined, events: Array.from(selectedEvents) });
  };

  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>{defaultValues ? 'Edit Endpoint' : 'Add Endpoint'}</DialogTitle>
          <DialogDescription>
            {defaultValues
              ? 'Update the webhook endpoint configuration'
              : 'Configure a new webhook endpoint to receive event notifications'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">URL</Label>
            <Input
              id="webhook-url"
              placeholder="https://example.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              type="url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-description">Description</Label>
            <Input
              id="webhook-description"
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label>Events</Label>
            {Object.entries(WEBHOOK_EVENT_CATEGORIES).map(([category, events]) => (
              <div key={category} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={events.every((e) => selectedEvents.has(e))}
                    onCheckedChange={() => toggleCategory(events)}
                  />
                  <span className="text-sm font-medium">{category}</span>
                </div>
                <div className="ml-6 space-y-1">
                  {events.map((event) => (
                    <div key={event} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedEvents.has(event)}
                        onCheckedChange={() => toggleEvent(event)}
                      />
                      <span className="text-xs">{event}</span>
                      <span className="text-xs text-muted-foreground">
                        — {WEBHOOK_EVENTS[event as WebhookEventType]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={isPending || !url || selectedEvents.size === 0}>
            {isPending ? 'Saving...' : defaultValues ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/* ----- Endpoint Detail Sheet ----- */

function EndpointDetailSheet({
  endpoint,
  onTest,
  onRegenerateSecret,
  isTestPending,
}: {
  endpoint: WebhookEndpoint;
  onTest: () => void;
  onRegenerateSecret: () => void;
  isTestPending: boolean;
}) {
  const { toast } = useToast();
  const { data: deliveries, isLoading } = useWebhookDeliveries(endpoint.id);
  const [secretVisible, setSecretVisible] = useState(false);

  const maskedSecret = endpoint.secret.slice(0, 6) + '••••••••••••';

  const copySecret = async () => {
    await navigator.clipboard.writeText(endpoint.secret);
    toast({ title: 'Secret copied to clipboard' });
  };

  return (
    <SheetContent className="sm:max-w-lg overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Endpoint Details</SheetTitle>
        <SheetDescription className="font-mono text-xs break-all">{endpoint.url}</SheetDescription>
      </SheetHeader>

      <div className="space-y-6 mt-6">
        {/* Secret */}
        <div className="space-y-2">
          <Label>Signing Secret</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
              {secretVisible ? endpoint.secret : maskedSecret}
            </code>
            <Button variant="ghost" size="icon" onClick={() => setSecretVisible(!secretVisible)}>
              {secretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={copySecret}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onRegenerateSecret} title="Regenerate secret">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Subscribed events */}
        <div className="space-y-2">
          <Label>Subscribed Events</Label>
          <div className="flex flex-wrap gap-1">
            {endpoint.events.map((event) => (
              <SeverityBadge key={event} severity="neutral">
                {event}
              </SeverityBadge>
            ))}
          </div>
        </div>

        {/* Test button */}
        <Button variant="outline" onClick={onTest} disabled={isTestPending} className="w-full">
          <Play className="mr-2 h-4 w-4" />
          {isTestPending ? 'Sending...' : 'Send Test Ping'}
        </Button>

        {/* Delivery log */}
        <div className="space-y-2">
          <Label>Recent Deliveries</Label>
          {isLoading ? (
            <Skeleton className="h-[200px]" />
          ) : !deliveries?.length ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No deliveries yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Attempts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs font-mono">{d.event_type}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(d.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={DELIVERY_STATUS_SEVERITY[d.status] ?? 'neutral'}>
                        {d.status}
                      </SeverityBadge>
                    </TableCell>
                    <TableCell className="text-xs">{d.response_status ?? '—'}</TableCell>
                    <TableCell className="text-xs">{d.attempt_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </SheetContent>
  );
}
