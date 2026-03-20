import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ValidatedRow } from '@/lib/csvParser';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
import { showMutationError } from '@/lib/errorToast';

interface ImportResult {
  success: number;
  failed: number;
  created: number;
  updated: number;
  errors: string[];
}

export function useBatchImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (validatedRows: ValidatedRow[]): Promise<ImportResult> => {
      if (validatedRows.length > 500) {
        throw new Error('Import limited to 500 rows at once. Split your file and import in batches.');
      }

      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const validRows = validatedRows.filter(r => r.isValid);
      const result: ImportResult = { success: 0, failed: 0, created: 0, updated: 0, errors: [] };
      const currentYear = new Date().getFullYear();

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        try {
          const propertyId = row.data.id as string | null;
          const isUpdate = !!propertyId;
          
          // Extract property data mapped to V2 column names
          const propertyData = {
            address_line_1: String(row.data.address_line || row.data.address_line_1 || ''),
            address_line_2: (row.data.address_line2 || row.data.address_line_2) as string | null,
            county: row.data.area_name as string | null,
            postcode: row.data.postcode as string | null,
            property_type: (row.data.property_type as string) || 'HMO',
            total_lettable_rooms: row.data.beds as number | null,
            current_valuation: row.data.current_value_gbp as number | null,
            purchase_price: row.data.purchase_price_gbp as number | null,
            epc_rating: row.data.epc_rating as string | null,
            notes: row.data.notes as string | null,
            city: (row.data.town_city || row.data.city || '') as string,
          };

          let property;
          
          if (isUpdate) {
            // Update existing property
            const { data: updatedProperty, error: updateError } = await supabase
              .from('properties_v2')
              .update(propertyData)
              .eq('id', propertyId)
              .select()
              .single();
              
            if (updateError) throw updateError;
            property = updatedProperty;
            result.updated++;
          } else {
            // Insert new property - entity_id is required for V2
            const entityId = row.data.entity_id as string | null;
            if (!entityId) {
              throw new Error('entity_id is required for new properties in V2');
            }

            const { data: newProperty, error: propError } = await supabase
              .from('properties_v2')
              .insert({ ...propertyData, org_id: orgId, entity_id: entityId })
              .select()
              .single();

            if (propError) throw propError;
            property = newProperty;
            result.created++;
          }

          // Handle loan data (upsert based on property_id)
          const mortgageBalance = row.data.mortgage_balance_gbp as number | null;
          const hasLoanData = mortgageBalance !== null || row.data.lender || row.data.interest_rate_percent;
          
          if (hasLoanData) {
            // Check if loan exists
            const { data: existingLoans } = await supabase
              .from('loans')
              .select('id')
              .eq('property_id', property.id)
              .limit(1);
              
            const loanData = {
              property_id: property.id,
              current_mortgage_balance_gbp: mortgageBalance,
              lender: row.data.lender as string | null,
              interest_rate_percent: row.data.interest_rate_percent as number | null,
              mortgage_payment_gbp: row.data.mortgage_payment_gbp as number | null,
              fixed_rate_expires: row.data.fixed_rate_expires as string | null,
            };

            if (existingLoans && existingLoans.length > 0) {
              const { error: loanError } = await supabase
                .from('loans')
                .update(loanData)
                .eq('id', existingLoans[0].id);
                
              if (loanError) {
                console.warn('Failed to update loan:', loanError);
              }
            } else if (mortgageBalance !== null && mortgageBalance > 0) {
              const { error: loanError } = await supabase
                .from('loans')
                .insert(loanData);

              if (loanError) {
                console.warn('Failed to insert loan:', loanError);
              }
            }
          }

          // Handle income data (upsert based on property_id + year)
          const annualRent = row.data.annual_rent_gbp as number | null;
          if (annualRent !== null) {
            const incomeData = {
              property_id: property.id,
              year: currentYear,
              annual_rent_gbp: annualRent,
            };

            const { error: incomeError } = await supabase
              .from('income')
              .upsert(incomeData, { onConflict: 'property_id,year' });

            if (incomeError) {
              console.warn('Failed to upsert income:', incomeError);
            }
          }

          result.success++;
        } catch (err) {
          result.failed++;
          result.errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties_v2'] });
    },
    onError: (error) => {
      showMutationError(error, 'Import failed');
    },
  });
}
