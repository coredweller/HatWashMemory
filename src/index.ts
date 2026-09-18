import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { z } from "zod";
import { config } from "./config.js";
import { openDatabase } from "./db/connection.js";
import { HatsRepository } from "./db/hatsRepository.js";
import { WashesRepository } from "./db/washesRepository.js";
import {
  CONTENT_TYPE_BY_EXTENSION,
  deleteImage,
  ensureImagesDir,
  IMAGE_FILE_PATTERN,
  storeImage,
} from "./images/storeImage.js";
import { logger } from "./logger.js";
import { fail, ok, type Result } from "./result.js";
import { parseWashDate, todayNoonSeconds } from "./web/dates.js";
import { queryHats } from "./web/queryHats.js";
import { queryWashLog } from "./web/queryHistory.js";
import { rankHats } from "./web/rankHats.js";
import { renderPage } from "./web/renderPage.js";
import { summarizeHistory } from "./web/summarizeHistory.js";

/** Base64 image payloads travel in the JSON body, so this is larger than a typical API cap. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

const HAT_ID_PATTERN = /^\/api\/hats\/(\d+)$/;
const WASH_ID_PATTERN = /^\/api\/washes\/(\d+)$/;

const nameSchema = z.string().trim().min(1, "Name is required").max(100);
const notesSchema = z.string().trim().max(500, "Notes must be 500 characters or fewer");

const createHatSchema = z.object({
  name: nameSchema,
  notes: notesSchema.optional(),
  imageDataUrl: z.string().optional(),
});

const updateHatSchema = z.object({
  name: nameSchema.optional(),
  notes: notesSchema.optional(),
  imageDataUrl: z.string().optional(),
  retired: z.boolean().optional(),
});

const createWashSchema = z.object({
  hatId: z.number().int().positive(),
  washedAt: z.string().optional(),
  notes: notesSchema.optional(),
});

const db = openDatabase();
const hatsRepository = new HatsRepository(db);
const washesRepository = new WashesRepository(db);
ensureImagesDir();

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > MAX_BODY_BYTES) reject(new Error("Request body too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function parseBody<T>(schema: z.ZodType<T>, raw: string): Result<T> {
  let json: unknown;
  try {
    json = raw.trim() === "" ? {} : JSON.parse(raw);
  } catch {
    return fail(new Error("Request body is not valid JSON"));
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const location = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return fail(new Error(`${location}${issue.message}`));
  }
  return ok(parsed.data);
}

/** Blank text fields come back from the form as "" — store those as NULL, not empty strings. */
function normalizeNotes(notes: string | undefined): string | null | undefined {
  if (notes === undefined) return undefined;
  return notes.trim() === "" ? null : notes.trim();
}

function renderCurrentPage(): string {
  const now = new Date();
  const ranked = rankHats(queryHats(), now);
  const log = queryWashLog();
  return renderPage({ ranked, log, stats: summarizeHistory(log, ranked.queue, now) }, now);
}

