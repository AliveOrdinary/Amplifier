// Amplifier Library: right-click an image (or a page, e.g. a Pinterest pin)
// and send it to the studio library. Also does the sending for board imports
// (board.js reads the board; this uploads each pin).

const MAX_UPLOAD = 4 * 1024 * 1024; // larger images are sent as a link instead

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "amplifier-image",
      title: "Add to Amplifier library",
      contexts: ["image"],
    });
    chrome.contextMenus.create({
      id: "amplifier-page",
      title: "Add this page's image to Amplifier",
      contexts: ["page", "link"],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  const { server, key } = await chrome.storage.sync.get(["server", "key"]);
  if (!server || !key) {
    notify("Set up the extension first", "Add your studio address and key in the settings.");
    chrome.runtime.openOptionsPage();
    return;
  }

  const form = new FormData();
  if (info.pageUrl) form.append("pageUrl", info.pageUrl);

  if (info.menuItemId === "amplifier-image" && info.srcUrl) {
    const blob = await fetchImage(info.srcUrl);
    if (blob) form.append("file", blob, fileName(info.srcUrl, blob.type));
    if (!info.srcUrl.startsWith("data:")) form.append("url", info.srcUrl);
  } else {
    // A page or a link: the studio uses the page's preview image.
    form.append("url", info.linkUrl || info.pageUrl);
  }

  notify("Adding to Amplifier…", "Claude is scoring it. This takes a few seconds.", "amplifier-progress");
  try {
    const response = await fetch(new URL("/api/ingest", server), {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const result = await response.json().catch(() => ({ ok: false, error: `Error ${response.status}` }));
    chrome.notifications.clear("amplifier-progress");

    if (!result.ok) return notify("Couldn't add that image", result.error || "Something went wrong.");
    if (result.status === "duplicate") return notify("Already in the library", "That exact image was added before.");
    const notes = [];
    if (result.nearDuplicates?.length) notes.push("It looks similar to an image already there.");
    if (result.scored === false) notes.push("Scoring failed; rescore it in the studio.");
    notify("Added to Amplifier", notes.join(" ") || "It's waiting in the review queue.");
  } catch {
    chrome.notifications.clear("amplifier-progress");
    notify("Couldn't reach the studio", "Check the address in the extension settings.");
  }
});

/* ----------------------------------------------------------- board imports */

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type === "amplifier-upload") {
    uploadPin(message).then(reply);
    return true; // reply comes later
  }
  if (message?.type === "amplifier-flush") {
    flush().then(reply);
    return true;
  }
  return false;
});

/** One pin: the full-size image if it loads and fits, otherwise Pinterest's 736px version. */
async function uploadPin({ url, fallback, pageUrl, board }) {
  const { server, key } = await chrome.storage.sync.get(["server", "key"]);
  if (!server || !key) return { ok: false, fatal: true, error: "Add your studio address and key in the extension's settings." };

  let blob = await fetchImage(url);
  let used = url;
  if (!blob && fallback) {
    blob = await fetchImage(fallback);
    used = fallback;
  }
  const form = new FormData();
  form.append("pageUrl", pageUrl);
  form.append("board", board);
  form.append("queue", "1");
  if (blob) form.append("file", blob, fileName(used, blob.type));
  else form.append("url", fallback || url);

  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(new URL("/api/ingest", server), {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
      if (response.status === 401) {
        return { ok: false, fatal: true, error: "The studio didn't accept the key. Check the extension's settings." };
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)));
        continue;
      }
      return await response.json().catch(() => ({ ok: false, error: `Error ${response.status}` }));
    } catch {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)));
        continue;
      }
      return { ok: false, error: "Couldn't reach the studio." };
    }
  }
}

/** The import is done: ask the studio to send everything waiting for scoring now. */
async function flush() {
  const { server, key } = await chrome.storage.sync.get(["server", "key"]);
  if (!server || !key) return { ok: false };
  try {
    const response = await fetch(new URL("/api/ingest/queue", server), {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
    });
    return await response.json().catch(() => ({ ok: false }));
  } catch {
    return { ok: false };
  }
}

async function fetchImage(src) {
  try {
    const response = await fetch(src, { credentials: "include" });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/") || blob.size === 0 || blob.size > MAX_UPLOAD) return null;
    return blob;
  } catch {
    return null;
  }
}

function fileName(src, type) {
  const extension = (type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  try {
    const last = new URL(src).pathname.split("/").filter(Boolean).pop();
    if (last && /\.[a-z0-9]{2,5}$/i.test(last)) return decodeURIComponent(last).slice(0, 120);
  } catch {
    // data: URLs and the like
  }
  return `image.${extension}`;
}

function notify(title, message, id) {
  chrome.notifications.create(id ?? "", {
    type: "basic",
    iconUrl: "icons/128.png",
    title,
    message,
  });
}
