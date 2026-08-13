import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../lib/utils.js';

export const badgeVariants = cva(
  'inline-flex h-6 min-w-0 max-w-full items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-full border-2 bg-white px-2.5 text-[11px] font-extrabold leading-none tracking-normal shadow-[0_2px_0_rgb(var(--tabliodb-border))] [&>span]:min-w-0 [&>span]:truncate',
  {
    defaultVariants: {
      variant: 'neutral',
    },
    variants: {
      variant: {
        blue:
          'border-[rgb(var(--tabliodb-sky-border))] text-[rgb(var(--tabliodb-sky-text))] shadow-[0_2px_0_rgb(var(--tabliodb-sky-border))]',
        green:
          'border-[rgb(var(--tabliodb-primary-border))] text-[rgb(var(--tabliodb-primary-text))] shadow-[0_2px_0_rgb(var(--tabliodb-primary-border))]',
        neutral:
          'border-[rgb(var(--tabliodb-border-strong))] text-[rgb(var(--tabliodb-ink-muted))] shadow-[0_2px_0_rgb(var(--tabliodb-border))]',
        purple:
          'border-[rgb(var(--tabliodb-lavender-border))] text-[rgb(var(--tabliodb-lavender-text))] shadow-[0_2px_0_rgb(var(--tabliodb-lavender-border))]',
        yellow:
          'border-[rgb(var(--tabliodb-gold-border))] text-[rgb(var(--tabliodb-gold-text))] shadow-[0_2px_0_rgb(var(--tabliodb-gold-border))]',
      },
    },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ className, variant }))} {...props} />;
}
