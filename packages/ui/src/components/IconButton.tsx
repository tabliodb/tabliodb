import type { ButtonHTMLAttributes, ComponentType, SVGProps } from 'react';
import { Button, type ButtonProps } from './Button.js';

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  variant?: ButtonProps['variant'];
};

export function IconButton({ icon: Icon, label, variant = 'ghost', ...props }: IconButtonProps) {
  return (
    <Button aria-label={label} size="icon" title={label} variant={variant} {...props}>
      <Icon aria-hidden="true" className="size-4" />
    </Button>
  );
}
