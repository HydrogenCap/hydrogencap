import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  type ParsedCSV,
  type PassportColumnMapping,
  PASSPORT_FIELDS,
} from '@/lib/passportCsvParser';

interface PassportColumnMapperProps {
  parsedCSV: ParsedCSV;
  mapping: PassportColumnMapping;
  onMappingChange: (csvColumn: string, fieldKey: PassportColumnMapping[string]) => void;
}

export function PassportColumnMapper({ parsedCSV, mapping, onMappingChange }: PassportColumnMapperProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Map each CSV column to a passport field. You must map at least an address or postcode for matching.
      </p>
      <div className="border border-border rounded-lg divide-y divide-border max-h-[400px] overflow-y-auto">
        {parsedCSV.headers.map(header => (
          <div key={header} className="flex items-center gap-4 p-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{header}</p>
              {parsedCSV.rows[0]?.[header] && (
                <p className="text-xs text-muted-foreground truncate">
                  e.g. {parsedCSV.rows[0][header]}
                </p>
              )}
            </div>
            <Select
              value={mapping[header] || ''}
              onValueChange={(value) => onMappingChange(header, value as PassportColumnMapping[string])}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select field..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Skip this column</SelectItem>
                {PASSPORT_FIELDS.map(field => (
                  <SelectItem key={field.key} value={field.key}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}
