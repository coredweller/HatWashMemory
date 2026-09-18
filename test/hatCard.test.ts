import { describe, expect, it } from "vitest";
import { escapeHtml, renderThumb } from "../src/web/hatCard.js";

describe("escapeHtml", () => {
  it("escapes every character that could break out of markup or an attribute", () => {
    expect(escapeHtml(`<script>alert("x" & 'y')</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;",
    );
  });

  it("escapes ampersands before the entities it introduces", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeHtml("Navy Yankees fitted")).toBe("Navy Yankees fitted");
  });
});

describe("renderThumb", () => {
  it("renders an img pointing at the stored file", () => {
    const html = renderThumb("0123456789abcdef.jpg", "Navy fitted", "thumb");

    expect(html).toContain('src="/images/0123456789abcdef.jpg"');
    expect(html).toContain('alt="Navy fitted"');
  });

  it("falls back to an initial when the hat has no photo", () => {
    const html = renderThumb(null, "navy fitted", "thumb");

    expect(html).toContain("placeholder");
    expect(html).toContain(">N<");
    expect(html).toContain('aria-label="navy fitted, no photo"');
  });

  it("escapes the hat name in both the label and the fallback initial", () => {
    expect(renderThumb(null, '<img src=x onerror=alert(1)>', "thumb")).not.toContain("<img src=x");
    expect(renderThumb("0123456789abcdef.jpg", '"><b>', "thumb")).not.toContain('"><b>');
  });
});
