import { zodResolver } from '@hookform/resolvers/zod';
import {
  DiagramCommandError,
  getDiagramModelIntegrityWarnings,
  repairDiagramModel,
  type DatabaseDialect,
  type DiagramModel,
  type DiagramModelIntegrityWarning,
} from '@tabliodb/schema-core';
import { parseCreateSchemaSql, type SqlImportWarning } from '@tabliodb/sql';
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
  FieldError,
} from '@tabliodb/ui';
import { Code2, FileJson, FileText, FileUp, FileWarning, Loader2 } from 'lucide-react';
import { useMemo, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ControlledSelect, ControlledTextarea } from '@/features/app/FormControls';
import { getErrorMessage } from '@/features/app/RouteStates';
import { DialectBadge, getDialectSelectOption } from './DialectIcon';

export type EditorImportSource = 'tabliodb_json' | 'sql';

export type EditorImportRequest = {
  content: string;
  dialect?: DatabaseDialect;
  source: EditorImportSource;
};

const importJsonFormSchema = z.object({
  json: z.string().trim().min(1, 'Paste exported Tabliodb JSON or upload a .json file.'),
});

type ImportJsonFormState = z.infer<typeof importJsonFormSchema>;

const diagramDialectOptions = [
  'postgresql',
  'mysql',
  'mariadb',
  'sqlite',
  'sqlserver',
] as const satisfies readonly DatabaseDialect[];

const importSqlFormSchema = z.object({
  dialect: z.enum(diagramDialectOptions),
  sql: z.string().trim().min(1, 'Paste SQL DDL or upload a .sql file.'),
});

type ImportSqlFormState = z.infer<typeof importSqlFormSchema>;

const selectClassName =
  'h-[var(--tabliodb-control-md)] w-full cursor-pointer rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 text-[13px] font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-[3px] focus:ring-[rgb(var(--tabliodb-focus-ring))] disabled:cursor-not-allowed disabled:opacity-50';

type ImportJsonDraftPreview =
  | {
      status: 'empty';
      warnings: [];
    }
  | {
      error: string;
      status: 'invalid';
      warnings: [];
    }
  | {
      model: DiagramModel;
      status: 'valid';
      warnings: DiagramModelIntegrityWarning[];
    };

type ImportSqlDraftPreview =
  | {
      status: 'empty';
      warnings: [];
    }
  | {
      error: string;
      status: 'invalid';
      warnings: [];
    }
  | {
      model: DiagramModel;
      status: 'valid';
      warnings: Array<DiagramModelIntegrityWarning | SqlImportWarning>;
    };

