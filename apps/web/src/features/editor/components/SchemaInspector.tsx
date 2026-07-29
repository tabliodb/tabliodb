import { zodResolver } from '@hookform/resolvers/zod';
import {
  applyDiagramCommand,
  applyDiagramCommands,
  getRelationshipColumnPairs,
  getTableColumns,
  type ColumnTypeFamily,
  type ColumnTypeSpec,
  type DatabaseTable,
  type DiagramModel,
} from '@tabliodb/schema-core';
import {
  Badge,
  Button,
  Dialog,
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
import { Plus, Save, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState, type InputHTMLAttributes } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { formatColumnType } from '../diagram-model';

const tableColorOptions = ['#58cc02', '#1cb0f6', '#ffc800', '#ff4b4b', '#8b5cf6', '#0f766e'] as const;

const editTableFormSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a valid hex color.'),
  name: z.string().trim().min(1, 'Table name is required.').max(64, 'Keep the table name under 64 characters.'),
  width: z.number().int().min(240, 'Minimum width is 240px.').max(720, 'Maximum width is 720px.'),
});

const columnTypeFamilyOptions = [
  'uuid',
  'varchar',
  'text',
  'integer',
  'bigint',
  'boolean',
  'timestamp',
  'date',
  'decimal',
  'json',
] as const satisfies readonly ColumnTypeFamily[];

const addColumnFormSchema = z.object({
  family: z.enum(columnTypeFamilyOptions),
  length: z.number().int().min(1).max(2048).optional(),
  name: z
    .string()
    .trim()
    .min(1, 'Column name is required.')
    .max(64, 'Keep the column name under 64 characters.')
    .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers, and underscores.'),
  nullable: z.boolean(),
  primaryKey: z.boolean(),
  unique: z.boolean(),
});

type EditTableFormState = z.infer<typeof editTableFormSchema>;
type AddColumnFormState = z.infer<typeof addColumnFormSchema>;

export type SchemaInspectorProps = {
  latestSnapshotVersion: number;
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
  selectedTableId: string | null;
};

