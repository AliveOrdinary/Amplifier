#!/usr/bin/env node
/**
 * One-off import: puts the projects in ./projects.mjs into Studio ›
 * Portfolio, with their images and videos, published and featured on Home.
 *
 *   npm run import:portfolio              import (projects already there are skipped)
 *   npm run import:portfolio -- --dry-run download and check every file, change nothing
 *   npm run import:portfolio -- --replace delete these projects first, then import them again
 *   npm run import:portfolio -- teeta     only the projects named (by address)
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or
 * SUPABASE_SECRET_KEY) in .env.local. Afterwards, save any project in
 * Studio › Portfolio (or redeploy) so the site picks the new work up.
 */

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { PROJECTS } from "./projects.mjs";

const BUCKET = "portfolio";
const MAX_BYTES = 50 * 1024 * 1024;
/** Photos bigger than this are scaled down and re-saved (a 12 MB JPG becomes ~1–2 MB). */
const SHRINK_OVER_BYTES = 3 * 1024 * 1024;
const MAX_SIDE = 2880;

const TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
};

const blockId = () => Math.random().toString(36).slice(2, 10);
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

function typeOf(url) {
  const ext = new URL(url).pathname.split(".").pop().toLowerCase();
  const mime = TYPES[ext];
  if (!mime) throw new Error(`Unknown file type: ${url}`);
  return { ext: ext === "jpeg" ? "jpg" : ext, mime };
}

/** Every file a project uses, cover first, each once. */
export function filesOf(project) {
  const seen = new Map();
  const add = (file) => {
    const f = typeof file === "string" ? { url: file } : file;
    if (!seen.has(f.url)) seen.set(f.url, f);
    else if (f.alt && !seen.get(f.url).alt) seen.get(f.url).alt = f.alt;
  };
  if (project.cover) add(project.cover);
  if (project.thumbnail) add(project.thumbnail);
  for (const b of project.blocks) if (typeof b !== "string") b.media.forEach(add);
  return [...seen.values()];
}

/** Downloads a file; big photos are scaled down. Returns the bytes and their size in pixels. */
export async function download(file, { fetch = globalThis.fetch, sharp } = {}) {
  let body;
  if (file.url.startsWith("file:")) {
    body = await readFile(new URL(file.url));
  } else {
    const res = await fetch(file.url);
    if (!res.ok) throw new Error(`${res.status} downloading ${file.url}`);
    body = Buffer.from(await res.arrayBuffer());
  }
  let { ext, mime } = typeOf(file.url);
  let width = null;
  let height = null;

  if (mime.startsWith("image/") && sharp) {
    const meta = await sharp(body).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
    if (body.length > SHRINK_OVER_BYTES && mime !== "image/gif") {
      const img = sharp(body).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true });
      const out = mime === "image/png" && meta.hasAlpha ? await img.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
        : mime === "image/webp" ? await img.webp({ quality: 85 }).toBuffer({ resolveWithObject: true })
        : await img.jpeg({ quality: 85, mozjpeg: true }).toBuffer({ resolveWithObject: true });
      if (out.data.length < body.length) {
        body = out.data;
        width = out.info.width;
        height = out.info.height;
        if (out.info.format === "jpeg" && ext !== "jpg") [ext, mime] = ["jpg", "image/jpeg"];
      }
    }
  }
  if (body.length > MAX_BYTES) throw new Error(`${file.url} is ${mb(body.length)}; Studio takes up to 50 MB.`);
  return { body, ext, mime, width, height };
}

/** Blocks as stored: text, or media by their new ids. */
export function storedBlocks(project, ids) {
  return project.blocks.map((b) =>
    typeof b === "string"
      ? { id: blockId(), type: "text", text: b }
      : {
          id: blockId(),
          type: "media",
          media: b.media.map((m) => ids.get(typeof m === "string" ? m : m.url)),
          ...(b.caption ? { caption: b.caption } : {}),
        },
  );
}

async function removeProject(db, studioId, slug, log) {
  const { data: row } = await db.from("projects").select("id").eq("studio_id", studioId).eq("slug", slug).maybeSingle();
  if (!row) return;
  const { data: media } = await db.from("project_media").select("storage_path").eq("project_id", row.id);
  const paths = (media ?? []).map((m) => m.storage_path);
  if (paths.length) await db.storage.from(BUCKET).remove(paths);
  const { error } = await db.from("projects").delete().eq("id", row.id);
  if (error) throw new Error(error.message);
  log(`  removed the existing ${slug}`);
}

