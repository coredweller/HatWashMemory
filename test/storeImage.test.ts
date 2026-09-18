import { describe, expect, it } from "vitest";
import { IMAGE_FILE_PATTERN, parseImageDataUrl } from "../src/images/storeImage.js";

function dataUrl(mimeSubtype: string, bytes: Buffer): string {
  return `data:image/${mimeSubtype};base64,${bytes.toString("base64")}`;
}

const SMALL_IMAGE = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe("parseImageDataUrl", () => {
  it("accepts jpeg, png, and webp, mapping each to a file extension", () => {
    const cases: [string, string][] = [
      ["jpeg", "jpg"],
      ["png", "png"],
      ["webp", "webp"],
    ];

    for (const [subtype, extension] of cases) {
      const parsed = parseImageDataUrl(dataUrl(subtype, SMALL_IMAGE));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      expect(parsed.value.extension).toBe(extension);
      expect(parsed.value.buffer.equals(SMALL_IMAGE)).toBe(true);
    }
  });

  it("rejects a data URL that is not an accepted image type", () => {
    for (const value of [
      "data:text/html;base64,PHNjcmlwdD4=",
      "data:image/gif;base64,R0lGODlh",
      "data:image/svg+xml;base64,PHN2Zz4=",
    ]) {
      expect(parseImageDataUrl(value).ok).toBe(false);
    }
  });

  it("rejects anything that is not a base64 data URL at all", () => {
    for (const value of ["", "https://example.com/hat.jpg", "just some text"]) {
      expect(parseImageDataUrl(value).ok).toBe(false);
    }
  });

  it("rejects an empty payload", () => {
    expect(parseImageDataUrl("data:image/jpeg;base64,").ok).toBe(false);
  });

  it("rejects an image larger than the 2 MB limit", () => {
    const parsed = parseImageDataUrl(dataUrl("jpeg", Buffer.alloc(2 * 1024 * 1024 + 1, 1)));

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.message).toMatch(/limit is 2048 KB/);
  });
});

describe("IMAGE_FILE_PATTERN", () => {
  it("matches only generated filenames, blocking path traversal", () => {
    expect(IMAGE_FILE_PATTERN.test("0123456789abcdef.jpg")).toBe(true);
    expect(IMAGE_FILE_PATTERN.test("0123456789abcdef.webp")).toBe(true);

    for (const value of [
      "../../hatwash.db",
      "0123456789abcdef.jpg/../../x",
      "0123456789ABCDEF.jpg",
      "short.jpg",
      "0123456789abcdef.exe",
      "0123456789abcdef",
    ]) {
      expect(IMAGE_FILE_PATTERN.test(value)).toBe(false);
    }
  });
});
