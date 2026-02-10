import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RentStatus } from '@/hooks/useRentCollection';

interface PaymentFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: RentStatus | 'all';
  onStatusFilterChange: (value: RentStatus | 'all') => void;
  propertyFilter: string;
  onPropertyFilterChange: (value: string) => void;
  properties: { id: string; address_line: string }[];
}

export default function PaymentFilters({
  search, onSearchChange,
  statusFilter, onStatusFilterChange,
  propertyFilter, onPropertyFilterChange,
  properties,
}: PaymentFiltersProps) {
  const hasFilters = search || statusFilter !== 'all' || propertyFilter !== 'all';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tenant or reference…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Property filter */}
      <Select value={propertyFilter} onValueChange={onPropertyFilterChange}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="All properties" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All properties</SelectItem>
          {properties.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.address_line}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as RentStatus | 'all')}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="overdue">Overdue</SelectItem>
          <SelectItem value="partial">Part-Paid</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="due">Due Today</SelectItem>
          <SelectItem value="upcoming">Upcoming</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => {
          onSearchChange('');
          onStatusFilterChange('all');
          onPropertyFilterChange('all');
        }}>
          <X className="h-4 w-4 mr-1" /> Clear
        </Button>
      )}
    </div>
  );
}
