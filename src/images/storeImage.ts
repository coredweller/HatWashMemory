import { randomBytes } from "node:crypto";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { fail, ok, type Result } from "../result.js";

/** Decoded bytes, after the client has already downscaled the photo. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const DATA_URL_PATTERN = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

const EXTENSION_BY_MIME_SUBTYPE: Record<string, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

/** Filenames are 16 random hex chars + extension; anything else is not ours. */
export const IMAGE_FILE_PATTERN = /^[a-f0-9]{16}\.(jpg|png|webp)$/;

export const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export interface ParsedImage {
  buffer: Buffer;
  extension: string;
}

/**
 * Pure: validate and decode a base64 image data URL. Kept separate from disk access
 * so the accept/reject rules can be tested without touching the filesystem.
 */
export function parseImageDataUrl(dataUrl: string): Result<ParsedImage> {
  const match = DATA_URL_PATTERN.exec(dataUrl.trim());
  if (!match) {
    return fail(new Error("Image must be a base64 data URL of type jpeg, png, or webp"));
  }

  const [, subtype, payload] = match;
  const buffer = Buffer.from(payload, "base64");

  if (buffer.length === 0) {
    return fail(new Error("Image data is empty"));
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    return fail(new Error(`Image is ${Math.round(buffer.length / 1024)} KB; the limit is 2048 KB`));
  }

  return ok({ buffer, extension: EXTENSION_BY_MIME_SUBTYPE[subtype] });
}

export function ensureImagesDir(): void {
  mkdirSync(config.IMAGES_DIR, { recursive: true });
}

/** Writes the decoded image under IMAGES_DIR and returns the generated filename. */
export function storeImage(dataUrl: string): Result<string> {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed.ok) {
    return parsed;
  }

  const fileName = `${randomBytes(8).toString("hex")}.${parsed.value.extension}`;
  try {
    writeFileSync(join(config.IMAGES_DIR, fileName), parsed.value.buffer);
    logger.info({ fileName, bytes: parsed.value.buffer.length }, "Stored hat image");
    return ok(fileName);
  } catch (error) {
    logger.error({ err: error, fileName }, "Failed to write hat image");
    return fail(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Best-effort cleanup when a photo is replaced or its hat is deleted. A missing file is
 * not worth failing the request over, but it is worth a log line.
 */
export function deleteImage(fileName: string): void {
  if (!IMAGE_FILE_PATTERN.test(fileName)) {
    logger.warn({ fileName }, "Refusing to delete an image with an unexpected filename");
    return;
  }
  try {
    unlinkSync(join(config.IMAGES_DIR, fileName));
    logger.info({ fileName }, "Deleted hat image");
  } catch (error) {
    logger.warn({ err: error, fileName }, "Could not delete hat image");
  }
}
