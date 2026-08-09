import { zodResolver } from '@hookform/resolvers/zod';
import {
  applyDiagramCommand,
  applyDiagramCommands,
  getDiagramReviewSignals,
  getTableColumns,
  type ColumnTypeFamily,
  type ColumnTypeSpec,
  type DatabaseCheck,
  type DatabaseColumn,
  type DatabaseEnum,
  type DatabaseIndex,
  type DatabaseIndexColumn,
  type DatabaseRelationship,
  type DatabaseTable,
  type DiagramModel,
  type DiagramReviewSettings,
  type DiagramReviewSignal,
  type ReferentialAction,
} from '@tabliodb/schema-core';
import type { CommentThreadTargetSummaryDto } from '@/resources/comments';
import {
  Badge,
  Button,
  Checkbox,
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
  Select,
  Surface,
  WithTooltip,
  cn,
} from '@tabliodb/ui';
import { MessageSquareText, PanelRight, Pencil, Plus, Save, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import {
  ControlledCheckbox,
  ControlledInput,
  ControlledSelect,
  ControlledTextarea,
  type ControlledCheckboxProps,
} from '@/features/app/FormControls';
import {
  createCommentMarkerSummary,
  formatCommentMarkerCount,
  formatCommentMarkerTitle,
  getColumnCommentMarkerCount,
  getCommentMarkerCountForTarget,
  getRelationshipCommentMarkerCount,
  getTableCommentMarkerCount,
  hasOpenCommentMarkers,
  type CommentMarkerCount,
  type CommentMarkerSummary,
} from '../comment-markers';
import { formatColumnType } from '../diagram-model';
import { getDisplayTableColor, getTableColorLabel, tableColorOptions } from '../table-colors';
const unsetSelectValue = '__unset' as const;

const editTableFormSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a valid hex color.'),
  name: z.string().trim().min(1, 'Table name is required.').max(64, 'Keep the table name under 64 characters.'),
  width: z.number().int().min(240, 'Minimum width is 240px.').max(720, 'Maximum width is 720px.'),
});

const columnTypeFamilyOptions = [
  'bigint',
  'boolean',
  'date',
  'decimal',
  'enum',
  'float',
  'integer',
  'json',
  'text',
  'time',
  'timestamp',
  'uuid',
  'varchar',
] as const satisfies readonly ColumnTypeFamily[];

const columnFormSchema = z
  .object({
    autoIncrement: z.boolean(),
    comment: z.string().trim().max(240, 'Keep the comment under 240 characters.'),
    defaultValue: z.string().trim().max(120, 'Keep the default value under 120 characters.'),
    enumId: z.string(),
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
  })
  .superRefine((values, context) => {
    if (values.family === 'enum' && values.enumId === unsetSelectValue) {
      context.addIssue({
        code: 'custom',
        message: 'Choose an enum type.',
        path: ['enumId'],
      });
    }
  });

type EditTableFormState = z.infer<typeof editTableFormSchema>;
type ColumnFormState = z.infer<typeof columnFormSchema>;

const enumFormSchema = z
  .object({
    comment: z.string().trim().max(240, 'Keep the comment under 240 characters.'),
    name: z
      .string()
      .trim()
      .min(1, 'Enum name is required.')
      .max(64, 'Keep the enum name under 64 characters.')
      .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers, and underscores.'),
    schema: z.string().trim().max(64, 'Keep the schema name under 64 characters.'),
    valuesText: z.string().trim(),
  })
  .superRefine((values, context) => {
    if (parseEnumValues(values.valuesText).length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Add at least one enum value.',
        path: ['valuesText'],
      });
    }
  });

type EnumFormState = z.infer<typeof enumFormSchema>;

const indexMethodOptions = [unsetSelectValue, 'btree', 'hash', 'gin', 'gist', 'brin'] as const;
const indexOrderOptions = [unsetSelectValue, 'asc', 'desc'] as const;
const indexNullsOptions = [unsetSelectValue, 'first', 'last'] as const;

const indexFormSchema = z.object({
  columnIds: z.array(z.string()).min(1, 'Choose at least one index column.'),
  comment: z.string().trim().max(240, 'Keep the comment under 240 characters.'),
  includeColumnIds: z.array(z.string()),
  method: z.enum(indexMethodOptions),
  name: z
    .string()
    .trim()
    .min(1, 'Index name is required.')
    .max(96, 'Keep the index name under 96 characters.')
    .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers, and underscores.'),
  nullsByColumnId: z.record(z.string(), z.enum(indexNullsOptions)),
  orderByColumnId: z.record(z.string(), z.enum(indexOrderOptions)),
  unique: z.boolean(),
  where: z.string().trim().max(240, 'Keep the WHERE expression under 240 characters.'),
});

type IndexFormState = z.infer<typeof indexFormSchema>;

const checkFormSchema = z.object({
  columnId: z.string(),
  comment: z.string().trim().max(240, 'Keep the comment under 240 characters.'),
  expression: z
    .string()
    .trim()
    .min(1, 'Check expression is required.')
    .max(320, 'Keep the expression under 320 characters.'),
  name: z
    .string()
    .trim()
    .min(1, 'Check name is required.')
    .max(96, 'Keep the check name under 96 characters.')
    .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers, and underscores.'),
});

type CheckFormState = z.infer<typeof checkFormSchema>;

const relationshipCardinalityOptions = [
  'one_to_one',
  'one_to_many',
  'many_to_many',
] as const satisfies readonly DatabaseRelationship['cardinality'][];

const referentialActionOptions = [
  unsetSelectValue,
  'cascade',
  'restrict',
  'set_null',
  'set_default',
  'no_action',
] as const;

const matchTypeOptions = [unsetSelectValue, 'simple', 'full', 'partial'] as const;

const relationshipFormSchema = z
  .object({
    cardinality: z.enum(relationshipCardinalityOptions),
    comment: z.string().trim().max(240, 'Keep the comment under 240 characters.'),
    deferrable: z.boolean(),
    matchType: z.enum(matchTypeOptions),
    name: z.string().trim().max(96, 'Keep the relationship name under 96 characters.'),
    onDelete: z.enum(referentialActionOptions),
    onUpdate: z.enum(referentialActionOptions),
    sourceColumnId: z.string(),
    sourceTableId: z.string().min(1, 'Choose a primary-key table.'),
    targetColumnId: z.string(),
    targetTableId: z.string().min(1, 'Choose a foreign-key table.'),
  })
  .superRefine((values, context) => {
    if (values.sourceColumnId === unsetSelectValue) {
      context.addIssue({
        code: 'custom',
        message: 'Choose a primary-key column.',
        path: ['sourceColumnId'],
      });
    }

    if (values.targetColumnId === unsetSelectValue) {
      context.addIssue({
        code: 'custom',
        message: 'Choose a foreign-key column.',
        path: ['targetColumnId'],
      });
    }
  });

type RelationshipFormState = z.infer<typeof relationshipFormSchema>;

export type SchemaInspectorCommentTarget = {
  targetId: string | null;
  targetType: 'check' | 'column' | 'diagram' | 'enum' | 'group' | 'index' | 'note' | 'relationship' | 'table';
};

export type SchemaInspectorProps = {
  className?: string;
  commentTargetSummaries?: CommentThreadTargetSummaryDto[];
  latestSnapshotVersion: number;
  model: DiagramModel;
  canIgnoreReviewSignals?: boolean;
  isIgnoringReviewSignal?: boolean;
  onHide?: () => void;
  onCommentTargetSelect?: (target: SchemaInspectorCommentTarget) => void;
  onModelChange: (model: DiagramModel) => void;
  onReviewSignalIgnore?: (signalId: string) => void;
  onTableSelect?: (tableId: string) => void;
  readOnly?: boolean;
  reviewSettings?: DiagramReviewSettings;
  reviewSignals?: DiagramReviewSignal[] | null;
  selectedTableId: string | null;
};

