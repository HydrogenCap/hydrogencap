import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSuggestedContractors } from '@/hooks/useMaintenanceQuotes';
import { AddQuoteDialog } from './AddQuoteDialog';
import { Users, Phone, Mail, Star } from 'lucide-react';

interface SuggestedContractorsProps {
  requestId: string;
  category: string;
}

export function SuggestedContractors({ requestId, category }: SuggestedContractorsProps) {
  const { data: contractors, isLoading } = useSuggestedContractors(category);

  if (isLoading || !contractors || contractors.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Suggested Contractors
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {contractors.map(c => (
          <div key={c.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border bg-muted/30">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{c.company_name}</span>
                {c.rating && (
                  <Badge variant="outline" className="text-[10px] px-1.5">
                    <Star className="h-3 w-3 mr-0.5 text-amber-500 fill-amber-500" /> {c.rating}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {c.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" /> {c.phone}</span>}
                {c.email && <span className="flex items-center gap-0.5"><Mail className="h-3 w-3" /> {c.email}</span>}
              </div>
            </div>
            <AddQuoteDialog
              requestId={requestId}
              prefillContractorId={c.id}
              prefillContractorName={c.company_name}
              trigger={
                <button className="text-xs font-medium text-primary hover:underline whitespace-nowrap">
                  Request Quote
                </button>
              }
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
