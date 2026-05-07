import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LucideIcon, FileQuestion } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  children?: ReactNode;
  className?: string;
  variant?: 'default' | 'success';
}

function ActionButton({ action, variant = 'default' }: { action: EmptyStateAction; variant?: 'default' | 'outline' }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (action.onClick) action.onClick();
    else if (action.href) navigate(action.href);
  };

  return (
    <Button variant={variant} onClick={handleClick}>
      {action.label}
    </Button>
  );
}

export function EmptyState({
  icon: Icon = FileQuestion,
  title,
  description,
  action,
  secondaryAction,
  children,
  className = '',
  variant = 'default',
}: EmptyStateProps) {
  const isSuccess = variant === 'success';

  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        {isSuccess ? (
          <div className="p-4 rounded-full bg-emerald-500/10 mb-4">
            <Icon className="h-12 w-12 text-emerald-500" />
          </div>
        ) : (
          <Icon className="h-12 w-12 text-muted-foreground/70 mb-4" />
        )}
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        {description && (
          <p className="text-muted-foreground mb-4 max-w-md">{description}</p>
        )}
        {(action || secondaryAction) && (
          <div className="flex items-center gap-3">
            {action && <ActionButton action={action} />}
            {secondaryAction && <ActionButton action={secondaryAction} variant="outline" />}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
