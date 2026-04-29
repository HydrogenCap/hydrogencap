import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DoorOpen, ArrowRight } from 'lucide-react';
import { supabaseAny } from '@/integrations/supabase/client';

const STATUS_STYLES: Record<string, { bg: string; label: string }> = {
  occupied: { bg: 'bg-primary', label: 'Occupied' },
  notice: { bg: 'bg-warning', label: 'Notice' },
  vacant: { bg: 'bg-destructive', label: 'Vacant' },
  maintenance: { bg: 'bg-muted-foreground', label: 'Maintenance' },
};

// Map V2 occupancy_status -> the four buckets the widget displays.
function mapV2Status(status: string): 'occupied' | 'notice' | 'vacant' | 'maintenance' {
  switch (status) {
    case 'occupied':
      return 'occupied';
    case 'under_offer':
      return 'notice';
    case 'refurbishment':
    case 'unavailable':
      return 'maintenance';
    case 'vacant':
    default:
      return 'vacant';
  }
}

export function OccupancyWidget() {
  const { data: rooms } = useQuery({
    queryKey: ['rooms_v2', 'all', 'occupancy_widget'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('rooms_v2')
        .select('id, occupancy_status, is_lettable')
        .eq('is_lettable', true);
      if (error) throw error;
      return (data || []) as Array<{ id: string; occupancy_status: string; is_lettable: boolean }>;
    },
  });

  const stats = useMemo(() => {
    if (!rooms || rooms.length === 0) return null;

    const total = rooms.length;
    const byStatus = {
      occupied: 0,
      notice: 0,
      vacant: 0,
      maintenance: 0,
    };
    for (const room of rooms) {
      byStatus[mapV2Status(room.occupancy_status)] += 1;
    }

    return { total, byStatus };
  }, [rooms]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DoorOpen className="h-4 w-4" />
          Occupancy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!stats || stats.total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No rooms configured</p>
        ) : (
          <>
            <div className="flex rounded-full overflow-hidden h-4">
              {Object.entries(stats.byStatus).map(([status, count]) => {
                if (count === 0) return null;
                const pct = (count / stats.total) * 100;
                return (
                  <div
                    key={status}
                    className={`${STATUS_STYLES[status]?.bg || 'bg-muted'} transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${STATUS_STYLES[status]?.label}: ${count}`}
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2 text-sm">
                  <div className={`w-3 h-3 rounded-full ${STATUS_STYLES[status]?.bg || 'bg-muted'}`} />
                  <span className="text-muted-foreground">{STATUS_STYLES[status]?.label}</span>
                  <span className="font-medium ml-auto">{count}</span>
                </div>
              ))}
            </div>

            <div className="text-center pt-1">
              <span className="text-2xl font-bold">
                {Math.round((stats.byStatus.occupied / stats.total) * 100)}%
              </span>
              <span className="text-sm text-muted-foreground ml-2">occupancy rate</span>
            </div>
          </>
        )}

        <Link to="/properties" className="flex items-center gap-1 text-sm text-primary hover:underline">
          View all properties
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
