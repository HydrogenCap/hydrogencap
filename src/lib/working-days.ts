/**
 * UK Working Days Calculator for Awaab's Law compliance.
 * Working days exclude weekends and UK bank holidays.
 */

// UK bank holidays 2026–2027
const UK_BANK_HOLIDAYS: string[] = [
  // 2026
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25',
  '2026-08-31', '2026-12-25', '2026-12-28',
  // 2027
  '2027-01-01', '2027-04-16', '2027-04-19', '2027-05-03', '2027-05-31',
  '2027-08-30', '2027-12-27', '2027-12-28',
];

const bankHolidaySet = new Set(
  UK_BANK_HOLIDAYS.map(d => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toDateString();
  })
);

/** Check if a date is a UK working day (not weekend, not bank holiday). */
export function isWorkingDay(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !bankHolidaySet.has(date.toDateString());
}

/** Add N working days to a start date. Returns the resulting date. */
export function addWorkingDays(startDate: Date, days: number): Date {
  const current = new Date(startDate);
  let added = 0;
  while (added < days) {
    current.setDate(current.getDate() + 1);
    if (isWorkingDay(current)) added++;
  }
  return current;
}

/** Add N calendar hours to a date. */
export function addHours(startDate: Date, hours: number): Date {
  return new Date(startDate.getTime() + hours * 60 * 60 * 1000);
}

/** Count working days remaining between now and a deadline. Negative = overdue. */
export function workingDaysRemaining(deadline: Date, from?: Date): number {
  const now = from ?? new Date();
  if (now >= deadline) {
    // Count negative working days (overdue)
    let count = 0;
    const cursor = new Date(deadline);
    while (cursor < now) {
      cursor.setDate(cursor.getDate() + 1);
      if (isWorkingDay(cursor)) count--;
    }
    return count;
  }

  let count = 0;
  const cursor = new Date(now);
  while (cursor < deadline) {
    cursor.setDate(cursor.getDate() + 1);
    if (isWorkingDay(cursor)) count++;
  }
  return count;
}

/** Calculate hours remaining until deadline. Negative = overdue. */
export function hoursRemaining(deadline: Date, from?: Date): number {
  const now = from ?? new Date();
  return (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
}

/** Get a human-readable countdown string. */
export function formatCountdown(deadline: Date, from?: Date): string {
  const now = from ?? new Date();
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs <= 0) {
    const overdueDays = Math.abs(workingDaysRemaining(deadline, now));
    if (overdueDays === 0) {
      const overdueHrs = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60));
      return `${overdueHrs}h overdue`;
    }
    return `${overdueDays} working day${overdueDays !== 1 ? 's' : ''} overdue`;
  }

  const totalHours = diffMs / (1000 * 60 * 60);
  if (totalHours < 48) {
    return `${Math.floor(totalHours)}h ${Math.floor((totalHours % 1) * 60)}m`;
  }

  const wdRemaining = workingDaysRemaining(deadline, now);
  return `${wdRemaining} working day${wdRemaining !== 1 ? 's' : ''}`;
}

export type DeadlineSeverity = 'safe' | 'warning' | 'critical' | 'overdue';

/** Get colour severity for a deadline based on percentage of time remaining. */
export function getDeadlineSeverity(
  deadline: Date,
  startDate: Date,
  from?: Date
): DeadlineSeverity {
  const now = from ?? new Date();
  if (now >= deadline) return 'overdue';

  const totalDuration = deadline.getTime() - startDate.getTime();
  const elapsed = now.getTime() - startDate.getTime();
  const pctRemaining = 1 - elapsed / totalDuration;

  if (pctRemaining <= 0.25) return 'critical';
  if (pctRemaining <= 0.50) return 'warning';
  return 'safe';
}

/** CSS classes for deadline severity badges/timers. */
export const DEADLINE_SEVERITY_STYLES: Record<DeadlineSeverity, string> = {
  safe: 'text-green-700 bg-green-50 border-green-200',
  warning: 'text-amber-700 bg-amber-50 border-amber-200',
  critical: 'text-red-700 bg-red-50 border-red-200',
  overdue: 'text-white bg-black animate-pulse border-black',
};
