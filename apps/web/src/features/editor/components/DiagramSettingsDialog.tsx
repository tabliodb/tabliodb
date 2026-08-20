import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { diagramReviewSignalCodes, type DiagramModel } from '@tabliodb/schema-core';
import type { DiagramResponseDtoOutput, ReviewSignalEffectiveSettingsDtoOutput } from '@tabliodb/sdk';
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FieldError,
  IconButton,
} from '@tabliodb/ui';
import { Loader2, Save, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ControlledInput, ControlledSelect } from '@/features/app/FormControls';
import { getErrorMessage } from '@/features/app/RouteStates';
import { useUpdateDiagramMutation } from '@/resources/diagrams';
import { reviewSignalQueries, useUpdateDiagramReviewSignalSettingsMutation } from '@/resources/review-signals';
import {
  diagramDialectOptions,
  sdkDialectByValue,
  toDatabaseDialect,
  toDiagramReviewSignalCode,
} from '../diagram-sdk-mappers';
import { selectClassName } from '../editor-form-styles';
import { formatDiagramDialect } from '../diagram-formatters';
import { ReviewSignalSettingsFields, toReviewSignalSettingsDto } from '../review-signal-settings';
import { getDialectSelectOption } from './DialectIcon';

type DiagramResponseDto = DiagramResponseDtoOutput;
type ReviewSignalEffectiveSettingsDto = ReviewSignalEffectiveSettingsDtoOutput;

const diagramSettingsFormSchema = z.object({
  dialect: z.enum(diagramDialectOptions),
  disabledRuleKeys: z.array(z.enum(diagramReviewSignalCodes)),
  name: z.string().trim().min(1, 'Diagram name is required.').max(80, 'Keep the name under 80 characters.'),
});

type DiagramSettingsFormState = z.infer<typeof diagramSettingsFormSchema>;

export function DiagramSettingsDialog({
  canEdit,
  diagram,
  model,
  onUpdated,
  trigger,
}: {
  canEdit: boolean;
  diagram: DiagramResponseDto;
  model: DiagramModel;
  onUpdated: (diagram: DiagramResponseDto) => void;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<DiagramSettingsFormState>({
    defaultValues: getDiagramSettingsDefaults(diagram),
    mode: 'onBlur',
    resolver: zodResolver(diagramSettingsFormSchema),
  });
  const { errors } = form.formState;
  const diagramReviewSettingsQueryOptions = reviewSignalQueries.diagramSettings(diagram.id);
  const diagramReviewSettingsQuery = useQuery({
    ...diagramReviewSettingsQueryOptions,
    // Dialog settings menjadi fetch boundary; rule override baru dimuat ketika user benar-benar membuka modal.
    enabled: open && diagramReviewSettingsQueryOptions.enabled !== false,
  });
  const updateDiagramMutation = useUpdateDiagramMutation();
  const updateDiagramReviewSettingsMutation = useUpdateDiagramReviewSignalSettingsMutation();
  const isPending = updateDiagramMutation.isPending || updateDiagramReviewSettingsMutation.isPending;
  const hasUnsavedDialectChange = model.dialect !== diagram.dialect;

  useEffect(() => {
    if (open) {
      form.reset(getDiagramSettingsDefaults(diagram, diagramReviewSettingsQuery.data));
      updateDiagramMutation.reset();
      updateDiagramReviewSettingsMutation.reset();
    }
  }, [diagram, diagramReviewSettingsQuery.data, form, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isPending) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getDiagramSettingsDefaults(diagram, diagramReviewSettingsQuery.data));
      updateDiagramMutation.reset();
      updateDiagramReviewSettingsMutation.reset();
    }
  }

  async function handleSubmit(values: DiagramSettingsFormState) {
    if (!canEdit) {
      return;
    }

    const updatedDiagram = await updateDiagramMutation.mutateAsync({
      body: {
        dialect: sdkDialectByValue[values.dialect],
        name: values.name,
      },
      diagramId: diagram.id,
    });
    const updatedReviewSettings = await updateDiagramReviewSettingsMutation.mutateAsync({
      diagramId: diagram.id,
      settings: toReviewSignalSettingsDto(values),
    });

    // Rename/dialect dan review override adalah satu intent UI, jadi reset form memakai hasil kedua endpoint sekaligus.
    form.reset(getDiagramSettingsDefaults(updatedDiagram, updatedReviewSettings));
    onUpdated(updatedDiagram);
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        {trigger ?? <IconButton icon={SlidersHorizontal} label="Diagram settings" variant="ghost" />}
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,520px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Diagram settings</DialogTitle>
            <DialogDescription>
              Rename the active diagram and choose the SQL dialect for generated output.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="grid gap-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Diagram name
                </span>
                <ControlledInput
                  autoFocus
                  aria-invalid={Boolean(errors.name)}
                  control={form.control}
                  disabled={isPending || !canEdit}
                  name="name"
                />
                <FieldError>{errors.name?.message}</FieldError>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  SQL dialect
                </span>
                <ControlledSelect
                  className={selectClassName}
                  control={form.control}
                  disabled={isPending || !canEdit}
                  name="dialect"
                  options={diagramDialectOptions.map(getDialectSelectOption)}
                />
                <FieldError>{errors.dialect?.message}</FieldError>
              </label>

              <section className="rounded-(--tabliodb-radius-lg) border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] p-3">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold">Review rule overrides</h3>
                    <p className="mt-1 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                      Disable extra rules for this diagram only.
                    </p>
                  </div>
                  <Badge variant="blue">{diagramReviewSettingsQuery.isPending ? 'Loading' : 'Diagram'}</Badge>
                </div>
                <ReviewSignalSettingsFields
                  control={form.control}
                  disabled={isPending || diagramReviewSettingsQuery.isFetching || !canEdit}
                  inheritedDisabledRuleKeys={diagramReviewSettingsQuery.data?.project.disabledRuleKeys}
                />
              </section>

              {!canEdit ? (
                <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-gold-text))]">
                  Your access role can view this diagram but cannot update diagram settings.
                </div>
              ) : null}

              {hasUnsavedDialectChange ? (
                <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-sky-text))]">
                  The open snapshot uses {formatDiagramDialect(model.dialect)} while the diagram record uses{' '}
                  {formatDiagramDialect(diagram.dialect)}.
                </div>
              ) : null}

              {updateDiagramMutation.error || updateDiagramReviewSettingsMutation.error ? (
                <div className="rounded-[14px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(updateDiagramMutation.error ?? updateDiagramReviewSettingsMutation.error)}
                </div>
              ) : null}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button disabled={isPending} onClick={() => handleOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button disabled={isPending || !canEdit} type="submit">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save diagram
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getDiagramSettingsDefaults(
  diagram: DiagramResponseDto,
  reviewSettings?: ReviewSignalEffectiveSettingsDto,
): DiagramSettingsFormState {
  return {
    dialect: toDatabaseDialect(diagram.dialect),
    disabledRuleKeys: reviewSettings?.diagram.disabledRuleKeys.map(toDiagramReviewSignalCode) ?? [],
    name: diagram.name,
  };
}
