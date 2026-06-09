import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Info, ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  DOC_TYPE_DISPLAY_NAMES,
  NOT_REQUIRED_REASON_PRESETS,
  type ComplianceDocType,
  type ComplianceMatrixRow,
} from '@/lib/complianceV2Types';
import { useToggleRequirementV2 } from '@/hooks/useComplianceV2';

interface RequirementsEditorProps {
  matrixRows: ComplianceMatrixRow[];
}

interface EditingState {
  row: ComplianceMatrixRow;
  reason: string;
  customReason: string;
  notes: string;
}

const CUSTOM_REASON = '__custom__';

export function RequirementsEditor({ matrixRows }: RequirementsEditorProps) {
  const [editing, setEditing] = useState<EditingState | null>(null);
  const toggle = useToggleRequirementV2();

  const sortedRows = useMemo(
    () =>
      [...matrixRows].sort((a, b) =>
        DOC_TYPE_DISPLAY_NAMES[a.document_type].localeCompare(
          DOC_TYPE_DISPLAY_NAMES[b.document_type],
        ),
      ),
    [matrixRows],
  );

  const handleSwitch = async (row: ComplianceMatrixRow, nextRequired: boolean) => {
    if (!nextRequired) {
      // Need a reason — open dialog
      setEditing({
        row,
        reason: NOT_REQUIRED_REASON_PRESETS[row.document_type]?.[0] ?? CUSTOM_REASON,
        customReason: '',
        notes: '',
      });
      return;
    }
    try {
      await toggle.mutateAsync({
        requirementId: row.requirement_id,
        isRequired: true,
        notes: null,
      });
      toast.success(`${DOC_TYPE_DISPLAY_NAMES[row.document_type]} marked as required`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update requirement');
    }
  };

  const submitNotRequired = async () => {
    if (!editing) return;
    const reasonText =
      editing.reason === CUSTOM_REASON ? editing.customReason.trim() : editing.reason;
    if (!reasonText || reasonText.length < 3) {
      toast.error('Please provide a reason (min 3 characters)');
      return;
    }
    try {
      await toggle.mutateAsync({
        requirementId: editing.row.requirement_id,
        isRequired: false,
        overrideReason: reasonText,
        notes: editing.notes.trim() || null,
      });
      toast.success(
        `${DOC_TYPE_DISPLAY_NAMES[editing.row.document_type]} marked as not required`,
      );
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update requirement');
    }
  };

  const presets = editing
    ? NOT_REQUIRED_REASON_PRESETS[editing.row.document_type] ?? []
    : [];

  return (
    <TooltipProvider delayDuration={150}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Compliance Requirements
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                Toggle each requirement on or off for this property. Marking
                something <em>Not required</em> needs a reason and is recorded
                in the audit log. All risk, Today and register views read from
                this single source.
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requirement</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[140px] text-right">Required</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => (
                <RequirementRow
                  key={row.requirement_id}
                  row={row}
                  onChange={(next) => handleSwitch(row, next)}
                  disabled={toggle.isPending}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mark{' '}
              {editing && DOC_TYPE_DISPLAY_NAMES[editing.row.document_type]}{' '}
              as not required
            </DialogTitle>
            <DialogDescription>
              Pick a reason and add an optional note. This will be visible
              wherever this requirement is listed and recorded in the audit log.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="reason-select">Reason</Label>
                <Select
                  value={editing.reason}
                  onValueChange={(v) =>
                    setEditing({ ...editing, reason: v })
                  }
                >
                  <SelectTrigger id="reason-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_REASON}>Other (write your own)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editing.reason === CUSTOM_REASON && (
                <div className="space-y-1.5">
                  <Label htmlFor="custom-reason">Custom reason</Label>
                  <Input
                    id="custom-reason"
                    value={editing.customReason}
                    onChange={(e) =>
                      setEditing({ ...editing, customReason: e.target.value })
                    }
                    placeholder="e.g. Commercial unit — not subject to residential gas regs"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="reason-notes">Notes (optional)</Label>
                <Textarea
                  id="reason-notes"
                  value={editing.notes}
                  onChange={(e) =>
                    setEditing({ ...editing, notes: e.target.value })
                  }
                  placeholder="Any supporting detail or reference"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitNotRequired}
              disabled={toggle.isPending}
            >
              <ShieldOff className="h-4 w-4 mr-1.5" /> Confirm not required
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

function RequirementRow({
  row,
  onChange,
  disabled,
}: {
  row: ComplianceMatrixRow;
  onChange: (next: boolean) => void;
  disabled: boolean;
}) {
  const label = DOC_TYPE_DISPLAY_NAMES[row.document_type as ComplianceDocType];
  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {label}
          {!row.is_required && row.override_reason && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 cursor-help bg-muted text-muted-foreground"
                >
                  <Info className="h-3 w-3" />
                  Reason
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-medium mb-0.5">Not required</p>
                <p className="text-xs">{row.override_reason}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TableCell>
      <TableCell>
        {row.is_required ? (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            <ShieldCheck className="h-3 w-3 mr-1" /> Required
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            <ShieldOff className="h-3 w-3 mr-1" /> Not required
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Switch
          checked={row.is_required}
          onCheckedChange={onChange}
          disabled={disabled}
          aria-label={`Toggle ${label} required`}
        />
      </TableCell>
    </TableRow>
  );
}
