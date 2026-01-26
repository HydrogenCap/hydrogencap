import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SignedUrlOptions {
  /** URL expiration time in seconds (default: 3600 = 1 hour) */
  expiresIn?: number;
  /** Whether to fetch immediately on mount */
  immediate?: boolean;
}

interface SignedUrlResult {
  signedUrl: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Extract storage path from a Supabase storage URL
 */
function extractStoragePath(bucketName: string, fileUrl: string): string | null {
  // Pattern: .../storage/v1/object/public/{bucket}/...
  const publicPattern = new RegExp(`/storage/v1/object/public/${bucketName}/(.+)$`);
  const publicMatch = fileUrl.match(publicPattern);
  if (publicMatch) return decodeURIComponent(publicMatch[1]);
  
  // Pattern: .../storage/v1/object/sign/{bucket}/...
  const signedPattern = new RegExp(`/storage/v1/object/sign/${bucketName}/(.+?)(\\?|$)`);
  const signedMatch = fileUrl.match(signedPattern);
  if (signedMatch) return decodeURIComponent(signedMatch[1]);
  
  // Try to extract just the path after '{bucket}/'
  const simplePattern = new RegExp(`${bucketName}/(.+?)(\\?|$)`);
  const simpleMatch = fileUrl.match(simplePattern);
  if (simpleMatch) return decodeURIComponent(simpleMatch[1]);
  
  return null;
}

/**
 * Hook to generate signed URLs for Supabase storage files
 */
export function useSignedUrl(
  bucketName: string,
  fileUrl: string | null | undefined,
  options: SignedUrlOptions = {}
): SignedUrlResult {
  const { expiresIn = 3600, immediate = true } = options;
  
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(immediate && !!fileUrl);
  const [error, setError] = useState<string | null>(null);

  const fetchSignedUrl = useCallback(async () => {
    if (!fileUrl) {
      setSignedUrl(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const path = extractStoragePath(bucketName, fileUrl);
      
      if (!path) {
        // If we can't extract path, use the URL directly
        setSignedUrl(fileUrl);
        setLoading(false);
        return;
      }

      const { data, error: signError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(path, expiresIn);

      if (signError) {
        console.error('Failed to create signed URL:', signError);
        // Fallback to original URL
        setSignedUrl(fileUrl);
        setError(signError.message);
      } else {
        setSignedUrl(data.signedUrl);
      }
    } catch (err) {
      console.error('Error getting signed URL:', err);
      setSignedUrl(fileUrl);
      setError(err instanceof Error ? err.message : 'Failed to generate signed URL');
    } finally {
      setLoading(false);
    }
  }, [bucketName, fileUrl, expiresIn]);

  useEffect(() => {
    if (immediate) {
      fetchSignedUrl();
    }
  }, [immediate, fetchSignedUrl]);

  return {
    signedUrl,
    loading,
    error,
    refetch: fetchSignedUrl,
  };
}

/**
 * Hook to download a file from Supabase storage
 */
export function useDownloadFile(bucketName: string) {
  const [downloading, setDownloading] = useState(false);

  const download = useCallback(async (fileUrl: string, fileName: string) => {
    setDownloading(true);
    
    try {
      const path = extractStoragePath(bucketName, fileUrl);
      
      if (!path) {
        // Try direct fetch
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        triggerDownload(blob, fileName);
        return;
      }

      // Generate short-lived signed URL for download
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(path, 60);

      if (error) {
        throw error;
      }

      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      triggerDownload(blob, fileName);
    } catch (err) {
      console.error('Download failed:', err);
      // Fallback: open in new tab
      window.open(fileUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  }, [bucketName]);

  return { download, downloading };
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
