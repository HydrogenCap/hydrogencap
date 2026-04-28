export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-muted-foreground mt-4">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-destructive" />
        <span>Overdue</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-amber-500" />
        <span>Urgent / Jobs</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-purple-500" />
        <span>Mortgage</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-emerald-500" />
        <span>Valid</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-green-200 dark:bg-green-900 border border-green-300 dark:border-green-700" />
        <span>Renewal Window</span>
      </div>
    </div>
  );
}
