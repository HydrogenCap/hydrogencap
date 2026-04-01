import { differenceInDays, format } from 'date-fns';
import { CheckCircle2, Circle, Clock, AlertTriangle, ExternalLink, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppSettings, useUpdateAppSetting } from '@/hooks/useAppSettings';
import type { TaxYearLabel } from '@/lib/accountingTypes';

// ─── MTD ITSA threshold mandation dates ─────────────────────────────────────
// April 2026: gross rental income > £50,000
// April 2027: gross rental income > £30,000
// April 2028 (proposed): gross rental income > £20,000
const THRESHOLDS = [
  { from: 2026, income: 50_000, label: '> £50,000 — mandated from April 2026' },
  { from: 2027, income: 30_000, label: '> £30,000 — mandated from April 2027' },
  { from: 2028, income: 20_000, label: '> £20,000 — mandated from April 2028 (proposed)' },
];

interface MtdDeadline {
  id: string;
  quarter: string;
  period: string;
  dueDate: Date;
  isEops?: boolean;
}

function buildDeadlines(taxYear: TaxYearLabel): MtdDeadline[] {
  const startYear = parseInt(taxYear.split('/')[0], 10);
  const y = startYear;
  const y1 = startYear + 1;
  const y2 = startYear + 2;

  return [
    {
      id: `${taxYear}_q1`,
      quarter: 'Q1',
      period: `6 Apr ${y} – 5 Jul ${y}`,
      dueDate: new Date(y, 7, 5), // 5 Aug
    },
    {
      id: `${taxYear}_q2`,
      quarter: 'Q2',
      period: `6 Jul ${y} – 5 Oct ${y}`,
      dueDate: new Date(y, 10, 5), // 5 Nov
    },
    {
      id: `${taxYear}_q3`,
      quarter: 'Q3',
      period: `6 Oct ${y} – 5 Jan ${y1}`,
      dueDate: new Date(y1, 1, 5), // 5 Feb
    },
    {
      id: `${taxYear}_q4`,
      quarter: 'Q4',
      period: `6 Jan ${y1} – 5 Apr ${y1}`,
      dueDate: new Date(y1, 4, 5), // 5 May
    },
    {
      id: `${taxYear}_eops`,
      quarter: 'EOPS',
      period: `End of Period Statement`,
      dueDate: new Date(y2, 0, 31), // 31 Jan
      isEops: true,
    },
    {
      id: `${taxYear}_final`,
      quarter: 'Final',
      period: `Final Declaration`,
      dueDate: new Date(y2, 0, 31), // 31 Jan
      isEops: true,
    },
  ];
}

function getEligibilityInfo(grossIncome: number, taxYear: TaxYearLabel) {
  const startYear = parseInt(taxYear.split('/')[0], 10);
  // MTD applies from the year the submission would be made (year after tax year ends)
  const submissionYear = startYear + 1;

  for (const t of THRESHOLDS) {
    if (grossIncome > t.income && submissionYear >= t.from) {
      return { mandated: true, label: t.label };
    }
  }
  // Check future mandation
  for (const t of THRESHOLDS) {
    if (grossIncome > t.income) {
      return { mandated: false, label: t.label, future: true };
    }
  }
  return { mandated: false, label: 'Below current thresholds', future: false };
}

interface Props {
  taxYear: TaxYearLabel;
  grossIncome?: number;
}