export function SchemaInspector({
  className,
  commentTargetSummaries = [],
  latestSnapshotVersion,
  model,
  canIgnoreReviewSignals = false,
  isIgnoringReviewSignal = false,
  onHide,
  onCommentTargetSelect,
  onModelChange,
  onReviewSignalIgnore,
  onTableSelect,
  readOnly = false,
  reviewSettings,
  reviewSignals: serverReviewSignals,
  selectedTableId,
}: SchemaInspectorProps) {
  const enums = Object.values(model.enums);
  const selectedTable = selectedTableId ? model.tables[selectedTableId] : null;
  const selectedColumns = selectedTable ? getTableColumns(model, selectedTable.id) : [];
  const selectedIndexes = selectedTable ? getTableIndexes(model, selectedTable) : [];
  const selectedChecks = selectedTable ? getTableChecks(model, selectedTable.id) : [];
  const selectedRelationships = selectedTable ? getTableRelationships(model, selectedTable.id) : [];
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedEnumId, setSelectedEnumId] = useState<string | null>(null);
  const [selectedIndexId, setSelectedIndexId] = useState<string | null>(null);
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const selectedColumnIds = selectedColumns.map((column) => column.id).join('|');
  const selectedEnumIds = enums.map((databaseEnum) => databaseEnum.id).join('|');
  const selectedIndexIds = selectedIndexes.map((index) => index.id).join('|');
  const selectedCheckIds = selectedChecks.map((check) => check.id).join('|');
  const selectedRelationshipIds = selectedRelationships.map((relationship) => relationship.id).join('|');
  const selectedColumn = selectedColumns.find((column) => column.id === selectedColumnId) ?? null;
  const selectedEnum = enums.find((databaseEnum) => databaseEnum.id === selectedEnumId) ?? null;
  const selectedIndex = selectedIndexes.find((index) => index.id === selectedIndexId) ?? null;
  const selectedCheck = selectedChecks.find((check) => check.id === selectedCheckId) ?? null;
  const selectedRelationship =
    selectedRelationships.find((relationship) => relationship.id === selectedRelationshipId) ?? null;
  const reviewSignals = useMemo(
    () => serverReviewSignals ?? getDiagramReviewSignals(model, reviewSettings),
    [model, reviewSettings, serverReviewSignals],
  );
  const commentMarkerSummary = useMemo(
    () => createCommentMarkerSummary(model, commentTargetSummaries),
    [commentTargetSummaries, model],
  );

  useEffect(() => {
    if (!selectedEnumId || !enums.some((databaseEnum) => databaseEnum.id === selectedEnumId)) {
      // Enum selection is global to the diagram, so it follows the available enum list instead of the active table.
      setSelectedEnumId(enums[0]?.id ?? null);
    }
  }, [enums, selectedEnumId, selectedEnumIds]);

  useEffect(() => {
    if (!selectedTable) {
      setSelectedColumnId(null);
      return;
    }

    if (!selectedColumnId || !selectedColumns.some((column) => column.id === selectedColumnId)) {
      // Keep column selection scoped to the active table so inspector actions never target a stale column id.
      setSelectedColumnId(selectedColumns[0]?.id ?? null);
    }
  }, [selectedColumnId, selectedColumnIds, selectedColumns, selectedTable]);

  useEffect(() => {
    if (!selectedTable) {
      setSelectedIndexId(null);
      return;
    }

    if (!selectedIndexId || !selectedIndexes.some((index) => index.id === selectedIndexId)) {
      // Keep index actions scoped to the active table, matching the table/column/relationship inspector behavior.
      setSelectedIndexId(selectedIndexes[0]?.id ?? null);
    }
  }, [selectedIndexId, selectedIndexIds, selectedIndexes, selectedTable]);

  useEffect(() => {
    if (!selectedTable) {
      setSelectedCheckId(null);
      return;
    }

    if (!selectedCheckId || !selectedChecks.some((check) => check.id === selectedCheckId)) {
      const checkForColumn = selectedColumnId
        ? selectedChecks.find((check) => check.columnId === selectedColumnId)
        : null;

      // Check selection follows the active table and prefers a constraint bound to the selected column.
      setSelectedCheckId(checkForColumn?.id ?? selectedChecks[0]?.id ?? null);
    }
  }, [selectedCheckId, selectedCheckIds, selectedChecks, selectedColumnId, selectedTable]);

  useEffect(() => {
    if (!selectedTable) {
      setSelectedRelationshipId(null);
      return;
    }

    if (
      !selectedRelationshipId ||
      !selectedRelationships.some((relationship) => relationship.id === selectedRelationshipId)
    ) {
      const relationshipForColumn = selectedColumnId
        ? selectedRelationships.find((relationship) => relationshipTouchesColumn(relationship, selectedColumnId))
        : null;

      // Relationship selection follows the active table and prefers the active column when there is a direct wire.
      setSelectedRelationshipId(relationshipForColumn?.id ?? selectedRelationships[0]?.id ?? null);
    }
  }, [selectedColumnId, selectedRelationshipId, selectedRelationshipIds, selectedRelationships, selectedTable]);

  function handleColumnSelect(columnId: string) {
    setSelectedColumnId(columnId);
    // Inspector selection ikut menggeser anchor komentar agar diskusi bisa diarahkan ke field yang sedang dilihat.
    onCommentTargetSelect?.({ targetId: columnId, targetType: 'column' });
  }

  function handleEnumSelect(enumId: string) {
    setSelectedEnumId(enumId);
    // Enum adalah entity global diagram, jadi target komentar tidak perlu memindahkan table selection.
    onCommentTargetSelect?.({ targetId: enumId, targetType: 'enum' });
  }

  function handleIndexSelect(indexId: string) {
    setSelectedIndexId(indexId);
    // Index punya lifecycle sendiri walau dimiliki table, sehingga komentar sebaiknya tidak jatuh ke table saja.
    onCommentTargetSelect?.({ targetId: indexId, targetType: 'index' });
  }

  function handleCheckSelect(checkId: string) {
    setSelectedCheckId(checkId);
    // Check constraint sering menjadi bahan review, jadi anchor detailnya disimpan sebagai check, bukan column/table.
    onCommentTargetSelect?.({ targetId: checkId, targetType: 'check' });
  }

  function handleRelationshipSelect(relationshipId: string) {
    setSelectedRelationshipId(relationshipId);
    // Relationship review harus menempel ke wire/domain relationship agar percakapannya tetap jelas saat table berubah.
    onCommentTargetSelect?.({ targetId: relationshipId, targetType: 'relationship' });
  }

  function handleReviewSignalSelect(signal: DiagramReviewSignal) {
    const { id, type } = signal.target;

    if (type === 'table') {
      onTableSelect?.(id);
      onCommentTargetSelect?.({ targetId: id, targetType: 'table' });
      return;
    }

    if (type === 'column') {
      const column = model.columns[id];

      if (column) {
        // Fokus signal column juga memilih table induknya supaya canvas dan sidebar kiri ikut memberi konteks visual.
        onTableSelect?.(column.tableId);
        handleColumnSelect(column.id);
      }

      return;
    }

    if (type === 'enum') {
      handleEnumSelect(id);
      return;
    }

    if (type === 'index') {
      const index = model.indexes[id];

      if (index) {
        onTableSelect?.(index.tableId);
        handleIndexSelect(index.id);
      }

      return;
    }

    if (type === 'check') {
      const check = model.checks[id];

      if (check) {
        onTableSelect?.(check.tableId);
        handleCheckSelect(check.id);
      }

      return;
    }

    if (type === 'relationship') {
      const relationship = model.relationships[id];

      if (relationship) {
        onTableSelect?.(relationship.targetTableId);
        handleRelationshipSelect(relationship.id);
      }
    }
  }

  return (
    <aside
      className={cn(
        'flex min-h-0 min-w-0 flex-col border-l border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-surface-raised))]',
        className,
      )}
    >
      <div className="flex h-[var(--tabliodb-header-height)] shrink-0 items-center justify-between border-b border-[rgb(var(--tabliodb-border))] bg-white/80 px-4 text-[13px] font-extrabold backdrop-blur">
        <span>Inspector</span>
        {onHide ? (
          <IconButton size="lg" icon={PanelRight} label="Hide inspector" onClick={onHide} variant="ghost" />
        ) : null}
      </div>
      <div className="tabliodb-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="green">{model.dialect}</Badge>
          <Badge variant="blue">v{latestSnapshotVersion}</Badge>
          {readOnly ? <Badge variant="yellow">View only</Badge> : null}
        </div>
        {readOnly ? (
          <Surface className="border-[rgb(var(--tabliodb-gold-border))] bg-[rgb(var(--tabliodb-gold-soft))] p-3 text-xs font-extrabold text-[rgb(var(--tabliodb-gold-text))]">
            This project role can inspect the schema, export SQL, and follow relationships, but cannot change the
            diagram.
          </Surface>
        ) : null}
        <EnumEditorPanel
          databaseEnum={selectedEnum}
          commentMarkerSummary={commentMarkerSummary}
          enums={enums}
          model={model}
          onEnumSelect={handleEnumSelect}
          onModelChange={onModelChange}
          readOnly={readOnly}
          selectedEnumId={selectedEnumId}
        />
        <section>
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Selected table
          </h2>
          {selectedTable ? (
            <Surface className="mt-2 p-3" depth="sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate text-[13px] font-extrabold leading-5">{selectedTable.name}</div>
                    <CommentMarkerBadge
                      count={getTableCommentMarkerCount(commentMarkerSummary, selectedTable.id)}
                      label={`table ${selectedTable.name}`}
                    />
                  </div>
                  <div className="text-[12px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                    {selectedColumns.length} cols / {selectedIndexes.length} idx / {selectedChecks.length} checks /{' '}
                    {countTableRelationships(model, selectedTable)} rels
                  </div>
                </div>
                <span
                  className="mt-1 size-3.5 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(var(--tabliodb-border-strong))]"
                  style={{ backgroundColor: getDisplayTableColor(selectedTable.color) }}
                />
              </div>
              <div className="mt-3 space-y-1">
                {selectedColumns.map((column) => (
                  <button
                    aria-pressed={selectedColumnId === column.id}
                    className={cn(
                      'grid w-full cursor-pointer grid-cols-[1fr_auto] gap-2 rounded-[var(--tabliodb-radius-md)] border border-transparent px-2 py-2 text-left text-xs transition hover:border-[rgb(var(--tabliodb-border))] hover:bg-[rgb(var(--tabliodb-surface))]',
                      selectedColumnId === column.id &&
                        'border-[rgb(var(--tabliodb-active-chip-border))] bg-[rgb(var(--tabliodb-selected-surface))] text-[rgb(var(--tabliodb-primary-text))] shadow-[inset_3px_0_0_rgb(var(--tabliodb-primary))]',
                    )}
                    key={column.id}
                    onClick={() => handleColumnSelect(column.id)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate font-extrabold text-[rgb(var(--tabliodb-ink))]">{column.name}</div>
                        <CommentMarkerBadge
                          count={getColumnCommentMarkerCount(commentMarkerSummary, column.id)}
                          label={`column ${column.name}`}
                        />
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {column.primaryKey ? <ColumnBadge>PK</ColumnBadge> : null}
                        {column.unique ? <ColumnBadge>UQ</ColumnBadge> : null}
                        {!column.nullable ? <ColumnBadge>NN</ColumnBadge> : null}
                      </div>
                    </div>
                    <span className="font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                      {formatColumnType(column.type)}
                    </span>
                  </button>
                ))}
              </div>
            </Surface>
          ) : (
            <Surface className="mt-2 border-dashed p-3 text-[13px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
              No table selected
            </Surface>
          )}
        </section>
        <ColumnInspector column={selectedColumn} model={model} table={selectedTable} />
        <IndexBuilderPanel
          columns={selectedColumns}
          commentMarkerSummary={commentMarkerSummary}
          index={selectedIndex}
          indexes={selectedIndexes}
          model={model}
          onIndexSelect={handleIndexSelect}
          onModelChange={onModelChange}
          readOnly={readOnly}
          selectedIndexId={selectedIndexId}
          table={selectedTable}
        />
        <CheckConstraintPanel
          check={selectedCheck}
          checks={selectedChecks}
          columns={selectedColumns}
          commentMarkerSummary={commentMarkerSummary}
          model={model}
          onCheckSelect={handleCheckSelect}
          onModelChange={onModelChange}
          readOnly={readOnly}
          selectedCheckId={selectedCheckId}
          table={selectedTable}
        />
        <RelationshipInspector
          model={model}
          commentMarkerSummary={commentMarkerSummary}
          onModelChange={onModelChange}
          onRelationshipSelect={handleRelationshipSelect}
          readOnly={readOnly}
          relationship={selectedRelationship}
          relationships={selectedRelationships}
          selectedRelationshipId={selectedRelationshipId}
        />
        <ReviewSignalsPanel
          canIgnore={canIgnoreReviewSignals}
          isIgnoring={isIgnoringReviewSignal}
          onSignalIgnore={onReviewSignalIgnore}
          onSignalSelect={handleReviewSignalSelect}
          signals={reviewSignals}
        />
      </div>
    </aside>
  );
}

