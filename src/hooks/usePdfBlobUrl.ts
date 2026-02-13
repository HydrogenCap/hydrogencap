import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches a PDF from Supabase storage (handling private buckets via signed URLs)
 * and returns a URL suitable for rendering in an iframe.
 * For Supabase storage URLs, generates a signed URL.
 * For other URLs, returns a blob URL.
 */
export function usePdfBlobUrl(sourceUrl: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Clean up previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    if (!sourceUrl) {
      setBlobUrl(null);
      setDataUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchPdf() {
      setLoading(true);
      setError(null);

      try {
        // Try to extract storage path from Supabase URL
        const bucketMatch = sourceUrl!.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/);
        
        if (bucketMatch) {
          const [, bucket, path] = bucketMatch;
          const decodedPath = decodeURIComponent(path);
          
          // Create a signed URL for private bucket access
          const { data: signedData, error: signError } = await supabase.storage
            .from(bucket)
            .createSignedUrl(decodedPath, 3600);
          
          if (signError || !signedData?.signedUrl) {
            throw new Error(`Failed to create signed URL: ${signError?.message || 'No URL returned'}`);
          }

          if (!cancelled) {
            setBlobUrl(signedData.signedUrl);
            setDataUrl(signedData.signedUrl);
          }
        } else {
          // Fallback: direct fetch for non-Supabase URLs
          const response = await fetch(sourceUrl!);
          if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();

          if (cancelled) return;

          const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          setBlobUrl(url);
          setDataUrl(url);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('PDF fetch error:', err);
          setError(err.message || 'Failed to load PDF');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPdf();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [sourceUrl]);

  return { blobUrl, dataUrl, loading, error };
}
