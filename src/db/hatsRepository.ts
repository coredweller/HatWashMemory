import type Database from "better-sqlite3";
import { logger } from "../logger.js";
import { fail, ok, type Result } from "../result.js";

export interface HatRow {
  id: number;
  name: string;
  image_file: string | null;
  notes: string | null;
  retired_at: number | null;
  created_at: number;
}

export interface NewHat {
  name: string;
  image_file: string | null;
  notes: string | null;
  created_at: number;
}

/** Fields a PATCH may change. `undefined` means "leave alone"; `null` means "clear". */
export interface HatUpdate {
  name?: string;
  notes?: string | null;
  image_file?: string | null;
  retired_at?: number | null;
}

export class HatsRepository {
  constructor(private readonly db: Database.Database) {}

  getById(id: number): HatRow | null {
    const row = this.db.prepare("SELECT * FROM hats WHERE id = ?").get(id) as HatRow | undefined;
    return row ?? null;
  }

  insertHat(hat: NewHat): Result<{ id: number }> {
    try {
      const statement = this.db.prepare(`
        INSERT INTO hats (name, image_file, notes, created_at)
        VALUES (@name, @image_file, @notes, @created_at)
      `);
      const result = statement.run(hat);
      return ok({ id: Number(result.lastInsertRowid) });
    } catch (error) {
      logger.error({ err: error, name: hat.name }, "Failed to insert hat");
      // The unique index on name is the expected collision here, so report it as such.
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        return fail(new Error(`A hat named "${hat.name}" already exists`));
      }
      return fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /** Applies only the provided fields. Returns false when the hat id does not exist. */
  updateHat(id: number, update: HatUpdate): Result<{ updated: boolean }> {
    const assignments: string[] = [];
    const params: Record<string, unknown> = { id };

    for (const column of ["name", "notes", "image_file", "retired_at"] as const) {
      if (update[column] !== undefined) {
        assignments.push(`${column} = @${column}`);
        params[column] = update[column];
      }
    }

    if (assignments.length === 0) {
      return ok({ updated: false });
    }

    try {
      const statement = this.db.prepare(`UPDATE hats SET ${assignments.join(", ")} WHERE id = @id`);
      const result = statement.run(params);
      return ok({ updated: result.changes > 0 });
    } catch (error) {
      logger.error({ err: error, hatId: id }, "Failed to update hat");
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        return fail(new Error(`A hat named "${update.name}" already exists`));
      }
      return fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /** Washes go with it via ON DELETE CASCADE. */
  deleteHat(id: number): Result<{ deleted: boolean }> {
    try {
      const result = this.db.prepare("DELETE FROM hats WHERE id = ?").run(id);
      return ok({ deleted: result.changes > 0 });
    } catch (error) {
      logger.error({ err: error, hatId: id }, "Failed to delete hat");
      return fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
