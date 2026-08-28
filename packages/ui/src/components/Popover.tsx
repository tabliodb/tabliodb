import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { forwardRef } from 'react';
import { cn } from '../lib/utils.js';

export const Popover = PopoverPrimitive.Root;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverClose = forwardRef<
  ElementRef<typeof PopoverPrimitive.Close>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Close>
>(({ className, ...props }, ref) => (
  <PopoverPrimitive.Close
    className={cn(
      // Popover close controls are often tiny icon surfaces, so direct primitive usage still needs a visible pointer/focus contract.
      !props.asChild &&
        'cursor-pointer rounded-[var(--tabliodb-radius-sm)] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    ref={ref}
    {...props}
  />
));
PopoverClose.displayName = PopoverPrimitive.Close.displayName;

export const PopoverTrigger = forwardRef<
  ElementRef<typeof PopoverPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <PopoverPrimitive.Trigger
    className={cn(
      // Direct popover triggers should read as clickable even before callers decide whether to wrap them in Button/IconButton.
      !props.asChild &&
        'cursor-pointer rounded-[var(--tabliodb-radius-sm)] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    ref={ref}
    {...props}
  />
));
PopoverTrigger.displayName = PopoverPrimitive.Trigger.displayName;

export const PopoverContent = forwardRef<
  ElementRef<typeof PopoverPrimitive.Content>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ align = 'start', className, onFocusOutside, onInteractOutside, sideOffset = 10, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      align={align}
      className={cn(
        // The popover is intentionally roomier than a dropdown because it hosts real form controls and danger-zone actions.
        'z-[90] w-80 origin-[var(--radix-popover-content-transform-origin)] rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border-strong))] bg-white p-3 text-[rgb(var(--tabliodb-ink))] shadow-[0_3px_0_rgb(var(--tabliodb-border-strong)),0_16px_38px_rgb(15_23_42/0.13)] outline-none transition-[opacity,transform] data-[state=open]:scale-100 data-[state=open]:opacity-100 data-[state=closed]:scale-95 data-[state=closed]:opacity-0',
        className,
      )}
      onFocusOutside={(event) => {
        if (isNestedSelectInteraction(event.target)) {
          event.preventDefault();
        }

        onFocusOutside?.(event);
      }}
      onInteractOutside={(event) => {
        if (isNestedSelectInteraction(event.target)) {
          event.preventDefault();
        }

        onInteractOutside?.(event);
      }}
      ref={ref}
      sideOffset={sideOffset}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

function isNestedSelectInteraction(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('[data-tabliodb-select-content]'));
}
