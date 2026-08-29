import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import type { AdminWorkspaceDtoOutput } from '@tabliodb/sdk';
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
  Input,
  Surface,
  cn,
} from '@tabliodb/ui';
import { Building2, Database, FolderKanban, Loader2, Plus, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { routes } from '@/app/routes';
import { ControlledInput } from '@/features/app/FormControls';
import { EmptyState, InlineErrorState, InlineLoadingState } from '@/features/app/RouteStates';
import {
  organizationsQueries,
  useCreateOrganizationMutation,
  type AdminWorkspaceListQuery,
} from '@/resources/organizations';

const workspacePageSize = 20;

const createWorkspaceFormSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required.').max(80, 'Keep the workspace name under 80 characters.'),
});

type CreateWorkspaceFormState = z.infer<typeof createWorkspaceFormSchema>;

const createWorkspaceDefaults: CreateWorkspaceFormState = {
  name: '',
};

export function AdminWorkspacesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [pageCursor, setPageCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);
  const workspaceListQuery = useMemo<AdminWorkspaceListQuery>(
    () => ({
      cursor: pageCursor,
      limit: workspacePageSize,
      search: searchTerm.trim() || undefined,
    }),
    [pageCursor, searchTerm],
  );
  const workspacesQuery = useQuery(organizationsQueries.adminWorkspaces(workspaceListQuery));
  const workspaces = workspacesQuery.data?.items ?? [];
  const totalCount = workspacesQuery.data?.totalCount ?? 0;
  const nextCursor = workspacesQuery.data?.nextCursor ?? null;
  const stats = useMemo(() => getWorkspaceStats(workspaces), [workspaces]);

  function resetPagination() {
    // Search mengubah dataset server, jadi cursor lama tidak boleh dipakai ke hasil query baru.
    setPageCursor(undefined);
    setCursorHistory([]);
  }

  return (
    <div className="mx-auto grid min-w-0 w-full max-w-7xl gap-5 px-4 py-4 sm:px-5 sm:py-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-normal text-[rgb(var(--tabliodb-ink))]">Workspaces</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
            Review every active workspace in this self-hosted instance. Opening a workspace still follows normal
            workspace membership rules.
          </p>
        </div>
        <CreateWorkspaceDialog />
      </section>

      <section className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <WorkspaceStatCard icon={Building2} label="Matching workspaces" value={totalCount} />
        <WorkspaceStatCard icon={UsersRound} label="Members on page" tone="green" value={stats.memberCount} />
        <WorkspaceStatCard icon={Database} label="Diagrams on page" tone="blue" value={stats.diagramCount} />
        <WorkspaceStatCard icon={FolderKanban} label="Folders on page" tone="yellow" value={stats.folderCount} />
      </section>

      <Surface className="min-w-0 overflow-hidden" depth="md">
        <div className="flex flex-col gap-3 border-b-2 border-[rgb(var(--tabliodb-border))] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--tabliodb-ink-subtle))]" />
            <Input
              className="pl-9"
              onChange={(event) => {
                setSearchTerm(event.target.value);
                resetPagination();
              }}
              placeholder="Search workspaces"
              value={searchTerm}
            />
          </div>
          <p className="text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
            Sorted by latest workspace activity
          </p>
        </div>

        {workspacesQuery.isPending ? (
          <InlineLoadingState className="m-4" message="Loading workspaces" />
        ) : workspacesQuery.error ? (
          <InlineErrorState
            className="m-4"
            error={workspacesQuery.error}
            onRetry={() => void workspacesQuery.refetch()}
            title="Could not load workspaces"
          />
        ) : workspaces.length === 0 ? (
          <EmptyState
            description={
              searchTerm.trim()
                ? 'Try another workspace name or clear the search.'
                : 'Create the first workspace so teams can start organizing diagrams.'
            }
            icon={Building2}
            title="No workspaces found"
          />
        ) : (
          <div className="divide-y divide-[rgb(var(--tabliodb-border))]">
            {workspaces.map((workspace) => (
              <WorkspaceRow key={workspace.id} workspace={workspace} />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t-2 border-[rgb(var(--tabliodb-border))] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
            Showing {workspaces.length} of {totalCount} matching workspaces
          </p>
          <div className="flex gap-2">
            <Button
              disabled={cursorHistory.length === 0 || workspacesQuery.isFetching}
              onClick={() => {
                const previousCursor = cursorHistory[cursorHistory.length - 1];
                setCursorHistory((history) => history.slice(0, -1));
                setPageCursor(previousCursor);
              }}
              size="sm"
              variant="secondary"
            >
              Previous
            </Button>
            <Button
              disabled={!nextCursor || workspacesQuery.isFetching}
              onClick={() => {
                setCursorHistory((history) => [...history, pageCursor]);
                setPageCursor(nextCursor ?? undefined);
              }}
              size="sm"
            >
              Next
            </Button>
          </div>
        </div>
      </Surface>
    </div>
  );
}

function CreateWorkspaceDialog() {
  const [open, setOpen] = useState(false);
  const form = useForm<CreateWorkspaceFormState>({
    defaultValues: createWorkspaceDefaults,
    mode: 'onBlur',
    resolver: zodResolver(createWorkspaceFormSchema),
  });
  const { errors } = form.formState;
  const createWorkspaceMutation = useCreateOrganizationMutation({
    mutationConfig: {
      onSuccess: () => {
        // Workspace baru dibuat sebagai milik actor, lalu cache admin workspace di-refresh oleh resource mutation.
        form.reset(createWorkspaceDefaults);
        setOpen(false);
      },
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen && !createWorkspaceMutation.isPending) {
      form.reset(createWorkspaceDefaults);
      createWorkspaceMutation.reset();
    }
  }

  function handleSubmit(values: CreateWorkspaceFormState) {
    createWorkspaceMutation.mutate({ name: values.name });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button className="gap-2 self-start lg:self-auto">
          <Plus className="size-4" />
          Workspace
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(94vw,480px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
            <DialogDescription>
              Workspaces group people. Diagrams can live directly in a workspace or inside optional folders.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Workspace name
              </span>
              <ControlledInput
                aria-invalid={Boolean(errors.name)}
                autoComplete="off"
                control={form.control}
                disabled={createWorkspaceMutation.isPending}
                name="name"
              />
              <FieldError>{errors.name?.message}</FieldError>
            </label>

            {createWorkspaceMutation.error ? (
              <InlineErrorState
                className="mt-4"
                error={createWorkspaceMutation.error}
                title="Could not create workspace"
              />
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button
              disabled={createWorkspaceMutation.isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={createWorkspaceMutation.isPending} type="submit">
              {createWorkspaceMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceRow({ workspace }: { workspace: AdminWorkspaceDtoOutput }) {
  const canOpenWorkspace = Boolean(workspace.currentUserRole);

  return (
    <article className="grid min-w-0 gap-4 p-4 transition hover:bg-[rgb(var(--tabliodb-surface))] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] text-[rgb(var(--tabliodb-primary-text))]">
          <Building2 className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-extrabold">{workspace.name}</h3>
            <WorkspaceAccessPill workspace={workspace} />
          </div>
          <p className="mt-0.5 truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
            {workspace.slug} · updated {formatDateTime(workspace.updatedAt)}
          </p>
          <div className="mt-3 grid gap-2 text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))] sm:grid-cols-2 xl:grid-cols-4">
            <WorkspaceMetric icon={UsersRound} label={`${workspace.memberCount} members`} />
            <WorkspaceMetric icon={ShieldCheck} label={`${workspace.ownerCount} owners`} />
            <WorkspaceMetric icon={Database} label={`${workspace.diagramCount} diagrams`} />
            <WorkspaceMetric icon={FolderKanban} label={`${workspace.folderCount} folders`} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        {canOpenWorkspace ? (
          <Button asChild size="sm" variant="secondary">
            <Link to={routes.workspace.to({ workspaceSlug: workspace.slug })}>Open workspace</Link>
          </Button>
        ) : (
          <span className="inline-flex h-[var(--tabliodb-control-sm)] items-center rounded-[var(--tabliodb-radius-sm)] border border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] px-3 text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
            Instance view only
          </span>
        )}
      </div>
    </article>
  );
}

function WorkspaceAccessPill({ workspace }: { workspace: AdminWorkspaceDtoOutput }) {
  if (!workspace.currentUserRole) {
    return <Badge variant="neutral">No workspace membership</Badge>;
  }

  return <Badge variant="green">{formatWorkspaceRole(workspace.currentUserRole)}</Badge>;
}

function WorkspaceMetric({ icon: Icon, label }: { icon: typeof UsersRound; label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon className="size-3.5 shrink-0 text-[rgb(var(--tabliodb-ink-subtle))]" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function WorkspaceStatCard({
  icon: Icon,
  label,
  tone = 'neutral',
  value,
}: {
  icon: typeof Building2;
  label: string;
  tone?: 'blue' | 'green' | 'neutral' | 'yellow';
  value: number;
}) {
  return (
    <Surface className={cn('grid gap-3 p-4', getStatToneClassName(tone))} depth="sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-extrabold uppercase tracking-wide opacity-75">{label}</span>
        <Icon className="size-4 opacity-75" />
      </div>
      <div className="truncate text-2xl font-extrabold">{formatNumber(value)}</div>
    </Surface>
  );
}

function getWorkspaceStats(workspaces: AdminWorkspaceDtoOutput[]) {
  return workspaces.reduce(
    (stats, workspace) => ({
      diagramCount: stats.diagramCount + workspace.diagramCount,
      folderCount: stats.folderCount + workspace.folderCount,
      memberCount: stats.memberCount + workspace.memberCount,
    }),
    { diagramCount: 0, folderCount: 0, memberCount: 0 },
  );
}

function getStatToneClassName(tone: 'blue' | 'green' | 'neutral' | 'yellow'): string {
  return {
    blue: 'border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] text-[rgb(var(--tabliodb-sky-text))]',
    green:
      'border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-selected-surface))] text-[rgb(var(--tabliodb-primary-text))]',
    neutral: 'border-[rgb(var(--tabliodb-border))] bg-white text-[rgb(var(--tabliodb-ink))]',
    yellow:
      'border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] text-[rgb(var(--tabliodb-gold-text))]',
  }[tone];
}

function formatWorkspaceRole(role: AdminWorkspaceDtoOutput['currentUserRole']): string {
  return {
    admin: 'Workspace admin',
    guest: 'Workspace guest',
    member: 'Workspace member',
    owner: 'Workspace owner',
  }[role ?? 'guest'];
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}
