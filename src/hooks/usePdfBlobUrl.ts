import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches a PDF from Supabase storage (handling private buckets via signed URLs)
 * and returns a blob: URL with correct MIME type.
 * Also provides a base64 data URL as fallback for environments where
 * Chrome blocks blob URLs in nested iframes.
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
        let arrayBuffer: ArrayBuffer;

        // Try to extract storage path from Supabase URL and download via SDK (handles private buckets)
        const bucketMatch = sourceUrl!.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
        if (bucketMatch) {
          const [, bucket, path] = bucketMatch;
          const decodedPath = decodeURIComponent(path);
          const { data, error: dlError } = await supabase.storage
            .from(bucket)
            .download(decodedPath);
          
          if (dlError || !data) {
            throw new Error(`Storage download failed: ${dlError?.message || 'No data'}`);
          }
          arrayBuffer = await data.arrayBuffer();
        } else {
          // Fallback: direct fetch for non-Supabase URLs
          const response = await fetch(sourceUrl!);
          if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
          }
          arrayBuffer = await response.arrayBuffer();
        }

        if (cancelled) return;

        // Create blob with explicit PDF MIME type
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        blobUrlRef.current = url;
        setBlobUrl(url);

        // Also create a base64 data URL as fallback for Chrome iframe restrictions
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8.length; i += chunkSize) {
          binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
        }
        const base64 = btoa(binary);
        if (!cancelled) {
          setDataUrl(`data:application/pdf;base64,${base64}`);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('PDF blob fetch error:', err);
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
