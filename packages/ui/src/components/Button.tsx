import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '../lib/utils.js';

export const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-sm font-extrabold tracking-normal outline-none transition-[background,border-color,box-shadow,color,transform] focus-visible:ring-4 focus-visible:ring-[rgb(var(--tabliodb-primary)/0.25)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-0.5',
  {
    defaultVariants: {
      size: 'default',
      variant: 'primary',
    },
    variants: {
      size: {
        default: 'h-11 px-4',
        icon: 'size-11 p-0',
        sm: 'h-9 rounded-xl px-3 text-xs',
        lg: 'h-12 px-5 text-base',
      },
      variant: {
        danger:
          'border-2 border-red-500 bg-red-500 text-white shadow-[0_4px_0_#b91c1c] hover:bg-red-400 active:shadow-[0_2px_0_#b91c1c]',
        ghost: 'bg-transparent text-[rgb(var(--tabliodb-ink-muted))] hover:bg-[rgb(var(--tabliodb-surface-raised))]',
        primary:
          'border-2 border-[rgb(var(--tabliodb-primary))] bg-[rgb(var(--tabliodb-primary))] text-white shadow-[0_4px_0_rgb(var(--tabliodb-primary-shadow))] hover:bg-[rgb(var(--tabliodb-primary-hover))] active:shadow-[0_2px_0_rgb(var(--tabliodb-primary-shadow))]',
        secondary:
          'border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white text-[rgb(var(--tabliodb-ink))] shadow-[0_4px_0_rgb(var(--tabliodb-border-strong))] hover:bg-[rgb(var(--tabliodb-surface-raised))] active:shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))]',
        sky: 'border-2 border-[rgb(var(--tabliodb-sky))] bg-[rgb(var(--tabliodb-sky))] text-white shadow-[0_4px_0_rgb(var(--tabliodb-sky-shadow))] hover:bg-[rgb(var(--tabliodb-sky-hover))] active:shadow-[0_2px_0_rgb(var(--tabliodb-sky-shadow))]',
        soft: 'border-2 border-transparent bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))] hover:bg-[rgb(var(--tabliodb-primary-soft-hover))]',
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
