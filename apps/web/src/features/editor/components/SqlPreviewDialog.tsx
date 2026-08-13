import type { DatabaseDialect } from '@tabliodb/schema-core';
import type { SqlGenerationWarning } from '@tabliodb/sql';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tabliodb/ui';
import { Code2, Copy, Download, FileWarning } from 'lucide-react';
import { formatDiagramDialect } from '../diagram-formatters';

export function SqlPreviewDialog({
  copied,
  dialect,
  onCopy,
  onDownload,
  onOpenChange,
  open,
  sql,
  warnings,
}: {
  copied: boolean;
  dialect: DatabaseDialect;
  onCopy: () => void;
  onDownload: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  sql: string;
  warnings: SqlGenerationWarning[];
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="w-[min(94vw,920px)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="size-5 text-[rgb(var(--tabliodb-sky-text))]" />
            SQL preview
          </DialogTitle>
          <DialogDescription>
            Review generated {formatDiagramDialect(dialect)} schema SQL before copying it into your database workflow.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-4">
          {warnings.length > 0 ? (
            <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-4 text-[13px] font-bold text-[rgb(var(--tabliodb-gold-text))]">
              <div className="mb-2 flex items-center gap-2 text-[14px] font-extrabold text-[rgb(var(--tabliodb-ink))]">
                <FileWarning className="size-4 text-[rgb(var(--tabliodb-gold-text))]" />
                Dialect warnings
              </div>
              <ul className="grid gap-1.5">
                {warnings.map((warning) => (
                  <li className="leading-5" key={warning.message}>
                    {warning.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] p-4 text-[13px] font-bold text-[rgb(var(--tabliodb-primary-text))]">
              SQL is ready for {formatDiagramDialect(dialect)} with no compatibility warnings.
            </section>
          )}

          <pre className="tabliodb-scrollbar max-h-[52dvh] overflow-auto rounded-[18px] border-2 border-[rgb(var(--tabliodb-ink))] bg-[rgb(var(--tabliodb-ink))] p-4 text-[12px] font-semibold leading-5 text-white shadow-[0_4px_0_rgb(var(--tabliodb-border-strong))]">
            <code>{sql}</code>
          </pre>
        </DialogBody>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
            Close
          </Button>
          <Button onClick={onDownload} type="button" variant="secondary">
            <Download className="size-4" />
            Download .sql
          </Button>
          <Button onClick={onCopy} type="button" variant="sky">
            <Copy className="size-4" />
            {copied ? 'Copied' : 'Copy SQL'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
