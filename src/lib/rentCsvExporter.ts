import { format, differenceInWeeks } from 'date-fns';
import type { RentScheduleWithDetails } from '@/hooks/useRentCollection';
import { normalizeRentItem } from '@/hooks/useRentCollection';

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportRentRollCSV(items: RentScheduleWithDetails[]): void {
  const today = new Date();
  const headers = [
    'Property Address', 'Room', 'Tenant Name', 'Rent Amount (£)',
    'Due Date', 'Status', 'Amount Paid (£)', 'Amount Outstanding (£)', 'Weeks Overdue',
  ];

  const rows = items.map(item => {
    const display = normalizeRentItem(item);
    const dueDate = new Date(item.due_date);
    const weeksOverdue = item.status === 'overdue' || item.status === 'partial'
      ? Math.max(0, differenceInWeeks(today, dueDate))
      : 0;

    return [
      escapeCSV(display.propertyAddress),
      escapeCSV(display.roomName),
      escapeCSV(display.tenantName),
      escapeCSV(item.rent_amount.toFixed(2)),
      escapeCSV(format(dueDate, 'dd/MM/yyyy')),
      escapeCSV(item.status),
      escapeCSV(item.amount_paid.toFixed(2)),
      escapeCSV(item.amount_outstanding.toFixed(2)),
      escapeCSV(weeksOverdue),
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  downloadBlob(csv, `rent-collection-${format(today, 'yyyy-MM-dd')}.csv`);
}

export function exportArrearsCSV(items: (RentScheduleWithDetails & { days_overdue?: number })[]): void {
  const today = new Date();
  const headers = [
    'Property', 'Tenant', 'Amount Owed (£)', 'Weeks Overdue',
    'Due Date', 'Last Reminder', 'Status',
  ];

  const rows = items.map(item => {
    const display = normalizeRentItem(item);
    const dueDate = new Date(item.due_date);
    const weeksOverdue = Math.max(0, differenceInWeeks(today, dueDate));

    return [
      escapeCSV(display.propertyAddress),
      escapeCSV(display.tenantName),
      escapeCSV(item.amount_outstanding.toFixed(2)),
      escapeCSV(weeksOverdue),
      escapeCSV(format(dueDate, 'dd/MM/yyyy')),
      escapeCSV(item.warning_sent_at ? format(new Date(item.warning_sent_at), 'dd/MM/yyyy') : ''),
      escapeCSV(item.status),
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  downloadBlob(csv, `arrears-report-${format(today, 'yyyy-MM-dd')}.csv`);
}

function downloadBlob(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}