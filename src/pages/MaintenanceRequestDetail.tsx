import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useMaintenanceRequest } from '@/hooks/useMaintenanceRequests';
import { useMaintenanceComments, useAddMaintenanceComment } from '@/hooks/useMaintenanceComments';
import { useWorksOrdersForRequest, useCreateWorksOrder, useUpdateWorksOrder } from '@/hooks/useWorksOrders';
import { PRIORITY_CONFIG, STATUS_CONFIG, CATEGORY_COLORS, MAINTENANCE_CATEGORY_NAMES, WORKS_ORDER_STATUS_CONFIG, WORKS_ORDER_PIPELINE } from '@/lib/maintenanceTypes';
import { LoadingState } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Home, User, Calendar, Clock, MessageSquare, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import type { CommentAuthorType, WorksOrderStatus } from '@/lib/maintenanceTypes';

export default function MaintenanceRequestDetail() {
  const { requestId } = useParams<{ requestId: string }>();
  const { data: request, isLoading } = useMaintenanceRequest(requestId);
  const { data: comments } = useMaintenanceComments(requestId);
  const { data: worksOrders } = useWorksOrdersForRequest(requestId);
  const addComment = useAddMaintenanceComment();
  const createWorksOrder = useCreateWorksOrder();
  const updateWorksOrder = useUpdateWorksOrder();

  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [commentAs, setCommentAs] = useState<CommentAuthorType>('operator');

  if (isLoading) return <AppLayout><LoadingState text="Loading request..." /></AppLayout>;
  if (!request) return <AppLayout><div className="container py-6">Request not found</div></AppLayout>;

  const priorityCfg = PRIORITY_CONFIG[request.priority];
  const statusCfg = STATUS_CONFIG[request.status];
  const wo = worksOrders?.[0]; // Primary works order

  const handleAddComment = () => {
    if (!newComment.trim() || !requestId) return;
    addComment.mutate({
      maintenance_request_id: requestId,
      author_type: commentAs,
      author_name: commentAs === 'system' ? 'System' : 'Operator',
      comment: newComment.trim(),
      is_internal: isInternal,
    }, { onSuccess: () => { setNewComment(''); setIsInternal(false); } });
  };

  const handleCreateWorksOrder = () => {
    if (!requestId) return;
    createWorksOrder.mutate({
      maintenance_request_id: requestId,
      property_id: request.property_id,
      description: `${request.title}: ${request.description || ''}`,
    });
  };

  const handleAdvanceWO = (status: WorksOrderStatus) => {
    if (!wo) return;
    updateWorksOrder.mutate({ id: wo.id, status });
  };

  const authorColors: Record<string, string> = {
    operator: 'bg-blue-500', tenant: 'bg-green-500', contractor: 'bg-orange-500', system: 'bg-gray-400',
  };

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        {/* Back + Header */}
        <Link to="/maintenance" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Maintenance
        </Link>

        {request.is_emergency && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="font-semibold text-destructive">EMERGENCY REQUEST</span>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{request.title}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className={priorityCfg.color}>{priorityCfg.icon} {priorityCfg.label}</Badge>
              <Badge variant="outline" className={statusCfg.color}>{statusCfg.label}</Badge>
              <Badge variant="outline" className={CATEGORY_COLORS[request.category]}>{MAINTENANCE_CATEGORY_NAMES[request.category]}</Badge>
            </div>
          </div>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Details + Timeline */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Issue Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{request.description}</p>
                {request.location_detail && <p className="text-muted-foreground">📍 {request.location_detail}</p>}
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" /> {request.property.address_line}</span>
                  {request.tenant && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {request.tenant.first_name} {request.tenant.last_name}</span>}
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {format(new Date(request.reported_date), 'dd MMM yyyy')}</span>
                </div>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Activity ({comments?.length || 0})</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {comments?.map(c => (
                  <div key={c.id} className={`flex gap-3 ${c.is_internal ? 'opacity-70 bg-muted/50 -mx-2 px-2 py-2 rounded' : ''}`}>
                    <div className={`h-8 w-8 rounded-full ${authorColors[c.author_type]} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {c.author_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{c.author_name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{c.author_type}</Badge>
                        {c.is_internal && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted">Internal</Badge>}
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                      </div>
                      <p className="text-sm mt-1">{c.comment}</p>
                    </div>
                  </div>
                ))}

                <div className="border-t pt-4 space-y-3">
                  <Textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..." rows={2} />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch checked={isInternal} onCheckedChange={setIsInternal} id="internal" />
                      <Label htmlFor="internal" className="text-xs">Internal note</Label>
                    </div>
                    <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim() || addComment.isPending}>
                      Post Comment
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Works Order */}
          <div className="space-y-6">
            {!wo ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground mb-4">No works order yet</p>
                  <Button onClick={handleCreateWorksOrder} disabled={createWorksOrder.isPending}>
                    {createWorksOrder.isPending ? 'Creating...' : 'Create Works Order'}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Works Order</span>
                    <Badge variant="outline">{wo.order_number}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status pipeline */}
                  <div className="flex flex-wrap gap-1">
                    {WORKS_ORDER_PIPELINE.map(s => {
                      const idx = WORKS_ORDER_PIPELINE.indexOf(s);
                      const currentIdx = WORKS_ORDER_PIPELINE.indexOf(wo.status as any);
                      const isPast = idx < currentIdx;
                      const isCurrent = s === wo.status;
                      return (
                        <Badge key={s} variant={isCurrent ? 'default' : 'outline'} className={`text-[10px] ${isPast ? 'bg-green-100 text-green-700 border-green-200' : ''}`}>
                          {isPast && <CheckCircle2 className="h-3 w-3 mr-0.5" />}
                          {WORKS_ORDER_STATUS_CONFIG[s].label}
                        </Badge>
                      );
                    })}
                  </div>

                  {/* Contractor */}
                  <div className="text-sm space-y-1">
                    <p className="text-muted-foreground">Contractor</p>
                    <p className="font-medium">{wo.contractor?.company_name || wo.contractor_name_override || 'Unassigned'}</p>
                  </div>

                  {/* Cost tracking */}
                  <div className="text-sm space-y-1">
                    {wo.quoted_amount != null && <p>Quoted: <span className="font-medium">£{wo.quoted_amount.toFixed(2)}</span></p>}
                    {wo.approved_amount != null && <p>Approved: <span className="font-medium">£{wo.approved_amount.toFixed(2)}</span></p>}
                    {wo.invoice_amount != null && <p>Invoiced: <span className="font-medium">£{wo.invoice_amount.toFixed(2)}</span></p>}
                    {wo.paid_amount != null && <p>Paid: <span className="font-medium text-green-600">£{wo.paid_amount.toFixed(2)}</span></p>}
                  </div>

                  {wo.scheduled_date && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Scheduled</p>
                      <p className="font-medium flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {format(new Date(wo.scheduled_date), 'dd MMM yyyy')}</p>
                    </div>
                  )}

                  {/* Context-dependent actions */}
                  <div className="border-t pt-3 space-y-2">
                    {wo.status === 'draft' && (
                      <Button size="sm" className="w-full" onClick={() => handleAdvanceWO('sent_to_contractor')}>Send to Contractor</Button>
                    )}
                    {wo.status === 'sent_to_contractor' && (
                      <Button size="sm" className="w-full" onClick={() => handleAdvanceWO('quote_received')}>Record Quote Received</Button>
                    )}
                    {wo.status === 'quote_received' && (
                      <Button size="sm" className="w-full" onClick={() => handleAdvanceWO('approved')}>Approve Quote</Button>
                    )}
                    {wo.status === 'approved' && (
                      <Button size="sm" className="w-full" onClick={() => handleAdvanceWO('scheduled')}>Mark Scheduled</Button>
                    )}
                    {wo.status === 'scheduled' && (
                      <Button size="sm" className="w-full" onClick={() => handleAdvanceWO('in_progress')}>Mark In Progress</Button>
                    )}
                    {wo.status === 'in_progress' && (
                      <Button size="sm" className="w-full" onClick={() => handleAdvanceWO('completed')}>Mark Complete</Button>
                    )}
                    {wo.status === 'completed' && (
                      <Button size="sm" className="w-full" onClick={() => handleAdvanceWO('invoiced')}>Record Invoice</Button>
                    )}
                    {wo.status === 'invoiced' && (
                      <Button size="sm" className="w-full" onClick={() => handleAdvanceWO('paid')}>Record Payment</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
