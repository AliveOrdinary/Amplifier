// The toolbar button: import the Pinterest board in this tab, or open settings.

const message = document.getElementById("message");
const importButton = document.getElementById("import");

document.getElementById("settings").addEventListener("click", (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

/** A board's address: pinterest.<tld>/<person>/<board>/ (not a pin, search or profile page). */
function isBoard(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)pinterest\.[a-z.]+$/.test(u.hostname)) return false;
    const parts = u.pathname.split("/").filter(Boolean);
    const reserved = ["pin", "search", "ideas", "today", "settings", "business", "_", "explore", "videos"];
    return parts.length >= 2 && parts.length <= 3 && !reserved.includes(parts[0]) && !reserved.includes(parts[1]);
  } catch {
    return false;
  }
}

(async () => {
  const { server, key } = await chrome.storage.sync.get(["server", "key"]);
  if (!server || !key) {
    message.innerHTML = "Add your studio address and key in <strong>Settings</strong> first.";
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !isBoard(tab.url)) {
    message.textContent = "Open one of your Pinterest boards to import it all at once.";
    return;
  }
  message.innerHTML =
    "Adds every pin on this board to the library. Claude scores them in the background, usually within an hour. <strong>Keep the tab open while it imports.</strong>";
  importButton.hidden = false;
  importButton.addEventListener("click", async () => {
    importButton.disabled = true;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["board.js"] });
    window.close();
  });
})();
