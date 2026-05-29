import { ArrowLeft, Edit, Trash2, Building2, User, Handshake, Shield, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabaseAny } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { LegalEntity } from '@/hooks/useLegalEntities';
import { toast } from "sonner";

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  spv: Building2,
  personal: User,
  joint_venture: Handshake,
  trust: Shield,
};

const TYPE_LABELS: Record<string, string> = {
  spv: 'SPV',
  personal: 'Personal',
  joint_venture: 'Joint Venture',
  trust: 'Trust',
};

const STATUS_CLASSES: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  dormant: 'bg-muted text-muted-foreground border-border',
  dissolved: 'bg-destructive/10 text-destructive border-destructive/20',
};

interface EntityHeaderProps {
  entity: LegalEntity;
  isLookingUp: boolean;
  freeAgentConnection: unknown;
  onRefreshFromCH: () => void;
  onShowEdit: () => void;
  onDelete: () => void;
}

export function EntityHeader({
  entity,
  isLookingUp,
  freeAgentConnection,
  onRefreshFromCH,
  onShowEdit,
  onDelete,
}: EntityHeaderProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const TypeIcon = TYPE_ICONS[entity.entity_type] || Building2;

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : 'An unexpected error occurred';

  return (
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/entities')} className="mb-1">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Entities
        </Button>
        <div className="flex items-center gap-3">
          <TypeIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">{entity.entity_name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{TYPE_LABELS[entity.entity_type]}</Badge>
          <Badge variant="outline" className={STATUS_CLASSES[entity.status]}>
            {entity.status.charAt(0).toUpperCase() + entity.status.slice(1)}
          </Badge>
          {entity.company_number && (
            <span className="text-sm text-muted-foreground font-mono">#{entity.company_number}</span>
          )}
          {entity.ch_company_status && (
            <Badge variant="outline" className="text-xs">
              CH: {entity.ch_company_status}
            </Badge>
          )}
          {(['ltd', 'llp'] as string[]).includes(entity.entity_type) && (
            freeAgentConnection ? (
              <Badge variant="outline" className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                FreeAgent Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                FreeAgent: Not connected
              </Badge>
            )
          )}
          {entity.entity_type !== 'personal' && (
            <div className="flex items-center gap-2 ml-2">
              <Switch
                checked={entity.is_group_parent || false}
                onCheckedChange={async (checked) => {
                  try {
                    if (checked) {
                      await supabaseAny
                        .from('legal_entities')
                        .update({ is_group_parent: false })
                        .eq('org_id', entity.org_id)
                        .eq('is_group_parent', true);
                    }
                    await supabaseAny
                      .from('legal_entities')
                      .update({ is_group_parent: checked })
                      .eq('id', entity.id);
                    queryClient.invalidateQueries({ queryKey: ['legal_entities'] });
                    queryClient.invalidateQueries({ queryKey: ['legal_entity', entity.id] });
                    queryClient.invalidateQueries({ queryKey: ['ownership_data_v2'] });
                    toast.success(checked ? 'Set as group parent' : 'Removed group parent status');
                  } catch (error: unknown) {
                    toast.error('Error', { description: getErrorMessage(error) });
                  }
                }}
                className="scale-75"
              />
              <span className="text-xs text-muted-foreground">Group parent</span>
              {entity.is_group_parent && (
                <Badge variant="default" className="text-[10px]">Group Parent</Badge>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {entity.company_number && (
          <Button variant="outline" onClick={onRefreshFromCH} disabled={isLookingUp}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLookingUp && 'animate-spin')} />
            Sync from CH
          </Button>
        )}
        <Button variant="outline" onClick={onShowEdit}>
          <Edit className="h-4 w-4 mr-2" /> Edit
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Entity?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{entity.entity_name}" and all its directors and shareholders. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
