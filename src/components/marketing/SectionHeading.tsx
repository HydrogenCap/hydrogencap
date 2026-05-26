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
        'space-y-5',
        align === 'center' && 'text-center',
        className
      )}
    >
      {badge && (
        <p
          className={cn(
            'text-xs uppercase tracking-[0.18em] text-gold font-semibold',
            align === 'center' && 'inline-block'
          )}
        >
          {badge}
        </p>
      )}
      <h2 className="font-display text-4xl md:text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground">
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            'text-lg text-muted-foreground font-light leading-relaxed max-w-2xl',
            align === 'center' && 'mx-auto'
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
