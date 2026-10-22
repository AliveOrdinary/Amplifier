import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from "./constants";

export type RemoteImage = {
  bytes: Buffer;
  mime: string;
  sourceUrl: string;
  pageUrl: string | null;
  name: string;
};

export class RemoteFetchError extends Error {}

const USER_AGENT =
  "Mozilla/5.0 (compatible; AmplifierLibrary/1.0; +https://amplifier.studio)";
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

/**
 * Fetch an image from a link someone pasted. Accepts a direct image URL or a
 * page URL (uses the page's preview image, e.g. a Pinterest pin). Refuses
 * private and local network addresses, caps size, and follows at most a few
 * redirects, checking each hop.
 */
export async function fetchRemoteImage(input: string): Promise<RemoteImage> {
  const first = await guardedGet(input, "any");

  if (first.kind === "image") {
    return { ...first.image, pageUrl: null };
  }

  const preview = findPreviewImage(first.html, first.url);
  if (!preview) {
    throw new RemoteFetchError("That page has no preview image. Try right-clicking the image itself.");
  }
  const second = await guardedGet(preview, "image");
  if (second.kind !== "image") throw new RemoteFetchError("The page's preview image couldn't be loaded.");
  return { ...second.image, pageUrl: first.url };
}

type GetResult =
  | { kind: "image"; url: string; image: Omit<RemoteImage, "pageUrl"> }
  | { kind: "html"; url: string; html: string };

async function guardedGet(rawUrl: string, expect: "any" | "image"): Promise<GetResult> {
  let url = parseHttpUrl(rawUrl);

  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHost(url.hostname);

    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        headers: { "user-agent": USER_AGENT, accept: "image/*,text/html;q=0.9,*/*;q=0.5" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new RemoteFetchError(
        timedOut
          ? "That site took too long to answer. Try again, or use the browser extension."
          : "Couldn't reach that site from the studio; some sites block it. Use the browser extension, or save the image and upload it.",
      );
    }

    if (response.status === 401 || response.status === 403 || response.status === 429) {
      throw new RemoteFetchError(
        "That site blocks downloads from the studio. Use the browser extension, or save the image and upload it.",
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new RemoteFetchError("The link redirected nowhere.");
      url = parseHttpUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new RemoteFetchError(`The site answered ${response.status}.`);

    const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();

    if (type.startsWith("image/")) {
      if (!ACCEPTED_TYPES.includes(type)) {
        throw new RemoteFetchError("That image format isn't supported (use JPEG, PNG, WebP, GIF or AVIF).");
      }
      const bytes = await readCapped(response, MAX_UPLOAD_BYTES);
      return {
        kind: "image",
        url: url.toString(),
        image: { bytes, mime: type, sourceUrl: url.toString(), name: nameFromUrl(url) },
      };
    }

    if (expect === "any" && type === "text/html") {
      const html = (await readCapped(response, MAX_HTML_BYTES)).toString("utf8");
      return { kind: "html", url: url.toString(), html };
    }

    throw new RemoteFetchError("That link isn't an image or a web page.");
  }
  throw new RemoteFetchError("Too many redirects.");
}

function parseHttpUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new RemoteFetchError("That doesn't look like a link.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new RemoteFetchError("Only http and https links can be added.");
  }
  if (url.username || url.password) throw new RemoteFetchError("Links with credentials aren't allowed.");
  return url;
}

async function assertPublicHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new RemoteFetchError("That address isn't allowed.");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new RemoteFetchError("That address isn't allowed.");
  }
}

export function isPrivateAddress(address: string): boolean {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const ip = mapped ? mapped[1] : address.toLowerCase();

  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  return (
    ip === "::" ||
    ip === "::1" ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe8") ||
    ip.startsWith("fe9") ||
    ip.startsWith("fea") ||
    ip.startsWith("feb") ||
    ip.startsWith("ff")
  );
}

async function readCapped(response: Response, limit: number): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > limit) throw new RemoteFetchError("That file is too large (25 MB max).");
  if (!response.body) return Buffer.alloc(0);

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new RemoteFetchError("That file is too large (25 MB max).");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** og:image, twitter:image or image_src from a page's head. */
export function findPreviewImage(html: string, baseUrl: string): string | null {
  const head = html.slice(0, 300_000);
  const metas = head.match(/<meta\b[^>]*>/gi) ?? [];
  const wanted = ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"];

  for (const name of wanted) {
    for (const tag of metas) {
      const key = attr(tag, "property") ?? attr(tag, "name");
      const content = attr(tag, "content");
      if (key?.toLowerCase() === name && content) return resolve(content, baseUrl);
    }
  }
  const link = head.match(/<link\b[^>]*rel=["']?image_src["']?[^>]*>/i)?.[0];
  const href = link ? attr(link, "href") : null;
  return href ? resolve(href, baseUrl) : null;
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  const raw = match ? (match[2] ?? match[3] ?? match[4]) : null;
  return raw ? raw.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'") : null;
}

function resolve(value: string, base: string) {
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

function nameFromUrl(url: URL) {
  const last = url.pathname.split("/").filter(Boolean).pop();
  return decodeURIComponent(last ?? url.hostname).slice(0, 120);
}
