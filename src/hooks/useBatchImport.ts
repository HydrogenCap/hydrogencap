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
          
          // Extract property data
          const propertyData = {
            address_line: String(row.data.address_line || ''),
            address_line2: row.data.address_line2 as string | null,
            area_name: row.data.area_name as string | null,
            postcode: row.data.postcode as string | null,
            property_type: row.data.property_type as string | null,
            beds: row.data.beds as number | null,
            bathrooms: row.data.bathrooms as number | null,
            current_value_gbp: row.data.current_value_gbp as number | null,
            purchase_price_gbp: row.data.purchase_price_gbp as number | null,
            ownership_entity: row.data.ownership_entity as string | null,
            ownership_percent: row.data.ownership_percent as number | null,
            epc_rating: row.data.epc_rating as string | null,
            notes: row.data.notes as string | null,
          };

          let property;
          
          if (isUpdate) {
            // Update existing property
            const { data: updatedProperty, error: updateError } = await supabase
              .from('properties')
              .update(propertyData)
              .eq('id', propertyId)
              .select()
              .single();
              
            if (updateError) throw updateError;
            property = updatedProperty;
            result.updated++;
          } else {
            // Insert new property
            const { data: newProperty, error: propError } = await supabase
              .from('properties')
              .insert({ ...propertyData, org_id: orgId })
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
              // Update existing loan
              const { error: loanError } = await supabase
                .from('loans')
                .update(loanData)
                .eq('id', existingLoans[0].id);
                
              if (loanError) {
                console.warn('Failed to update loan:', loanError);
              }
            } else if (mortgageBalance !== null && mortgageBalance > 0) {
              // Insert new loan only if there's a balance
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
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
    onError: (error) => {
      showMutationError(error, 'Import failed');
    },
  });
}
