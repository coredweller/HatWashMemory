import type Database from "better-sqlite3";
import { logger } from "../logger.js";
import { fail, ok, type Result } from "../result.js";

export interface NewWash {
  hat_id: number;
  washed_at: number;
  notes: string | null;
  created_at: number;
}

export class WashesRepository {
  constructor(private readonly db: Database.Database) {}

  insertWash(wash: NewWash): Result<{ id: number }> {
    try {
      const statement = this.db.prepare(`
        INSERT INTO washes (hat_id, washed_at, notes, created_at)
        VALUES (@hat_id, @washed_at, @notes, @created_at)
      `);
      const result = statement.run(wash);
      return ok({ id: Number(result.lastInsertRowid) });
    } catch (error) {
      logger.error({ err: error, hatId: wash.hat_id }, "Failed to insert wash");
      return fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  deleteWash(id: number): Result<{ deleted: boolean }> {
    try {
      const result = this.db.prepare("DELETE FROM washes WHERE id = ?").run(id);
      return ok({ deleted: result.changes > 0 });
    } catch (error) {
      logger.error({ err: error, washId: id }, "Failed to delete wash");
      return fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
