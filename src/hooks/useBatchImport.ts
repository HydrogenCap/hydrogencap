import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ValidatedRow } from '@/lib/csvParser';

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

async function getUserOrgId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('org_id')
    .limit(1)
    .maybeSingle();
  
  if (error || !data) return null;
  return data.org_id;
}

export function useBatchImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (validatedRows: ValidatedRow[]): Promise<ImportResult> => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const validRows = validatedRows.filter(r => r.isValid);
      const result: ImportResult = { success: 0, failed: 0, errors: [] };
      const currentYear = new Date().getFullYear();

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        try {
          // Extract property data
          const propertyData = {
            org_id: orgId,
            address_line: String(row.data.address_line || ''),
            area_name: row.data.area_name as string | null,
            postcode: row.data.postcode as string | null,
            property_type: row.data.property_type as string | null,
            beds: row.data.beds as number | null,
            current_value_gbp: row.data.current_value_gbp as number | null,
            purchase_price_gbp: row.data.purchase_price_gbp as number | null,
            ownership_entity: row.data.ownership_entity as string | null,
            ownership_percent: row.data.ownership_percent as number | null,
            epc_rating: row.data.epc_rating as string | null,
            notes: row.data.notes as string | null,
          };

          // Insert property
          const { data: property, error: propError } = await supabase
            .from('properties')
            .insert(propertyData)
            .select()
            .single();

          if (propError) throw propError;

          // Insert loan if mortgage data exists
          const mortgageBalance = row.data.mortgage_balance_gbp as number | null;
          if (mortgageBalance !== null && mortgageBalance > 0) {
            const loanData = {
              property_id: property.id,
              current_mortgage_balance_gbp: mortgageBalance,
              lender: row.data.lender as string | null,
              interest_rate_percent: row.data.interest_rate_percent as number | null,
              mortgage_payment_gbp: row.data.mortgage_payment_gbp as number | null,
            };

            const { error: loanError } = await supabase
              .from('loans')
              .insert(loanData);

            if (loanError) {
              console.warn('Failed to insert loan:', loanError);
            }
          }

          // Insert income if rent data exists
          const annualRent = row.data.annual_rent_gbp as number | null;
          if (annualRent !== null && annualRent > 0) {
            const incomeData = {
              property_id: property.id,
              year: currentYear,
              annual_rent_gbp: annualRent,
            };

            const { error: incomeError } = await supabase
              .from('income')
              .insert(incomeData);

            if (incomeError) {
              console.warn('Failed to insert income:', incomeError);
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
  });
}
