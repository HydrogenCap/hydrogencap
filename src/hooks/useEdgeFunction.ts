import { supabase } from '@/integrations/supabase/client';

/**
 * Invoke a Supabase edge function with typed body/response.
 * Centralises all edge-function calls so components don't import supabase directly.
 */
export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) throw error;
  return data as T;
}
