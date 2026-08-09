import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { forwardRef } from 'react';
import { cn } from '../lib/utils.js';

export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    className={cn(
      // The checked state mirrors Tabliodb's Duolingo-tuned controls: chunky border, green fill, and a small pressed shadow.
      'grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-[6px] border border-[rgb(var(--tabliodb-border-strong))] bg-white text-white shadow-[0_1px_0_rgb(var(--tabliodb-border-strong))] outline-none transition hover:bg-[rgb(var(--tabliodb-surface-raised))] focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[rgb(var(--tabliodb-primary))] data-[state=checked]:bg-[rgb(var(--tabliodb-primary))] data-[state=checked]:shadow-[0_1px_0_rgb(var(--tabliodb-primary-shadow))]',
      className,
    )}
    ref={ref}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="grid place-items-center">
      <Check className="size-3 stroke-[4]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
