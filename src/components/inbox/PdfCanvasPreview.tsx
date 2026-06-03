import { useEffect, useRef, useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as pdfjsLib from 'pdfjs-dist';
// Vite-friendly worker import — bundled as a static asset URL.
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface PdfCanvasPreviewProps {
  /** A blob: URL (or any same-origin URL) pointing at the PDF bytes. Used as a fallback if `data` is not provided. */
  src?: string | null;
  /** Raw PDF bytes — preferred when available; avoids fetching blob: URLs which can fail in sandboxed iframes. */
  data?: Blob | ArrayBuffer | Uint8Array | null;
  /** Container height in pixels. */
  height?: number;
}

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4.0;

/**
 * Renders PDFs as canvas pages using pdf.js. Avoids the "This content is blocked"
 * fallback that Chrome's built-in PDF viewer shows inside sandboxed iframes
 * (e.g. the Lovable preview iframe).
 */
export function PdfCanvasPreview({ src, data, height = 480 }: PdfCanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setPageNum(1);
    setTotalPages(0);
    setError(null);
    setZoom(1);
  }, [src, data]);

  useEffect(() => {
    if (!src && !data) return;
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;

    async function render() {
      setLoading(true);
      try {
        let bytes: Uint8Array;
        if (data) {
          if (data instanceof Uint8Array) bytes = data;
          else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
          else bytes = new Uint8Array(await data.arrayBuffer());
        } else {
          const resp = await fetch(src!);
          if (!resp.ok) throw new Error(`Failed to fetch PDF (${resp.status})`);
          bytes = new Uint8Array(await resp.arrayBuffer());
        }
        if (cancelled) return;
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setTotalPages(pdf.numPages);

        const page = await pdf.getPage(pageNum);
        if (cancelled) return;

        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const viewport = page.getViewport({ scale: 1 });
        const containerWidth = container.clientWidth - 16; // account for padding
        const fitScale = Math.min(containerWidth / viewport.width, (height - 16) / viewport.height);
        const userScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
        const finalScale = fitScale * userScale * (window.devicePixelRatio || 1);
        const scaledViewport = page.getViewport({ scale: finalScale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        canvas.style.width = `${scaledViewport.width / (window.devicePixelRatio || 1)}px`;
        canvas.style.height = `${scaledViewport.height / (window.devicePixelRatio || 1)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const task = page.render({ canvasContext: ctx, viewport: scaledViewport });
        renderTask = task;
        await task.promise;
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to render PDF';
          // Ignore the harmless "Rendering cancelled" error
          if (!/cancel/i.test(msg)) setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    render();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [src, data, pageNum, height, zoom]);

  if (!src && !data) return null;

  return (
    <div className="w-full flex flex-col" style={{ height }}>
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-background flex items-start justify-center p-2 relative"
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error ? (
          <p className="text-xs text-destructive m-auto">{error}</p>
        ) : (
          <canvas ref={canvasRef} className="shadow-sm" />
        )}
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-border py-1.5 bg-muted/30">
        {totalPages > 1 && (
          <>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setPageNum(p => Math.max(1, p - 1))}
              disabled={pageNum <= 1 || loading}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              Page {pageNum} of {totalPages}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setPageNum(p => Math.min(totalPages, p + 1))}
              disabled={pageNum >= totalPages || loading}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
          </>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setZoom(z => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) / ZOOM_STEP) * ZOOM_STEP))}
          disabled={zoom <= MIN_ZOOM || loading}
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setZoom(z => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) / ZOOM_STEP) * ZOOM_STEP))}
          disabled={zoom >= MAX_ZOOM || loading}
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setZoom(1)}
          disabled={zoom === 1 || loading}
          aria-label="Reset zoom"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
