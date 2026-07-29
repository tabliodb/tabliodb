import type { HTMLAttributes } from 'react';
import { cn } from '../lib/utils.js';

export type FieldErrorProps = HTMLAttributes<HTMLParagraphElement>;

export function FieldError({ children, className, ...props }: FieldErrorProps) {
  if (!children) {
    return null;
  }

  return (
    <p className={cn('mt-1 text-xs font-extrabold text-red-600', className)} role="alert" {...props}>
      {children}
    </p>
  );
}