function ReviewSignalsPanel({
  canIgnore,
  isIgnoring,
  onSignalIgnore,
  onSignalSelect,
  signals,
}: {
  canIgnore: boolean;
  isIgnoring: boolean;
  onSignalIgnore?: (signalId: string) => void;
  onSignalSelect: (signal: DiagramReviewSignal) => void;
  signals: DiagramReviewSignal[];
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Review signals
        </h2>
        <Badge variant={signals.length > 0 ? 'yellow' : 'green'}>{signals.length} found</Badge>
      </div>
      {signals.length > 0 ? (
        <div className="mt-2 space-y-2">
          {signals.slice(0, 8).map((signal) => (
            <div
              className={cn(
                'w-full rounded-[var(--tabliodb-radius-md)] border bg-white p-3 text-left shadow-[0_2px_0_rgb(var(--tabliodb-border-strong))] transition hover:-translate-y-0.5 hover:bg-[rgb(var(--tabliodb-surface-raised))]',
                getReviewSignalClassName(signal),
              )}
              key={signal.id}
            >
              <WithTooltip content={`Focus ${signal.target.type} related to this signal`} side="left">
                <button
                  className="block w-full cursor-pointer rounded-[calc(var(--tabliodb-radius-md)-4px)] text-left outline-none transition focus-visible:ring-4 focus-visible:ring-[rgb(var(--tabliodb-focus-ring))]"
                  onClick={() => onSignalSelect(signal)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-extrabold text-[rgb(var(--tabliodb-ink))]">
                        {signal.title}
                      </div>
                      <p className="mt-1 text-[12px] font-semibold leading-5 text-[rgb(var(--tabliodb-ink-muted))]">
                        {signal.message}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-current px-2 py-0.5 text-[10px] font-extrabold uppercase">
                      {signal.severity}
                    </span>
                  </div>
                </button>
              </WithTooltip>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-subtle))]">
                  {signal.target.type}
                </div>
                {canIgnore && onSignalIgnore ? (
                  <WithTooltip content="Hide this signal for the current saved diagram">
                    <Button
                      // Ignore berada di aksi terpisah dari tombol focus target supaya keyboard/mouse user tidak memicu dua intent sekaligus.
                      disabled={isIgnoring}
                      onClick={() => onSignalIgnore(signal.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Ignore
                    </Button>
                  </WithTooltip>
                ) : null}
              </div>
            </div>
          ))}
          {signals.length > 8 ? (
            <div className="rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-center text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
              +{signals.length - 8} more signals
            </div>
          ) : null}
        </div>
      ) : (
        <Surface className="mt-2 border-[rgb(var(--tabliodb-primary-border))] bg-[rgb(var(--tabliodb-primary-soft))] p-3 text-[13px] font-bold text-[rgb(var(--tabliodb-primary-text))] shadow-[0_2px_0_rgb(var(--tabliodb-primary-border))]">
          Schema looks tidy from the current review rules.
        </Surface>
      )}
    </section>
  );
}

function getReviewSignalClassName(signal: DiagramReviewSignal): string {
  if (signal.severity === 'error') {
    return 'border-[rgb(var(--tabliodb-danger-border))] text-[rgb(var(--tabliodb-danger-text))]';
  }

  if (signal.severity === 'warning') {
    return 'border-[rgb(var(--tabliodb-gold-border))] text-[rgb(var(--tabliodb-gold-text))]';
  }

  return 'border-[rgb(var(--tabliodb-sky-border))] text-[rgb(var(--tabliodb-sky-text))]';
}

