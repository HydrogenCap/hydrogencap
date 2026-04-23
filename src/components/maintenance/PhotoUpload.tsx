import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { Camera, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  folder: string;
  onUpload: (urls: string[]) => void;
  existingUrls?: string[];
  maxFiles?: number;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function PhotoUpload({ folder, onUpload, existingUrls = [], maxFiles = 5 }: Props) {
  const [uploading, setUploading] = useState(false);
  const [urls, setUrls] = useState<string[]>(existingUrls);
  const { toast } = useToast();

  const onDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of files.slice(0, maxFiles - urls.length)) {
        const ext = file.name.split('.').pop();
        const path = `${folder}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('maintenance-photos').upload(path, file);
        if (error) throw error;
        newUrls.push(path);
      }
      const updated = [...urls, ...newUrls];
      setUrls(updated);
      onUpload(updated);
    } catch (err: unknown) {
      console.error('Failed to upload photo:', err);
      toast({ title: 'Upload failed', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }, [folder, urls, maxFiles, onUpload, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: maxFiles - urls.length,
    disabled: uploading || urls.length >= maxFiles,
  });

  const removeUrl = (url: string) => {
    const updated = urls.filter(u => u !== url);
    setUrls(updated);
    onUpload(updated);
  };

  return (
    <div className="space-y-2">
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url, i) => (
            <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden border">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button onClick={() => removeUrl(url)} className="absolute top-0 right-0 bg-background/80 rounded-bl p-0.5">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {urls.length < maxFiles && (
        <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
          <input {...getInputProps()} />
          {uploading ? (
            <Loader2 className="h-4 w-4 mx-auto animate-spin" />
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Camera className="h-4 w-4" />
              <span>Add photos ({urls.length}/{maxFiles})</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