export function SchemaInspector({
  latestSnapshotVersion,
  model,
  onModelChange,
  selectedTableId,
}: SchemaInspectorProps) {
  const selectedTable = selectedTableId ? model.tables[selectedTableId] : null;
  const selectedColumns = selectedTable ? getTableColumns(model, selectedTable.id) : [];
  const reviewSignals = useMemo(() => getReviewSignals(model), [model]);

  return (
    <aside className="border-l-2 border-[rgb(var(--tabliodb-border))] bg-white">
      <div className="flex h-16 items-center border-b-2 border-[rgb(var(--tabliodb-border))] px-5 text-sm font-extrabold">
        Inspector
      </div>
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant="green">{model.dialect}</Badge>
          <Badge variant="blue">v{latestSnapshotVersion}</Badge>
        </div>
        <section>
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Selected table
          </h2>
          {selectedTable ? (
            <Surface className="mt-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold">{selectedTable.name}</div>
                  <div className="mt-1 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                    {selectedColumns.length} columns / {selectedTable.indexIds.length} indexes /{' '}
                    {countTableRelationships(model, selectedTable)} relationships
                  </div>
                </div>
                <span
                  className="mt-1 size-4 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_2px_rgb(var(--tabliodb-border-strong))]"
                  style={{ backgroundColor: selectedTable.color ?? '#0f766e' }}
                />
              </div>
              <div className="mt-3 flex gap-2">
                <EditTableDialog model={model} onModelChange={onModelChange} table={selectedTable} />
                <AddColumnDialog model={model} onModelChange={onModelChange} table={selectedTable} />
              </div>
              <div className="mt-3 divide-y divide-[rgb(var(--tabliodb-border))]">
                {selectedColumns.map((column) => (
                  <div className="grid grid-cols-[1fr_auto] gap-2 py-2 text-xs" key={column.id}>
                    <div className="min-w-0">
                      <div className="truncate font-extrabold text-[rgb(var(--tabliodb-ink))]">{column.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {column.primaryKey ? <ColumnBadge>PK</ColumnBadge> : null}
                        {column.unique ? <ColumnBadge>UQ</ColumnBadge> : null}
                        {!column.nullable ? <ColumnBadge>NN</ColumnBadge> : null}
                      </div>
                    </div>
                    <span className="font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                      {formatColumnType(column.type)}
                    </span>
                  </div>
                ))}
              </div>
            </Surface>
          ) : (
            <Surface className="mt-2 border-dashed p-4 text-sm font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
              No table selected
            </Surface>
          )}
        </section>
        <section>
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Review signals
          </h2>
          <div className="mt-2 space-y-2 text-sm">
            {reviewSignals.map((signal) => (
              <Surface
                className="border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 font-bold text-[rgb(var(--tabliodb-gold-text))] shadow-[0_3px_0_rgb(var(--tabliodb-gold-border))]"
                key={signal}
              >
                {signal}
              </Surface>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function EditTableDialog({
  model,
  onModelChange,
  table,
}: {
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
  table: DatabaseTable;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<EditTableFormState>({
    defaultValues: getEditTableDefaults(table),
    resolver: zodResolver(editTableFormSchema),
  });
  const { errors } = form.formState;
  const selectedColor = form.watch('color');

  useEffect(() => {
    if (open) {
      form.reset(getEditTableDefaults(table));
    }
  }, [form, open, table]);

  function handleSubmit(values: EditTableFormState) {
    onModelChange(
      applyDiagramCommands(model, [
        { type: 'table.rename', tableId: table.id, name: values.name.trim() },
        { type: 'table.resize', tableId: table.id, width: values.width },
        { type: 'table.changeColor', tableId: table.id, color: values.color },
      ]),
    );
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <SlidersHorizontal className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit table</DialogTitle>
            <DialogDescription>Adjust the table identity and visual width.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Table name
              </span>
              <Input autoFocus aria-invalid={Boolean(errors.name)} {...form.register('name')} />
              <FieldError>{errors.name?.message}</FieldError>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Width
              </span>
              <Input
                aria-invalid={Boolean(errors.width)}
                min={240}
                max={720}
                type="number"
                {...form.register('width', { valueAsNumber: true })}
              />
              <FieldError>{errors.width?.message}</FieldError>
            </label>
            <div>
              <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Color
              </span>
              <div className="flex flex-wrap gap-2">
                {tableColorOptions.map((color) => (
                  <button
                    aria-label={`Use ${color}`}
                    className={cn(
                      'size-9 cursor-pointer rounded-full border-2 border-white shadow-[0_0_0_2px_rgb(var(--tabliodb-border-strong))] transition hover:scale-105',
                      selectedColor === color && 'shadow-[0_0_0_3px_rgb(var(--tabliodb-primary))]',
                    )}
                    key={color}
                    onClick={() => form.setValue('color', color, { shouldDirty: true, shouldValidate: true })}
                    style={{ backgroundColor: color }}
                    type="button"
                  />
                ))}
              </div>
              <Input className="mt-3" aria-invalid={Boolean(errors.color)} {...form.register('color')} />
              <FieldError>{errors.color?.message}</FieldError>
            </div>
          </div>
          <DialogFooter className="mt-5">
            <Button onClick={() => setOpen(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <Save className="size-4" />
              Save table
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddColumnDialog({
  model,
  onModelChange,
  table,
}: {
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
  table: DatabaseTable;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<AddColumnFormState>({
    defaultValues: {
      family: 'varchar',
      length: 160,
      name: '',
      nullable: true,
      primaryKey: false,
      unique: false,
    },
    resolver: zodResolver(addColumnFormSchema),
  });
  const { errors } = form.formState;
  const family = form.watch('family');

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset();
    }
  }

  function handleSubmit(values: AddColumnFormState) {
    onModelChange(
      applyDiagramCommand(model, {
        type: 'column.create',
        tableId: table.id,
        name: values.name.trim(),
        columnType: createColumnType(values),
        nullable: values.primaryKey ? false : values.nullable,
        primaryKey: values.primaryKey,
        unique: values.unique,
      }),
    );
    handleOpenChange(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="soft">
          <Plus className="size-4" />
          Column
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>New column</DialogTitle>
            <DialogDescription>Add a typed column to {table.name}.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Column name
              </span>
              <Input
                autoFocus
                aria-invalid={Boolean(errors.name)}
                placeholder="created_at"
                {...form.register('name')}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                Type
              </span>
              <select
                className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-primary)/0.18)]"
                {...form.register('family')}
              >
                {columnTypeFamilyOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            {family === 'varchar' ? (
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Length
                </span>
                <Input
                  aria-invalid={Boolean(errors.length)}
                  min={1}
                  max={2048}
                  type="number"
                  {...form.register('length', { valueAsNumber: true })}
                />
                <FieldError>{errors.length?.message}</FieldError>
              </label>
            ) : null}
            <div className="grid gap-2">
              <CheckboxField label="Primary key" {...form.register('primaryKey')} />
              <CheckboxField label="Unique" {...form.register('unique')} />
              <CheckboxField label="Nullable" {...form.register('nullable')} />
            </div>
          </div>
          <DialogFooter className="mt-5">
            <Button onClick={() => handleOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <Plus className="size-4" />
              Add column
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CheckboxField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] px-3 py-2 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] transition hover:bg-[rgb(var(--tabliodb-surface-raised))]">
      <input className="size-4 cursor-pointer accent-[rgb(var(--tabliodb-primary))]" type="checkbox" {...props} />
      {label}
    </label>
  );
}

function ColumnBadge({ children }: { children: string }) {
  return (
    <span className="rounded-md bg-[rgb(var(--tabliodb-surface-raised))] px-1.5 py-0.5 text-[10px] font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
      {children}
    </span>
  );
}

function getEditTableDefaults(table: DatabaseTable): EditTableFormState {
  return {
    color: table.color ?? '#0f766e',
    name: table.name,
    width: table.width,
  };
}

function createColumnType(values: AddColumnFormState): ColumnTypeSpec {
  if (values.family === 'varchar') {
    return {
      family: values.family,
      length: values.length ?? 160,
    };
  }

  return { family: values.family };
}

function countTableRelationships(model: DiagramModel, table: DatabaseTable): number {
  return Object.values(model.relationships).filter(
    (relationship) => relationship.sourceTableId === table.id || relationship.targetTableId === table.id,
  ).length;
}

function getReviewSignals(model: DiagramModel): string[] {
  const relationshipsByTargetColumn = new Set(
    Object.values(model.relationships).flatMap((relationship) =>
      getRelationshipColumnPairs(relationship).map((pair) => pair.targetColumnId),
    ),
  );

  const missingRelationshipIndexes = Object.values(model.columns)
    .filter((column) => column.name.endsWith('_id') && !relationshipsByTargetColumn.has(column.id))
    .map((column) => `${model.tables[column.tableId]?.name ?? column.tableId}.${column.name} has no relationship`);

  if (missingRelationshipIndexes.length > 0) {
    return missingRelationshipIndexes.slice(0, 2);
  }

  return ['Foreign keys are mapped', 'Unique columns are visible'];
}
