import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Fetches a PDF and returns a blob: URL for rendering in an iframe.
 * For Supabase private storage, uses the SDK to download with auth.
 */
export function usePdfBlobUrl(sourceUrl: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    if (!sourceUrl) {
      setBlobUrl(null);
      setBlob(null);
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
        let blob: Blob;

        // Extract storage path from Supabase URL and download via SDK (handles private buckets)
        const bucketMatch = sourceUrl!.match(
          /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/
        );

        if (bucketMatch) {
          const [, bucket, path] = bucketMatch;
          const decodedPath = decodeURIComponent(path);
          const { data, error: dlError } = await supabase.storage
            .from(bucket)
            .download(decodedPath);

          if (dlError || !data) {
            throw new Error(`Storage download failed: ${dlError?.message || 'No data'}`);
          }
          // Ensure correct MIME type
          blob = new Blob([data], { type: 'application/pdf' });
        } else {
          const response = await fetch(sourceUrl!);
          if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        }

        if (cancelled) return;

        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setDataUrl(url);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load PDF:', err);
          setError(err instanceof Error ? err.message : 'Failed to load PDF');
          toast.error(err instanceof Error ? err.message : 'Failed to load PDF');
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
