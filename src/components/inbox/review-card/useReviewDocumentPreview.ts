import { useEffect, useState } from 'react';
import { createSignedStorageUrl } from '@/lib/storagePaths';
import { usePdfBlobUrl } from '@/hooks/usePdfBlobUrl';

/**
 * Loads signed URL + (for PDFs) a blob: URL for inline preview when the
 * review card is expanded. Mirrors the original logic exactly.
 */
export function useReviewDocumentPreview(opts: {
  expanded: boolean;
  isPdf: boolean;
  fileUrl: string;
}) {
  const { expanded, isPdf, fileUrl } = opts;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSignedLoading, setPreviewSignedLoading] = useState(false);

  const { blobUrl: pdfBlobUrl, blob: pdfBlob, loading: pdfBlobLoading, error: pdfBlobError } =
    usePdfBlobUrl(expanded && isPdf ? fileUrl : null);

  useEffect(() => {
    if (!expanded || isPdf || previewUrl || !fileUrl) return;
    let cancelled = false;
    setPreviewSignedLoading(true);
    createSignedStorageUrl('documents', fileUrl, 3600)
      .then(url => { if (!cancelled) setPreviewUrl(url); })
      .catch(() => { /* silent — preview is best-effort */ })
      .finally(() => { if (!cancelled) setPreviewSignedLoading(false); });
    return () => { cancelled = true; };
  }, [expanded, isPdf, previewUrl, fileUrl]);

  const [openHref, setOpenHref] = useState<string | null>(null);
  useEffect(() => {
    if (!expanded || openHref || !fileUrl) return;
    let cancelled = false;
    createSignedStorageUrl('documents', fileUrl, 3600)
      .then(url => { if (!cancelled) setOpenHref(url); })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [expanded, openHref, fileUrl]);

  return {
    previewUrl,
    previewSignedLoading,
    pdfBlobUrl,
    pdfBlob,
    pdfBlobLoading,
    pdfBlobError,
    openHref,
  };
}