export async function importProjects({ db, projects = PROJECTS, dryRun = false, replace = false, fetch, sharp, log = console.log }) {
  let studioId = null;
  if (!dryRun) {
    const { data: studio, error } = await db.from("studios").select("id").eq("slug", "amplifier").maybeSingle();
    if (error) throw new Error(error.message);
    if (!studio) throw new Error("No studio with the address “amplifier” in this database.");
    studioId = studio.id;
  }

  // Studio lists projects by `sort`, lowest first; these go ahead of anything already there.
  const results = [];
  for (const [i, project] of projects.entries()) {
    log(`\n${project.title} (/projects/${project.slug})`);
    if (!dryRun) {
      if (replace) await removeProject(db, studioId, project.slug, log);
      const { data: existing } = await db.from("projects").select("id").eq("studio_id", studioId).eq("slug", project.slug).maybeSingle();
      if (existing) {
        log("  already in Studio, skipped (use --replace to import it again)");
        results.push({ slug: project.slug, skipped: true });
        continue;
      }
    }

    let projectId = null;
    if (!dryRun) {
      const { data, error } = await db
        .from("projects")
        .insert({
          studio_id: studioId,
          slug: project.slug,
          title: project.title,
          client: project.client ?? null,
          year: project.year ?? null,
          services: project.services ?? [],
          short_summary: project.summary ?? null,
          featured: false,
          published: false,
          sort: i,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      projectId = data.id;
    }

    try {
      const ids = new Map();
      const files = filesOf(project);
      for (const [n, file] of files.entries()) {
        const got = await download(file, { fetch, sharp });
        const name = decodeURIComponent(new URL(file.url).pathname.split("/").pop());
        log(`  ${String(n + 1).padStart(2)}/${files.length} ${name} ${mb(got.body.length)}${got.width ? ` ${got.width}×${got.height}` : ""}`);
        if (dryRun) {
          ids.set(file.url, randomUUID());
          continue;
        }
        const path = `${studioId}/${projectId}/${randomUUID()}.${got.ext}`;
        const up = await db.storage.from(BUCKET).upload(path, got.body, { contentType: got.mime, upsert: false });
        if (up.error) throw new Error(`${name}: ${up.error.message}`);
        const { data, error } = await db
          .from("project_media")
          .insert({
            project_id: projectId,
            kind: got.mime.startsWith("video/") ? "video" : "image",
            storage_path: path,
            alt: file.alt ?? null,
            has_audio: false,
            width: got.width,
            height: got.height,
            bytes: got.body.length,
            mime: got.mime,
            sort: n,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        ids.set(file.url, data.id);
      }

      const blocks = storedBlocks(project, ids);
      const idOf = (file) => (file ? ids.get(typeof file === "string" ? file : file.url) : null);
      if (!dryRun) {
        const { error } = await db
          .from("projects")
          .update({ blocks, cover_media_id: idOf(project.cover), published: true, featured: true })
          .eq("id", projectId);
        if (error) throw new Error(error.message);
        if (project.thumbnail) {
          const thumb = await db.from("projects").update({ thumbnail_media_id: idOf(project.thumbnail) }).eq("id", projectId);
          if (thumb.error) {
            log(`  thumbnail not set (${thumb.error.message}): apply migration 15, then pick it in Studio with “Make thumbnail”`);
          }
        }
      }
      log(`  ${dryRun ? "checked" : "published and featured"}: ${files.length} files, ${blocks.length} blocks`);
      results.push({ slug: project.slug, files: files.length, blocks });
    } catch (error) {
      // Don't leave half a project behind.
      if (projectId) await removeProject(db, studioId, project.slug, () => {});
      throw error;
    }
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const replace = args.includes("--replace");
  const only = args.filter((a) => !a.startsWith("--"));
  const projects = only.length ? PROJECTS.filter((p) => only.includes(p.slug)) : PROJECTS;
  if (!projects.length) throw new Error(`No project with the address ${only.join(", ")}. Try: ${PROJECTS.map((p) => p.slug).join(", ")}`);

  const { default: sharp } = await import("sharp");
  let db = null;
  if (!dryRun) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase › Project settings › API keys).");
    }
    const { createClient } = await import("@supabase/supabase-js");
    db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  await importProjects({ db, projects, dryRun, replace, sharp });
  console.log(
    dryRun
      ? "\nDry run: every file downloaded fine. Nothing was changed."
      : "\nDone. Save any project in Studio › Portfolio (or redeploy) so the site shows the new work.",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`\n${error.message}`);
    process.exit(1);
  });
}
