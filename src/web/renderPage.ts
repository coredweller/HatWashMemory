import { toDateInputValue } from "./dates.js";
import { escapeHtml, renderHatCard, renderHistoryRow, renderQueueRow } from "./hatCard.js";
import type { WashLogRow } from "./queryHistory.js";
import type { RankedHats } from "./rankHats.js";
import type { HistoryStats } from "./summarizeHistory.js";

export interface PageData {
  ranked: RankedHats;
  log: WashLogRow[];
  stats: HistoryStats;
}

const STYLES = `
    :root {
      color-scheme: light dark;
      --bg: #f5f5f7;
      --card: #ffffff;
      --text: #1d1d1f;
      --muted: #6e6e73;
      --border: #e2e2e6;
      --accent: #2f6f4f;
      --accent-text: #ffffff;
      --danger: #c0392b;
      --never-bg: #2f6f4f14;
      --shadow: 0 1px 2px #0000000f;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #000000;
        --card: #1c1c1e;
        --text: #f5f5f7;
        --muted: #98989d;
        --border: #2c2c2e;
        --accent: #4cb07c;
        --accent-text: #06180f;
        --danger: #ff6b5e;
        --never-bg: #4cb07c1f;
        --shadow: none;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 2rem 1.25rem 4rem;
      background: var(--bg);
      color: var(--text);
      font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    main { max-width: 860px; margin: 0 auto; }
    header { max-width: 860px; margin: 0 auto 1.25rem; }
    h1 { font-size: 1.5rem; margin: 0 0 .25rem; letter-spacing: -.02em; }
    .tagline { color: var(--muted); margin: 0; }
    h2 { font-size: 1.05rem; margin: 1.75rem 0 .6rem; }
    h2:first-child { margin-top: 0; }

    nav.tabs { display: flex; gap: .4rem; margin: 1rem 0 1.25rem; flex-wrap: wrap; }
    nav.tabs button {
      font: inherit; cursor: pointer; padding: .4rem .9rem; border-radius: 999px;
      border: 1px solid var(--border); background: var(--card); color: var(--text);
    }
    nav.tabs button[aria-selected="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }

    .card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow); }
    ul.list { list-style: none; margin: 0; padding: 0; }
    .item { background: var(--card); border: 1px solid var(--border); border-radius: 14px; margin-bottom: .5rem; box-shadow: var(--shadow); }
    .item.never { background: var(--never-bg); }
    .row { display: flex; align-items: center; gap: .75rem; padding: .7rem .85rem; }
    .pos { color: var(--muted); font-variant-numeric: tabular-nums; min-width: 1.5rem; text-align: right; }
    .meta { flex: 1; min-width: 0; }
    .name { font-weight: 600; overflow-wrap: anywhere; }
    .sub { color: var(--muted); font-size: .85rem; overflow-wrap: anywhere; }
    .when { color: var(--muted); font-size: .85rem; white-space: nowrap; }

    .thumb, .photo, .placeholder { background: var(--bg); border: 1px solid var(--border); object-fit: cover; display: block; }
    .thumb, .thumb.placeholder { width: 44px; height: 44px; border-radius: 10px; flex: none; }
    .photo, .photo.placeholder { width: 100%; aspect-ratio: 4 / 3; border-radius: 14px 14px 0 0; border-width: 0 0 1px; }
    .placeholder { display: grid; place-items: center; color: var(--muted); font-weight: 600; }
    .photo.placeholder { font-size: 2rem; }

    .btn {
      font: inherit; cursor: pointer; white-space: nowrap; padding: .4rem .8rem;
      border-radius: 8px; border: 1px solid var(--border); background: var(--card); color: var(--text);
    }
    .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-text); font-weight: 600; }
    .btn.ghost { color: var(--muted); }
    .btn.danger { color: var(--danger); border-color: var(--danger); }
    .btn:disabled { opacity: .55; cursor: default; }
    .btn.failed { border-color: var(--danger); color: var(--danger); }

    .inline-form {
      display: flex; gap: .6rem; flex-wrap: wrap; align-items: flex-end;
      padding: .25rem .85rem .85rem; border-top: 1px dashed var(--border); margin-top: -.2rem;
    }
    .inline-form label { display: flex; flex-direction: column; gap: .2rem; font-size: .8rem; color: var(--muted); }
    .inline-form label.grow { flex: 1; min-width: 12rem; }
    .form-actions { display: flex; gap: .5rem; margin-left: auto; }
    input[type="text"], input[type="date"], input[type="file"] {
      font: inherit; padding: .35rem .5rem; border-radius: 8px;
      border: 1px solid var(--border); background: var(--bg); color: var(--text);
    }
    .preview { max-width: 140px; border-radius: 10px; border: 1px solid var(--border); }

    .add-panel { padding: .85rem; margin-bottom: 1rem; }
    .add-panel .inline-form { border-top: 0; padding: 0; margin-top: .6rem; }
    .add-panel > .name { font-weight: 600; }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: .75rem; }
    .hat-card { overflow: hidden; display: flex; flex-direction: column; }
    .hat-card.retired { opacity: .6; }
    .card-body { padding: .7rem .85rem; display: flex; flex-direction: column; gap: .35rem; }
    .card-body .notes { margin: 0; color: var(--muted); font-size: .85rem; }
    .card-actions { display: flex; gap: .5rem; margin-top: .25rem; }
    .hat-card .inline-form { flex-direction: column; align-items: stretch; padding: .6rem 0 0; }

    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: .6rem; margin-bottom: 1rem; }
    .stat { padding: .7rem .85rem; }
    .stat .value { font-size: 1.35rem; font-weight: 600; letter-spacing: -.02em; }
    .stat .label { color: var(--muted); font-size: .8rem; }

    .empty { padding: 1.5rem; text-align: center; color: var(--muted); }
    .empty strong { color: var(--text); display: block; margin-bottom: .25rem; }

    #toast {
      position: fixed; left: 50%; bottom: 1.25rem; transform: translateX(-50%);
      max-width: min(90vw, 34rem); padding: .6rem 1rem; border-radius: 10px;
      background: var(--card); border: 1px solid var(--danger); color: var(--danger);
      box-shadow: 0 4px 14px #00000026; z-index: 10;
    }
    #toast[hidden] { display: none; }
`;

