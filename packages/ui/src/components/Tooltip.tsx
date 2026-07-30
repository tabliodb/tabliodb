import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react';
import { forwardRef } from 'react';
import { cn } from '../lib/utils.js';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const TooltipPortal = TooltipPrimitive.Portal;

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ children, className, sideOffset = 8, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      className={cn(
        // Tooltip dibuat padat, rounded, dan memiliki shadow bawah ala tombol Duolingo agar terasa bagian dari sistem visual Tabliodb.
        'z-50 max-w-64 rounded-[var(--tabliodb-radius-sm)] border border-[rgb(var(--tabliodb-ink))] bg-[rgb(var(--tabliodb-ink))] px-2.5 py-1.5 text-[11px] font-extrabold leading-4 text-white shadow-[0_2px_0_rgb(0_0_0/0.18),0_10px_28px_rgb(15_23_42/0.16)] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
        className,
      )}
      ref={ref}
      sideOffset={sideOffset}
      {...props}
    >
      {/* Arrow kecil memberi arah visual tanpa membuat tooltip terasa berat di toolbar yang padat. */}
      {children}
      <TooltipPrimitive.Arrow className="fill-[rgb(var(--tabliodb-ink))]" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export function WithTooltip({
  children,
  content,
  delayDuration = 250,
  disabled = false,
  side = 'top',
}: {
  children: ReactNode;
  content: ReactNode;
  delayDuration?: number;
  disabled?: boolean;
  side?: ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>['side'];
}) {
  if (disabled) {
    return children;
  }

  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </Tooltip>
  );
}
