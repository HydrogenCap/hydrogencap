import React from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FieldDefinition } from '@/hooks/useMissingInfo';

interface Props {
  field: FieldDefinition;
  value: string | number | boolean | null | undefined;
  onChange: (value: string | number | boolean | undefined) => void;
  isFilled?: boolean;
}

export function MissingFieldEditor({ field, value, onChange, isFilled }: Props) {
  const renderInput = () => {
    switch (field.type) {
      case 'text':
        return (
          <Input
            placeholder={`Enter ${field.label.toLowerCase()}`}
            value={value || ''}
            onChange={e => onChange(e.target.value || undefined)}
            className={cn(isFilled && 'border-green-500')}
          />
        );

      case 'currency':
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={value || ''}
              onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
              className={cn('pl-7', isFilled && 'border-green-500')}
            />
          </div>
        );

      case 'percent':
        return (
          <div className="relative">
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="0.00"
              value={value || ''}
              onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
              className={cn('pr-7', isFilled && 'border-green-500')}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
          </div>
        );

      case 'number':
        return (
          <Input
            type="number"
            step="1"
            min="0"
            placeholder="0"
            value={value || ''}
            onChange={e => onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            className={cn(isFilled && 'border-green-500')}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-2 h-10">
            <Switch
              checked={value === true}
              onCheckedChange={checked => onChange(checked)}
            />
            <span className="text-sm text-muted-foreground">
              {value === true ? 'Yes' : value === false ? 'No' : 'Not set'}
            </span>
          </div>
        );

      case 'date': {
        const dateValue = value ? new Date(value) : undefined;
        // Calculate a reasonable year range (30 years back, 40 years forward for mortgages)
        const currentYear = new Date().getFullYear();
        const fromYear = currentYear - 30;
        const toYear = currentYear + 40;
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !value && 'text-muted-foreground',
                  isFilled && 'border-green-500'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(dateValue!, 'PPP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateValue}
                onSelect={date => onChange(date ? format(date, 'yyyy-MM-dd') : undefined)}
                initialFocus
                className="p-3 pointer-events-auto"
                captionLayout="dropdown-buttons"
                fromYear={fromYear}
                toYear={toYear}
              />
            </PopoverContent>
          </Popover>
        );
      }

      case 'select':
        return (
          <Select value={value || ''} onValueChange={v => onChange(v || undefined)}>
            <SelectTrigger className={cn(isFilled && 'border-green-500')}>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(opt => (
                <SelectItem key={opt} value={opt}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{field.label}</Label>
      {renderInput()}
    </div>
  );
}
