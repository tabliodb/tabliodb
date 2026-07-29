import { Input, cn, type InputProps } from '@tabliodb/ui';
import type { ComponentPropsWithoutRef } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues, type PathValue } from 'react-hook-form';

export type ControlledInputProps<TFieldValues extends FieldValues> = Omit<
  InputProps,
  'checked' | 'defaultChecked' | 'defaultValue' | 'name' | 'onBlur' | 'onChange' | 'ref' | 'value'
> & {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
};

export function ControlledInput<TFieldValues extends FieldValues>({
  control,
  name,
  type,
  ...props
}: ControlledInputProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Input
          {...props}
          name={field.name}
          onBlur={field.onBlur}
          onChange={(event) => {
            // Number inputs must send numbers into Zod; blank stays undefined so required fields fail validation clearly.
            field.onChange(readInputValue(event.currentTarget, type));
          }}
          type={type}
          value={field.value ?? ''}
        />
      )}
    />
  );
}

export type ControlledCheckboxProps<TFieldValues extends FieldValues> = Omit<
  ComponentPropsWithoutRef<'input'>,
  'checked' | 'defaultChecked' | 'name' | 'onBlur' | 'onChange' | 'ref' | 'type'
> & {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
};

export function ControlledCheckbox<TFieldValues extends FieldValues>({
  className,
  control,
  name,
  ...props
}: ControlledCheckboxProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <input
          {...props}
          checked={Boolean(field.value)}
          className={cn('size-4 cursor-pointer accent-[rgb(var(--tabliodb-primary))]', className)}
          name={field.name}
          onBlur={field.onBlur}
          onChange={(event) => field.onChange(event.currentTarget.checked)}
          type="checkbox"
        />
      )}
    />
  );
}

export type ControlledSelectProps<TFieldValues extends FieldValues> = Omit<
  ComponentPropsWithoutRef<'select'>,
  'defaultValue' | 'name' | 'onBlur' | 'onChange' | 'ref' | 'value'
> & {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
};

export function ControlledSelect<TFieldValues extends FieldValues>({
  control,
  name,
  ...props
}: ControlledSelectProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <select
          {...props}
          name={field.name}
          onBlur={field.onBlur}
          onChange={(event) => field.onChange(event.currentTarget.value)}
          value={field.value ?? ''}
        />
      )}
    />
  );
}

export type ControlledTextareaProps<TFieldValues extends FieldValues> = Omit<
  ComponentPropsWithoutRef<'textarea'>,
  'defaultValue' | 'name' | 'onBlur' | 'onChange' | 'ref' | 'value'
> & {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
};

export function ControlledTextarea<TFieldValues extends FieldValues>({
  control,
  name,
  ...props
}: ControlledTextareaProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <textarea
          {...props}
          name={field.name}
          onBlur={field.onBlur}
          onChange={(event) => field.onChange(event.currentTarget.value)}
          value={field.value ?? ''}
        />
      )}
    />
  );
}

function readInputValue<TFieldValues extends FieldValues>(
  input: HTMLInputElement,
  type: InputProps['type'],
): PathValue<TFieldValues, FieldPath<TFieldValues>> | number | string | undefined {
  if (type === 'number') {
    return input.value === '' ? undefined : input.valueAsNumber;
  }

  return input.value;
}
