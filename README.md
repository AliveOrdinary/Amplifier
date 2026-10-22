# Amplifier

The studio site, the client Visual Brief and the studio's reference library, in one Next.js app.

- **Portfolio** (`/`): public site. Rebuilt in phase 5; amplifier.studio serves the current site until launch.
- **Brief** (`/b/…`): a private link per client. Phase 3.
- **Studio** (`/studio`): library, briefs, prep pages and portfolio projects, for studio members only.

The concept, decisions and build plan live in the *Amplifier Visual Brief — Concept Spec* doc.

## Stack

Next.js 16 (App Router, Cache Components, `proxy.ts`), Supabase (Postgres, Auth, Storage), Tailwind CSS 4, Claude API (from phase 2). Type is PP Neue Montreal with Geist Mono.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev
```

## Environment variables

| Variable | Used for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything |
| `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) | The browser extension's ingest endpoint |
| `ANTHROPIC_API_KEY` | Scoring library images |
| `AMPLIFIER_SCORING_MODEL` | Optional. Defaults to `claude-sonnet-5-5` |
| `VOYAGE_API_KEY` | Image embeddings: similar images, near-duplicates, brief pairs |
| `AMPLIFIER_EMBEDDING_MODEL` | Optional. Defaults to `voyage-multimodal-3.5` |

## Library

Images come in four ways: upload or drop in Studio › Library, paste an image or page link, the Chrome extension (right-click › Add to Amplifier library), or the Android share sheet once the studio is installed as an app. Each image is resized (1600px display, 480px thumbnail), checked for exact and near duplicates, and scored by Claude on the eight dimensions. Members review and correct scores from the keyboard in Library › Review, edit any image in Browse, and check gaps in Coverage. Extension keys live in Studio › Settings.

Each image is also embedded with Voyage (1024 numbers that place similar-looking images close together). That powers "More like this" in Browse, catches crops and recolours as near-duplicates, and helps briefs pick pairs. Images added before embeddings existed are embedded quietly the next time the library is opened.

### Rubric

The dimensions are the studio's own, edited in Settings › Rubric (up to 10). Each end is described by what you can see, and can have up to three anchor images. Claude scores every image against those definitions, sees the anchors, and sees the studio's eight most recent corrections as examples. Changing a definition marks the library for rescoring (run from the Rubric page) and flags corrections made under the old meaning; they're listed under Browse › To check. Retired dimensions keep their scores but leave scoring and briefs.

The Chrome extension lives in `extension/`. After changing it, run `npm run build:extension` to refresh `public/amplifier-extension.zip`, which the library page links to.

## Database

Migrations are in `supabase/migrations`, applied in filename order:

1. `…01_drop_v1.sql` deletes the v1 tagger and briefing tables and their data. Afterwards, empty and delete the old `reference-images` bucket under Storage.
2. `…02_core_schema.sql` creates the v2 tables, row level security and the `library` and `portfolio` storage buckets.
3. `…03_seed_studio.sql` adds the studio, the eight taste dimensions and the question templates. Safe to re-run.
4. `…04_library.sql` adds image processing columns and the browser extension's personal keys.
5. `…05_cached_image_urls.sql` stores each image's signed links for a week, so images keep the same address and stay cached.
6. `…06_rubric.sql` makes the dimensions editable: definitions, anchors, retiring, and Claude's score kept beside corrections.
7. `…07_embeddings.sql` turns on pgvector and adds image embeddings and the `similar_images` search.
8. `…08_briefs.sql` adds the brief's frozen plan, the welcome note, a 30-day link expiry and score snapshots on pairs.

Apply them with the Supabase CLI (`supabase db push`) or paste each file into the SQL editor, in order.

## Briefs

Studio › Briefs › New brief: pick the client and project type, adjust the questions and pin any images, then copy the private link (`/b/<token>`). The client sees, on their phone or computer:

1. A welcome, then "What are you making?"
2. Warm-up: 12 images, keep or skip (pins always included).
3. This or that: up to 20 pairs. Each pair tests one dimension with two images far apart on it and close on the rest (scores plus embeddings); the next pair goes to the dimension we're least sure about. Three pairs repeat an earlier one with the sides swapped, and four ask what caught their eye.
4. The remaining questions, then thanks.

When the client first opens the link, the brief freezes its plan (rubric, warm-up and image pool with their scores), so later library changes don't affect it. Progress is saved after every answer. Results, including an early read of where their choices lean, appear on the brief's page. The engine (`lib/brief/engine.ts`) is plain functions with no database, so it can be tested with simulated clients.

## Prep page

Each brief has a prep page (Briefs › a brief › Open prep page), ready when the client finishes (or after 8 pairs, on request). When the client's last answer arrives, Claude reads their written answers against what their choices showed (`lib/brief/report.ts`, one call, saved in `reports`) and writes:

- **Contradictions**: dimensions where their words and choices are at least 1.25 apart, each with a question for the meeting. The code picks them from the numbers; Claude writes the wording.
- **Taste profile**: said (ring) against showed (square) on every dimension.
- **Confident directions**: what they kept choosing and passing over, with images.
- **Hesitations**: slow choices and repeated pairs answered differently.
- **Starter moodboard**: their strongest picks plus the closest library matches (embeddings). Reorder, remove, add from the library; paste or drop images on the page to add them to the library and the board. Export as one image (clipboard), as layers (SVG on the clipboard, for Figma and FigJam) or as a zip of JPEGs.

The wording is editable on the page; Regenerate rewrites it.

### Studio members

1. In Supabase, **Authentication → Sign In / Providers**: turn off "Allow new users to sign up".
2. **Authentication → Users → Add user**: create your account (email + password).
3. Put your email and name into `supabase/add-members.sql` and run it in the SQL editor. This makes you the studio owner.

More members will be invited from the studio's Settings page.

A signed-in account that isn't in `members` is signed out and shown a notice.
