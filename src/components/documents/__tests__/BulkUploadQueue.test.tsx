import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkUploadQueue } from '../BulkUploadQueue';
import type { QueueItem, QueueItemStatus } from '@/hooks/useBulkDocumentUpload';

function makeFile(name: string, size = 1024, type = 'application/pdf'): File {
  return new File(['content'], name, { type, size } as any);
}

function makeQueueItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 'q-1',
    file: makeFile('test.pdf'),
    thumbnailUrl: null,
    storagePath: '/docs/test.pdf',
    documentId: null,
    status: 'queued' as QueueItemStatus,
    error: null,
    classification: { documentType: null, confidence: 0, category: null },
    extraction: {
      address: null, postcode: null, expiryDate: null, issueDate: null,
      certificateNumber: null, rating: null, fieldConfidences: {},
    },
    matchedPropertyId: null,
    selectedPropertyId: null,
    retryCount: 0,
    ...overrides,
  };
}

const properties = [
  { id: 'p-1', address_line_1: '1 Test St', postcode: 'SW1A' },
  { id: 'p-2', address_line_1: '2 Other St', postcode: 'N1 1AA' },
];

describe('BulkUploadQueue', () => {
  it('renders nothing when items is empty', () => {
    const { container } = render(
      <BulkUploadQueue items={[]} properties={[]} onRetry={() => {}} onRemove={() => {}} onSetProperty={() => {}} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders queue header with file count', () => {
    const items = [makeQueueItem()];
    render(
      <BulkUploadQueue items={items} properties={properties} onRetry={() => {}} onRemove={() => {}} onSetProperty={() => {}} />,
    );
    expect(screen.getByText('Upload Queue')).toBeInTheDocument();
    expect(screen.getByText('1 files')).toBeInTheDocument();
  });

  it('shows done count', () => {
    const items = [
      makeQueueItem({ id: 'q-1', status: 'done' }),
      makeQueueItem({ id: 'q-2', status: 'done' }),
    ];
    render(
      <BulkUploadQueue items={items} properties={properties} onRetry={() => {}} onRemove={() => {}} onSetProperty={() => {}} />,
    );
    expect(screen.getByText('2 done')).toBeInTheDocument();
  });

  it('shows error count', () => {
    const items = [makeQueueItem({ status: 'error', error: 'Upload failed' })];
    render(
      <BulkUploadQueue items={items} properties={properties} onRetry={() => {}} onRemove={() => {}} onSetProperty={() => {}} />,
    );
    expect(screen.getByText('1 failed')).toBeInTheDocument();
  });

  it('shows processing count', () => {
    const items = [makeQueueItem({ status: 'uploading' })];
    render(
      <BulkUploadQueue items={items} properties={properties} onRetry={() => {}} onRemove={() => {}} onSetProperty={() => {}} />,
    );
    expect(screen.getByText('1 processing')).toBeInTheDocument();
  });

  it('displays filename', () => {
    const items = [makeQueueItem({ file: makeFile('my-document.pdf') })];
    render(
      <BulkUploadQueue items={items} properties={properties} onRetry={() => {}} onRemove={() => {}} onSetProperty={() => {}} />,
    );
    expect(screen.getByText('my-document.pdf')).toBeInTheDocument();
  });

  it('shows error message for failed items', () => {
    const items = [makeQueueItem({ status: 'error', error: 'File too large' })];
    render(
      <BulkUploadQueue items={items} properties={properties} onRetry={() => {}} onRemove={() => {}} onSetProperty={() => {}} />,
    );
    expect(screen.getByText('File too large')).toBeInTheDocument();
  });

  it('calls onRetry when retry button clicked on error item', () => {
    const onRetry = vi.fn();
    const items = [makeQueueItem({ status: 'error', error: 'Failed' })];
    render(
      <BulkUploadQueue items={items} properties={properties} onRetry={onRetry} onRemove={() => {}} onSetProperty={() => {}} />,
    );
    const retryBtn = screen.getByTitle('Retry');
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledWith('q-1');
  });

  it('calls onRemove when remove button clicked', () => {
    const onRemove = vi.fn();
    const items = [makeQueueItem({ status: 'done' })];
    render(
      <BulkUploadQueue items={items} properties={properties} onRetry={() => {}} onRemove={onRemove} onSetProperty={() => {}} />,
    );
    const removeBtn = screen.getByTitle('Remove');
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledWith('q-1');
  });

  it('does not show remove button for actively processing items', () => {
    const items = [makeQueueItem({ status: 'uploading' })];
    render(
      <BulkUploadQueue items={items} properties={properties} onRetry={() => {}} onRemove={() => {}} onSetProperty={() => {}} />,
    );
    expect(screen.queryByTitle('Remove')).not.toBeInTheDocument();
  });

  it('shows classification badge when doc type is classified', () => {
    const items = [makeQueueItem({
      status: 'done',
      classification: { documentType: 'gas_safety', confidence: 0.95, category: 'compliance' },
    })];
    render(
      <BulkUploadQueue items={items} properties={properties} onRetry={() => {}} onRemove={() => {}} onSetProperty={() => {}} />,
    );
    expect(screen.getByText('Gas Safety')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    const items = [makeQueueItem()];
    render(
      <BulkUploadQueue items={items} properties={properties} onRetry={() => {}} onRemove={() => {}} onSetProperty={() => {}} />,
    );
    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Classification')).toBeInTheDocument();
    expect(screen.getByText('Property')).toBeInTheDocument();
    expect(screen.getByText('Confidence')).toBeInTheDocument();
  });
});
