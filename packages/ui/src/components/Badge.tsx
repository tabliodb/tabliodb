import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../lib/utils.js';

export const badgeVariants = cva(
  'inline-flex h-5 min-w-0 max-w-full items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-full border px-2 text-[10px] font-extrabold leading-none tracking-normal [&>span]:min-w-0 [&>span]:truncate',
  {
    defaultVariants: {
      variant: 'neutral',
    },
    variants: {
      variant: {
        blue: 'border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] text-[rgb(var(--tabliodb-sky-text))]',
        green:
          'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]',
        neutral:
          'border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] text-[rgb(var(--tabliodb-ink-muted))]',
        purple:
          'border-[rgb(var(--tabliodb-lavender-border))] bg-[rgb(var(--tabliodb-lavender-soft))] text-[rgb(var(--tabliodb-lavender-text))]',
        yellow:
          'border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] text-[rgb(var(--tabliodb-gold-text))]',
      },
    },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ className, variant }))} {...props} />;
}
