import { formatDate, formatDaysSince } from "./dates.js";
import type { WashLogRow } from "./queryHistory.js";
import type { RankedHat } from "./rankHats.js";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A stored photo, or a lettered placeholder so every row keeps the same shape. */
export function renderThumb(imageFile: string | null, name: string, className: string): string {
  const alt = escapeHtml(name);
  if (imageFile === null) {
    const initial = escapeHtml(name.trim().charAt(0).toUpperCase() || "?");
    return `<div class="${className} placeholder" role="img" aria-label="${alt}, no photo">${initial}</div>`;
  }
  return `<img class="${className}" src="/images/${escapeHtml(imageFile)}" alt="${alt}" loading="lazy" />`;
}

function washCountLabel(count: number): string {
  return count === 1 ? "1 wash" : `${count} washes`;
}

export function renderQueueRow(hat: RankedHat, todayValue: string): string {
  const name = escapeHtml(hat.name);
  const neverClass = hat.last_washed === null ? " never" : "";
  const lastWashed = hat.last_washed === null ? "" : ` on ${escapeHtml(formatDate(hat.last_washed))}`;

  return `
        <li class="item${neverClass}">
          <div class="row">
            <span class="pos">${hat.position}</span>
            ${renderThumb(hat.image_file, hat.name, "thumb")}
            <div class="meta">
              <div class="name">${name}</div>
              <div class="sub">${escapeHtml(formatDaysSince(hat.daysSince))}${lastWashed} &middot; ${washCountLabel(hat.wash_count)}</div>
            </div>
            <button class="btn primary wash-btn" data-hat-id="${hat.id}" data-name="${name}">Wash &check;</button>
            <button class="btn ghost toggle" data-target="wash-form-${hat.id}" aria-expanded="false" title="Log a wash on another date">&hellip;</button>
          </div>
          <form class="inline-form wash-form" id="wash-form-${hat.id}" data-hat-id="${hat.id}" hidden>
            <label>Date
              <input type="date" name="washedAt" value="${escapeHtml(todayValue)}" max="${escapeHtml(todayValue)}" required />
            </label>
            <label class="grow">Notes
              <input type="text" name="notes" placeholder="optional — e.g. cap cage, cold cycle" maxlength="500" />
            </label>
            <button class="btn primary" type="submit">Log wash</button>
          </form>
        </li>`;
}

export function renderHatCard(hat: RankedHat, todayValue: string): string {
  const name = escapeHtml(hat.name);
  const isRetired = hat.retired_at !== null;
  const notes = hat.notes === null || hat.notes.trim() === "" ? "" : `<p class="notes">${escapeHtml(hat.notes)}</p>`;

  return `
        <article class="card hat-card${isRetired ? " retired" : ""}">
          ${renderThumb(hat.image_file, hat.name, "photo")}
          <div class="card-body">
            <div class="name">${name}</div>
            <div class="sub">${escapeHtml(formatDaysSince(hat.daysSince))} &middot; ${washCountLabel(hat.wash_count)}</div>
            ${notes}
            <div class="card-actions">
              <button class="btn ghost toggle" data-target="edit-form-${hat.id}" aria-expanded="false">Edit</button>
              <button class="btn ghost retire-btn" data-hat-id="${hat.id}" data-retired="${isRetired}">${isRetired ? "Unretire" : "Retire"}</button>
            </div>
            <form class="inline-form edit-form" id="edit-form-${hat.id}" data-hat-id="${hat.id}" hidden>
              <label class="grow">Name
                <input type="text" name="name" value="${name}" maxlength="100" required />
              </label>
              <label class="grow">Notes
                <input type="text" name="notes" value="${escapeHtml(hat.notes ?? "")}" maxlength="500" />
              </label>
              <label class="grow">Replace photo
                <input type="file" name="photo" accept="image/*" data-preview="edit-preview-${hat.id}" />
              </label>
              <img class="preview" id="edit-preview-${hat.id}" alt="New photo preview" hidden />
              <div class="form-actions">
                <button class="btn primary" type="submit">Save</button>
                <button class="btn danger delete-hat-btn" type="button" data-hat-id="${hat.id}" data-name="${name}">Delete hat</button>
              </div>
            </form>
          </div>
        </article>`;
}

export function renderHistoryRow(wash: WashLogRow): string {
  const notes =
    wash.notes === null || wash.notes.trim() === ""
      ? ""
      : `<div class="sub">${escapeHtml(wash.notes)}</div>`;

  return `
        <li class="item">
          <div class="row">
            ${renderThumb(wash.image_file, wash.hat_name, "thumb")}
            <div class="meta">
              <div class="name">${escapeHtml(wash.hat_name)}</div>
              ${notes}
            </div>
            <time class="when">${escapeHtml(formatDate(wash.washed_at))}</time>
            <button class="btn ghost delete-wash-btn" data-wash-id="${wash.id}" title="Remove this entry">&times;</button>
          </div>
        </li>`;
}
