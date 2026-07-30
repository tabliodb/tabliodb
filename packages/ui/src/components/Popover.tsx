import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { forwardRef } from 'react';
import { cn } from '../lib/utils.js';

export const Popover = PopoverPrimitive.Root;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export const PopoverContent = forwardRef<
  ElementRef<typeof PopoverPrimitive.Content>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ align = 'start', className, sideOffset = 10, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      align={align}
      className={cn(
        // The popover is intentionally roomier than a dropdown because it hosts real form controls and danger-zone actions.
        'z-[90] w-80 origin-[var(--radix-popover-content-transform-origin)] rounded-[18px] border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white p-4 text-[rgb(var(--tabliodb-ink))] shadow-[0_6px_0_rgb(var(--tabliodb-border-strong)),0_18px_42px_rgb(0_0_0/0.16)] outline-none transition-[opacity,transform] data-[state=open]:scale-100 data-[state=open]:opacity-100 data-[state=closed]:scale-95 data-[state=closed]:opacity-0',
        className,
      )}
      ref={ref}
      sideOffset={sideOffset}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;