function serveImage(res: ServerResponse, fileName: string): void {
  // Validate the name before touching the filesystem — path traversal cannot survive this.
  if (!IMAGE_FILE_PATTERN.test(fileName)) {
    sendError(res, 404, "Not found");
    return;
  }

  let file: Buffer;
  try {
    file = readFileSync(join(config.IMAGES_DIR, fileName));
  } catch (error) {
    logger.warn({ err: error, fileName }, "Requested hat image is missing");
    sendError(res, 404, "Not found");
    return;
  }

  const extension = fileName.split(".").pop() ?? "jpg";
  res.writeHead(200, {
    "Content-Type": CONTENT_TYPE_BY_EXTENSION[extension],
    // Filenames are random and never reused, so a stored image can be cached indefinitely.
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  res.end(file);
}

async function handleCreateHat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = parseBody(createHatSchema, await readBody(req));
  if (!body.ok) {
    sendError(res, 400, body.error.message);
    return;
  }

  let imageFile: string | null = null;
  if (body.value.imageDataUrl !== undefined && body.value.imageDataUrl !== "") {
    const stored = storeImage(body.value.imageDataUrl);
    if (!stored.ok) {
      sendError(res, 400, stored.error.message);
      return;
    }
    imageFile = stored.value;
  }

  const inserted = hatsRepository.insertHat({
    name: body.value.name,
    image_file: imageFile,
    notes: normalizeNotes(body.value.notes) ?? null,
    created_at: Math.floor(Date.now() / 1000),
  });

  if (!inserted.ok) {
    // The hat was rejected, so the image we just wrote has no owner.
    if (imageFile !== null) deleteImage(imageFile);
    sendError(res, 400, inserted.error.message);
    return;
  }

  logger.info({ hatId: inserted.value.id, name: body.value.name }, "Added hat");
  sendJson(res, 201, { id: inserted.value.id });
}

async function handleUpdateHat(req: IncomingMessage, res: ServerResponse, hatId: number): Promise<void> {
  const existing = hatsRepository.getById(hatId);
  if (existing === null) {
    sendError(res, 404, `No hat with id ${hatId}`);
    return;
  }

  const body = parseBody(updateHatSchema, await readBody(req));
  if (!body.ok) {
    sendError(res, 400, body.error.message);
    return;
  }

  let newImageFile: string | undefined;
  if (body.value.imageDataUrl !== undefined && body.value.imageDataUrl !== "") {
    const stored = storeImage(body.value.imageDataUrl);
    if (!stored.ok) {
      sendError(res, 400, stored.error.message);
      return;
    }
    newImageFile = stored.value;
  }

  const retiredAt =
    body.value.retired === undefined ? undefined : body.value.retired ? Math.floor(Date.now() / 1000) : null;

  const updated = hatsRepository.updateHat(hatId, {
    name: body.value.name,
    notes: normalizeNotes(body.value.notes),
    image_file: newImageFile,
    retired_at: retiredAt,
  });

  if (!updated.ok) {
    if (newImageFile !== undefined) deleteImage(newImageFile);
    sendError(res, 400, updated.error.message);
    return;
  }

  // Only now that the row points at the new file is the old one safe to remove.
  if (newImageFile !== undefined && existing.image_file !== null) {
    deleteImage(existing.image_file);
  }

  logger.info({ hatId, retired: body.value.retired }, "Updated hat");
  sendJson(res, 200, { id: hatId });
}

function handleDeleteHat(res: ServerResponse, hatId: number): void {
  const existing = hatsRepository.getById(hatId);
  if (existing === null) {
    sendError(res, 404, `No hat with id ${hatId}`);
    return;
  }

  const deleted = hatsRepository.deleteHat(hatId);
  if (!deleted.ok) {
    sendError(res, 500, deleted.error.message);
    return;
  }

  if (existing.image_file !== null) deleteImage(existing.image_file);

  logger.info({ hatId, name: existing.name }, "Deleted hat and its wash history");
  sendJson(res, 200, { id: hatId });
}

async function handleCreateWash(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = parseBody(createWashSchema, await readBody(req));
  if (!body.ok) {
    sendError(res, 400, body.error.message);
    return;
  }

  if (hatsRepository.getById(body.value.hatId) === null) {
    sendError(res, 404, `No hat with id ${body.value.hatId}`);
    return;
  }

  const now = new Date();
  let washedAt = todayNoonSeconds(now);
  if (body.value.washedAt !== undefined && body.value.washedAt !== "") {
    const parsed = parseWashDate(body.value.washedAt, now);
    if (!parsed.ok) {
      sendError(res, 400, parsed.error.message);
      return;
    }
    washedAt = parsed.value;
  }

  const inserted = washesRepository.insertWash({
    hat_id: body.value.hatId,
    washed_at: washedAt,
    notes: normalizeNotes(body.value.notes) ?? null,
    created_at: Math.floor(now.getTime() / 1000),
  });

  if (!inserted.ok) {
    sendError(res, 500, inserted.error.message);
    return;
  }

  logger.info({ washId: inserted.value.id, hatId: body.value.hatId, washedAt }, "Logged wash");
  sendJson(res, 201, { id: inserted.value.id });
}

function handleDeleteWash(res: ServerResponse, washId: number): void {
  const deleted = washesRepository.deleteWash(washId);
  if (!deleted.ok) {
    sendError(res, 500, deleted.error.message);
    return;
  }
  if (!deleted.value.deleted) {
    sendError(res, 404, `No wash with id ${washId}`);
    return;
  }

  logger.info({ washId }, "Deleted wash");
  sendJson(res, 200, { id: washId });
}

const server = createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    const method = req.method ?? "GET";

    if ((method === "GET" || method === "HEAD") && pathname === "/") {
      const html = renderCurrentPage();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if ((method === "GET" || method === "HEAD") && pathname.startsWith("/images/")) {
      serveImage(res, pathname.slice("/images/".length));
      return;
    }

    if (method === "POST" && pathname === "/api/hats") {
      await handleCreateHat(req, res);
      return;
    }

    if (method === "POST" && pathname === "/api/washes") {
      await handleCreateWash(req, res);
      return;
    }

    const hatMatch = HAT_ID_PATTERN.exec(pathname);
    if (hatMatch && method === "PATCH") {
      await handleUpdateHat(req, res, Number(hatMatch[1]));
      return;
    }
    if (hatMatch && method === "DELETE") {
      handleDeleteHat(res, Number(hatMatch[1]));
      return;
    }

    const washMatch = WASH_ID_PATTERN.exec(pathname);
    if (washMatch && method === "DELETE") {
      handleDeleteWash(res, Number(washMatch[1]));
      return;
    }

    sendError(res, 404, "Not found");
  } catch (error) {
    logger.error({ err: error, method: req.method, url: req.url }, "Request failed");
    sendError(res, 500, error instanceof Error ? error.message : String(error));
  }
});

// Localhost only — this is a personal tool with no authentication.
server.listen(config.PORT, "127.0.0.1", () => {
  logger.info({ dbPath: config.DB_PATH, imagesDir: config.IMAGES_DIR }, `Hat Wash Memory — open http://localhost:${config.PORT}`);
});
