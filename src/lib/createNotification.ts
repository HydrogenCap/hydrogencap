import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];

interface CreateNotificationParams {
  orgId: string;
  userId: string; // specific user ID or 'all_org_members'
  category: 'compliance' | 'rent' | 'maintenance' | 'tenancy' | 'system';
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  linkTo?: string;
  entityType?: string;
  entityId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  const { orgId, userId, category, severity, title, message, linkTo, entityType, entityId } = params;

  if (userId === 'all_org_members') {
    // Get all org members
    const { data: members, error: membersError } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('org_id', orgId);

    if (membersError) {
      console.error('Failed to fetch org members for notification:', membersError);
      return;
    }

    if (!members || members.length === 0) return;

    const rows = members.map(m => ({
      org_id: orgId,
      user_id: m.user_id,
      category,
      severity,
      title,
      message,
      link_to: linkTo || null,
      entity_type: entityType || null,
      entity_id: entityId || null,
    }));

    const { error } = await supabase.from('notifications').insert(rows as NotificationInsert[]);
    if (error) console.error('Failed to create notifications:', error);
  } else {
    const { error } = await supabase.from('notifications').insert({
      org_id: orgId,
      user_id: userId,
      category,
      severity,
      title,
      message,
      link_to: linkTo || null,
      entity_type: entityType || null,
      entity_id: entityId || null,
    } as NotificationInsert);
    if (error) console.error('Failed to create notification:', error);
  }
}
