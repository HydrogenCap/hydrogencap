import { useState, useEffect, useRef } from 'react';

/**
 * Fetches a PDF from a URL and returns a blob: URL with correct MIME type.
 * This is needed because Supabase signed URLs often set Content-Disposition: attachment
 * which prevents inline PDF rendering in iframes.
 */
export function usePdfBlobUrl(sourceUrl: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
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
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchPdf() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(sourceUrl!);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        
        if (cancelled) return;

        // Create blob with explicit PDF MIME type
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        blobUrlRef.current = url;
        setBlobUrl(url);
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

  return { blobUrl, loading, error };
}
