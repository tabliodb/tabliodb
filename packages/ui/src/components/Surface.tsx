import type { HTMLAttributes } from 'react';
import { cn } from '../lib/utils.js';

export type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  depth?: 'none' | 'sm' | 'md';
};

const depthClassName: Record<NonNullable<SurfaceProps['depth']>, string> = {
  md: 'shadow-[0_6px_0_rgb(var(--tabliodb-border-strong))]',
  none: '',
  sm: 'shadow-[0_3px_0_rgb(var(--tabliodb-border-strong))]',
};

export function Surface({ className, depth = 'sm', ...props }: SurfaceProps) {
  return (
    <div
      className={cn(
        'rounded-[18px] border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white text-[rgb(var(--tabliodb-ink))]',
        depthClassName[depth],
        className,
      )}
      {...props}
    />
  );
}
