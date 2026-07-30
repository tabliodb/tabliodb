import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { forwardRef } from 'react';
import { cn } from '../lib/utils.js';

export type SelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

export type SelectProps = Omit<ComponentPropsWithoutRef<typeof SelectPrimitive.Root>, 'children'> & {
  'aria-invalid'?: ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>['aria-invalid'];
  'aria-label'?: ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>['aria-label'];
  className?: string;
  contentClassName?: string;
  id?: string;
  onBlur?: ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>['onBlur'];
  options: SelectOption[];
  placeholder?: string;
};

export function Select({
  className,
  contentClassName,
  id,
  onBlur,
  options,
  placeholder = 'Select option',
  value,
  ...props
}: SelectProps) {
  const { 'aria-invalid': ariaInvalid, 'aria-label': ariaLabel, ...rootProps } = props;

  return (
    <SelectPrimitive.Root value={value} {...rootProps}>
      <SelectPrimitive.Trigger
        aria-invalid={ariaInvalid}
        aria-label={ariaLabel}
        id={id}
        className={cn(
          'flex h-[var(--tabliodb-control-md)] w-full cursor-pointer items-center justify-between gap-2 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 text-left text-[13px] font-extrabold leading-none text-[rgb(var(--tabliodb-ink))] shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))] outline-none transition hover:bg-[rgb(var(--tabliodb-surface-raised))] focus:border-[rgb(var(--tabliodb-primary))] focus:ring-[3px] focus:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-[rgb(var(--tabliodb-ink-subtle))]',
          className,
        )}
        onBlur={onBlur}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-[rgb(var(--tabliodb-ink-muted))]" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={cn(
            'z-[80] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border-strong))] bg-white text-[rgb(var(--tabliodb-ink))] shadow-[0_3px_0_rgb(var(--tabliodb-border-strong)),0_14px_32px_rgb(15_23_42/0.12)]',
            contentClassName,
          )}
          position="popper"
          sideOffset={6}
        >
          <SelectPrimitive.ScrollUpButton className="flex h-7 cursor-default items-center justify-center bg-white text-[rgb(var(--tabliodb-ink-muted))]">
            <ChevronUp className="size-4" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectItem disabled={option.disabled} key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-7 cursor-default items-center justify-center bg-white text-[rgb(var(--tabliodb-ink-muted))]">
            <ChevronDown className="size-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ children, className, ...props }, ref) => (
  <SelectPrimitive.Item
    className={cn(
      'relative flex min-h-9 cursor-pointer select-none items-center rounded-[var(--tabliodb-radius-sm)] px-8 py-1.5 text-[13px] font-bold outline-none transition data-[disabled]:pointer-events-none data-[highlighted]:bg-[rgb(var(--tabliodb-selected-surface))] data-[highlighted]:text-[rgb(var(--tabliodb-primary-text))] data-[state=checked]:bg-[rgb(var(--tabliodb-active-chip-bg))] data-[state=checked]:text-[rgb(var(--tabliodb-primary-text))] data-[disabled]:opacity-50',
      className,
    )}
    ref={ref}
    {...props}
  >
    <span className="absolute left-2.5 grid size-5 place-items-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;
