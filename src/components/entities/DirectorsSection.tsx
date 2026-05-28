import { Edit, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { EntityDirector } from '@/hooks/useLegalEntities';
import { formatDateUK } from '@/lib/calculations';


interface DirectorsSectionProps {
  directors: EntityDirector[] | undefined;
  onAddDirector: () => void;
  onEditDirector: (director: EntityDirector) => void;
  onDeleteDirector: (director: EntityDirector) => void;
}

export function DirectorsSection({
  directors,
  onAddDirector,
  onEditDirector,
  onDeleteDirector,
}: DirectorsSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Directors</CardTitle>
        <Button size="sm" onClick={onAddDirector}>
          <Plus className="h-4 w-4 mr-1" /> Add Director
        </Button>
      </CardHeader>
      <CardContent>
        {directors && directors.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Director Name</TableHead>
                <TableHead>Appointment Date</TableHead>
                <TableHead>Resignation Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {directors.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.director_name}</TableCell>
                  <TableCell>{formatDate(d.appointment_date)}</TableCell>
                  <TableCell>{formatDate(d.resignation_date)}</TableCell>
                  <TableCell>
                    <Badge variant={d.is_current ? 'default' : 'secondary'}>
                      {d.is_current ? 'Current' : 'Resigned'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label="Edit director" className="h-7 w-7" onClick={() => onEditDirector(d)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove director"
                        className="h-7 w-7 text-destructive"
                        onClick={() => onDeleteDirector(d)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-center py-6">No directors added yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
