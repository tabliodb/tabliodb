import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '../lib/utils.js';

// The shared primitive owns pointer affordance so every shadcn-style button reads as clickable across the app.
export const buttonVariants = cva(
  'inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--tabliodb-radius-md)] text-[13px] font-extrabold leading-none tracking-normal outline-none transition-[background,border-color,box-shadow,color,transform] focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-0.5 [&_svg]:shrink-0',
  {
    defaultVariants: {
      size: 'default',
      variant: 'primary',
    },
    variants: {
      size: {
        default: 'h-[var(--tabliodb-control-md)] px-3.5',
        icon: 'size-[var(--tabliodb-control-md)] p-0',
        sm: 'h-[var(--tabliodb-control-sm)] rounded-[var(--tabliodb-radius-sm)] px-3 text-xs',
        lg: 'h-[var(--tabliodb-control-lg)] px-4 text-sm',
      },
      variant: {
        danger:
          'border border-[rgb(var(--tabliodb-danger))] bg-[rgb(var(--tabliodb-danger))] text-white shadow-[0_3px_0_rgb(var(--tabliodb-danger-shadow))] hover:bg-[rgb(var(--tabliodb-danger-hover))] active:shadow-[0_1px_0_rgb(var(--tabliodb-danger-shadow))]',
        ghost: 'bg-transparent text-[rgb(var(--tabliodb-ink-muted))] hover:bg-[rgb(var(--tabliodb-surface-raised))]',
        primary:
          'border border-[rgb(var(--tabliodb-primary))] bg-[rgb(var(--tabliodb-primary))] text-white shadow-[0_3px_0_rgb(var(--tabliodb-primary-shadow))] hover:bg-[rgb(var(--tabliodb-primary-hover))] active:shadow-[0_1px_0_rgb(var(--tabliodb-primary-shadow))]',
        purple:
          'border border-[rgb(var(--tabliodb-lavender))] bg-[rgb(var(--tabliodb-lavender))] text-white shadow-[0_3px_0_rgb(var(--tabliodb-lavender-shadow))] hover:bg-[rgb(var(--tabliodb-lavender-hover))] active:shadow-[0_1px_0_rgb(var(--tabliodb-lavender-shadow))]',
        secondary:
          'border border-[rgb(var(--tabliodb-border-strong))] bg-white text-[rgb(var(--tabliodb-ink))] shadow-[0_3px_0_rgb(var(--tabliodb-border-strong))] hover:bg-[rgb(var(--tabliodb-surface-raised))] active:shadow-[0_1px_0_rgb(var(--tabliodb-border-strong))]',
        sky: 'border border-[rgb(var(--tabliodb-sky))] bg-[rgb(var(--tabliodb-sky))] text-white shadow-[0_3px_0_rgb(var(--tabliodb-sky-shadow))] hover:bg-[rgb(var(--tabliodb-sky-hover))] active:shadow-[0_1px_0_rgb(var(--tabliodb-sky-shadow))]',
        soft: 'border border-transparent bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))] hover:bg-[rgb(var(--tabliodb-primary-soft-hover))]',
      },
    },
  },
);

export type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>;

export function Button({
  asChild = false,
  children,
  className,
  size,
  type = 'button',
  variant,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';

  return (
    <Component
      className={cn(buttonVariants({ className, size, variant }))}
      type={asChild ? undefined : type}
      {...props}
    >
      {children}
    </Component>
  );
}
