import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ListState } from '@/components/ListState';
import { useRoomPnLPortfolio, type RoomPnLPeriod } from '@/hooks/useRoomPnL';
import { fmtGbp } from '../utils/types';

type RoomSortKey = 'contribution' | 'grossIncome' | 'maintenanceCosts' | 'voidDays' | 'occupancyRate';

export function RoomPerformanceSection() {
  const [period, setPeriod] = useState<RoomPnLPeriod>('last_12_months');
  const [sortKey, setSortKey] = useState<RoomSortKey>('contribution');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const { data, isLoading, error, refetch } = useRoomPnLPortfolio(period);

  const sorted = useMemo(() => {
    if (!data) return [];
    const arr = [...data];
    arr.sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return arr;
  }, [data, sortKey, sortDir]);

  const toggleSort = (k: RoomSortKey) => {
    if (k === sortKey) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(k); setSortDir('desc'); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Room Performance</CardTitle>
          <CardDescription>Per-room contribution across the portfolio.</CardDescription>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as RoomPnLPeriod)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="current_month">Current month</SelectItem>
            <SelectItem value="ytd">Year to date</SelectItem>
            <SelectItem value="last_12_months">Last 12 months</SelectItem>
            <SelectItem value="all_time">All time</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <ListState
          isLoading={isLoading}
          error={error as Error | null}
          isEmpty={!sorted.length}
          emptyTitle="No rooms found"
          emptyDescription="Add rooms to your properties to see contribution analysis here."
          onRetry={() => { refetch(); }}
        >
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('grossIncome')}>Gross income</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('voidDays')}>Void days</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('maintenanceCosts')}>Maintenance</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('contribution')}>Contribution</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('occupancyRate')}>Occupancy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(row => (
                  <TableRow key={row.roomId}>
                    <TableCell>
                      <Link to={`/properties-v2/${row.propertyId}`} className="text-primary hover:underline">{row.address}</Link>
                    </TableCell>
                    <TableCell>
                      <Link to={`/rooms-v2/${row.roomId}`} className="text-primary hover:underline">{row.roomName}</Link>
                    </TableCell>
                    <TableCell className="text-right">{fmtGbp(row.grossIncome)}</TableCell>
                    <TableCell className="text-right">{row.voidDays}</TableCell>
                    <TableCell className="text-right">{fmtGbp(row.maintenanceCosts)}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={row.contribution >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                        {row.contribution >= 0 ? '' : '-'}{fmtGbp(Math.abs(row.contribution))}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{Math.round(row.occupancyRate * 100)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ListState>
      </CardContent>
    </Card>
  );
}
