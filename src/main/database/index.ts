import type Database from 'better-sqlite3';
import { ManagedPackageRepository } from '../packages/package-repository';
import { getSqlite } from './client';
import { bootstrapSchemaSql, managedPackageSchemaStatements } from './bootstrap';

type TableInfoRow = {
  name: string;
};

export const applyDatabaseUpgrades = (sqlite: Database.Database): void => {
	sqlite.exec(managedPackageSchemaStatements.join(";\n"));
	const worktreeColumns = sqlite
		.prepare("PRAGMA table_info(worktrees)")
		.all() as TableInfoRow[];
	if (
		worktreeColumns.length > 0 &&
		!worktreeColumns.some(({ name }) => name === "kind")
	) {
		sqlite.exec(
			"ALTER TABLE worktrees ADD COLUMN kind TEXT NOT NULL DEFAULT 'linked'",
		);
	}

  const sessionColumns = sqlite
    .prepare('PRAGMA table_info(coding_agent_sessions)')
    .all() as TableInfoRow[];
  if (
    sessionColumns.length > 0 &&
    !sessionColumns.some(({ name }) => name === 'last_viewed_at')
  ) {
    sqlite.exec(
      'ALTER TABLE coding_agent_sessions ADD COLUMN last_viewed_at INTEGER',
    );
  }
};

export const initDatabase = (): void => {
  const sqlite = getSqlite();
  sqlite.exec(bootstrapSchemaSql);
  applyDatabaseUpgrades(sqlite);
  // Quarantine incomplete updates before any catalog or host is constructed.
  new ManagedPackageRepository(sqlite).quarantineUpdateRecoveries();
};
