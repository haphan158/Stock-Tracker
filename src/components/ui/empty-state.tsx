import type { ReactNode } from 'react';

import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/src/components/ui/card';
import { cn } from '@/src/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Primary CTA — either a button/link element or a full form. */
  action?: ReactNode;
  className?: string;
  /** Tints the icon badge. Defaults to the brand primary ring. */
  tone?: 'primary' | 'amber' | 'rose' | 'emerald' | 'muted';
}

const TONE_CLASSES: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  primary: 'bg-primary/10 text-primary ring-primary/20',
  amber: 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400',
  rose: 'bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
  muted: 'bg-muted text-muted-foreground ring-border',
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone = 'primary',
}: EmptyStateProps) {
  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <span
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full ring-1',
            TONE_CLASSES[tone],
          )}
          aria-hidden
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="max-w-md space-y-1">
          <h3 className="text-foreground text-lg font-semibold">{title}</h3>
          {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </div>
        {action ? <div className="pt-1">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
