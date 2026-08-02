import type { ButtonHTMLAttributes, ComponentType, SVGProps } from 'react';
import { Button, type ButtonProps } from './Button.js';
import { WithTooltip } from './Tooltip.js';
import { cn } from '../lib/utils.js';

export type IconButtonSize = 'sm' | 'default' | 'lg' | 'xl';

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  variant?: ButtonProps['variant'];
  size?: IconButtonSize;
};

const sizeClasses: Record<IconButtonSize, { button: string; icon: string }> = {
  sm: {
    button: 'size-7',
    icon: 'size-3.5',
  },
  default: {
    button: 'size-8',
    icon: 'size-4',
  },
  lg: {
    button: 'size-9',
    icon: 'size-5',
  },
  xl: {
    button: 'size-10',
    icon: 'size-6',
  },
};

export function IconButton({
  className,
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'default',
  ...props
}: IconButtonProps) {
  const currentSize = sizeClasses[size];

  return (
    <WithTooltip content={label}>
      <Button aria-label={label} className={cn(currentSize.button, className)} size="icon" variant={variant} {...props}>
        <Icon aria-hidden="true" className={currentSize.icon} />
      </Button>
    </WithTooltip>
  );
}
