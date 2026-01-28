import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  badge?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeading({
  badge,
  title,
  description,
  align = 'center',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'space-y-4',
        align === 'center' && 'text-center',
        className
      )}
    >
      {badge && (
        <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
          {badge}
        </span>
      )}
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
      {description && (
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {description}
        </p>
      )}
    </div>
  );
}
