import { supabase } from '@/integrations/supabase/client';

/**
 * Centralised storage helpers so components don't import supabase directly.
 */

export async function uploadToStorage(bucket: string, path: string, file: File) {
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
}

export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function removeFromStorage(bucket: string, paths: string[]) {
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;
}
