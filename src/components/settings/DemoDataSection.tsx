import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Trash2, Database } from 'lucide-react';
import { useDemoData } from '@/hooks/useDemoData';

export function DemoDataSection() {
  const { hasDemoData, isLoading, seed, clear } = useDemoData();

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Demo Data
        </CardTitle>
        <CardDescription>
          Explore the platform with sample properties, tenants, and compliance data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Checking…</p>
        ) : hasDemoData ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Demo portfolio is loaded with 3 sample properties. You can remove it at any time.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => clear.mutate()}
              disabled={clear.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {clear.isPending ? 'Removing…' : 'Remove demo data'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Load 3 sample properties with tenants, compliance certificates, mortgages, and maintenance requests. You can remove it at any time.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => seed.mutate()}
              disabled={seed.isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {seed.isPending ? 'Loading…' : 'Load demo data'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
