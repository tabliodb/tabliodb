import { useQuery } from '@tanstack/react-query';
import LOGO from '@/assets/logo.svg';
import { Badge, Button, Surface } from '@tabliodb/ui';
import { Database, Eye, LocateFixed } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { ErrorState, LoadingState } from '@/features/app/RouteStates';
import { SchemaCanvas } from '@/features/editor/components/SchemaCanvas';
import { shareLinkQueries } from '@/resources/share-links';

export function PublicSharePage() {
  const { token = '' } = useParams();
  const [fitSignal, setFitSignal] = useState(0);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const shareQuery = useQuery(shareLinkQueries.publicByToken(token));

  if (shareQuery.isPending) {
    return <LoadingState message="Loading shared diagram" />;
  }

  if (shareQuery.error) {
    return (
      <ErrorState
        error={shareQuery.error}
        onRetry={() => void shareQuery.refetch()}
        title="Could not open shared diagram"
      />
    );
  }

  const share = shareQuery.data;

  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-[rgb(var(--tabliodb-canvas))] text-[rgb(var(--tabliodb-ink))]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface))] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-[rgb(var(--tabliodb-primary-soft))]">
            <img alt="" className="size-6" src={LOGO} />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-base font-black">{share.diagram.name}</h1>
              <Badge variant="green">Read-only</Badge>
              {share.snapshot ? <Badge variant="blue">Saved v{share.snapshot.version}</Badge> : null}
            </div>
            <p className="truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">
              {share.diagram.folderName ?? share.diagram.organizationName} / {share.diagram.dialect}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Surface className="hidden items-center gap-2 px-3 py-2 text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))] sm:flex">
            <Eye className="size-4 text-[rgb(var(--tabliodb-sky-text))]" />
            Public share
          </Surface>
          <Button
            className="gap-2"
            onClick={() => setFitSignal((value) => value + 1)}
            type="button"
            variant="secondary"
          >
            <LocateFixed className="size-4" />
            Fit
          </Button>
        </div>
      </header>

      <section className="relative min-h-0 flex-1">
        <SchemaCanvas
          fitKey={`public-share:${token}`}
          fitSignal={fitSignal}
          floatingInsetLeft={16}
          floatingInsetRight={16}
          model={share.model}
          onColumnSelect={setSelectedColumnId}
          onModelChange={() => {
            // Public share route is intentionally read-only; SchemaCanvas still requires the callback for one reusable API.
          }}
          onSelectedTableChange={setSelectedTableId}
          readOnly
          selectedColumnId={selectedColumnId}
          selectedTableId={selectedTableId}
          toolbar={
            <Surface className="flex items-center gap-2 px-3 py-2 text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
              <Database className="size-4 text-[rgb(var(--tabliodb-primary-text))]" />
              {share.diagram.organizationName}
            </Surface>
          }
        />
      </section>
    </main>
  );
}
