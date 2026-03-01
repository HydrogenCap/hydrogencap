import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface LogoWordmarkProps {
  to?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export function LogoWordmark({ to = '/', className, size = 'md', showSubtitle = true }: LogoWordmarkProps) {
  const sizes = {
    sm: { text: 'text-lg', subtitle: 'text-[9px]' },
    md: { text: 'text-xl', subtitle: 'text-[10px]' },
    lg: { text: 'text-2xl', subtitle: 'text-xs' },
  };

  const content = (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="font-display font-bold tracking-tight text-primary" style={{ fontSize: size === 'sm' ? '1.125rem' : size === 'lg' ? '1.5rem' : '1.25rem' }}>
        Tenure<span className="text-foreground">IQ</span>
      </span>
      {showSubtitle && (
        <span className={cn('text-muted-foreground leading-tight hidden sm:inline', sizes[size].subtitle)}>
          Property Intelligence
        </span>
      )}
    </div>
  );

  if (to) {
    return <Link to={to} className="flex items-center">{content}</Link>;
  }

  return content;
}
