import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { forwardRef } from 'react';
import { cn } from '../lib/utils.js';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuCheckboxItem = DropdownMenuPrimitive.CheckboxItem;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuLabel = DropdownMenuPrimitive.Label;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;
export const DropdownMenuRadioItem = DropdownMenuPrimitive.RadioItem;
export const DropdownMenuSeparator = DropdownMenuPrimitive.Separator;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuSubTrigger = DropdownMenuPrimitive.SubTrigger;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 8, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      className={cn(
        'z-50 min-w-52 overflow-hidden rounded-[18px] border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white p-2 text-[rgb(var(--tabliodb-ink))] shadow-[0_6px_0_rgb(var(--tabliodb-border-strong)),0_14px_32px_rgb(0_0_0/0.14)]',
        className,
      )}
      ref={ref}
      sideOffset={sideOffset}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Item>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    className={cn(
      // Menu rows are direct command surfaces, so they intentionally use pointer cursor instead of Radix's neutral default.
      'relative flex cursor-pointer select-none items-center gap-2 rounded-[12px] px-3 py-2 text-sm font-bold outline-none transition-colors focus:bg-[rgb(var(--tabliodb-primary-soft))] focus:text-[rgb(var(--tabliodb-primary-text))] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
      inset && 'pl-8',
      className,
    )}
    ref={ref}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export function DropdownMenuSeparatorItem({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('-mx-1 my-1 h-px bg-[rgb(var(--tabliodb-border))]', className)} {...props} />;
}
