import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { Upload, Zap, Loader2, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BulkUploadQueue } from '@/components/documents/BulkUploadQueue';
import { BulkUploadSummary } from '@/components/documents/BulkUploadSummary';
import { useBulkDocumentUpload } from '@/hooks/useBulkDocumentUpload';
import { TEXT } from '@/lib/design-tokens';

export default function BulkDocumentScanner() {
  const navigate = useNavigate();
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

  const onDrop = useCallback((accepted: File[]) => {
    addFiles(accepted);
  }, [addFiles]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxFiles: 50,
    maxSize: 10 * 1024 * 1024,
    noClick: queue.length > 0,
    noKeyboard: queue.length > 0,
    disabled: isProcessing,
  });

  const queuedCount = queue.filter(q => q.status === 'queued').length;
  const hasFiles = queue.length > 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className={TEXT.pageTitle}>Bulk Document Scanner</h1>
            <p className={`${TEXT.body} text-muted-foreground mt-1`}>
              Drop up to 50 documents for AI classification and data extraction
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
                  <p className="text-lg font-semibold text-primary">Drop files to add to queue</p>
                ) : (
                  <>
                    <p className="text-lg font-semibold">
                      {hasFiles ? 'Drop more files to add' : 'Drop files here or click to browse'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      PDF, JPG, PNG — up to 50 files, 10MB each
                    </p>
                  </>
                )}

                {hasFiles && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={(e) => { e.stopPropagation(); open(); }}>
                    Add More Files
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overall Progress Bar */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Processing {queue.length} files...
              </span>
              <span className="font-medium tabular-nums">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Process All Button */}
        {queuedCount > 0 && !isProcessing && (
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

        {/* Upload Queue */}
        <BulkUploadQueue
          items={queue}
          properties={properties}
          onRetry={retryItem}
          onRemove={removeItem}
          onSetProperty={setPropertyForItem}
        />

        {/* Summary (shown after processing) */}
        {isComplete && !isProcessing && queue.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <h2 className={`${TEXT.sectionHeading} mb-4`}>Processing Complete</h2>
              <BulkUploadSummary
                stats={stats}
                onSendToReview={() => navigate('/inbox')}
                onDone={() => {
                  clearQueue();
                  navigate('/documents');
                }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
