import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Home, 
  Banknote, 
  CheckCircle2,
  FileText
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatGBP } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  date: string;
  type: 'purchase' | 'development' | 'go_live' | 'refinance' | 'valuation' | 'compliance';
  title: string;
  description?: string;
  value?: number;
  icon: React.ElementType;
  color: string;
}

interface PropertyTimelineProps {
  property: {
    original_purchase_date?: string | null;
    purchase_price_gbp?: number | null;
    operational_date?: string | null;
    lifecycle_type?: string | null;
    current_value_gbp?: number | null;
    loans?: Array<{
      loan_start_date?: string | null;
      current_mortgage_balance_gbp?: number | null;
      lender?: string | null;
    }>;
  };
  complianceItems?: Array<{
    id: string;
    compliance_type: string;
    issue_date?: string | null;
    expiry_date?: string | null;
  }>;
}

export function PropertyTimeline({ property, complianceItems = [] }: PropertyTimelineProps) {
  const events = useMemo<TimelineEvent[]>(() => {
    const timeline: TimelineEvent[] = [];

    // Purchase event
    if (property.original_purchase_date) {
      timeline.push({
        id: 'purchase',
        date: property.original_purchase_date,
        type: 'purchase',
        title: 'Property Acquired',
        description: property.purchase_price_gbp 
          ? `Purchased for ${formatGBP(property.purchase_price_gbp)}` 
          : 'Purchase price not recorded',
        value: property.purchase_price_gbp || undefined,
        icon: Home,
        color: 'bg-blue-500',
      });
    }

    // Loan events
    property.loans?.forEach((loan, idx) => {
      if (loan.loan_start_date) {
        timeline.push({
          id: `loan-${idx}`,
          date: loan.loan_start_date,
          type: 'refinance',
          title: loan.lender ? `Financed with ${loan.lender}` : 'Mortgage Obtained',
          description: loan.current_mortgage_balance_gbp 
            ? `Balance: ${formatGBP(loan.current_mortgage_balance_gbp)}` 
            : undefined,
          icon: Banknote,
          color: 'bg-purple-500',
        });
      }
    });

    // Go-live event
    if (property.operational_date && property.lifecycle_type === 'core_rental') {
      timeline.push({
        id: 'go-live',
        date: property.operational_date,
        type: 'go_live',
        title: 'Converted to Investment',
        description: 'Property moved from Development to Core Rental',
        icon: CheckCircle2,
        color: 'bg-emerald-500',
      });
    }

    // Key compliance events
    complianceItems
      .filter(item => item.issue_date)
      .slice(0, 5)
      .forEach(item => {
        timeline.push({
          id: `compliance-${item.id}`,
          date: item.issue_date!,
          type: 'compliance',
          title: item.compliance_type,
          description: item.expiry_date 
            ? `Expires: ${format(parseISO(item.expiry_date), 'dd MMM yyyy')}` 
            : undefined,
          icon: FileText,
          color: 'bg-cyan-500',
        });
      });

    // Sort by date descending (most recent first)
    return timeline.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [property, complianceItems]);

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Property Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No timeline events recorded yet. Add purchase date and other milestones to see the property history.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Property Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
          
          <div className="space-y-6">
            {events.map((event, _idx) => {
              const Icon = event.icon;
              return (
                <div key={event.id} className="relative flex gap-4 pl-10">
                  {/* Timeline dot */}
                  <div 
                    className={cn(
                      'absolute left-2 w-5 h-5 rounded-full flex items-center justify-center',
                      event.color
                    )}
                  >
                    <Icon className="h-3 w-3 text-white" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{event.title}</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {format(parseISO(event.date), 'dd MMM yyyy')}
                      </Badge>
                    </div>
                    {event.description && (
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
