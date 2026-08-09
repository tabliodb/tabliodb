import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { forwardRef } from 'react';
import { cn } from '../lib/utils.js';

export const Dialog = DialogPrimitive.Root;

export const DialogClose = forwardRef<
  ElementRef<typeof DialogPrimitive.Close>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Close
    className={cn(
      // Raw Radix close buttons otherwise look neutral; this keeps direct usage clickable while preserving asChild composition.
      !props.asChild &&
        'cursor-pointer rounded-[var(--tabliodb-radius-sm)] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    ref={ref}
    {...props}
  />
));
DialogClose.displayName = DialogPrimitive.Close.displayName;

export const DialogTrigger = forwardRef<
  ElementRef<typeof DialogPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Trigger
    className={cn(
      // Dialog triggers may be used without Button in compact UI; pointer and focus affordance still need to be present.
      !props.asChild &&
        'cursor-pointer rounded-[var(--tabliodb-radius-sm)] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    ref={ref}
    {...props}
  />
));
DialogTrigger.displayName = DialogPrimitive.Trigger.displayName;

export const DialogPortal = DialogPrimitive.Portal;

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-50 bg-[rgb(var(--tabliodb-ink)/0.28)] backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in',
      className,
    )}
    ref={ref}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ children, className, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      className={cn(
        'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[18px] border border-[rgb(var(--tabliodb-border-strong))] bg-white text-[rgb(var(--tabliodb-ink))] shadow-[0_4px_0_rgb(var(--tabliodb-border-strong)),0_18px_48px_rgb(15_23_42/0.14)] outline-none',
        className,
      )}
      ref={ref}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export function DialogHeader({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('grid shrink-0 gap-1 px-5 pt-5 text-left', className)} {...props} />;
}

export function DialogBody({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  // Header and footer stay as fixed flex siblings; this middle region owns all overflow and keeps padded scroll edges.
  return (
    <div
      className={cn(
        'tabliodb-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 [scrollbar-gutter:stable]',
        className,
      )}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col-reverse gap-2 border-t border-[rgb(var(--tabliodb-border))] bg-white px-5 py-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title className={cn('text-base font-extrabold tracking-normal', className)} ref={ref} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    className={cn('text-[13px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]', className)}
    ref={ref}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
