import { zodResolver } from '@hookform/resolvers/zod';
import type { DiagramResponseDtoOutput, ProjectResponseDtoOutput } from '@tabliodb/sdk';
import {
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
} from '@tabliodb/ui';
import { FolderOpen, Loader2, MoveRight } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ControlledSelect } from '@/features/app/FormControls';
import { getErrorMessage } from '@/features/app/RouteStates';
import { useUpdateDiagramMutation } from '@/resources/diagrams';
import { selectClassName } from '../editor-form-styles';

type DiagramResponseDto = DiagramResponseDtoOutput;
type ProjectResponseDto = ProjectResponseDtoOutput;

const rootDiagramLocationValue = '__workspace_root__';

const moveDiagramFormSchema = z.object({
  projectId: z.string().min(1, 'Choose where this diagram should live.'),
});

type MoveDiagramFormState = z.infer<typeof moveDiagramFormSchema>;

export function MoveDiagramDialog({
  canMove,
  diagram,
  onMoved,
  onOpenChange,
  open,
  projects,
  trigger,
}: {
  canMove: boolean;
  diagram: DiagramResponseDto;
  onMoved: (diagram: DiagramResponseDto) => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  projects: ProjectResponseDto[];
  trigger?: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = open ?? internalOpen;
  const updateDiagramMutation = useUpdateDiagramMutation();
  const form = useForm<MoveDiagramFormState>({
    defaultValues: getMoveDiagramDefaults(diagram),
    mode: 'onBlur',
    resolver: zodResolver(moveDiagramFormSchema),
  });
  const diagramLocationOptions = useMemo(
    () => getDiagramLocationOptions(projects, diagram.projectId),
    [diagram.projectId, projects],
  );
  const selectedProjectId = form.watch('projectId');
  const currentLocationName = formatDiagramLocation(projects, diagram.projectId);
  const nextLocationName = formatDiagramLocation(
    projects,
    selectedProjectId === rootDiagramLocationValue ? null : selectedProjectId,
  );

  useEffect(() => {
    if (dialogOpen) {
      // Opening the dialog always mirrors the current server value so stale context-menu state cannot move the wrong diagram.
      form.reset(getMoveDiagramDefaults(diagram));
      updateDiagramMutation.reset();
    }
  }, [diagram, dialogOpen, form]);

  function setDialogOpen(nextOpen: boolean) {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && updateDiagramMutation.isPending) {
      return;
    }

    setDialogOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getMoveDiagramDefaults(diagram));
      updateDiagramMutation.reset();
    }
  }

  async function handleSubmit(values: MoveDiagramFormState) {
    if (!canMove) {
      return;
    }

    const projectId = values.projectId === rootDiagramLocationValue ? null : values.projectId;
    const updatedDiagram = await updateDiagramMutation.mutateAsync({
      body: {
        // projectId is the only field sent from this dialog, keeping move semantics separate from settings edits.
        projectId,
      },
      diagramId: diagram.id,
    });

    onMoved(updatedDiagram);
    form.reset(getMoveDiagramDefaults(updatedDiagram));
    setDialogOpen(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={dialogOpen}>
      {trigger !== null ? (
        <DialogTrigger asChild>{trigger ?? <Button variant="secondary">Move</Button>}</DialogTrigger>
      ) : null}
      <DialogContent className="w-[min(94vw,460px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Move diagram</DialogTitle>
            <DialogDescription>
              Choose whether {diagram.name} lives directly in the workspace or inside a folder.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="grid gap-4">
              <div className="rounded-[var(--tabliodb-radius-lg)] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[14px] bg-white text-[rgb(var(--tabliodb-primary-text))] shadow-[inset_0_0_0_1px_rgb(var(--tabliodb-border))]">
                    <FolderOpen className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{diagram.name}</p>
                    <p className="mt-0.5 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                      Current location: {currentLocationName}
                    </p>
                  </div>
                </div>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Destination
                </span>
                <ControlledSelect
                  className={selectClassName}
                  control={form.control}
                  disabled={updateDiagramMutation.isPending || !canMove}
                  name="projectId"
                  options={diagramLocationOptions}
                />
                <FieldError>{form.formState.errors.projectId?.message}</FieldError>
              </label>

              <div className="rounded-[14px] border border-[rgb(var(--tabliodb-border))] bg-white p-3 text-sm font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                Moving only changes the library location. Tables, notes, relationships, comments, and access rules stay
                attached to the same diagram.
              </div>

              {!canMove ? (
                <div className="rounded-[14px] border border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-gold-text))]">
                  Your access role can view this diagram but cannot move it.
                </div>
              ) : null}

              {updateDiagramMutation.error ? (
                <div className="rounded-[14px] border border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-3 text-sm font-bold text-[rgb(var(--tabliodb-danger-text))]">
                  {getErrorMessage(updateDiagramMutation.error)}
                </div>
              ) : null}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              disabled={updateDiagramMutation.isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={updateDiagramMutation.isPending || !canMove} type="submit">
              {updateDiagramMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MoveRight className="size-4" />
              )}
              Move to {nextLocationName}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getMoveDiagramDefaults(diagram: DiagramResponseDto): MoveDiagramFormState {
  return {
    projectId: diagram.projectId ?? rootDiagramLocationValue,
  };
}

function getDiagramLocationOptions(projects: ProjectResponseDto[], currentProjectId: string | null) {
  const options = [
    {
      label: 'No folder',
      textValue: 'No folder',
      value: rootDiagramLocationValue,
    },
    ...projects.map((project) => ({
      label: project.name,
      textValue: project.name,
      value: project.id,
    })),
  ];

  if (currentProjectId && !projects.some((project) => project.id === currentProjectId)) {
    // Direct diagram collaborators may not have folder-list access, but the select still needs a stable current value.
    options.push({
      label: 'Current folder',
      textValue: 'Current folder',
      value: currentProjectId,
    });
  }

  return options;
}

function formatDiagramLocation(projects: ProjectResponseDto[], projectId: string | null): string {
  if (!projectId) {
    return 'No folder';
  }

  return projects.find((project) => project.id === projectId)?.name ?? 'Current folder';
}
