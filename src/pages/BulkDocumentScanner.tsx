import { useCallback, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { Upload, Zap, Loader2, Trash2, FolderUp } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BulkUploadQueue } from '@/components/documents/BulkUploadQueue';
import { BulkUploadSummary } from '@/components/documents/BulkUploadSummary';
import { BulkReviewQueue } from '@/components/documents/BulkReviewQueue';
import { useBulkDocumentUpload } from '@/hooks/useBulkDocumentUpload';
import { useTenantsV2 } from '@/hooks/useTenantsV2';
import { walkDataTransfer, readInputFiles } from '@/lib/documents/folderWalker';
import { TEXT } from '@/lib/design-tokens';

export default function BulkDocumentScanner() {
  const navigate = useNavigate();
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [showReview, setShowReview] = useState(false);

  const {
    queue,
    isProcessing,
    isComplete,
    progress,
    stats,
    properties,
    addFiles,
    processAll,
    retryItem,
    removeItem,
    setPropertyForItem,
    clearQueue,
  } = useBulkDocumentUpload();

  // react-dropzone fallback (flat drops, click-to-browse). Folder DnD is handled
  // by our own onDrop hook below via dataTransfer.items.
  const onDrop = useCallback((accepted: File[]) => {
    addFiles(accepted);
  }, [addFiles]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/heic': ['.heic', '.heif'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 50,
    maxSize: 10 * 1024 * 1024,
    noClick: queue.length > 0,
    noKeyboard: queue.length > 0,
    disabled: isProcessing,
    // Intercept native drop so folders can be walked recursively. If items
    // exposes webkitGetAsEntry, walk; otherwise fall back to react-dropzone's
    // accepted files handler above.
    getFilesFromEvent: async (event) => {
      const ev = event as DragEvent;
      if (ev.dataTransfer && ev.dataTransfer.items && ev.dataTransfer.items.length) {
        const walked = await walkDataTransfer(ev.dataTransfer);
        // Fire-and-forget; addFiles already handles validation + toasts.
        addFiles(walked);
        return []; // Suppress the dropzone's own accepted callback.
      }
      // Click-to-browse path: let react-dropzone hand us Files normally.
      const dt = (event as { dataTransfer?: DataTransfer }).dataTransfer;
      const target = (event as unknown as { target?: HTMLInputElement }).target;
      const list = dt?.files ?? target?.files;
      return list ? Array.from(list) : [];
    },
  });

  const handleFolderInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const walked = readInputFiles(e.target);
      if (walked.length) addFiles(walked);
      // Reset so re-selecting the same folder still fires onChange.
      e.target.value = '';
    },
    [addFiles],
  );

  const queuedCount = queue.filter((q) => q.status === 'queued').length;
  const hasFiles = queue.length > 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className={TEXT.pageTitle}>Bulk Document Scanner</h1>
            <p className={`${TEXT.body} text-muted-foreground mt-1`}>
              Drop a folder or up to 50 files for AI classification and data extraction
            </p>
          </div>
          {hasFiles && !isProcessing && (
            <Button variant="ghost" size="sm" onClick={clearQueue} className="gap-2 text-muted-foreground">
              <Trash2 className="h-4 w-4" />
              Clear All
            </Button>
          )}
        </div>

        {/* Drop Zone */}
        {!showReview && (
          <Card>
            <CardContent className="p-0">
              <div
                {...getRootProps()}
                className={`relative rounded-lg border-2 border-dashed transition-colors ${
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : hasFiles
                      ? 'border-border bg-muted/30 cursor-default'
                      : 'border-border hover:border-primary/50 cursor-pointer'
                } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input {...getInputProps()} />

                <div className={`flex flex-col items-center justify-center text-center ${hasFiles ? 'py-8' : 'py-16'}`}>
                  <div className={`flex h-14 w-14 items-center justify-center rounded-full ${
                    isDragActive ? 'bg-primary/10' : 'bg-muted'
                  } mb-4`}>
                    <Upload className={`h-6 w-6 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>

                  {isDragActive ? (
                    <p className="text-lg font-semibold text-primary">Drop files or folder to add to queue</p>
                  ) : (
                    <>
                      <p className="text-lg font-semibold">
                        {hasFiles ? 'Drop more files to add' : 'Drop files or a folder, or click to browse'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        PDF, JPG, PNG, HEIC, DOCX — up to 50 files, 10MB each
                      </p>
                    </>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    {hasFiles && (
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); open(); }}>
                        Add More Files
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        folderInputRef.current?.click();
                      }}
                    >
                      <FolderUp className="h-4 w-4" />
                      Upload folder
                    </Button>
                    {/* Hidden input with webkitdirectory enables folder picking. */}
                    <input
                      ref={folderInputRef}
                      type="file"
                      multiple
                      // @ts-expect-error - non-standard but widely supported
                      webkitdirectory=""
                      directory=""
                      className="hidden"
                      onChange={handleFolderInput}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overall Progress Bar */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Processing {queue.length} files...</span>
              <span className="font-medium tabular-nums">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Process All Button */}
        {queuedCount > 0 && !isProcessing && !showReview && (
          <div className="flex items-center justify-center">
            <Button size="lg" onClick={processAll} className="gap-2">
              <Zap className="h-4 w-4" />
              Process All ({queuedCount} file{queuedCount !== 1 ? 's' : ''})
            </Button>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing with AI — classifying and extracting data from your documents
          </div>
        )}

        {/* Upload Queue (hidden once user enters batch review) */}
        {!showReview && (
          <BulkUploadQueue
            items={queue}
            properties={properties}
            onRetry={retryItem}
            onRemove={removeItem}
            onSetProperty={setPropertyForItem}
          />
        )}

        {/* Summary + entry point to batch review (shown after processing) */}
        {isComplete && !isProcessing && queue.length > 0 && !showReview && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className={`${TEXT.sectionHeading}`}>Processing Complete</h2>
              <BulkUploadSummary
                stats={stats}
                onSendToReview={() => setShowReview(true)}
                onDone={() => {
                  clearQueue();
                  navigate('/documents');
                }}
              />
              <div className="flex justify-end">
                <Button onClick={() => setShowReview(true)} className="gap-2">
                  Review {stats.extracted} document{stats.extracted === 1 ? '' : 's'}
                  <Zap className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Batched review queue */}
        {showReview && (
          <BulkReviewQueue
            items={queue}
            properties={properties}
            onDone={() => {
              setShowReview(false);
              clearQueue();
              navigate('/documents');
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
