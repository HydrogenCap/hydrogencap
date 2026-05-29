// Barrel — preserves the original `@/hooks/useRentCollection` import surface.
// Implementation has been split into ./rent-collection/* by concern.
export type {
  RentStatus,
  RentScheduleItem,
  RentScheduleWithDetails,
  RentItemDisplay,
  RentPayment,
  ArrearsAgingRow,
  MonthSummaryData,
  LedgerEntry,
  RentTrendPoint,
} from './rent-collection/types';

export { normalizeRentItem } from './rent-collection/internal';

export {
  useRentSchedule,
  useArrears,
  useRentPayments,
  useRecordPayment,
  useRentScheduleItem,
  useUpdateRentScheduleStatus,
  usePaymentReminders,
  useSendReminder,
  useDeleteRentSchedule,
  useDuplicateRentSchedule,
  useUpdateRentScheduleNotes,
} from './rent-collection/useRentSchedule';

export {
  useRentSummary,
  useArrearsAging,
  useMonthSummary,
} from './rent-collection/useArrears';

export {
  useTenancyLedger,
  usePaidOnTimeStats,
} from './rent-collection/useTenancyLedger';

export {
  useBulkMarkPaid,
  useBulkWriteOff,
  useBulkAddNote,
  useBulkSendReminder,
} from './rent-collection/useBulkActions';

export { useGenerateScheduleFromAgreement } from './rent-collection/useScheduleGeneration';

export { useRentTrend } from './rent-collection/useRentTrend';
