export interface MigrationStep {
  key: string;
  title: string;
  v1Table: string;
  v2Table: string;
  functionName: string;
  v1Count: number;
  v2Count: number;
  status: 'not_started' | 'partial' | 'complete' | 'skipped';
  result?: MigrationResult;
}

export interface MigrationResult {
  migrated: number;
  skipped_already_exists?: number;
  skipped_no_v2_property?: number;
  skipped_missing_refs_or_exists?: number;
  skipped?: number;
  unassigned_entity_id?: string;
  table: string;
}

export interface FullMigrationResult {
  migration_results: MigrationResult[];
  completed_at: string;
}

export interface GapField {
  field: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'toggle' | 'dropdown' | 'date';
  options?: { value: string; label: string }[];
}

export function getMigrationStatus(v1Count: number, v2Count: number): MigrationStep['status'] {
  if (v1Count === 0) return 'skipped';
  if (v2Count === 0) return 'not_started';
  if (v2Count >= v1Count) return 'complete';
  return 'partial';
}

export function getStatusColor(status: MigrationStep['status']): string {
  switch (status) {
    case 'complete': return 'text-success';
    case 'partial': return 'text-warning';
    case 'not_started': return 'text-destructive';
    case 'skipped': return 'text-muted-foreground';
  }
}

export function getStatusLabel(status: MigrationStep['status']): string {
  switch (status) {
    case 'complete': return 'Complete';
    case 'partial': return 'Partial';
    case 'not_started': return 'Not Started';
    case 'skipped': return 'Skipped';
  }
}
