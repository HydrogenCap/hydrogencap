import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PhotoGalleryProps {
  /** Can be full URLs or storage paths */
  photos: string[];
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [resolvedUrls, setResolvedUrls] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!photos.length) { setResolvedUrls([]); return; }

    const resolve = async () => {
      const urls = await Promise.all(
        photos.map(async (p) => {
          // If it's already a full URL, use it directly
          if (p.startsWith('http')) return p;
          // Otherwise it's a storage path — get signed URL
          const { data } = await supabase.storage
            .from('maintenance-photos')
            .createSignedUrl(p, 3600);
          return data?.signedUrl || '';
        })
      );
      setResolvedUrls(urls.filter(Boolean));
    };
    resolve();
  }, [photos]);

  if (!resolvedUrls.length) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {resolvedUrls.map((url, i) => (
          <button
            key={i}
            onClick={() => setLightboxIndex(i)}
            className="w-20 h-20 rounded-md overflow-hidden border hover:opacity-80 transition-opacity cursor-pointer"
          >
            <img src={url} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      <Dialog open={lightboxIndex !== null} onOpenChange={() => setLightboxIndex(null)}>
        <DialogContent className="max-w-3xl p-2">
          {lightboxIndex !== null && resolvedUrls[lightboxIndex] && (
            <div className="relative">
              <img
                src={resolvedUrls[lightboxIndex]}
                alt=""
                className="w-full h-auto max-h-[80vh] object-contain rounded"
              />
              {resolvedUrls.length > 1 && (
                <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="rounded-full opacity-80"
                    onClick={() => setLightboxIndex((lightboxIndex - 1 + resolvedUrls.length) % resolvedUrls.length)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="rounded-full opacity-80"
                    onClick={() => setLightboxIndex((lightboxIndex + 1) % resolvedUrls.length)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <p className="text-center text-sm text-muted-foreground mt-1">
                {lightboxIndex + 1} of {resolvedUrls.length}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
