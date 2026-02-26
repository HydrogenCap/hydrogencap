import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Building2, User, Handshake, Shield } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { EntityFormModal } from '@/components/entities/EntityFormModal';

const TYPE_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; icon: React.ComponentType<{ className?: string }> }> = {
  spv: { label: 'SPV', variant: 'default', icon: Building2 },
  personal: { label: 'Personal', variant: 'secondary', icon: User },
  joint_venture: { label: 'Joint Venture', variant: 'outline', icon: Handshake },
  trust: { label: 'Trust', variant: 'outline', icon: Shield },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  dormant: { label: 'Dormant', className: 'bg-muted text-muted-foreground border-border' },
  dissolved: { label: 'Dissolved', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export default function Entities() {
  const { data: entities, isLoading } = useLegalEntities();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'status'>('name');
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = useMemo(() => {
    if (!entities) return [];
    let result = entities.filter(e =>
      e.entity_name.toLowerCase().includes(search.toLowerCase()) ||
      (e.company_number && e.company_number.toLowerCase().includes(search.toLowerCase()))
    );
    result.sort((a, b) => {
      if (sortBy === 'name') return a.entity_name.localeCompare(b.entity_name);
      if (sortBy === 'type') return a.entity_type.localeCompare(b.entity_type);
      return a.status.localeCompare(b.status);
    });
    return result;
  }, [entities, search, sortBy]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Entities</h1>
            <p className="text-muted-foreground">Manage your legal entities, directors, and shareholders</p>
          </div>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entity
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or company number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort by Name</SelectItem>
              <SelectItem value="type">Sort by Type</SelectItem>
              <SelectItem value="status">Sort by Status</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            {search ? 'No entities match your search.' : 'No entities yet. Click "Add Entity" to get started.'}
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Company Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Properties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entity) => {
                  const typeConfig = TYPE_CONFIG[entity.entity_type];
                  const statusConfig = STATUS_CONFIG[entity.status];
                  return (
                    <TableRow
                      key={entity.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/entities/${entity.id}`)}
                    >
                      <TableCell className="font-semibold">{entity.entity_name}</TableCell>
                      <TableCell>
                        <Badge variant={typeConfig.variant} className="gap-1">
                          <typeConfig.icon className="h-3 w-3" />
                          {typeConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">
                        {entity.company_number || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusConfig.className}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">0</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <EntityFormModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
      />
    </AppLayout>
  );
}
