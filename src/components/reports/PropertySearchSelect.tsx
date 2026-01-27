import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { PropertyReportData } from '@/lib/reportPdfGenerator';

interface PropertySearchSelectProps {
  properties: PropertyReportData[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function PropertySearchSelect({
  properties,
  value,
  onValueChange,
  placeholder = 'Select a property...',
}: PropertySearchSelectProps) {
  const [open, setOpen] = useState(false);

  // Sort properties by address for easier navigation
  const sortedProperties = useMemo(() => {
    return [...properties].sort((a, b) => {
      // Extract leading number if exists for natural sorting
      const numA = parseInt(a.address_line.match(/^(\d+)/)?.[1] || '0');
      const numB = parseInt(b.address_line.match(/^(\d+)/)?.[1] || '0');
      
      if (numA !== numB) {
        return numA - numB;
      }
      
      // Fall back to alphabetical
      return a.address_line.localeCompare(b.address_line);
    });
  }, [properties]);

  const selectedProperty = properties.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedProperty ? (
            <div className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{selectedProperty.address_line}</span>
              <Badge variant="outline" className="shrink-0 text-xs ml-auto">
                {selectedProperty.lifecycle_type === 'core_rental' ? 'Core' : 'Dev'}
              </Badge>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type to search properties..." />
          <CommandList>
            <CommandEmpty>No property found.</CommandEmpty>
            <CommandGroup>
              {sortedProperties.map((property) => (
                <CommandItem
                  key={property.id}
                  value={`${property.address_line} ${property.postcode || ''}`}
                  onSelect={() => {
                    onValueChange(property.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === property.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium">
                        {property.address_line}
                      </span>
                      {property.postcode && (
                        <span className="text-xs text-muted-foreground">
                          {property.postcode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={property.lifecycle_type === 'core_rental' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {property.lifecycle_type === 'core_rental' ? 'Core' : 'Dev'}
                      </Badge>
                      {property.legal_owner_company_id && (
                        <Badge variant="outline" className="text-xs">
                          SPV
                        </Badge>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
