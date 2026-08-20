import type { Dialect } from '@tabliodb/sdk';
import { cn, type SelectOption } from '@tabliodb/ui';
import mariadbIconUrl from '@/assets/dialects/mariadb.svg';
import mysqlIconUrl from '@/assets/dialects/mysql.svg';
import postgresqlIconUrl from '@/assets/dialects/postgresql.svg';
import sqliteIconUrl from '@/assets/dialects/sqlite.svg';
import sqlserverIconUrl from '@/assets/dialects/sqlserver.svg';

type DialectValue = Dialect | string;

const dialectMeta: Record<
  string,
  {
    iconUrl: string;
    label: string;
    logoBackground: string;
    pillClassName: string;
  }
> = {
  mariadb: {
    iconUrl: mariadbIconUrl,
    label: 'MariaDB',
    logoBackground: 'bg-[#fff7e8]',
    pillClassName: 'border-[#dfc39d] bg-[#fff8ec] text-[#6e4f22]',
  },
  mysql: {
    iconUrl: mysqlIconUrl,
    label: 'MySQL',
    logoBackground: 'bg-[#0f7c91]',
    pillClassName: 'border-[#8ed5e1] bg-[#ecfbff] text-[#075f71]',
  },
  postgresql: {
    iconUrl: postgresqlIconUrl,
    label: 'PostgreSQL',
    logoBackground: 'bg-[#eef6ff]',
    pillClassName: 'border-[#a7c4dc] bg-[#f3f9ff] text-[#245878]',
  },
  sqlite: {
    iconUrl: sqliteIconUrl,
    label: 'SQLite',
    logoBackground: 'bg-[#eff9ff]',
    pillClassName: 'border-[#a5d7f0] bg-[#f1fbff] text-[#075b83]',
  },
  sqlserver: {
    iconUrl: sqlserverIconUrl,
    label: 'SQL Server',
    logoBackground: 'bg-[#eef8ff]',
    pillClassName: 'border-[#a6d9f0] bg-[#f0fbff] text-[#075a87]',
  },
};

export function DialectIcon({ className, dialect }: { className?: string; dialect: DialectValue }) {
  const meta = getDialectMeta(dialect);

  return <img alt="" aria-hidden="true" className={cn('size-4 object-contain', className)} src={meta.iconUrl} />;
}

export function DialectBadge({ className, dialect }: { className?: string; dialect: DialectValue }) {
  const meta = getDialectMeta(dialect);

  return (
    <span
      className={cn(
        // Dialect badges use real logo color families, not generic opacity tints, so they stay readable in the light editor.
        'inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border px-2 text-[11px] font-black leading-none',
        meta.pillClassName,
        className,
      )}
    >
      <span
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-[7px] border border-white shadow-[0_1px_0_rgb(15_23_42/0.08)]',
          meta.logoBackground,
        )}
      >
        <DialectIcon className="size-3.5" dialect={dialect} />
      </span>
      <span className="truncate">{meta.label}</span>
    </span>
  );
}

export function DialectSelectLabel({ dialect }: { dialect: DialectValue }) {
  const meta = getDialectMeta(dialect);

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={cn(
          // Select rows need a quieter icon treatment than cards, so the logo reads as metadata instead of a call to action.
          'grid size-6 shrink-0 place-items-center rounded-[8px] border border-[rgb(var(--tabliodb-border))]',
          meta.logoBackground,
        )}
      >
        <DialectIcon className="size-4" dialect={dialect} />
      </span>
      <span className="truncate">{meta.label}</span>
    </span>
  );
}

export function getDialectSelectOption(dialect: DialectValue): SelectOption {
  return {
    label: <DialectSelectLabel dialect={dialect} />,
    textValue: formatDialectLabel(dialect),
    value: String(dialect),
  };
}

export function formatDialectLabel(dialect: DialectValue): string {
  return getDialectMeta(dialect).label;
}

function getDialectMeta(dialect: DialectValue) {
  const key = String(dialect).toLowerCase();

  return (
    dialectMeta[key] ?? {
      iconUrl: postgresqlIconUrl,
      label: String(dialect),
      logoBackground: 'bg-[rgb(var(--tabliodb-surface-raised))]',
      pillClassName: 'border-[rgb(var(--tabliodb-border))] bg-white text-[rgb(var(--tabliodb-ink-muted))]',
    }
  );
}
