const form = document.getElementById("form");
const server = document.getElementById("server");
const key = document.getElementById("key");
const status = document.getElementById("status");

chrome.storage.sync.get(["server", "key"]).then((saved) => {
  server.value = saved.server || "https://amplifier.studio";
  key.value = saved.key || "";
});

function origin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const address = origin(server.value);
  if (!address) return (status.textContent = "That address isn't valid.");
  await chrome.storage.sync.set({ server: address, key: key.value.trim() });
  server.value = address;
  status.textContent = "Saved.";
});

document.getElementById("test").addEventListener("click", async () => {
  const address = origin(server.value);
  if (!address) return (status.textContent = "That address isn't valid.");
  status.textContent = "Checking…";
  try {
    const response = await fetch(new URL("/api/ingest", address), {
      headers: { Authorization: `Bearer ${key.value.trim()}` },
    });
    const result = await response.json().catch(() => ({}));
    status.textContent = result.ok
      ? `Connected to ${result.studio}. Remember to save.`
      : result.error || `The studio answered ${response.status}.`;
  } catch {
    status.textContent = "Couldn't reach that address.";
  }
});
