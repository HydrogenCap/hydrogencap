import { forwardRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Quote } from 'lucide-react';

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  company?: string;
}

export const TestimonialCard = forwardRef<HTMLDivElement, TestimonialCardProps>(
  ({ quote, author, role, company }, ref) => {
    return (
      <Card ref={ref} className="h-full">
        <CardContent className="pt-6 flex flex-col h-full">
          <Quote className="h-8 w-8 text-primary/20 mb-4" />
          <blockquote className="flex-1 text-muted-foreground mb-6">
            "{quote}"
          </blockquote>
          <div>
            <p className="font-semibold">{author}</p>
            <p className="text-sm text-muted-foreground">
              {role}{company && `, ${company}`}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
);

TestimonialCard.displayName = 'TestimonialCard';
