import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { formatUKPostcode, isValidUKPostcode } from '@/hooks/useCoreIdentity';

interface AddressFormValues {
  address_line: string | null;
  address_line2: string | null;
  town_city: string | null;
  county: string | null;
  postcode: string | null;
}

interface AddressEditorProps {
  form: UseFormReturn<AddressFormValues>;
  showPreview?: boolean;
}

export function AddressEditor({ form, showPreview = true }: AddressEditorProps) {
  const watchedValues = form.watch(['address_line', 'address_line2', 'town_city', 'county', 'postcode']);
  
  const formattedAddress = [
    watchedValues[0],
    watchedValues[1],
    watchedValues[2],
    watchedValues[3],
    watchedValues[4],
  ].filter(Boolean).join(', ');

  const handlePostcodeBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const formatted = formatUKPostcode(e.target.value);
    form.setValue('postcode', formatted, { shouldValidate: true });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="address_line"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>
                Address Line 1 <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="e.g. 123 High Street" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="address_line2"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Address Line 2</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Apartment 4B" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="town_city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                City/Town <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="e.g. Manchester" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="county"
          render={({ field }) => (
            <FormItem>
              <FormLabel>County</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Greater Manchester" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="postcode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Postcode <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder="e.g. M1 1AA" 
                  {...field} 
                  value={field.value ?? ''} 
                  onBlur={handlePostcodeBlur}
                  className="uppercase"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {showPreview && formattedAddress && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Formatted Address</p>
              <p className="text-sm">{formattedAddress}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