function EnumEditorPanel({
  databaseEnum,
  commentMarkerSummary,
  enums,
  model,
  onEnumSelect,
  onModelChange,
  readOnly,
  selectedEnumId,
}: {
  databaseEnum: DatabaseEnum | null;
  commentMarkerSummary: CommentMarkerSummary;
  enums: DatabaseEnum[];
  model: DiagramModel;
  onEnumSelect: (enumId: string) => void;
  onModelChange: (model: DiagramModel) => void;
  readOnly: boolean;
  selectedEnumId: string | null;
}) {
  return (
    <section>
      <h2 className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">Enums</h2>
      <Surface className="mt-2 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-extrabold leading-5">{enums.length} enums</div>
            <div className="text-[12px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
              Reusable database type values
            </div>
          </div>
          {!readOnly ? <AddEnumDialog model={model} onModelChange={onModelChange} /> : null}
        </div>
        {enums.length > 0 ? (
          <div className="mt-3 space-y-1">
            {enums.map((currentEnum) => (
              <button
                aria-pressed={selectedEnumId === currentEnum.id}
                className={cn(
                  'w-full cursor-pointer rounded-xl px-2 py-2 text-left transition hover:bg-[rgb(var(--tabliodb-surface-raised))]',
                  selectedEnumId === currentEnum.id &&
                    'bg-[rgb(var(--tabliodb-selected-surface))] text-[rgb(var(--tabliodb-primary-text))]',
                )}
                key={currentEnum.id}
                onClick={() => onEnumSelect(currentEnum.id)}
                type="button"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="truncate text-xs font-extrabold">{currentEnum.name}</div>
                  <CommentMarkerBadge
                    count={getCommentMarkerCountForTarget(commentMarkerSummary, 'enum', currentEnum.id)}
                    label={`enum ${currentEnum.name}`}
                  />
                </div>
                <div className="mt-1 truncate text-[11px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  {currentEnum.values.join(', ')}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-[13px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
            No enums yet
          </div>
        )}
        {databaseEnum ? (
          <div className="mt-3 rounded-[var(--tabliodb-radius-md)] bg-[rgb(var(--tabliodb-surface))] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="truncate text-[13px] font-extrabold leading-5">{databaseEnum.name}</div>
                  <CommentMarkerBadge
                    count={getCommentMarkerCountForTarget(commentMarkerSummary, 'enum', databaseEnum.id)}
                    label={`enum ${databaseEnum.name}`}
                  />
                </div>
                <div className="text-[12px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  {databaseEnum.schema ? `${databaseEnum.schema} schema` : 'default schema'}
                </div>
              </div>
              {!readOnly ? (
                <EditEnumDialog databaseEnum={databaseEnum} model={model} onModelChange={onModelChange} />
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {databaseEnum.values.map((value) => (
                <ColumnBadge key={value}>{value}</ColumnBadge>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <ColumnFact label="Values" value={String(databaseEnum.values.length)} />
              <ColumnFact label="Used by" value={String(countEnumUsage(model, databaseEnum.id))} />
            </div>
            {databaseEnum.comment ? (
              <p className="mt-3 wrap-break-word rounded-[var(--tabliodb-radius-md)] bg-white p-3 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                {databaseEnum.comment}
              </p>
            ) : null}
          </div>
        ) : null}
      </Surface>
    </section>
  );
}

function AddEnumDialog({
  model,
  onModelChange,
}: {
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<EnumFormState>({
    defaultValues: getNewEnumDefaults(model),
    resolver: zodResolver(enumFormSchema),
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getNewEnumDefaults(model));
    }
  }

  function handleSubmit(values: EnumFormState) {
    onModelChange(
      applyDiagramCommand(model, {
        type: 'enum.create',
        name: values.name.trim(),
        comment: normalizeOptionalString(values.comment),
        schema: normalizeOptionalString(values.schema),
        values: parseEnumValues(values.valuesText),
      }),
    );
    handleOpenChange(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="soft">
          <Plus className="size-4" />
          Enum
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(92vw,520px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>New enum</DialogTitle>
            <DialogDescription>Create reusable values for enum columns.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <EnumFormFields form={form} />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <Plus className="size-4" />
              Add enum
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditEnumDialog({
  databaseEnum,
  model,
  onModelChange,
}: {
  databaseEnum: DatabaseEnum;
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<EnumFormState>({
    defaultValues: getEnumDefaults(databaseEnum),
    resolver: zodResolver(enumFormSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset(getEnumDefaults(databaseEnum));
    }
  }, [databaseEnum, form, open]);

  function handleSubmit(values: EnumFormState) {
    onModelChange(
      applyDiagramCommand(model, {
        type: 'enum.update',
        enumId: databaseEnum.id,
        changes: {
          name: values.name.trim(),
          comment: normalizeOptionalString(values.comment),
          schema: normalizeOptionalString(values.schema),
          values: parseEnumValues(values.valuesText),
        },
      }),
    );
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(92vw,520px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit enum</DialogTitle>
            <DialogDescription>Update enum values and metadata.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <EnumFormFields form={form} />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setOpen(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <Save className="size-4" />
              Save enum
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EnumFormFields({ form }: { form: UseFormReturn<EnumFormState> }) {
  const { errors } = form.formState;

  return (
    <div className="grid gap-4">
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Enum name
        </span>
        <ControlledInput
          autoFocus
          aria-invalid={Boolean(errors.name)}
          control={form.control}
          name="name"
          placeholder="order_status"
        />
        <FieldError>{errors.name?.message}</FieldError>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Schema
        </span>
        <ControlledInput control={form.control} name="schema" placeholder="public" />
        <FieldError>{errors.schema?.message}</FieldError>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Values
        </span>
        <ControlledTextarea
          className="min-h-28 w-full resize-y rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 py-2 text-sm font-semibold text-[rgb(var(--tabliodb-ink))] outline-none transition placeholder:text-[rgb(var(--tabliodb-ink-subtle))] focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
          control={form.control}
          name="valuesText"
          placeholder={'draft\npublished\narchived'}
        />
        <FieldError>{errors.valuesText?.message}</FieldError>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Comment
        </span>
        <ControlledInput control={form.control} name="comment" placeholder="Enum note" />
        <FieldError>{errors.comment?.message}</FieldError>
      </label>
    </div>
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
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit table</DialogTitle>
            <DialogDescription>Adjust the table identity and visual width.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Table name
                </span>
                <ControlledInput autoFocus aria-invalid={Boolean(errors.name)} control={form.control} name="name" />
                <FieldError>{errors.name?.message}</FieldError>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Width
                </span>
                <ControlledInput
                  aria-invalid={Boolean(errors.width)}
                  control={form.control}
                  min={240}
                  max={720}
                  name="width"
                  type="number"
                />
                <FieldError>{errors.width?.message}</FieldError>
              </label>
              <div>
                <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Color
                </span>
                <div className="flex flex-wrap gap-2">
                  {tableColorOptions.map((color) => {
                    const colorLabel = getTableColorLabel(color);

                    return (
                      <WithTooltip content={`Set table color to ${colorLabel}`} key={color}>
                        <button
                          aria-label={`Use ${colorLabel}`}
                          className="size-9 cursor-pointer rounded-full border-2 border-white transition hover:scale-105"
                          onClick={() => form.setValue('color', color, { shouldDirty: true, shouldValidate: true })}
                          style={{
                            backgroundColor: color,
                            boxShadow:
                              selectedColor === color
                                ? `0 0 0 1px #ffffff, 0 0 0 4px ${color}, 0 2px 0 rgb(var(--tabliodb-border-strong))`
                                : '0 0 0 1px rgb(var(--tabliodb-border-strong)), 0 2px 0 rgb(var(--tabliodb-border-strong))',
                          }}
                          type="button"
                        />
                      </WithTooltip>
                    );
                  })}
                </div>
                <ControlledInput
                  aria-invalid={Boolean(errors.color)}
                  className="mt-3"
                  control={form.control}
                  name="color"
                />
                <FieldError>{errors.color?.message}</FieldError>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
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
  const form = useForm<ColumnFormState>({
    defaultValues: getNewColumnDefaults(),
    resolver: zodResolver(columnFormSchema),
  });
  const { errors } = form.formState;
  const enumOptions = Object.values(model.enums);
  const family = form.watch('family');

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getNewColumnDefaults());
    }
  }

  function handleSubmit(values: ColumnFormState) {
    onModelChange(
      applyDiagramCommand(model, {
        type: 'column.create',
        tableId: table.id,
        name: values.name.trim(),
        columnType: createColumnType(values),
        autoIncrement: values.autoIncrement,
        comment: normalizeOptionalString(values.comment),
        defaultValue: normalizeOptionalString(values.defaultValue),
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
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>New column</DialogTitle>
            <DialogDescription>Add a typed column to {table.name}.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Column name
                </span>
                <ControlledInput
                  autoFocus
                  aria-invalid={Boolean(errors.name)}
                  control={form.control}
                  name="name"
                  placeholder="created_at"
                />
                <FieldError>{errors.name?.message}</FieldError>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Type
                </span>
                <ControlledSelect
                  className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                  control={form.control}
                  name="family"
                  options={columnTypeFamilyOptions.map((option) => ({ label: option, value: option }))}
                />
              </label>
              {family === 'varchar' ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Length
                  </span>
                  <ControlledInput
                    aria-invalid={Boolean(errors.length)}
                    control={form.control}
                    min={1}
                    max={2048}
                    name="length"
                    type="number"
                  />
                  <FieldError>{errors.length?.message}</FieldError>
                </label>
              ) : null}
              {family === 'enum' ? <EnumSelectField enumOptions={enumOptions} form={form} /> : null}
              <div className="grid gap-2">
                <CheckboxField control={form.control} label="Primary key" name="primaryKey" />
                <CheckboxField control={form.control} label="Unique" name="unique" />
                <CheckboxField control={form.control} label="Auto increment" name="autoIncrement" />
                <CheckboxField control={form.control} label="Nullable" name="nullable" />
              </div>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Default value
                </span>
                <ControlledInput control={form.control} name="defaultValue" placeholder="now()" />
                <FieldError>{errors.defaultValue?.message}</FieldError>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Comment
                </span>
                <ControlledInput control={form.control} name="comment" placeholder="Shown in generated docs later" />
                <FieldError>{errors.comment?.message}</FieldError>
              </label>
            </div>
          </DialogBody>
          <DialogFooter>
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

function ColumnInspector({
  column,
  model,
  table,
}: {
  column: DatabaseColumn | null;
  model: DiagramModel;
  table: DatabaseTable | null;
}) {
  return (
    <section>
      <h2 className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
        Selected column
      </h2>
      {column && table ? (
        <Surface className="mt-2 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-extrabold leading-5">{column.name}</div>
              <div className="text-[12px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                {table.name} / {formatColumnType(column.type)}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <ColumnFact label="Primary key" value={column.primaryKey ? 'Yes' : 'No'} />
            <ColumnFact label="Nullable" value={column.nullable ? 'Yes' : 'No'} />
            <ColumnFact label="Unique" value={column.unique ? 'Yes' : 'No'} />
            <ColumnFact label="Auto inc" value={column.autoIncrement ? 'Yes' : 'No'} />
            <ColumnFact label="Relations" value={String(countColumnRelationships(model, column))} />
            <ColumnFact label="Default" value={column.defaultValue || '-'} />
          </div>
          {column.comment ? (
            <p className="mt-3 wrap-break-word rounded-[var(--tabliodb-radius-md)] bg-[rgb(var(--tabliodb-surface))] p-3 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
              {column.comment}
            </p>
          ) : null}
        </Surface>
      ) : (
        <Surface className="mt-2 border-dashed p-3 text-[13px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
          No column selected
        </Surface>
      )}
    </section>
  );
}

function EditColumnDialog({
  column,
  model,
  onModelChange,
}: {
  column: DatabaseColumn;
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<ColumnFormState>({
    defaultValues: getColumnDefaults(column),
    resolver: zodResolver(columnFormSchema),
  });
  const { errors } = form.formState;
  const enumOptions = Object.values(model.enums);
  const family = form.watch('family');

  useEffect(() => {
    if (open) {
      form.reset(getColumnDefaults(column));
    }
  }, [column, form, open]);

  function handleSubmit(values: ColumnFormState) {
    onModelChange(
      applyDiagramCommand(model, {
        type: 'column.update',
        columnId: column.id,
        changes: {
          autoIncrement: values.autoIncrement,
          comment: normalizeOptionalString(values.comment),
          defaultValue: normalizeOptionalString(values.defaultValue),
          name: values.name.trim(),
          nullable: values.primaryKey ? false : values.nullable,
          primaryKey: values.primaryKey,
          type: createColumnType(values, column.type),
          unique: values.unique,
        },
      }),
    );
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit column</DialogTitle>
            <DialogDescription>Change column type, constraints, and metadata.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Column name
                </span>
                <ControlledInput autoFocus aria-invalid={Boolean(errors.name)} control={form.control} name="name" />
                <FieldError>{errors.name?.message}</FieldError>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Type
                </span>
                <ControlledSelect
                  className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                  control={form.control}
                  name="family"
                  options={columnTypeFamilyOptions.map((option) => ({ label: option, value: option }))}
                />
              </label>
              {family === 'varchar' ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Length
                  </span>
                  <ControlledInput
                    aria-invalid={Boolean(errors.length)}
                    control={form.control}
                    min={1}
                    max={2048}
                    name="length"
                    type="number"
                  />
                  <FieldError>{errors.length?.message}</FieldError>
                </label>
              ) : null}
              {family === 'enum' ? <EnumSelectField enumOptions={enumOptions} form={form} /> : null}
              <div className="grid gap-2">
                <CheckboxField control={form.control} label="Primary key" name="primaryKey" />
                <CheckboxField control={form.control} label="Unique" name="unique" />
                <CheckboxField control={form.control} label="Auto increment" name="autoIncrement" />
                <CheckboxField control={form.control} label="Nullable" name="nullable" />
              </div>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Default value
                </span>
                <ControlledInput control={form.control} name="defaultValue" placeholder="now()" />
                <FieldError>{errors.defaultValue?.message}</FieldError>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Comment
                </span>
                <ControlledInput control={form.control} name="comment" placeholder="Column note" />
                <FieldError>{errors.comment?.message}</FieldError>
              </label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setOpen(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <Save className="size-4" />
              Save column
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IndexBuilderPanel({
  columns,
  commentMarkerSummary,
  index,
  indexes,
  model,
  onIndexSelect,
  onModelChange,
  readOnly,
  selectedIndexId,
  table,
}: {
  columns: DatabaseColumn[];
  commentMarkerSummary: CommentMarkerSummary;
  index: DatabaseIndex | null;
  indexes: DatabaseIndex[];
  model: DiagramModel;
  onIndexSelect: (indexId: string) => void;
  onModelChange: (model: DiagramModel) => void;
  readOnly: boolean;
  selectedIndexId: string | null;
  table: DatabaseTable | null;
}) {
  return (
    <section>
      <h2 className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">Indexes</h2>
      {table ? (
        <Surface className="mt-2 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-extrabold leading-5">{indexes.length} indexes</div>
              <div className="text-[12px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                Composite, unique, and partial indexes
              </div>
            </div>
            {!readOnly ? (
              <AddIndexDialog columns={columns} model={model} onModelChange={onModelChange} table={table} />
            ) : null}
          </div>
          {indexes.length > 0 ? (
            <div className="mt-3 space-y-1">
              {indexes.map((currentIndex) => (
                <button
                  aria-pressed={selectedIndexId === currentIndex.id}
                  className={cn(
                    'w-full cursor-pointer rounded-xl px-2 py-2 text-left transition hover:bg-[rgb(var(--tabliodb-surface-raised))]',
                    selectedIndexId === currentIndex.id &&
                      'bg-[rgb(var(--tabliodb-selected-surface))] text-[rgb(var(--tabliodb-primary-text))]',
                  )}
                  key={currentIndex.id}
                  onClick={() => onIndexSelect(currentIndex.id)}
                  type="button"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate text-xs font-extrabold">{currentIndex.name}</div>
                    <CommentMarkerBadge
                      count={getCommentMarkerCountForTarget(commentMarkerSummary, 'index', currentIndex.id)}
                      label={`index ${currentIndex.name}`}
                    />
                  </div>
                  <div className="mt-1 truncate text-[11px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                    {formatIndexColumns(model, currentIndex)}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-[13px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
              No indexes yet
            </div>
          )}
          {index ? (
            <div className="mt-3 rounded-[var(--tabliodb-radius-md)] bg-[rgb(var(--tabliodb-surface))] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate text-[13px] font-extrabold leading-5">{index.name}</div>
                    <CommentMarkerBadge
                      count={getCommentMarkerCountForTarget(commentMarkerSummary, 'index', index.id)}
                      label={`index ${index.name}`}
                    />
                  </div>
                  <div className="text-[12px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                    {index.unique ? 'Unique index' : 'Non-unique index'}
                  </div>
                </div>
                {!readOnly ? (
                  <EditIndexDialog columns={columns} index={index} model={model} onModelChange={onModelChange} />
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <ColumnFact label="Method" value={formatIndexMethod(index.method)} />
                <ColumnFact label="Columns" value={String(index.columns.length)} />
                <ColumnFact label="Include" value={String(index.includeColumnIds?.length ?? 0)} />
                <ColumnFact label="Partial" value={index.where ? 'Yes' : 'No'} />
              </div>
              {index.where ? (
                <p className="mt-3 wrap-break-word rounded-[var(--tabliodb-radius-md)] bg-white p-3 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  WHERE {index.where}
                </p>
              ) : null}
              {index.comment ? (
                <p className="mt-2 wrap-break-word rounded-[var(--tabliodb-radius-md)] bg-white p-3 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  {index.comment}
                </p>
              ) : null}
            </div>
          ) : null}
        </Surface>
      ) : (
        <Surface className="mt-2 border-dashed p-3 text-[13px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
          No table selected
        </Surface>
      )}
    </section>
  );
}

function AddIndexDialog({
  columns,
  model,
  onModelChange,
  table,
}: {
  columns: DatabaseColumn[];
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
  table: DatabaseTable;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<IndexFormState>({
    defaultValues: getNewIndexDefaults(table, columns),
    resolver: zodResolver(indexFormSchema),
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getNewIndexDefaults(table, columns));
    }
  }

  function handleSubmit(values: IndexFormState) {
    onModelChange(
      applyDiagramCommand(model, {
        type: 'index.create',
        tableId: table.id,
        name: values.name.trim(),
        columns: createIndexColumns(values),
        comment: normalizeOptionalString(values.comment),
        includeColumnIds: normalizeIncludeColumnIds(values),
        method: normalizeIndexMethod(values.method),
        unique: values.unique,
        where: normalizeOptionalString(values.where),
      }),
    );
    handleOpenChange(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button disabled={columns.length === 0} size="sm" variant="soft">
          <Plus className="size-4" />
          Index
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(92vw,560px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>New index</DialogTitle>
            <DialogDescription>Build a table index from one or more columns.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <IndexFormFields columns={columns} form={form} />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <Plus className="size-4" />
              Add index
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditIndexDialog({
  columns,
  index,
  model,
  onModelChange,
}: {
  columns: DatabaseColumn[];
  index: DatabaseIndex;
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<IndexFormState>({
    defaultValues: getIndexDefaults(index, columns),
    resolver: zodResolver(indexFormSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset(getIndexDefaults(index, columns));
    }
  }, [columns, form, index, open]);

  function handleSubmit(values: IndexFormState) {
    onModelChange(
      applyDiagramCommand(model, {
        type: 'index.update',
        indexId: index.id,
        changes: {
          name: values.name.trim(),
          columns: createIndexColumns(values),
          comment: normalizeOptionalString(values.comment),
          includeColumnIds: normalizeIncludeColumnIds(values),
          method: normalizeIndexMethod(values.method),
          unique: values.unique,
          where: normalizeOptionalString(values.where),
        },
      }),
    );
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(92vw,560px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit index</DialogTitle>
            <DialogDescription>Change indexed columns, method, and partial predicate.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <IndexFormFields columns={columns} form={form} />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setOpen(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <Save className="size-4" />
              Save index
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IndexFormFields({ columns, form }: { columns: DatabaseColumn[]; form: UseFormReturn<IndexFormState> }) {
  const { errors } = form.formState;
  const columnIds = form.watch('columnIds');
  const includeColumnIds = form.watch('includeColumnIds');
  const nullsByColumnId = form.watch('nullsByColumnId');
  const orderByColumnId = form.watch('orderByColumnId');

  function handleColumnToggle(columnId: string, checked: boolean) {
    const nextColumnIds = checked
      ? [...form.getValues('columnIds'), columnId]
      : form.getValues('columnIds').filter((currentColumnId) => currentColumnId !== columnId);

    // Include columns must not duplicate key columns, so toggling a key column also removes it from INCLUDE.
    form.setValue('columnIds', nextColumnIds, { shouldDirty: true, shouldValidate: true });
    form.setValue(
      'includeColumnIds',
      form.getValues('includeColumnIds').filter((includeColumnId) => !nextColumnIds.includes(includeColumnId)),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  function handleIncludeColumnToggle(columnId: string, checked: boolean) {
    const currentIncludeColumnIds = form.getValues('includeColumnIds');
    const nextIncludeColumnIds = checked
      ? [...currentIncludeColumnIds, columnId]
      : currentIncludeColumnIds.filter((currentColumnId) => currentColumnId !== columnId);

    // The array is controlled manually because index columns are a builder-style set, not a simple scalar input.
    form.setValue('includeColumnIds', nextIncludeColumnIds, { shouldDirty: true, shouldValidate: true });
  }

  function handleOrderChange(columnId: string, value: IndexFormState['orderByColumnId'][string]) {
    form.setValue(
      'orderByColumnId',
      {
        ...form.getValues('orderByColumnId'),
        [columnId]: value,
      },
      { shouldDirty: true, shouldValidate: true },
    );
  }

  function handleNullsChange(columnId: string, value: IndexFormState['nullsByColumnId'][string]) {
    form.setValue(
      'nullsByColumnId',
      {
        ...form.getValues('nullsByColumnId'),
        [columnId]: value,
      },
      { shouldDirty: true, shouldValidate: true },
    );
  }

  return (
    <div className="grid gap-4">
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Index name
        </span>
        <ControlledInput
          autoFocus
          aria-invalid={Boolean(errors.name)}
          control={form.control}
          name="name"
          placeholder="users_email_idx"
        />
        <FieldError>{errors.name?.message}</FieldError>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
            Method
          </span>
          <ControlledSelect
            className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
            control={form.control}
            name="method"
            options={indexMethodOptions.map((option) => ({
              label: option === unsetSelectValue ? 'Default' : option,
              value: option,
            }))}
          />
        </label>
        <div className="pt-6">
          <CheckboxField control={form.control} label="Unique index" name="unique" />
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Key columns
        </div>
        <div className="grid gap-2">
          {columns.map((column) => {
            const selected = columnIds.includes(column.id);

            return (
              <div
                className={cn(
                  'rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] p-3',
                  selected &&
                    'border-[rgb(var(--tabliodb-active-chip-border))] bg-[rgb(var(--tabliodb-selected-surface))]',
                )}
                key={column.id}
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm font-extrabold">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(checked) => handleColumnToggle(column.id, checked === true)}
                  />
                  <span className="min-w-0 flex-1 truncate">{column.name}</span>
                  <span className="text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                    {formatColumnType(column.type)}
                  </span>
                </label>
                {selected ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="block text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                      Order
                      <Select
                        className="mt-1 h-10 w-full cursor-pointer rounded-xl border-2 border-[rgb(var(--tabliodb-border))] bg-white px-2 text-xs font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))]"
                        onValueChange={(value) =>
                          handleOrderChange(column.id, value as IndexFormState['orderByColumnId'][string])
                        }
                        options={indexOrderOptions.map((option) => ({
                          label: option === unsetSelectValue ? 'Default' : option.toUpperCase(),
                          value: option,
                        }))}
                        value={orderByColumnId[column.id] ?? unsetSelectValue}
                      />
                    </label>
                    <label className="block text-xs font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
                      Nulls
                      <Select
                        className="mt-1 h-10 w-full cursor-pointer rounded-xl border-2 border-[rgb(var(--tabliodb-border))] bg-white px-2 text-xs font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))]"
                        onValueChange={(value) =>
                          handleNullsChange(column.id, value as IndexFormState['nullsByColumnId'][string])
                        }
                        options={indexNullsOptions.map((option) => ({
                          label: option === unsetSelectValue ? 'Default' : option,
                          value: option,
                        }))}
                        value={nullsByColumnId[column.id] ?? unsetSelectValue}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <FieldError>{errors.columnIds?.message}</FieldError>
      </div>
      <div>
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Include columns
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {columns.map((column) => {
            const selectedAsKey = columnIds.includes(column.id);

            return (
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] px-3 py-2 text-sm font-extrabold transition hover:bg-[rgb(var(--tabliodb-surface-raised))]',
                  selectedAsKey && 'cursor-not-allowed opacity-50',
                )}
                key={column.id}
              >
                <Checkbox
                  checked={includeColumnIds.includes(column.id)}
                  disabled={selectedAsKey}
                  onCheckedChange={(checked) => handleIncludeColumnToggle(column.id, checked === true)}
                />
                <span className="min-w-0 truncate">{column.name}</span>
              </label>
            );
          })}
        </div>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Partial WHERE
        </span>
        <ControlledInput control={form.control} name="where" placeholder="deleted_at IS NULL" />
        <FieldError>{errors.where?.message}</FieldError>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Comment
        </span>
        <ControlledInput control={form.control} name="comment" placeholder="Index note" />
        <FieldError>{errors.comment?.message}</FieldError>
      </label>
    </div>
  );
}

function CheckConstraintPanel({
  check,
  checks,
  columns,
  commentMarkerSummary,
  model,
  onCheckSelect,
  onModelChange,
  readOnly,
  selectedCheckId,
  table,
}: {
  check: DatabaseCheck | null;
  checks: DatabaseCheck[];
  columns: DatabaseColumn[];
  commentMarkerSummary: CommentMarkerSummary;
  model: DiagramModel;
  onCheckSelect: (checkId: string) => void;
  onModelChange: (model: DiagramModel) => void;
  readOnly: boolean;
  selectedCheckId: string | null;
  table: DatabaseTable | null;
}) {
  return (
    <section>
      <h2 className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
        Check constraints
      </h2>
      {table ? (
        <Surface className="mt-2 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-extrabold leading-5">{checks.length} checks</div>
              <div className="text-[12px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                Validate table and column-level business rules
              </div>
            </div>
            {!readOnly ? (
              <AddCheckDialog
                checks={checks}
                columns={columns}
                model={model}
                onModelChange={onModelChange}
                table={table}
              />
            ) : null}
          </div>
          {checks.length > 0 ? (
            <div className="mt-3 space-y-1">
              {checks.map((currentCheck) => (
                <button
                  aria-pressed={selectedCheckId === currentCheck.id}
                  className={cn(
                    'w-full cursor-pointer rounded-xl px-2 py-2 text-left transition hover:bg-[rgb(var(--tabliodb-surface-raised))]',
                    selectedCheckId === currentCheck.id &&
                      'bg-[rgb(var(--tabliodb-selected-surface))] text-[rgb(var(--tabliodb-primary-text))]',
                  )}
                  key={currentCheck.id}
                  onClick={() => onCheckSelect(currentCheck.id)}
                  type="button"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate text-xs font-extrabold">{currentCheck.name}</div>
                    <CommentMarkerBadge
                      count={getCommentMarkerCountForTarget(commentMarkerSummary, 'check', currentCheck.id)}
                      label={`check ${currentCheck.name}`}
                    />
                  </div>
                  <div className="mt-1 truncate text-[11px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                    {currentCheck.expression}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-[var(--tabliodb-radius-md)] border border-dashed border-[rgb(var(--tabliodb-border))] p-3 text-[13px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
              No check constraints yet
            </div>
          )}
          {check ? (
            <div className="mt-3 rounded-[var(--tabliodb-radius-md)] bg-[rgb(var(--tabliodb-surface))] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate text-[13px] font-extrabold leading-5">{check.name}</div>
                    <CommentMarkerBadge
                      count={getCommentMarkerCountForTarget(commentMarkerSummary, 'check', check.id)}
                      label={`check ${check.name}`}
                    />
                  </div>
                  <div className="text-[12px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                    {formatCheckScope(model, check)}
                  </div>
                </div>
                {!readOnly ? (
                  <EditCheckDialog check={check} columns={columns} model={model} onModelChange={onModelChange} />
                ) : null}
              </div>
              <p className="mt-3 wrap-break-word rounded-[var(--tabliodb-radius-md)] bg-white p-3 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                CHECK ({check.expression})
              </p>
              {check.comment ? (
                <p className="mt-2 wrap-break-word rounded-[var(--tabliodb-radius-md)] bg-white p-3 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  {check.comment}
                </p>
              ) : null}
            </div>
          ) : null}
        </Surface>
      ) : (
        <Surface className="mt-2 border-dashed p-3 text-[13px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
          No table selected
        </Surface>
      )}
    </section>
  );
}

function AddCheckDialog({
  checks,
  columns,
  model,
  onModelChange,
  table,
}: {
  checks: DatabaseCheck[];
  columns: DatabaseColumn[];
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
  table: DatabaseTable;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<CheckFormState>({
    defaultValues: getNewCheckDefaults(table, checks),
    resolver: zodResolver(checkFormSchema),
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      form.reset(getNewCheckDefaults(table, checks));
    }
  }

  function handleSubmit(values: CheckFormState) {
    onModelChange(
      applyDiagramCommand(model, {
        type: 'check.create',
        tableId: table.id,
        columnId: normalizeCheckColumnId(values.columnId),
        name: values.name.trim(),
        expression: values.expression.trim(),
        comment: normalizeOptionalString(values.comment),
      }),
    );
    handleOpenChange(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="soft">
          <Plus className="size-4" />
          Check
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(92vw,560px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>New check constraint</DialogTitle>
            <DialogDescription>Define a SQL CHECK expression for the selected table.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <CheckFormFields columns={columns} form={form} />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <Plus className="size-4" />
              Add check
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCheckDialog({
  check,
  columns,
  model,
  onModelChange,
}: {
  check: DatabaseCheck;
  columns: DatabaseColumn[];
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [open, setOpen] = useState(false);
  const form = useForm<CheckFormState>({
    defaultValues: getCheckDefaults(check),
    resolver: zodResolver(checkFormSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset(getCheckDefaults(check));
      setConfirmDelete(false);
    }
  }, [check, form, open]);

  function handleSubmit(values: CheckFormState) {
    onModelChange(
      applyDiagramCommand(model, {
        type: 'check.update',
        checkId: check.id,
        changes: {
          columnId: normalizeCheckColumnId(values.columnId),
          comment: normalizeOptionalString(values.comment),
          expression: values.expression.trim(),
          name: values.name.trim(),
        },
      }),
    );
    setOpen(false);
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    onModelChange(
      applyDiagramCommand(model, {
        type: 'check.delete',
        checkId: check.id,
      }),
    );
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(92vw,560px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit check constraint</DialogTitle>
            <DialogDescription>Update the constraint expression, scope, or metadata.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <CheckFormFields columns={columns} form={form} />
          </DialogBody>
          <DialogFooter className="justify-between sm:justify-between">
            <Button onClick={handleDelete} type="button" variant={confirmDelete ? 'danger' : 'secondary'}>
              <Trash2 className="size-4" />
              {confirmDelete ? 'Confirm delete' : 'Delete'}
            </Button>
            <div className="flex gap-2">
              <Button onClick={() => setOpen(false)} type="button" variant="secondary">
                Cancel
              </Button>
              <Button type="submit">
                <Save className="size-4" />
                Save check
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CheckFormFields({ columns, form }: { columns: DatabaseColumn[]; form: UseFormReturn<CheckFormState> }) {
  const { errors } = form.formState;

  return (
    <div className="grid gap-4">
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Check name
        </span>
        <ControlledInput
          autoFocus
          aria-invalid={Boolean(errors.name)}
          control={form.control}
          name="name"
          placeholder="orders_total_positive"
        />
        <FieldError>{errors.name?.message}</FieldError>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Scope
        </span>
        <ControlledSelect
          className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
          control={form.control}
          name="columnId"
          options={[
            { label: 'Table-level constraint', value: unsetSelectValue },
            ...columns.map((column) => ({
              label: `${column.name} (${formatColumnType(column.type)})`,
              value: column.id,
            })),
          ]}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Expression
        </span>
        <ControlledTextarea
          className="min-h-28 w-full resize-y rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 py-2 text-sm font-semibold text-[rgb(var(--tabliodb-ink))] outline-none transition placeholder:text-[rgb(var(--tabliodb-ink-subtle))] focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
          control={form.control}
          name="expression"
          placeholder="total >= 0"
        />
        <FieldError>{errors.expression?.message}</FieldError>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
          Comment
        </span>
        <ControlledInput control={form.control} name="comment" placeholder="Constraint note" />
        <FieldError>{errors.comment?.message}</FieldError>
      </label>
    </div>
  );
}

function EnumSelectField({ enumOptions, form }: { enumOptions: DatabaseEnum[]; form: UseFormReturn<ColumnFormState> }) {
  const { errors } = form.formState;

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
        Enum type
      </span>
      <ControlledSelect
        className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
        control={form.control}
        name="enumId"
        options={[
          {
            label: enumOptions.length > 0 ? 'Choose enum' : 'Create enum first',
            value: unsetSelectValue,
          },
          ...enumOptions.map((databaseEnum) => ({
            label: databaseEnum.name,
            value: databaseEnum.id,
          })),
        ]}
      />
      <FieldError>{errors.enumId?.message}</FieldError>
    </label>
  );
}

function RelationshipInspector({
  commentMarkerSummary,
  model,
  onModelChange,
  onRelationshipSelect,
  readOnly,
  relationship,
  relationships,
  selectedRelationshipId,
}: {
  commentMarkerSummary: CommentMarkerSummary;
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
  onRelationshipSelect: (relationshipId: string) => void;
  readOnly: boolean;
  relationship: DatabaseRelationship | null;
  relationships: DatabaseRelationship[];
  selectedRelationshipId: string | null;
}) {
  return (
    <section>
      <h2 className="text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
        Relationships
      </h2>
      {relationships.length > 0 ? (
        <Surface className="mt-2 p-3">
          <div className="space-y-1">
            {relationships.map((currentRelationship) => (
              <button
                aria-pressed={selectedRelationshipId === currentRelationship.id}
                className={cn(
                  'w-full cursor-pointer rounded-xl px-2 py-2 text-left transition hover:bg-[rgb(var(--tabliodb-surface-raised))]',
                  selectedRelationshipId === currentRelationship.id &&
                    'bg-[rgb(var(--tabliodb-selected-surface))] text-[rgb(var(--tabliodb-primary-text))]',
                )}
                key={currentRelationship.id}
                onClick={() => onRelationshipSelect(currentRelationship.id)}
                type="button"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="truncate text-xs font-extrabold">
                    {getRelationshipTitle(model, currentRelationship)}
                  </div>
                  <CommentMarkerBadge
                    count={getRelationshipCommentMarkerCount(commentMarkerSummary, currentRelationship.id)}
                    label={`relationship ${getRelationshipTitle(model, currentRelationship)}`}
                  />
                </div>
                <div className="mt-1 truncate text-[11px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  {getRelationshipEndpointLabel(model, currentRelationship, 'source')}
                  {' -> '}
                  {getRelationshipEndpointLabel(model, currentRelationship, 'target')}
                </div>
              </button>
            ))}
          </div>
          {relationship ? (
            <div className="mt-3 rounded-[var(--tabliodb-radius-md)] bg-[rgb(var(--tabliodb-surface))] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate text-[13px] font-extrabold leading-5">
                      {getRelationshipTitle(model, relationship)}
                    </div>
                    <CommentMarkerBadge
                      count={getRelationshipCommentMarkerCount(commentMarkerSummary, relationship.id)}
                      label={`relationship ${getRelationshipTitle(model, relationship)}`}
                    />
                  </div>
                  <div className="text-[12px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                    {formatRelationshipCardinality(relationship.cardinality)}
                  </div>
                </div>
                {!readOnly ? (
                  <EditRelationshipDialog model={model} onModelChange={onModelChange} relationship={relationship} />
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <ColumnFact label="On delete" value={formatReferentialAction(relationship.onDelete)} />
                <ColumnFact label="On update" value={formatReferentialAction(relationship.onUpdate)} />
                <ColumnFact label="Match" value={relationship.matchType ?? '-'} />
                <ColumnFact label="Deferred" value={relationship.deferrable ? 'Yes' : 'No'} />
              </div>
              {relationship.comment ? (
                <p className="mt-3 wrap-break-word rounded-[var(--tabliodb-radius-md)] bg-white p-3 text-xs font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
                  {relationship.comment}
                </p>
              ) : null}
            </div>
          ) : null}
        </Surface>
      ) : (
        <Surface className="mt-2 border-dashed p-3 text-[13px] font-semibold text-[rgb(var(--tabliodb-ink-muted))]">
          No relationship on this table
        </Surface>
      )}
    </section>
  );
}

function EditRelationshipDialog({
  model,
  onModelChange,
  relationship,
}: {
  model: DiagramModel;
  onModelChange: (model: DiagramModel) => void;
  relationship: DatabaseRelationship;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<RelationshipFormState>({
    defaultValues: getRelationshipDefaults(relationship),
    resolver: zodResolver(relationshipFormSchema),
  });
  const { errors } = form.formState;
  const tables = Object.values(model.tables);
  const sourceTableId = form.watch('sourceTableId');
  const targetTableId = form.watch('targetTableId');
  const sourceColumns = useMemo(
    () => (sourceTableId ? getTableColumns(model, sourceTableId) : []),
    [model, sourceTableId],
  );
  const targetColumns = useMemo(
    () => (targetTableId ? getTableColumns(model, targetTableId) : []),
    [model, targetTableId],
  );
  const sourceColumnIds = sourceColumns.map((column) => column.id).join('|');
  const targetColumnIds = targetColumns.map((column) => column.id).join('|');

  useEffect(() => {
    if (open) {
      form.reset(getRelationshipDefaults(relationship));
    }
  }, [form, open, relationship]);

  useEffect(() => {
    const sourceColumnId = form.getValues('sourceColumnId');

    if (!sourceColumns.some((column) => column.id === sourceColumnId)) {
      // When the source table changes, pick the first valid column so the form never submits a stale endpoint.
      form.setValue('sourceColumnId', sourceColumns[0]?.id ?? unsetSelectValue, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, sourceColumnIds, sourceColumns]);

  useEffect(() => {
    const targetColumnId = form.getValues('targetColumnId');

    if (!targetColumns.some((column) => column.id === targetColumnId)) {
      // Foreign-key endpoint follows the selected target table for the same stale-id protection as the source side.
      form.setValue('targetColumnId', targetColumns[0]?.id ?? unsetSelectValue, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, targetColumnIds, targetColumns]);

  function handleSubmit(values: RelationshipFormState) {
    onModelChange(
      applyDiagramCommand(model, {
        type: 'relationship.update',
        relationshipId: relationship.id,
        changes: {
          cardinality: values.cardinality,
          comment: normalizeOptionalString(values.comment),
          deferrable: values.deferrable ? true : undefined,
          matchType: normalizeMatchType(values.matchType),
          name: normalizeOptionalString(values.name),
          onDelete: normalizeReferentialAction(values.onDelete),
          onUpdate: normalizeReferentialAction(values.onUpdate),
          sourceColumnIds: [values.sourceColumnId],
          sourceTableId: values.sourceTableId,
          targetColumnIds: [values.targetColumnId],
          targetTableId: values.targetTableId,
        },
      }),
    );
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(92vw,560px)]">
        <form className="contents" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit relationship</DialogTitle>
            <DialogDescription>Adjust endpoints and referential behavior.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Relationship name
                </span>
                <ControlledInput autoFocus control={form.control} name="name" placeholder="orders_user_id_fkey" />
                <FieldError>{errors.name?.message}</FieldError>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Primary table
                  </span>
                  <ControlledSelect
                    className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                    control={form.control}
                    name="sourceTableId"
                    options={tables.map((table) => ({ label: table.name, value: table.id }))}
                  />
                  <FieldError>{errors.sourceTableId?.message}</FieldError>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Primary column
                  </span>
                  <ControlledSelect
                    className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                    control={form.control}
                    name="sourceColumnId"
                    options={
                      sourceColumns.length > 0
                        ? sourceColumns.map((column) => ({
                            label: `${column.name} (${formatColumnType(column.type)})`,
                            value: column.id,
                          }))
                        : [{ disabled: true, label: 'No columns', value: unsetSelectValue }]
                    }
                  />
                  <FieldError>{errors.sourceColumnId?.message}</FieldError>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Foreign table
                  </span>
                  <ControlledSelect
                    className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                    control={form.control}
                    name="targetTableId"
                    options={tables.map((table) => ({ label: table.name, value: table.id }))}
                  />
                  <FieldError>{errors.targetTableId?.message}</FieldError>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Foreign column
                  </span>
                  <ControlledSelect
                    className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                    control={form.control}
                    name="targetColumnId"
                    options={
                      targetColumns.length > 0
                        ? targetColumns.map((column) => ({
                            label: `${column.name} (${formatColumnType(column.type)})`,
                            value: column.id,
                          }))
                        : [{ disabled: true, label: 'No columns', value: unsetSelectValue }]
                    }
                  />
                  <FieldError>{errors.targetColumnId?.message}</FieldError>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Cardinality
                  </span>
                  <ControlledSelect
                    className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                    control={form.control}
                    name="cardinality"
                    options={relationshipCardinalityOptions.map((option) => ({
                      label: formatRelationshipCardinality(option),
                      value: option,
                    }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    Match type
                  </span>
                  <ControlledSelect
                    className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                    control={form.control}
                    name="matchType"
                    options={matchTypeOptions.map((option) => ({
                      label: option === unsetSelectValue ? 'Not set' : option,
                      value: option,
                    }))}
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    On delete
                  </span>
                  <ControlledSelect
                    className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                    control={form.control}
                    name="onDelete"
                    options={referentialActionOptions.map((option) => ({
                      label: option === unsetSelectValue ? 'Not set' : formatReferentialAction(option),
                      value: option,
                    }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                    On update
                  </span>
                  <ControlledSelect
                    className="h-11 w-full cursor-pointer rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] bg-white px-3 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] outline-none transition focus:border-[rgb(var(--tabliodb-primary))] focus:ring-4 focus:ring-[rgb(var(--tabliodb-focus-ring))]"
                    control={form.control}
                    name="onUpdate"
                    options={referentialActionOptions.map((option) => ({
                      label: option === unsetSelectValue ? 'Not set' : formatReferentialAction(option),
                      value: option,
                    }))}
                  />
                </label>
              </div>
              <CheckboxField control={form.control} label="Deferrable" name="deferrable" />
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-muted))]">
                  Comment
                </span>
                <ControlledInput control={form.control} name="comment" placeholder="Relationship note" />
                <FieldError>{errors.comment?.message}</FieldError>
              </label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setOpen(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <Save className="size-4" />
              Save relationship
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CheckboxField<TFieldValues extends FieldValues>({
  label,
  ...props
}: ControlledCheckboxProps<TFieldValues> & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-[14px] border-2 border-[rgb(var(--tabliodb-border))] px-3 py-2 text-sm font-extrabold text-[rgb(var(--tabliodb-ink))] transition hover:bg-[rgb(var(--tabliodb-surface-raised))]">
      <ControlledCheckbox {...props} />
      {label}
    </label>
  );
}

function ColumnFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[rgb(var(--tabliodb-surface-raised))] px-3 py-2">
      <div className="truncate text-[10px] font-extrabold uppercase tracking-wide text-[rgb(var(--tabliodb-ink-subtle))]">
        {label}
      </div>
      <div className="mt-0.5 line-clamp-2 wrap-break-word font-extrabold leading-4 text-[rgb(var(--tabliodb-ink))]">
        {value}
      </div>
    </div>
  );
}

function CommentMarkerBadge({ count, label }: { count: CommentMarkerCount; label: string }) {
  if (!hasOpenCommentMarkers(count)) {
    return null;
  }

  const title = formatCommentMarkerTitle(count, label);

  return (
    <WithTooltip content={title}>
      <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-[rgb(var(--tabliodb-sky-border))] bg-[rgb(var(--tabliodb-sky-soft))] px-1.5 text-[10px] font-extrabold leading-none text-[rgb(var(--tabliodb-sky-text))] shadow-[0_1px_0_rgb(var(--tabliodb-sky-border))]">
        <MessageSquareText className="size-3" />
        {formatCommentMarkerCount(count)}
      </span>
    </WithTooltip>
  );
}

function ColumnBadge({ children }: { children: string }) {
  return (
    <WithTooltip content={getColumnBadgeTooltip(children)}>
      <span className="inline-block max-w-full truncate rounded-md bg-[rgb(var(--tabliodb-surface-raised))] px-1.5 py-0.5 align-middle text-[10px] font-extrabold text-[rgb(var(--tabliodb-ink-muted))]">
        {children}
      </span>
    </WithTooltip>
  );
}

function getColumnBadgeTooltip(value: string): string {
  const labels: Record<string, string> = {
    NN: 'Not nullable',
    PK: 'Primary key',
    UQ: 'Unique column',
  };

  return labels[value] ?? value;
}

function getEditTableDefaults(table: DatabaseTable): EditTableFormState {
  return {
    color: getDisplayTableColor(table.color),
    name: table.name,
    width: table.width,
  };
}

function getNewColumnDefaults(): ColumnFormState {
  return {
    autoIncrement: false,
    comment: '',
    defaultValue: '',
    enumId: unsetSelectValue,
    family: 'varchar',
    length: 160,
    name: '',
    nullable: true,
    primaryKey: false,
    unique: false,
  };
}

function getColumnDefaults(column: DatabaseColumn): ColumnFormState {
  return {
    autoIncrement: column.autoIncrement,
    comment: column.comment ?? '',
    defaultValue: column.defaultValue ?? '',
    enumId: column.type.enumId ?? unsetSelectValue,
    family: column.type.family,
    length: column.type.length ?? 160,
    name: column.name,
    nullable: column.nullable,
    primaryKey: column.primaryKey,
    unique: column.unique,
  };
}

function createColumnType(values: ColumnFormState, currentType?: ColumnTypeSpec): ColumnTypeSpec {
  const preservedType = currentType?.family === values.family ? currentType : undefined;

  if (values.family === 'varchar') {
    return {
      ...(preservedType ?? {}),
      family: values.family,
      // Length is the only type facet exposed in the first inspector form, while imported metadata stays intact.
      length: values.length ?? preservedType?.length ?? 160,
      raw: undefined,
    };
  }

  if (values.family === 'enum') {
    return {
      family: values.family,
      // Enum columns point at a diagram enum entity, so rename/edit enum values do not require column rewrites.
      enumId: values.enumId,
      raw: undefined,
    };
  }

  if (preservedType) {
    // Preserve precision, scale, enumId, and raw metadata when the user edits flags without changing the type family.
    return preservedType;
  }

  return { family: values.family };
}

function normalizeOptionalString(value: string): string | undefined {
  const trimmedValue = value.trim();

  // Store blank optional values as undefined so generated SQL and inspector facts do not carry empty strings.
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function getNewEnumDefaults(model: DiagramModel): EnumFormState {
  const nextEnumIndex = Object.keys(model.enums).length + 1;

  return {
    comment: '',
    name: `status_${nextEnumIndex}`,
    schema: '',
    valuesText: 'draft\npublished\narchived',
  };
}

function getEnumDefaults(databaseEnum: DatabaseEnum): EnumFormState {
  return {
    comment: databaseEnum.comment ?? '',
    name: databaseEnum.name,
    schema: databaseEnum.schema ?? '',
    valuesText: databaseEnum.values.join('\n'),
  };
}

function parseEnumValues(value: string): string[] {
  const values = value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

  // Preserve the user's ordering while removing duplicates, matching schema-core command normalization.
  return Array.from(new Set(values));
}

function countEnumUsage(model: DiagramModel, enumId: string): number {
  return Object.values(model.columns).filter((column) => column.type.enumId === enumId).length;
}

function countTableRelationships(model: DiagramModel, table: DatabaseTable): number {
  return Object.values(model.relationships).filter(
    (relationship) => relationship.sourceTableId === table.id || relationship.targetTableId === table.id,
  ).length;
}

function getTableIndexes(model: DiagramModel, table: DatabaseTable): DatabaseIndex[] {
  return table.indexIds.flatMap((indexId) => {
    const index = model.indexes[indexId];

    return index ? [index] : [];
  });
}

function getTableChecks(model: DiagramModel, tableId: string): DatabaseCheck[] {
  return Object.values(model.checks).filter((check) => check.tableId === tableId);
}

function getTableRelationships(model: DiagramModel, tableId: string): DatabaseRelationship[] {
  return Object.values(model.relationships).filter(
    (relationship) => relationship.sourceTableId === tableId || relationship.targetTableId === tableId,
  );
}

function countColumnRelationships(model: DiagramModel, column: DatabaseColumn): number {
  return Object.values(model.relationships).filter(
    (relationship) =>
      relationship.sourceColumnIds.includes(column.id) || relationship.targetColumnIds.includes(column.id),
  ).length;
}

function relationshipTouchesColumn(relationship: DatabaseRelationship, columnId: string): boolean {
  return relationship.sourceColumnIds.includes(columnId) || relationship.targetColumnIds.includes(columnId);
}

function getNewIndexDefaults(table: DatabaseTable, columns: DatabaseColumn[]): IndexFormState {
  const firstColumn = columns[0];
  const orderByColumnId: IndexFormState['orderByColumnId'] = Object.fromEntries(
    columns.map((column) => [column.id, unsetSelectValue]),
  );
  const nullsByColumnId: IndexFormState['nullsByColumnId'] = Object.fromEntries(
    columns.map((column) => [column.id, unsetSelectValue]),
  );

  return {
    columnIds: firstColumn ? [firstColumn.id] : [],
    comment: '',
    includeColumnIds: [],
    method: unsetSelectValue,
    name: getSuggestedIndexName(table, firstColumn),
    nullsByColumnId,
    orderByColumnId,
    unique: false,
    where: '',
  };
}

function getIndexDefaults(index: DatabaseIndex, columns: DatabaseColumn[]): IndexFormState {
  const orderByColumnId: IndexFormState['orderByColumnId'] = Object.fromEntries(
    columns.map((column) => [column.id, unsetSelectValue]),
  );
  const nullsByColumnId: IndexFormState['nullsByColumnId'] = Object.fromEntries(
    columns.map((column) => [column.id, unsetSelectValue]),
  );

  for (const indexColumn of index.columns) {
    orderByColumnId[indexColumn.columnId] = indexColumn.order ?? unsetSelectValue;
    nullsByColumnId[indexColumn.columnId] = indexColumn.nulls ?? unsetSelectValue;
  }

  return {
    columnIds: index.columns.map((column) => column.columnId),
    comment: index.comment ?? '',
    includeColumnIds: index.includeColumnIds ?? [],
    method: index.method ?? unsetSelectValue,
    name: index.name,
    nullsByColumnId,
    orderByColumnId,
    unique: index.unique,
    where: index.where ?? '',
  };
}

function getNewCheckDefaults(table: DatabaseTable, checks: DatabaseCheck[]): CheckFormState {
  return {
    columnId: unsetSelectValue,
    comment: '',
    expression: '',
    name: normalizeIdentifier(`${table.name}_check_${checks.length + 1}`),
  };
}

function getCheckDefaults(check: DatabaseCheck): CheckFormState {
  return {
    columnId: check.columnId ?? unsetSelectValue,
    comment: check.comment ?? '',
    expression: check.expression,
    name: check.name,
  };
}

function normalizeCheckColumnId(value: CheckFormState['columnId']): string | undefined {
  return value === unsetSelectValue ? undefined : value;
}

function createIndexColumns(values: IndexFormState): DatabaseIndexColumn[] {
  return values.columnIds.map((columnId) => {
    const indexColumn: DatabaseIndexColumn = { columnId };
    const order = normalizeIndexOrder(values.orderByColumnId[columnId] ?? unsetSelectValue);
    const nulls = normalizeIndexNulls(values.nullsByColumnId[columnId] ?? unsetSelectValue);

    if (order) {
      indexColumn.order = order;
    }

    if (nulls) {
      indexColumn.nulls = nulls;
    }

    return indexColumn;
  });
}

function normalizeIncludeColumnIds(values: IndexFormState): string[] | undefined {
  const keyColumnIds = new Set(values.columnIds);
  const includeColumnIds = values.includeColumnIds.filter((columnId) => !keyColumnIds.has(columnId));

  // Empty INCLUDE lists are stored as undefined to keep the serialized diagram compact.
  return includeColumnIds.length > 0 ? includeColumnIds : undefined;
}

function normalizeIndexMethod(value: IndexFormState['method']): DatabaseIndex['method'] | undefined {
  return value === unsetSelectValue ? undefined : value;
}

function normalizeIndexOrder(
  value: IndexFormState['orderByColumnId'][string],
): DatabaseIndexColumn['order'] | undefined {
  return value === unsetSelectValue ? undefined : value;
}

function normalizeIndexNulls(
  value: IndexFormState['nullsByColumnId'][string],
): DatabaseIndexColumn['nulls'] | undefined {
  return value === unsetSelectValue ? undefined : value;
}

function getSuggestedIndexName(table: DatabaseTable, column: DatabaseColumn | undefined): string {
  return normalizeIdentifier(`${table.name}_${column?.name ?? 'column'}_idx`) || `idx_${table.id}`;
}

function normalizeIdentifier(value: string): string {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  // Index names must start with a letter because the form schema intentionally follows common SQL identifier rules.
  return /^[a-z]/.test(normalizedValue) ? normalizedValue : `idx_${normalizedValue}`;
}

function formatIndexColumns(model: DiagramModel, index: DatabaseIndex): string {
  return index.columns.map((column) => formatIndexColumn(model, column)).join(', ');
}

function formatIndexColumn(model: DiagramModel, indexColumn: DatabaseIndexColumn): string {
  const columnName = model.columns[indexColumn.columnId]?.name ?? indexColumn.columnId;
  const facets = [
    indexColumn.order ? indexColumn.order.toUpperCase() : undefined,
    indexColumn.nulls ? `NULLS ${indexColumn.nulls.toUpperCase()}` : undefined,
  ].filter(Boolean);

  return facets.length > 0 ? `${columnName} ${facets.join(' ')}` : columnName;
}

function formatIndexMethod(method: DatabaseIndex['method']): string {
  return method ?? 'default';
}

function formatCheckScope(model: DiagramModel, check: DatabaseCheck): string {
  if (!check.columnId) {
    return 'Table-level constraint';
  }

  const column = model.columns[check.columnId];
  return column ? `Column ${column.name}` : `Column ${check.columnId}`;
}

function getRelationshipDefaults(relationship: DatabaseRelationship): RelationshipFormState {
  return {
    cardinality: relationship.cardinality,
    comment: relationship.comment ?? '',
    deferrable: relationship.deferrable ?? false,
    matchType: relationship.matchType ?? unsetSelectValue,
    name: relationship.name ?? '',
    onDelete: relationship.onDelete ?? unsetSelectValue,
    onUpdate: relationship.onUpdate ?? unsetSelectValue,
    sourceColumnId: relationship.sourceColumnIds[0] ?? unsetSelectValue,
    sourceTableId: relationship.sourceTableId,
    targetColumnId: relationship.targetColumnIds[0] ?? unsetSelectValue,
    targetTableId: relationship.targetTableId,
  };
}

function normalizeReferentialAction(value: RelationshipFormState['onDelete']): ReferentialAction | undefined {
  return value === unsetSelectValue ? undefined : value;
}

function normalizeMatchType(value: RelationshipFormState['matchType']): DatabaseRelationship['matchType'] | undefined {
  return value === unsetSelectValue ? undefined : value;
}

function getRelationshipTitle(model: DiagramModel, relationship: DatabaseRelationship): string {
  if (relationship.name) {
    return relationship.name;
  }

  return `${getRelationshipEndpointLabel(model, relationship, 'source')} -> ${getRelationshipEndpointLabel(
    model,
    relationship,
    'target',
  )}`;
}

function getRelationshipEndpointLabel(
  model: DiagramModel,
  relationship: DatabaseRelationship,
  role: 'source' | 'target',
): string {
  const tableId = role === 'source' ? relationship.sourceTableId : relationship.targetTableId;
  const columnIds = role === 'source' ? relationship.sourceColumnIds : relationship.targetColumnIds;
  const table = model.tables[tableId];
  const columns = columnIds.map((columnId) => model.columns[columnId]?.name ?? columnId).join(', ');

  return `${table?.name ?? tableId}.${columns || '?'}`;
}

function formatRelationshipCardinality(cardinality: DatabaseRelationship['cardinality']): string {
  const labels: Record<DatabaseRelationship['cardinality'], string> = {
    many_to_many: 'Many to many',
    one_to_many: 'One to many',
    one_to_one: 'One to one',
  };

  return labels[cardinality];
}

function formatReferentialAction(action: ReferentialAction | undefined): string {
  if (!action) {
    return '-';
  }

  const labels: Record<ReferentialAction, string> = {
    cascade: 'Cascade',
    no_action: 'No action',
    restrict: 'Restrict',
    set_default: 'Set default',
    set_null: 'Set null',
  };

  return labels[action];
}
