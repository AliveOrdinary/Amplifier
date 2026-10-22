/**
 * Getting a board out of Amplifier, in the browser: as one picture, as
 * separate images in the same layout (SVG), or as a zip of image files.
 */
import { zipSync } from "fflate";

export type ExportImage = { url: string; width: number; height: number; description: string | null };
export type Placed = { x: number; y: number; w: number; h: number };

/** Rows of images at one height each, filling the width (like a contact sheet). */
export function justifiedLayout(sizes: { width: number; height: number }[], width: number, rowHeight: number, gap: number) {
  const placed: Placed[] = [];
  let y = 0;
  let row: number[] = [];
  let ratios = 0;
  const flush = (height: number, stretch: boolean) => {
    let x = 0;
    for (const i of row) {
      const ratio = sizes[i].width / sizes[i].height;
      const w = stretch ? ratio * height : Math.min(ratio * height, width);
      placed[i] = { x, y, w, h: height };
      x += w + gap;
    }
    y += height + gap;
    row = [];
    ratios = 0;
  };
  sizes.forEach((size, i) => {
    row.push(i);
    ratios += size.width / Math.max(1, size.height);
    const natural = ratios * rowHeight + gap * (row.length - 1);
    if (natural >= width) flush((width - gap * (row.length - 1)) / ratios, true);
  });
  if (row.length) flush(rowHeight, false);
  return { placed, height: Math.max(0, y - gap) };
}

async function bitmap(url: string) {
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error("Couldn't load an image.");
  return createImageBitmap(await response.blob());
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't draw the board."))), type, quality));

/** The whole board as one PNG. */
export async function boardPng(images: ExportImage[], { width = 2400, rowHeight = 560, gap = 24, padding = 48 } = {}) {
  const { placed, height } = justifiedLayout(images, width, rowHeight, gap);
  const canvas = canvasOf(width + padding * 2, height + padding * 2);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f2f1ec";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const bitmaps = await Promise.all(images.map((i) => bitmap(i.url)));
  bitmaps.forEach((b, i) => {
    const p = placed[i];
    ctx.drawImage(b, padding + p.x, padding + p.y, p.w, p.h);
    b.close();
  });
  return toBlob(canvas, "image/png");
}

/** One image re-encoded as JPEG at a given size. */
async function jpeg(url: string, width?: number, height?: number, quality = 0.88) {
  const b = await bitmap(url);
  const canvas = canvasOf(width ?? b.width, height ?? b.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(b, 0, 0, canvas.width, canvas.height);
  b.close();
  return toBlob(canvas, "image/jpeg", quality);
}

const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The board as SVG: each image a separate, movable layer in the same layout. */
export async function boardSvg(images: ExportImage[], { width = 1600, rowHeight = 380, gap = 16 } = {}) {
  const { placed, height } = justifiedLayout(images, width, rowHeight, gap);
  const layers = await Promise.all(
    images.map(async (image, i) => {
      const p = placed[i];
      // Twice the placed size keeps it sharp when zoomed in.
      const href = await dataUrl(await jpeg(image.url, p.w * 2, p.h * 2, 0.85));
      const title = image.description ? `<title>${escape(image.description)}</title>` : "";
      return `<image x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" width="${p.w.toFixed(1)}" height="${p.h.toFixed(1)}" href="${href}">${title}</image>`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${Math.ceil(height)}" viewBox="0 0 ${width} ${Math.ceil(height)}">${layers.join("")}</svg>`;
}

const slug = (s: string | null) =>
  (s ?? "image")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "image";

/** Every image as a numbered JPEG, zipped. */
export async function boardZip(images: ExportImage[]) {
  const files: Record<string, Uint8Array> = {};
  const blobs = await Promise.all(images.map((i) => jpeg(i.url)));
  await Promise.all(
    blobs.map(async (blob, i) => {
      files[`${String(i + 1).padStart(2, "0")}-${slug(images[i].description)}.jpg`] = new Uint8Array(await blob.arrayBuffer());
    }),
  );
  // JPEGs are already compressed: store them as they are.
  const zipped = zipSync(files, { level: 0 });
  return new Blob([zipped as BlobPart], { type: "application/zip" });
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