const SCRIPT = `
    const MAX_IMAGE_EDGE = 1000;

    const toast = document.getElementById("toast");
    let toastTimer = 0;
    function showError(message) {
      toast.textContent = message;
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.hidden = true; }, 6000);
    }

    async function api(method, path, body) {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (method + " " + path + " failed (" + response.status + ")"));
      return data;
    }

    // Runs a mutation with the clicked control showing progress, then reloads so the
    // server stays the single source of rendered truth.
    async function mutate(button, doneLabel, action) {
      const original = button.textContent;
      button.disabled = true;
      button.textContent = "Saving…";
      button.classList.remove("failed");
      try {
        await action();
        button.textContent = doneLabel;
        location.reload();
      } catch (error) {
        button.disabled = false;
        button.textContent = original;
        button.classList.add("failed");
        showError(error.message || String(error));
      }
    }

    // Downscale in the browser so uploads stay small and the server needs no image library.
    function readImageDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read " + file.name));
        reader.onload = () => {
          const image = new Image();
          image.onerror = () => reject(new Error(file.name + " is not a readable image"));
          image.onload = () => {
            const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
          };
          image.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    // File inputs stash their downscaled data URL on the element for the submit handler.
    document.addEventListener("change", async (event) => {
      const input = event.target.closest('input[type="file"][data-preview]');
      if (!input) return;
      const preview = document.getElementById(input.dataset.preview);
      const file = input.files && input.files[0];
      if (!file) {
        input.imageDataUrl = null;
        preview.hidden = true;
        return;
      }
      try {
        const dataUrl = await readImageDataUrl(file);
        input.imageDataUrl = dataUrl;
        preview.src = dataUrl;
        preview.hidden = false;
      } catch (error) {
        input.value = "";
        input.imageDataUrl = null;
        preview.hidden = true;
        showError(error.message || String(error));
      }
    });

    document.addEventListener("click", (event) => {
      const toggle = event.target.closest(".toggle");
      if (toggle) {
        const target = document.getElementById(toggle.dataset.target);
        const nowHidden = !target.hidden;
        target.hidden = nowHidden;
        toggle.setAttribute("aria-expanded", String(!nowHidden));
        return;
      }

      const washButton = event.target.closest(".wash-btn");
      if (washButton) {
        mutate(washButton, "Washed ✓", () =>
          api("POST", "/api/washes", { hatId: Number(washButton.dataset.hatId) })
        );
        return;
      }

      const retireButton = event.target.closest(".retire-btn");
      if (retireButton) {
        const retired = retireButton.dataset.retired === "true";
        mutate(retireButton, "Saved ✓", () =>
          api("PATCH", "/api/hats/" + retireButton.dataset.hatId, { retired: !retired })
        );
        return;
      }

      const deleteHatButton = event.target.closest(".delete-hat-btn");
      if (deleteHatButton) {
        const name = deleteHatButton.dataset.name;
        if (!confirm('Delete "' + name + '" and its entire wash history? This cannot be undone.')) return;
        mutate(deleteHatButton, "Deleted", () =>
          api("DELETE", "/api/hats/" + deleteHatButton.dataset.hatId)
        );
        return;
      }

      const deleteWashButton = event.target.closest(".delete-wash-btn");
      if (deleteWashButton) {
        if (!confirm("Remove this wash entry?")) return;
        mutate(deleteWashButton, "×", () =>
          api("DELETE", "/api/washes/" + deleteWashButton.dataset.washId)
        );
      }
    });

    document.addEventListener("submit", (event) => {
      const form = event.target;
      event.preventDefault();
      const submitButton = form.querySelector('button[type="submit"]');
      const fileInput = form.querySelector('input[type="file"]');
      const imageDataUrl = fileInput && fileInput.imageDataUrl ? fileInput.imageDataUrl : undefined;

      if (form.classList.contains("wash-form")) {
        mutate(submitButton, "Logged ✓", () =>
          api("POST", "/api/washes", {
            hatId: Number(form.dataset.hatId),
            washedAt: form.elements.washedAt.value,
            notes: form.elements.notes.value,
          })
        );
        return;
      }

      if (form.classList.contains("add-hat-form")) {
        mutate(submitButton, "Added ✓", () =>
          api("POST", "/api/hats", {
            name: form.elements.name.value,
            notes: form.elements.notes.value,
            imageDataUrl,
          })
        );
        return;
      }

      if (form.classList.contains("edit-form")) {
        mutate(submitButton, "Saved ✓", () =>
          api("PATCH", "/api/hats/" + form.dataset.hatId, {
            name: form.elements.name.value,
            notes: form.elements.notes.value,
            imageDataUrl,
          })
        );
      }
    });

    // Tabs, with the active one kept in the hash so a reload after a mutation lands back here.
    const tabButtons = Array.from(document.querySelectorAll('nav.tabs button[role="tab"]'));
    function selectTab(id, updateHash) {
      tabButtons.forEach((button) => {
        const selected = button.dataset.tab === id;
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
        document.getElementById("panel-" + button.dataset.tab).hidden = !selected;
      });
      if (updateHash) history.replaceState(null, "", "#" + id);
    }

    tabButtons.forEach((button) => {
      button.addEventListener("click", () => selectTab(button.dataset.tab, true));
      button.addEventListener("keydown", (event) => {
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (step === 0) return;
        event.preventDefault();
        const next = tabButtons[(tabButtons.indexOf(button) + step + tabButtons.length) % tabButtons.length];
        next.focus();
        selectTab(next.dataset.tab, true);
      });
    });

    const initialTab = location.hash.replace("#", "");
    if (tabButtons.some((button) => button.dataset.tab === initialTab)) selectTab(initialTab, false);
`;

