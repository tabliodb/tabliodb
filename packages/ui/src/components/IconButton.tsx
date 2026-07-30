import type { ButtonHTMLAttributes, ComponentType, SVGProps } from 'react';
import { Button, type ButtonProps } from './Button.js';
import { WithTooltip } from './Tooltip.js';
import { cn } from '../lib/utils.js';

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  variant?: ButtonProps['variant'];
};

export function IconButton({ className, icon: Icon, label, variant = 'ghost', ...props }: IconButtonProps) {
  return (
    <WithTooltip content={label}>
      <Button
        aria-label={label}
        className={cn('size-8', className)}
        size="icon"
        // Native title tetap dipasang sebagai metadata/fallback, sementara Radix Tooltip mengurus affordance visual yang konsisten.
        title={label}
        variant={variant}
        {...props}
      >
        <Icon aria-hidden="true" className="size-4" />
      </Button>
    </WithTooltip>
  );
}
