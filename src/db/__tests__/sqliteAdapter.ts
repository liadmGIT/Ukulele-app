import { DatabaseSync } from 'node:sqlite';

/**
 * A stand-in for `expo-sqlite`'s synchronous API, backed by Node's own SQLite.
 *
 * This exists so the real `SqliteDriver` — its actual migrations, its actual
 * upserts, its actual foreign keys — can be exercised in CI. The alternative is
 * testing a hand-written imitation of the SQL, which would have happily passed
 * while the shipped statements were the ones that could not run.
 *
 * Only the surface the driver uses is implemented, and it is deliberately thin:
 * anything clever here would be a way for the test to disagree with the device.
 */

type Row = Record<string, unknown>;

class Statement {
  constructor(private readonly statement: ReturnType<DatabaseSync['prepare']>) {}

  executeSync(...params: unknown[]): void {
    this.statement.run(...(params as never[]));
  }

  finalizeSync(): void {
    // node:sqlite finalises on garbage collection; nothing to do.
  }
}

export class TestDatabase {
  private readonly db: DatabaseSync;
  private inTransaction = false;

  constructor(location = ':memory:') {
    this.db = new DatabaseSync(location);
  }

  execSync(sql: string): void {
    this.db.exec(sql);
  }

  runSync(sql: string, ...params: unknown[]): void {
    this.db.prepare(sql).run(...(params as never[]));
  }

  getFirstSync<T>(sql: string, ...params: unknown[]): T | null {
    return (this.db.prepare(sql).get(...(params as never[])) as T | undefined) ?? null;
  }

  getAllSync<T>(sql: string, ...params: unknown[]): T[] {
    return this.db.prepare(sql).all(...(params as never[])) as T[];
  }

  prepareSync(sql: string): Statement {
    return new Statement(this.db.prepare(sql));
  }

  withTransactionSync(work: () => void): void {
    // Matches expo-sqlite: nested calls join the outer transaction rather than
    // failing, which `replaceContent` relies on.
    if (this.inTransaction) {
      work();
      return;
    }

    this.inTransaction = true;
    this.db.exec('BEGIN;');
    try {
      work();
      this.db.exec('COMMIT;');
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    } finally {
      this.inTransaction = false;
    }
  }

  close(): void {
    this.db.close();
  }
}

/** Rows as plain objects, for assertions. */
export function rows<T extends Row>(database: TestDatabase, sql: string): T[] {
  return database.getAllSync<T>(sql);
}