function renderTab(id: string, label: string, count: number, selected: boolean): string {
  return `<button role="tab" data-tab="${id}" aria-selected="${selected}" aria-controls="panel-${id}" tabindex="${selected ? 0 : -1}">${label} <span class="sub">${count}</span></button>`;
}

function renderEmpty(title: string, hint: string): string {
  return `<div class="card empty"><strong>${escapeHtml(title)}</strong>${escapeHtml(hint)}</div>`;
}

function renderStats(stats: HistoryStats): string {
  const average =
    stats.averageDaysBetweenWashes === null ? "—" : `${stats.averageDaysBetweenWashes} days`;
  const mostWashed = stats.mostWashed === null ? "—" : escapeHtml(stats.mostWashed.name);
  const mostWashedLabel =
    stats.mostWashed === null ? "Most washed" : `Most washed &middot; ${stats.mostWashed.count}`;
  const overdue = stats.longestUnwashed === null ? "—" : escapeHtml(stats.longestUnwashed.name);
  const overdueLabel =
    stats.longestUnwashed === null || stats.longestUnwashed.days === null
      ? "Next up"
      : `Next up &middot; ${stats.longestUnwashed.days} days`;

  return `
      <div class="stats">
        <div class="card stat"><div class="value">${stats.totalWashes}</div><div class="label">Washes logged</div></div>
        <div class="card stat"><div class="value">${stats.washesThisYear}</div><div class="label">This year</div></div>
        <div class="card stat"><div class="value">${average}</div><div class="label">Average between washes</div></div>
        <div class="card stat"><div class="value">${mostWashed}</div><div class="label">${mostWashedLabel}</div></div>
        <div class="card stat"><div class="value">${overdue}</div><div class="label">${overdueLabel}</div></div>
      </div>`;
}

