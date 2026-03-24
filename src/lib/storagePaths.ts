import { supabase } from '@/integrations/supabase/client';

export function extractStoragePath(bucketName: string, fileUrl: string): string | null {
  const publicPattern = new RegExp(`/storage/v1/object/public/${bucketName}/(.+)$`);
  const publicMatch = fileUrl.match(publicPattern);
  if (publicMatch) return decodeURIComponent(publicMatch[1]);

  const signedPattern = new RegExp(`/storage/v1/object/sign/${bucketName}/(.+?)(\\?|$)`);
  const signedMatch = fileUrl.match(signedPattern);
  if (signedMatch) return decodeURIComponent(signedMatch[1]);

  const simplePattern = new RegExp(`${bucketName}/(.+?)(\\?|$)`);
  const simpleMatch = fileUrl.match(simplePattern);
  if (simpleMatch) return decodeURIComponent(simpleMatch[1]);

  return fileUrl.includes('://') ? null : fileUrl;
}

export async function createSignedStorageUrl(
  bucketName: string,
  fileUrl: string,
  expiresIn = 3600
): Promise<string> {
  const path = extractStoragePath(bucketName, fileUrl);

  if (!path) {
    return fileUrl;
  }

  const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    return fileUrl;
  }

  return data.signedUrl;
}
