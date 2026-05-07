import { Download, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { REPORT_TEMPLATES, type ReportType } from '@/hooks/useReportGeneration';

export function ReportTemplatesGrid({
  filteredProperties,
  isPending,
  onGenerate,
}: {
  filteredProperties: Array<Record<string, unknown>>;
  isPending: boolean;
  onGenerate: (t: ReportType) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {REPORT_TEMPLATES.map(template => {
        const canGenerate = filteredProperties.length > 0;
        const isMortgagePack = template.id === 'mortgage_broker_pack';
        const propertyCount = filteredProperties.length;

        return (
          <Card key={template.id} className={!canGenerate ? 'opacity-60' : ''}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-2xl">{template.icon}</span>
                {template.name}
                {isMortgagePack && (
                  <Badge variant="secondary" className="text-xs ml-auto">Lender-Grade</Badge>
                )}
              </CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {propertyCount} {propertyCount === 1 ? 'property' : 'properties'} selected
              </div>
              <Button
                className="w-full gap-2"
                disabled={!canGenerate || isPending}
                onClick={() => onGenerate(template.id)}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isMortgagePack ? 'Configure & Generate' : 'Generate PDF'}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