export function ImportJsonDialog({
  currentDiagramName,
  disabled,
  importError,
  isImporting,
  onImport,
  onOpenChange,
  open,
}: {
  currentDiagramName: string;
  disabled: boolean;
  importError: unknown;
  isImporting: boolean;
  onImport: (input: EditorImportRequest) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const form = useForm<ImportJsonFormState>({
    defaultValues: {
      json: '',
    },
    mode: 'onChange',
    resolver: zodResolver(importJsonFormSchema),
  });
  const { errors } = form.formState;
  const rawJson = form.watch('json');
  const preview = useMemo(() => parseImportJsonDraft(rawJson), [rawJson]);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && disabled) {
      return;
    }

    onOpenChange(nextOpen);

    if (!nextOpen) {
      form.reset({ json: '' });
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const inputElement = event.currentTarget;
    const file = inputElement.files?.[0];

    if (!file) {
      return;
    }

    const content = await file.text();

    // File upload hanya mengisi textarea; validasi dan preview tetap melalui jalur paste yang sama.
    form.setValue('json', content, { shouldDirty: true, shouldValidate: true });
    // React clears currentTarget after the async boundary, so the DOM input is captured before awaiting file.text().
    inputElement.value = '';
  }

  async function handleSubmit() {
    if (preview.status !== 'valid') {
      form.setError('json', {
        message: preview.status === 'invalid' ? preview.error : 'Paste exported Tabliodb JSON or upload a .json file.',
        type: 'manual',
      });
      return;
    }

    try {
      // Server menerima konten mentah agar jalur UI identik dengan jalur SDK/API untuk import file JSON.
      await onImport({
        content: rawJson,
        source: 'tabliodb_json',
      });
      handleOpenChange(false);
    } catch {
      // Error mutation ditampilkan dari prop importError, jadi catch ini hanya menjaga dialog tetap terbuka untuk koreksi user.
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="w-[min(94vw,820px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="size-5 text-[rgb(var(--tabliodb-primary-text))]" />
              Import Tabliodb JSON
            </DialogTitle>
            <DialogDescription>
              Replace the current draft for {currentDiagramName}. Create a snapshot after import when the result looks
              right.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="grid gap-4">
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] px-4 py-5 text-center text-[13px] font-extrabold text-[rgb(var(--tabliodb-primary-text))] transition hover:bg-[rgb(var(--tabliodb-primary-soft-hover))]">
              <FileJson className="size-6" />
              Upload exported .tabliodb.json
              <span className="text-[12px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                or paste the file contents below
              </span>
              <input
                accept=".json,application/json"
                className="sr-only"
                disabled={disabled}
                onChange={handleFileChange}
                type="file"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                JSON
              </span>
              <ControlledTextarea
                aria-invalid={Boolean(errors.json) || preview.status === 'invalid'}
                className="tabliodb-scrollbar min-h-64 w-full resize-y rounded-[18px] border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 py-3 font-mono text-[12px] font-semibold leading-5 text-[rgb(var(--tabliodb-ink))] outline-none transition placeholder:font-sans placeholder:text-[rgb(var(--tabliodb-ink-subtle))] focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                control={form.control}
                disabled={disabled}
                name="json"
                placeholder='{"schemaVersion":1,"dialect":"postgresql","tables":{...}}'
              />
              <FieldError>{errors.json?.message}</FieldError>
            </label>

            <ImportJsonPreview preview={preview} />

            {importError ? (
              <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-4 text-[13px] font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(importError)}
              </section>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button disabled={disabled || isImporting || preview.status !== 'valid'} type="submit">
              {isImporting ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
              Apply import
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ImportSqlDialog({
  currentDiagramName,
  defaultDialect,
  disabled,
  importError,
  isImporting,
  onImport,
  onOpenChange,
  open,
}: {
  currentDiagramName: string;
  defaultDialect: DatabaseDialect;
  disabled: boolean;
  importError: unknown;
  isImporting: boolean;
  onImport: (input: EditorImportRequest) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const form = useForm<ImportSqlFormState>({
    defaultValues: {
      dialect: defaultDialect,
      sql: '',
    },
    mode: 'onChange',
    resolver: zodResolver(importSqlFormSchema),
  });
  const { errors } = form.formState;
  const rawSql = form.watch('sql');
  const dialect = form.watch('dialect');
  const preview = useMemo(
    () => parseImportSqlDraft(rawSql, dialect, currentDiagramName),
    [currentDiagramName, dialect, rawSql],
  );

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && disabled) {
      return;
    }

    onOpenChange(nextOpen);

    if (nextOpen) {
      form.reset({ dialect: defaultDialect, sql: '' });
    }

    if (!nextOpen) {
      form.reset({ dialect: defaultDialect, sql: '' });
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const inputElement = event.currentTarget;
    const file = inputElement.files?.[0];

    if (!file) {
      return;
    }

    const content = await file.text();

    // Upload .sql hanya mengisi textarea supaya paste dan file tetap memakai validator serta preview yang sama.
    form.setValue('sql', content, { shouldDirty: true, shouldValidate: true });
    // React clears currentTarget after the async boundary, so the DOM input is captured before awaiting file.text().
    inputElement.value = '';
  }

  async function handleSubmit() {
    if (preview.status !== 'valid') {
      form.setError('sql', {
        message: preview.status === 'invalid' ? preview.error : 'Paste SQL DDL or upload a .sql file.',
        type: 'manual',
      });
      return;
    }

    try {
      // Dialect ikut dikirim supaya parser backend tidak menebak-nebak sintaks DDL yang ditempel user.
      await onImport({
        content: rawSql,
        dialect,
        source: 'sql',
      });
      handleOpenChange(false);
    } catch {
      // Error mutation ditampilkan di bawah preview dan dialog tetap terbuka agar user bisa memperbaiki SQL.
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="w-[min(94vw,860px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="size-5 text-[rgb(var(--tabliodb-sky-text))]" />
              Import SQL DDL
            </DialogTitle>
            <DialogDescription>
              Parse CREATE statements into an editable draft for {currentDiagramName}. Snapshot after reviewing the
              imported diagram.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
              <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] px-4 py-5 text-center text-[13px] font-extrabold text-[rgb(var(--tabliodb-sky-text))] transition hover:bg-[rgb(var(--tabliodb-sky-soft-hover))]">
                <FileText className="size-6" />
                Upload .sql DDL
                <span className="text-[12px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
                  or paste CREATE statements below
                </span>
                <input
                  accept=".sql,.txt,text/plain,application/sql"
                  className="sr-only"
                  disabled={disabled}
                  onChange={handleFileChange}
                  type="file"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Source dialect
                </span>
                <ControlledSelect
                  className={selectClassName}
                  control={form.control}
                  disabled={disabled}
                  name="dialect"
                  options={diagramDialectOptions.map(getDialectSelectOption)}
                />
                <FieldError>{errors.dialect?.message}</FieldError>
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                SQL DDL
              </span>
              <ControlledTextarea
                aria-invalid={Boolean(errors.sql) || preview.status === 'invalid'}
                className="tabliodb-scrollbar min-h-64 w-full resize-y rounded-[18px] border-2 border-[rgb(var(--tabliodb-border-strong))] bg-white px-3 py-3 font-mono text-[12px] font-semibold leading-5 text-[rgb(var(--tabliodb-ink))] outline-none transition placeholder:font-sans placeholder:text-[rgb(var(--tabliodb-ink-subtle))] focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                control={form.control}
                disabled={disabled}
                name="sql"
                placeholder={'CREATE TABLE users (\n  id UUID PRIMARY KEY,\n  email VARCHAR(190) NOT NULL UNIQUE\n);'}
              />
              <FieldError>{errors.sql?.message}</FieldError>
            </label>

            <ImportSqlPreview preview={preview} />

            {importError ? (
              <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-4 text-[13px] font-bold text-[rgb(var(--tabliodb-danger-text))]">
                {getErrorMessage(importError)}
              </section>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button disabled={disabled || isImporting || preview.status !== 'valid'} type="submit" variant="sky">
              {isImporting ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
              Apply SQL import
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportJsonPreview({ preview }: { preview: ImportJsonDraftPreview }) {
  if (preview.status === 'empty') {
    return (
      <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-4 text-[13px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
        Waiting for a Tabliodb JSON document.
      </section>
    );
  }

  if (preview.status === 'invalid') {
    return (
      <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-4 text-[13px] font-bold text-[rgb(var(--tabliodb-danger-text))]">
        {preview.error}
      </section>
    );
  }

  const model = preview.model;

  return (
    <section className="grid gap-3 rounded-[18px] border-2 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <DialectBadge dialect={model.dialect} />
        <Badge>{Object.keys(model.tables).length} tables</Badge>
        <Badge>{Object.keys(model.relationships).length} relationships</Badge>
        <Badge>{Object.keys(model.indexes).length} indexes</Badge>
        <Badge>{Object.keys(model.enums).length} enums</Badge>
      </div>
      <div>
        <div className="text-[14px] font-extrabold text-[rgb(var(--tabliodb-ink))]">{model.metadata.name}</div>
        <div className="text-[12px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
          This import will replace the current unsaved draft model.
        </div>
      </div>
      {preview.warnings.length > 0 ? (
        <div className="rounded-2xl border-2 border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 text-[12px] font-bold text-[rgb(var(--tabliodb-gold-text))]">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold text-[rgb(var(--tabliodb-ink))]">
            <FileWarning className="size-4 text-[rgb(var(--tabliodb-gold-text))]" />
            Import warnings
          </div>
          <ul className="grid gap-1">
            {preview.warnings.slice(0, 6).map((warning) => (
              <li key={`${warning.code}:${warning.target?.id ?? warning.message}`}>{warning.message}</li>
            ))}
          </ul>
          {preview.warnings.length > 6 ? (
            <div className="mt-2">+{preview.warnings.length - 6} more warnings</div>
          ) : null}
        </div>
      ) : (
        <div className="text-[13px] font-extrabold text-[rgb(var(--tabliodb-primary-text))]">
          JSON is valid and no unresolved references were found.
        </div>
      )}
    </section>
  );
}

function ImportSqlPreview({ preview }: { preview: ImportSqlDraftPreview }) {
  if (preview.status === 'empty') {
    return (
      <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))] p-4 text-[13px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
        Waiting for SQL DDL.
      </section>
    );
  }

  if (preview.status === 'invalid') {
    return (
      <section className="rounded-[18px] border-2 border-[rgb(var(--tabliodb-danger-border))] bg-[rgb(var(--tabliodb-danger-soft))] p-4 text-[13px] font-bold text-[rgb(var(--tabliodb-danger-text))]">
        {preview.error}
      </section>
    );
  }

  const model = preview.model;

  return (
    <section className="grid gap-3 rounded-[18px] border-2 border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <DialectBadge dialect={model.dialect} />
        <Badge>{Object.keys(model.tables).length} tables</Badge>
        <Badge>{Object.keys(model.relationships).length} relationships</Badge>
        <Badge>{Object.keys(model.indexes).length} indexes</Badge>
        <Badge>{Object.keys(model.enums).length} enums</Badge>
      </div>
      <div>
        <div className="text-[14px] font-extrabold text-[rgb(var(--tabliodb-ink))]">{model.metadata.name}</div>
        <div className="text-[12px] font-bold text-[rgb(var(--tabliodb-ink-muted))]">
          SQL import is intentionally conservative; unsupported statements are reported instead of silently pretending
          they were modeled.
        </div>
      </div>
      {preview.warnings.length > 0 ? (
        <div className="rounded-2xl border-2 border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 text-[12px] font-bold text-[rgb(var(--tabliodb-gold-text))]">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold text-[rgb(var(--tabliodb-ink))]">
            <FileWarning className="size-4 text-[rgb(var(--tabliodb-gold-text))]" />
            Import warnings
          </div>
          <ul className="grid gap-1">
            {preview.warnings.slice(0, 8).map((warning) => (
              <li key={`${warning.code}:${warning.message}`}>{warning.message}</li>
            ))}
          </ul>
          {preview.warnings.length > 8 ? (
            <div className="mt-2">+{preview.warnings.length - 8} more warnings</div>
          ) : null}
        </div>
      ) : (
        <div className="text-[13px] font-extrabold text-[rgb(var(--tabliodb-sky-text))]">
          SQL parsed into an editable diagram with no import warnings.
        </div>
      )}
    </section>
  );
}

function parseImportJsonDraft(value: string): ImportJsonDraftPreview {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return { status: 'empty', warnings: [] };
  }

  try {
    const parsedValue = JSON.parse(trimmedValue) as unknown;
    const model = repairDiagramModel(parsedValue);

    return {
      model,
      status: 'valid',
      warnings: getDiagramModelIntegrityWarnings(model),
    };
  } catch (error) {
    return {
      error: getImportJsonErrorMessage(error),
      status: 'invalid',
      warnings: [],
    };
  }
}

function getImportJsonErrorMessage(error: unknown): string {
  if (error instanceof SyntaxError) {
    return `JSON is not valid: ${error.message}`;
  }

  if (error instanceof z.ZodError) {
    const firstIssue = error.issues[0];

    return firstIssue
      ? `JSON does not match Tabliodb schema: ${firstIssue.message}`
      : 'JSON does not match Tabliodb schema.';
  }

  if (error instanceof DiagramCommandError) {
    return error.message;
  }

  return 'JSON could not be imported.';
}

function parseImportSqlDraft(value: string, dialect: DatabaseDialect, diagramName: string): ImportSqlDraftPreview {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return { status: 'empty', warnings: [] };
  }

  try {
    const result = parseCreateSchemaSql(trimmedValue, {
      dialect,
      diagramName: `${diagramName} import`,
    });
    const model = repairDiagramModel(result.model);

    return {
      model,
      status: 'valid',
      warnings: [...result.warnings, ...getDiagramModelIntegrityWarnings(model)],
    };
  } catch (error) {
    return {
      error: getImportSqlErrorMessage(error),
      status: 'invalid',
      warnings: [],
    };
  }
}

function getImportSqlErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    const firstIssue = error.issues[0];

    return firstIssue
      ? `SQL produced an invalid Tabliodb model: ${firstIssue.message}`
      : 'SQL produced an invalid Tabliodb model.';
  }

  if (error instanceof Error) {
    return `SQL could not be imported: ${error.message}`;
  }

  return 'SQL could not be imported.';
}
