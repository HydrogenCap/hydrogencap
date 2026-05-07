import { ExternalLink, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PROVISIONS } from '../utils/templates';

export function BillProvisionsCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="h-4 w-4" />
          Key Provisions & Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {PROVISIONS.map(p => (
            <div key={p.title} className="flex gap-3 items-start p-3 rounded-lg border bg-muted/30">
              <p.icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{p.detail}</p>
                <Badge variant="secondary" className="mt-1 text-xs">{p.status}</Badge>
              </div>
            </div>
          ))}
        </div>
        <a
          href="https://www.legislation.gov.uk/ukpga/2025/1/contents"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3"
        >
          Renters' Rights Act 2025 on legislation.gov.uk <ExternalLink className="h-3 w-3" />
        </a>
      </CardContent>
    </Card>
  );
}
