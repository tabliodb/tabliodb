import type { HTMLAttributes } from 'react';
import { cn } from '../lib/utils.js';

export type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  depth?: 'none' | 'sm' | 'md';
};

const depthClassName: Record<NonNullable<SurfaceProps['depth']>, string> = {
  md: 'shadow-[0_3px_0_rgb(var(--tabliodb-border-strong)),var(--tabliodb-shadow-panel)]',
  none: '',
  sm: 'shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))]',
};

export function Surface({ className, depth = 'none', ...props }: SurfaceProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border-strong))] bg-white text-[rgb(var(--tabliodb-ink))]',
        depthClassName[depth],
        className,
      )}
      {...props}
    />
  );
}
