import {
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  Shield,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { type ActionItem } from '@/lib/portfolioInsights';

interface ActionItemsCardProps {
  actionItems: ActionItem[];
  onActionClick: (action: ActionItem) => void;
}

export function ActionItemsCard({ actionItems, onActionClick }: ActionItemsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Action Items
        </CardTitle>
        <CardDescription>
          Click to view affected properties
        </CardDescription>
      </CardHeader>
      <CardContent>
        {actionItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No urgent actions required</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actionItems.map((action) => (
              <button
                key={action.id}
                onClick={() => onActionClick(action)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
              >
                <div className={`p-2 rounded-full ${
                  action.severity === 'red'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-warning/10 text-warning'
                }`}>
                  {action.severity === 'red' ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{action.title}</div>
                  <div className="text-sm text-muted-foreground">{action.description}</div>
                </div>
                <Badge variant={action.severity === 'red' ? 'destructive' : 'secondary'}>
                  {action.count}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
