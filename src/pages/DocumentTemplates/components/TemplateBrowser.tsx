import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DOCUMENT_TEMPLATES, TEMPLATE_CATEGORIES } from '@/lib/documentTemplates';

interface Props {
  onSelect: (id: string) => void;
}

export function TemplateBrowser({ onSelect }: Props) {
  return (
    <Tabs defaultValue="all">
      <TabsList>
        <TabsTrigger value="all">All</TabsTrigger>
        {TEMPLATE_CATEGORIES.map(c => (
          <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>
        ))}
      </TabsList>
      {['all', ...TEMPLATE_CATEGORIES.map(c => c.value)].map(cat => (
        <TabsContent key={cat} value={cat}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {DOCUMENT_TEMPLATES
              .filter(t => cat === 'all' || t.category === cat)
              .map(t => (
                <Card
                  key={t.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => onSelect(t.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-semibold">{t.name}</CardTitle>
                      <Badge variant="outline" className="text-xs capitalize">{t.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{t.description}</p>
                    <Button variant="outline" size="sm" className="w-full">
                      Generate <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
