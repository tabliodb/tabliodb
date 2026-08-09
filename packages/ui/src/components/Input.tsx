import type { ComponentPropsWithoutRef, FocusEvent } from 'react';
import { cn } from '../lib/utils.js';

export type InputProps = ComponentPropsWithoutRef<'input'>;

export function Input({ className, onFocus, ...props }: InputProps) {
  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    onFocus?.(event);

    if (!canCollapseSelection(event.currentTarget)) {
      return;
    }

    window.requestAnimationFrame(() => {
      const input = event.currentTarget;

      if (!document.contains(input)) {
        return;
      }

      const wholeValueIsSelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;

      if (wholeValueIsSelected) {
        // Auto-focused dialog/popover inputs should place the caret at the end without selecting the current value.
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  }

  return (
    <input
      className={cn(
        'flex h-[var(--tabliodb-control-md)] w-full min-w-0 rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 text-[13px] font-semibold leading-none text-[rgb(var(--tabliodb-ink))] outline-none transition placeholder:text-[rgb(var(--tabliodb-ink-subtle))] focus:border-[rgb(var(--tabliodb-primary))] focus:ring-[1px] focus:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      onFocus={handleFocus}
      {...props}
    />
  );
}

function canCollapseSelection(input: HTMLInputElement): boolean {
  return ['email', 'password', 'search', 'tel', 'text', 'url'].includes(input.type);
}
