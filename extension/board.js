// Import a whole Pinterest board into the Amplifier library. Injected into the
// board's tab from the toolbar popup. It scrolls the board the way a person
// would, collects each pin's full-size image, and hands them to the
// extension's background worker a few at a time, which sends them to the
// studio. Scoring happens later, in the background, through the Batch API.

(() => {
  if (window.__amplifierImport) {
    window.__amplifierImport.focus();
    return;
  }

  const UPLOADS_AT_ONCE = 3;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const state = {
    phase: "reading", // reading → sending → finishing → done | stopped
    stop: false,
    seen: new Set(),
    queue: [],
    sent: 0,
    added: 0,
    already: 0,
    failed: 0,
    error: "",
  };

  /* ------------------------------------------------------------ the board */

  const boardName = (
    document.querySelector("h1")?.textContent ||
    decodeURIComponent(location.pathname.split("/").filter(Boolean)[1] || "Pinterest board").replace(/-/g, " ")
  )
    .trim()
    .slice(0, 80);

  /** "340 Pins" or "1.2k Pins" in the board's header. */
  function pinCount() {
    for (const el of document.querySelectorAll("div, span, h2, h3")) {
      if (el.children.length) continue;
      const m = (el.textContent || "").trim().match(/^([\d.,]+)\s*([kK])?\s+Pins?$/);
      if (m) return Math.round(parseFloat(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1));
    }
    return null;
  }
  const expected = pinCount();

  /** Pinterest's own suggestions start below this heading; they aren't the board's pins. */
  function ideasHeading() {
    return [...document.querySelectorAll("h2, h3, [role='heading']")].find((h) =>
      /more ideas|ideas for this board|find some ideas/i.test(h.textContent || ""),
    );
  }

  /** The largest version of a pin's image, with a smaller one in case the original won't load. */
  function sources(img) {
    const list = [img.currentSrc, img.src, ...(img.srcset || "").split(",").map((s) => s.trim().split(/\s+/)[0])].filter(
      (u) => u && u.includes("pinimg.com"),
    );
    if (!list.length) return null;
    const m = list[list.length - 1].match(/^(https:\/\/i\.pinimg\.com\/)[^/]+(\/.+)$/);
    if (!m) return { url: list[list.length - 1], fallback: null };
    return { url: `${m[1]}originals${m[2]}`, fallback: `${m[1]}736x${m[2]}` };
  }

  /** Add the pins on screen now. Pinterest only keeps nearby pins in the page, so this runs as it scrolls. */
  function collect() {
    const heading = ideasHeading();
    let found = 0;
    for (const link of document.querySelectorAll('a[href*="/pin/"]')) {
      if (heading && heading.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING) continue;
      const id = ((link.getAttribute("href") || "").match(/\/pin\/([^/?#]+)/) || [])[1];
      if (!id || state.seen.has(id)) continue;
      const card = link.closest("[data-grid-item], [data-test-id='pin'], [role='listitem']") || link;
      if (/\bpromoted\b/i.test(card.textContent || "")) continue; // ads
      const img = card.querySelector("img") || link.querySelector("img");
      const src = img && sources(img);
      if (!src) continue;
      state.seen.add(id);
      state.queue.push({ ...src, pageUrl: new URL(`/pin/${id}/`, location.origin).href });
      found++;
    }
    return { found, heading };
  }

  async function readBoard() {
    window.scrollTo(0, 0);
    await sleep(600);
    let idle = 0;
    while (!state.stop) {
      const { found, heading } = collect();
      render();
      if (expected && state.seen.size >= expected) break;
      // Reached the suggestions: every pin above them has been on screen.
      if (heading && heading.getBoundingClientRect().top < innerHeight) break;
      idle = found ? 0 : idle + 1;
      if (idle >= 8) break;
      window.scrollBy(0, Math.round(innerHeight * 0.85));
      await sleep(900);
    }
  }

  /* --------------------------------------------------------------- sending */

  async function send() {
    const worker = async () => {
      while (!state.stop) {
        const pin = state.queue.shift();
        if (!pin) {
          if (state.phase !== "reading") return;
          await sleep(400);
          continue;
        }
        const r = await chrome.runtime
          .sendMessage({ type: "amplifier-upload", board: boardName, ...pin })
          .catch((err) => ({ ok: false, error: String(err?.message || err) }));
        state.sent++;
        if (r?.ok && r.status === "duplicate") state.already++;
        else if (r?.ok) state.added++;
        else {
          state.failed++;
          state.error = r?.error || "";
          if (r?.fatal) state.stop = true;
        }
        render();
        await sleep(200);
      }
    };
    await Promise.all(Array.from({ length: UPLOADS_AT_ONCE }, worker));
  }

  /* ---------------------------------------------------------------- panel */

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      .card { width: 320px; box-sizing: border-box; padding: 16px; background: #f2f1ec; color: #111; border: 1px solid #111;
              font: 14px/1.45 system-ui, sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,.18); display: grid; gap: 10px; }
      .top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
      .brand { font-size: 17px; letter-spacing: -0.01em; }
      .board { font: 11px ui-monospace, monospace; letter-spacing: .06em; text-transform: uppercase; color: #5e5c55;
               overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bar { height: 3px; background: #d6d3ca; }
      .fill { height: 3px; width: 0; background: #ff4f00; transition: width .3s; }
      .note { color: #5e5c55; font-size: 13px; }
      button { height: 34px; padding: 0 12px; font: inherit; cursor: pointer; border: 1px solid #111; background: transparent; color: #111; justify-self: start; }
    </style>
    <div class="card" role="status" aria-live="polite">
      <div class="top"><span class="brand">amplifier.</span><span class="board"></span></div>
      <div class="line"></div>
      <div class="bar"><div class="fill"></div></div>
      <div class="note"></div>
      <button type="button">Stop</button>
    </div>`;
  document.documentElement.appendChild(host);
  const $ = (s) => root.querySelector(s);
  $(".board").textContent = boardName;
  const button = $("button");
  button.addEventListener("click", () => {
    if (state.phase === "done" || state.phase === "stopped") {
      host.remove();
      delete window.__amplifierImport;
    } else {
      state.stop = true;
      button.disabled = true;
      button.textContent = "Stopping…";
    }
  });

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function render() {
    const total = Math.max(state.seen.size, expected || 0, 1);
    $(".fill").style.width = `${Math.round((state.sent / total) * 100)}%`;
    const tally = [
      plural(state.added, "added", "added"),
      state.already ? `${state.already} already in the library` : "",
      state.failed ? `${state.failed} couldn't be added` : "",
    ]
      .filter(Boolean)
      .join(", ");

    if (state.phase === "reading" || state.phase === "sending") {
      $(".line").textContent =
        state.phase === "reading"
          ? `Reading the board… ${plural(state.seen.size, "pin", "pins")} found${expected ? ` of ${expected}` : ""}. ${state.sent} sent.`
          : `Sending ${state.sent} of ${state.seen.size}…`;
      $(".note").textContent = "Keep this tab open until it's done. You can use other tabs.";
    } else if (state.phase === "finishing") {
      $(".line").textContent = `${tally}.`;
      $(".note").textContent = "Handing them to Claude for scoring…";
    } else {
      $(".line").textContent = `${state.phase === "stopped" ? "Stopped" : "Done"}. ${tally}.`;
      $(".note").textContent = state.error && !state.added
        ? state.error
        : "Claude scores them in the background, usually within an hour. Most go straight to the library; any that need a look wait in Review.";
      button.disabled = false;
      button.textContent = "Close";
    }
  }

  window.__amplifierImport = { focus: () => host.scrollIntoView?.() };

  (async () => {
    render();
    await Promise.all([
      readBoard().then(() => {
        if (state.phase === "reading") state.phase = "sending";
        render();
      }),
      send(),
    ]);
    const stopped = state.stop;
    state.phase = "finishing";
    render();
    if (state.added) await chrome.runtime.sendMessage({ type: "amplifier-flush" }).catch(() => null);
    state.phase = stopped ? "stopped" : "done";
    render();
  })();
})();
