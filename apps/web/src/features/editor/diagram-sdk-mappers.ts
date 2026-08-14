import type { DatabaseDialect, DiagramReviewSignalCode } from '@tabliodb/schema-core';
import { Dialect as SdkDialect, DisabledRuleKeys as SdkDisabledRuleKeys } from '@tabliodb/sdk';

export const diagramDialectOptions = [
  'postgresql',
  'mysql',
  'sqlite',
  'mariadb',
  'sqlserver',
] as const satisfies readonly DatabaseDialect[];

export const sdkDialectByValue: Record<DatabaseDialect, SdkDialect> = {
  mariadb: SdkDialect.Mariadb,
  mysql: SdkDialect.Mysql,
  postgresql: SdkDialect.Postgresql,
  sqlite: SdkDialect.Sqlite,
  sqlserver: SdkDialect.Sqlserver,
};

export const sdkDisabledRuleKeyByValue: Record<DiagramReviewSignalCode, SdkDisabledRuleKeys> = {
  duplicate_column_name: SdkDisabledRuleKeys.DuplicateColumnName,
  duplicate_table_name: SdkDisabledRuleKeys.DuplicateTableName,
  email_column_not_unique: SdkDisabledRuleKeys.EmailColumnNotUnique,
  foreign_key_missing_index: SdkDisabledRuleKeys.ForeignKeyMissingIndex,
  money_column_uses_float: SdkDisabledRuleKeys.MoneyColumnUsesFloat,
  relationship_column_type_mismatch: SdkDisabledRuleKeys.RelationshipColumnTypeMismatch,
  table_missing_primary_key: SdkDisabledRuleKeys.TableMissingPrimaryKey,
  unused_enum: SdkDisabledRuleKeys.UnusedEnum,
};

export function toDatabaseDialect(dialect: DatabaseDialect | SdkDialect): DatabaseDialect {
  // Generated SDK enum dan schema-core dialect berbagi value string yang sama, tetapi boundary ini menjaga cast tetap eksplisit.
  return dialect as DatabaseDialect;
}

export function toDiagramReviewSignalCode(
  ruleKey: DiagramReviewSignalCode | SdkDisabledRuleKeys,
): DiagramReviewSignalCode {
  // Review settings API memakai enum SDK, sedangkan schema-core memakai union domain; mapper ini jadi titik konversi tunggal.
  return ruleKey as DiagramReviewSignalCode;
}
