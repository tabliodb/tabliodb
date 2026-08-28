import {
  diagramReviewRuleDefinitions,
  diagramReviewSignalCodes,
  type DiagramReviewSignal,
  type DiagramReviewSignalCode,
} from '@tabliodb/schema-core';
import type { ReviewSignalSettingsDto } from '@tabliodb/sdk';
import { Badge, Checkbox, cn } from '@tabliodb/ui';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { z } from 'zod';
import { sdkDisabledRuleKeyByValue, toDiagramReviewSignalCode } from './diagram-sdk-mappers';

export const reviewSignalSettingsFormSchema = z.object({
  disabledRuleKeys: z.array(z.enum(diagramReviewSignalCodes)),
});

export type ReviewSignalSettingsFormState = z.infer<typeof reviewSignalSettingsFormSchema>;

export function ReviewSignalSettingsFields<
  TFieldValues extends FieldValues & { disabledRuleKeys: DiagramReviewSignalCode[] },
>({
  control,
  disabled,
}: {
  control: Control<TFieldValues>;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-2">
      {diagramReviewRuleDefinitions.map((rule) => (
        <Controller
          control={control}
          key={rule.code}
          name={'disabledRuleKeys' as Path<TFieldValues>}
          render={({ field }) => {
            const disabledRuleKeys = Array.isArray(field.value) ? (field.value as DiagramReviewSignalCode[]) : [];
            const isDisabledByCurrentScope = disabledRuleKeys.includes(rule.code);
            const isEnabled = !isDisabledByCurrentScope;

            return (
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-(--tabliodb-radius-md) border-2 bg-white p-3 transition',
                  isEnabled
                    ? 'border-[rgb(var(--tabliodb-border))] hover:bg-[rgb(var(--tabliodb-surface-raised))]'
                    : 'border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))]',
                  disabled && 'cursor-not-allowed opacity-75',
                )}
              >
                <Checkbox
                  checked={isEnabled}
                  disabled={disabled}
                  onCheckedChange={(checked) => {
                    const nextRuleKeys = new Set(disabledRuleKeys);

                    // Backend menyimpan disabledRuleKeys, tetapi UI memakai mental model umum: checked berarti rule aktif, unchecked berarti rule dimatikan.
                    if (checked === true) {
                      nextRuleKeys.delete(rule.code);
                    } else {
                      nextRuleKeys.add(rule.code);
                    }

                    field.onChange(Array.from(nextRuleKeys));
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-extrabold text-[rgb(var(--tabliodb-ink))]">{rule.title}</span>
                    <Badge
                      variant={
                        isDisabledByCurrentScope ? 'neutral' : getReviewRuleBadgeVariant(rule.severity)
                      }
                    >
                      {isDisabledByCurrentScope ? 'Off' : rule.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                    {rule.description}
                  </p>
                </div>
              </label>
            );
          }}
        />
      ))}
    </div>
  );
}

export function getReviewSignalSettingsDefaults(settings?: ReviewSignalSettingsDto): ReviewSignalSettingsFormState {
  return {
    disabledRuleKeys: settings?.disabledRuleKeys?.map(toDiagramReviewSignalCode) ?? [],
  };
}

export function toReviewSignalSettingsDto(values: ReviewSignalSettingsFormState): ReviewSignalSettingsDto {
  return {
    // Normalisasi Set menjaga payload deterministik meskipun form state berubah dari script atau update realtime di masa depan.
    disabledRuleKeys: Array.from(new Set(values.disabledRuleKeys)).map((ruleKey) => sdkDisabledRuleKeyByValue[ruleKey]),
  };
}

function getReviewRuleBadgeVariant(severity: DiagramReviewSignal['severity']): 'blue' | 'green' | 'neutral' | 'yellow' {
  if (severity === 'error') {
    return 'blue';
  }

  if (severity === 'warning') {
    return 'yellow';
  }

  return 'neutral';
}