export function renderPage(data: PageData, now: Date): string {
  const { ranked, log, stats } = data;
  const todayValue = toDateInputValue(now);
  const totalHats = ranked.queue.length + ranked.retired.length;

  const queueSection =
    ranked.queue.length === 0
      ? renderEmpty(
          totalHats === 0 ? "No hats yet" : "Every hat is retired",
          totalHats === 0
            ? "Add your first hat on the All Hats tab to start the queue."
            : "Unretire a hat on the All Hats tab to put it back in the queue.",
        )
      : `<ul class="list">${ranked.queue.map((hat) => renderQueueRow(hat, todayValue)).join("")}
      </ul>`;

  const retiredSection =
    ranked.retired.length === 0
      ? ""
      : `
      <h2>Retired</h2>
      <div class="grid">${ranked.retired.map((hat) => renderHatCard(hat, todayValue)).join("")}
      </div>`;

  const hatsSection =
    ranked.queue.length === 0 && ranked.retired.length === 0
      ? renderEmpty("No hats yet", "Use the form above to add one — a name is all that is required.")
      : `<div class="grid">${ranked.queue.map((hat) => renderHatCard(hat, todayValue)).join("")}
      </div>`;

  const historySection =
    log.length === 0
      ? renderEmpty("No washes logged yet", "Hit Wash ✓ on the Wash Next tab and it will show up here.")
      : `<ul class="list">${log.map((wash) => renderHistoryRow(wash)).join("")}
      </ul>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hat Wash Memory</title>
  <style>${STYLES}</style>
</head>
<body>
  <header>
    <h1>Hat Wash Memory</h1>
    <p class="tagline">${totalHats} ${totalHats === 1 ? "hat" : "hats"} &middot; ${stats.totalWashes} ${stats.totalWashes === 1 ? "wash" : "washes"} logged</p>
    <nav class="tabs" role="tablist" aria-label="View">
      ${renderTab("next", "Wash Next", ranked.queue.length, true)}
      ${renderTab("hats", "All Hats", totalHats, false)}
      ${renderTab("history", "History", log.length, false)}
    </nav>
  </header>

  <main>
    <section id="panel-next" role="tabpanel" aria-label="Wash Next">
      ${queueSection}
    </section>

    <section id="panel-hats" role="tabpanel" aria-label="All Hats" hidden>
      <div class="card add-panel">
        <div class="name">Add a hat</div>
        <form class="inline-form add-hat-form">
          <label class="grow">Name
            <input type="text" name="name" placeholder="e.g. Navy Yankees fitted" maxlength="100" required />
          </label>
          <label class="grow">Notes
            <input type="text" name="notes" placeholder="optional — material, care warnings" maxlength="500" />
          </label>
          <label>Photo
            <input type="file" name="photo" accept="image/*" data-preview="add-preview" />
          </label>
          <img class="preview" id="add-preview" alt="Photo preview" hidden />
          <div class="form-actions">
            <button class="btn primary" type="submit">Add hat</button>
          </div>
        </form>
      </div>
      ${hatsSection}
      ${retiredSection}
    </section>

    <section id="panel-history" role="tabpanel" aria-label="History" hidden>
      ${renderStats(stats)}
      ${historySection}
    </section>
  </main>

  <div id="toast" role="alert" hidden></div>
  <script>${SCRIPT}</script>
</body>
</html>
`;
}