export function MtdItsaCard({ taxYear, grossIncome = 0 }: Props) {
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateAppSetting();
  const deadlines = buildDeadlines(taxYear);
  const eligibility = getEligibilityInfo(grossIncome, taxYear);

  const isSubmitted = (id: string) => settings?.[`mtd_submitted_${id}`] === 'true';

  const toggleSubmitted = (id: string) => {
    const current = isSubmitted(id);
    updateSetting.mutate({ key: `mtd_submitted_${id}`, value: current ? 'false' : 'true' });
  };

  const today = new Date();

  const deadlineStatus = (d: MtdDeadline) => {
    if (isSubmitted(d.id)) return 'submitted';
    const days = differenceInDays(d.dueDate, today);
    if (days < 0) return 'overdue';
    if (days <= 30) return 'due-soon';
    return 'upcoming';
  };

  const statusConfig = {
    submitted: {
      badge: <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Submitted</Badge>,
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />,
      bg: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800',
    },
    overdue: {
      badge: <Badge variant="destructive">Overdue</Badge>,
      icon: <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />,
      bg: 'bg-destructive/5 border-destructive/20',
    },
    'due-soon': {
      badge: <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Due soon</Badge>,
      icon: <Clock className="h-4 w-4 text-amber-600 shrink-0" />,
      bg: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800',
    },
    upcoming: {
      badge: <Badge variant="secondary">Upcoming</Badge>,
      icon: <Circle className="h-4 w-4 text-muted-foreground shrink-0" />,
      bg: '',
    },
  };

  const submittedCount = deadlines.filter(d => isSubmitted(d.id)).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            MTD ITSA — Quarterly Submissions
          </CardTitle>
          <Badge variant="secondary">{submittedCount}/{deadlines.length} done</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">

        {/* Eligibility banner */}
        <div className={`rounded-md p-3 flex items-start gap-2 text-xs ${
          eligibility.mandated
            ? 'bg-destructive/5 border border-destructive/20 text-destructive'
            : eligibility.future
            ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 text-amber-700 dark:text-amber-400'
            : 'bg-muted/40 text-muted-foreground'
        }`}>
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>
            {eligibility.mandated
              ? <span><strong>MTD ITSA is mandatory</strong> for your portfolio this year — {eligibility.label}.</span>
              : eligibility.future
              ? <span><strong>MTD ITSA will be required</strong> for your portfolio — {eligibility.label}. Start preparing now.</span>
              : <span>Your rental income is currently below all MTD ITSA thresholds. You may still voluntarily join.</span>
            }
          </div>
        </div>

        {/* Threshold reference */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {THRESHOLDS.map(t => (
            <div key={t.from} className="rounded-md border p-2 text-xs">
              <p className="font-medium">April {t.from}</p>
              <p className="text-muted-foreground">{t.income >= 50_000 ? '> £50,000' : t.income >= 30_000 ? '> £30,000' : '> £20,000'} gross income</p>
              {t.from === 2028 && <Badge variant="outline" className="mt-1 text-xs">Proposed</Badge>}
            </div>
          ))}
        </div>

        {/* Quarterly deadline list */}
        <div className="space-y-2">
          {deadlines.map(d => {
            const status = deadlineStatus(d);
            const cfg = statusConfig[status];
            const daysLeft = differenceInDays(d.dueDate, today);
            return (
              <div key={d.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${cfg.bg}`}>
                <div className="flex items-center gap-3 min-w-0">
                  {cfg.icon}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{d.quarter}</span>
                      {cfg.badge}
                    </div>
                    <p className="text-xs text-muted-foreground">{d.period}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {format(d.dueDate, 'dd MMM yyyy')}
                      {status !== 'submitted' && !d.isEops && (
                        <span className={daysLeft < 0 ? ' text-destructive font-medium' : daysLeft <= 30 ? ' text-amber-600' : ''}>
                          {daysLeft < 0 ? ` (${Math.abs(daysLeft)}d overdue)` : ` (${daysLeft}d)`}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isSubmitted(d.id) ? 'outline' : 'default'}
                  className="shrink-0 h-7 text-xs"
                  onClick={() => toggleSubmitted(d.id)}
                  disabled={updateSetting.isPending}
                >
                  {isSubmitted(d.id) ? 'Unmark' : 'Mark Submitted'}
                </Button>
              </div>
            );
          })}
        </div>

        <a
          href="https://www.gov.uk/guidance/sign-up-your-client-for-making-tax-digital-for-income-tax"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          HMRC MTD ITSA guidance <ExternalLink className="h-3 w-3" />
        </a>
      </CardContent>
    </Card>
  );
}
