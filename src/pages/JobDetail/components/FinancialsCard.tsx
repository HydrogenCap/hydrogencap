import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Job {
  quoted_amount_gbp?: number | null;
  final_amount_gbp?: number | null;
  payment_status: string;
}

export function FinancialsCard({ job }: { job: Job }) {
  if (!(job.quoted_amount_gbp || job.final_amount_gbp)) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Financials</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {job.quoted_amount_gbp && (
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Quote</span>
            <span className="font-medium">£{job.quoted_amount_gbp}</span>
          </div>
        )}
        {job.final_amount_gbp && (
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Final</span>
            <span className="font-medium">£{job.final_amount_gbp}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Payment</span>
          <Badge variant="outline">{job.payment_status}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
