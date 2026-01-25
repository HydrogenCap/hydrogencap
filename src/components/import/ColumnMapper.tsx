import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Check, AlertCircle } from 'lucide-react';
import { PROPERTY_FIELDS, type ColumnMapping, type PropertyFieldKey } from '@/lib/csvParser';

interface ColumnMapperProps {
  csvHeaders: string[];
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
  sampleData: Record<string, string>[];
}

export function ColumnMapper({ csvHeaders, mapping, onMappingChange, sampleData }: ColumnMapperProps) {
  const usedFields = new Set(Object.values(mapping).filter(Boolean));
  
  const handleChange = (csvColumn: string, fieldKey: string) => {
    onMappingChange({
      ...mapping,
      [csvColumn]: fieldKey as PropertyFieldKey | '',
    });
  };

  const requiredFieldsMapped = PROPERTY_FIELDS
    .filter(f => f.required)
    .every(f => usedFields.has(f.key));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">Map CSV Columns</h3>
        {requiredFieldsMapped ? (
          <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            <Check className="h-3 w-3 mr-1" />
            Required fields mapped
          </Badge>
        ) : (
          <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Map required fields
          </Badge>
        )}
      </div>

      <div className="border border-border rounded-lg divide-y divide-border">
        {csvHeaders.map((header) => {
          const sampleValue = sampleData[0]?.[header] || '';
          const currentMapping = mapping[header] || '';
          
          return (
            <div key={header} className="flex items-center gap-4 p-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{header}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {sampleValue ? `e.g. "${sampleValue}"` : 'No sample data'}
                </p>
              </div>
              
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              
              <div className="w-56">
                <Select
                  value={currentMapping}
                  onValueChange={(value) => handleChange(header, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Skip this column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Skip this column</SelectItem>
                    {PROPERTY_FIELDS.map((field) => (
                      <SelectItem 
                        key={field.key} 
                        value={field.key}
                        disabled={usedFields.has(field.key) && mapping[header] !== field.key}
                      >
                        {field.label}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        * Required fields must be mapped for import to proceed
      </p>
    </div>
  );
}
