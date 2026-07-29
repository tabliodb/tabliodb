import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../lib/utils.js';

export type InputProps = ComponentPropsWithoutRef<'input'>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'flex h-11 w-full rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-semibold text-[rgb(var(--tabliodb-ink))] outline-none transition placeholder:text-[rgb(var(--tabliodb-ink-subtle))] focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary)/0.18)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
