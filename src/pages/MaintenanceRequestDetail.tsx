import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useMaintenanceRequest } from '@/hooks/useMaintenanceRequests';
import { useMaintenanceComments, useAddMaintenanceComment } from '@/hooks/useMaintenanceComments';
import { useWorksOrdersForRequest, useCreateWorksOrder } from '@/hooks/useWorksOrders';
import { PRIORITY_CONFIG, STATUS_CONFIG, CATEGORY_COLORS, MAINTENANCE_CATEGORY_NAMES } from '@/lib/maintenanceTypes';
import { normalizeMaintenanceItem } from '@/lib/maintenanceNormalizer';
import { WorksOrderDetailForm } from '@/components/maintenance/WorksOrderDetailForm';
import { InlineAuditHistory } from '@/components/audit/InlineAuditHistory';
import { LoadingState } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Home, User, Calendar, MessageSquare, AlertTriangle, MapPin } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import type { CommentAuthorType } from '@/lib/maintenanceTypes';

export default function MaintenanceRequestDetail() {
  const { requestId } = useParams<{ requestId: string }>();
  const { data: request, isLoading } = useMaintenanceRequest(requestId);
  const { data: comments } = useMaintenanceComments(requestId);
  const { data: worksOrders } = useWorksOrdersForRequest(requestId);
  const addComment = useAddMaintenanceComment();
  const createWorksOrder = useCreateWorksOrder();

  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  if (isLoading) return <AppLayout><LoadingState text="Loading request..." /></AppLayout>;
  if (!request) return <AppLayout><div className="container py-6">Request not found</div></AppLayout>;

  const priorityCfg = PRIORITY_CONFIG[request.priority];
  const statusCfg = STATUS_CONFIG[request.status];
  const display = normalizeMaintenanceItem(request);
  const wo = worksOrders?.[0];

  const handleAddComment = () => {
    if (!newComment.trim() || !requestId) return;
    addComment.mutate({
      maintenance_request_id: requestId,
      author_type: 'operator' as CommentAuthorType,
      author_name: 'Operator',
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

  const authorColors: Record<string, string> = {
    operator: 'bg-primary', tenant: 'bg-success', contractor: 'bg-warning', system: 'bg-muted-foreground',
  };

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        <Link to="/maintenance" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Maintenance
        </Link>

        {request.is_emergency && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="font-semibold text-destructive">EMERGENCY REQUEST</span>
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold">{request.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="outline" className={priorityCfg.color}>{priorityCfg.icon} {priorityCfg.label}</Badge>
            <Badge variant="outline" className={statusCfg.color}>{statusCfg.label}</Badge>
            <Badge variant="outline" className={CATEGORY_COLORS[request.category]}>{MAINTENANCE_CATEGORY_NAMES[request.category]}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Details + Timeline */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Issue Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{request.description}</p>
                {request.location_detail && (
                  <p className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {request.location_detail}</p>
                )}
                <div className="flex items-center gap-4 text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" /> {display.propertyAddress}</span>
                  {display.tenantName && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {display.tenantName}</span>}
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {format(new Date(request.reported_date), 'dd MMM yyyy')}</span>
                </div>

                {/* Photo thumbnails */}
                {request.photo_urls && request.photo_urls.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {request.photo_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="w-20 h-20 rounded-md overflow-hidden border hover:opacity-80 transition-opacity">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}

                <InlineAuditHistory tableName="maintenance_requests" recordId={requestId} />
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Activity ({comments?.length || 0})</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {comments?.map(c => (
                  <div key={c.id} className={`flex gap-3 ${c.is_internal ? 'opacity-70 bg-muted/50 -mx-2 px-2 py-2 rounded' : ''}`}>
                    <div className={`h-8 w-8 rounded-full ${authorColors[c.author_type]} flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0`}>
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
              <WorksOrderDetailForm worksOrder={wo} />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
