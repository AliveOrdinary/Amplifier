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

**Pinterest boards** come in through the extension too: open a board, click the Amplifier button, Import this board. The extension scrolls the board in the designer's own browser, sends each pin's full-size image (or Pinterest's 736px version if the original is too big), and labels it with who imported it and the board's name ("Ana · Wayfinding"). Imported images are stored, de-duplicated and embedded at once, but scored later through Anthropic's Message Batches API (half price, usually within the hour, `lib/library/score-queue.ts`). They go straight to the library unless something needs a look: a likely duplicate, a failed score, or Claude being unsure overall (average confidence under 0.4). Those wait in Review with the reason shown. Finished batches are read back whenever someone has the library or rubric page open, or when an import ends.

The library never loads all at once. Review loads only what's waiting for review; Browse asks the server for 60 images at a time, newest first, and loads the next 60 as you scroll, with the status, medium, board, search and "To check" filters applied on the server. Tab counts and Coverage are counted in the database. The pickers (rubric anchors, brief pins, the moodboard's "Add from library") search on the server and show more on request. New images still appear without a reload: the page checks every 15 seconds for anything added since.

Each image is also embedded with Voyage (1024 numbers that place similar-looking images close together). That powers "More like this" in Browse, catches crops and recolours as near-duplicates, and helps briefs pick pairs. Images added before embeddings existed are embedded quietly the next time the library is opened.

### Rubric

The dimensions are the studio's own, edited in Settings › Rubric (up to 10). Each end is described by what you can see, and can have up to three anchor images. Claude scores every image against those definitions, sees the anchors, and sees the studio's eight most recent corrections as examples. Changing a definition (or its anchors) marks that dimension out of date, and only that dimension is rescored: Claude's answer is a few numbers instead of a full score, which roughly halves the cost. Up to 40 out-of-date images rescore straight away from the Rubric page; more go through the Batch API in the background. Corrections made under the old meaning are flagged and listed under Browse › To check. Retired dimensions keep their scores but leave scoring and briefs.

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
9. `…09_generalist.sql` adds four media (signage and wayfinding, interiors, print and editorial, illustration), the generalist project types (the four artist-only ones are retired, not deleted, so older briefs keep their label), where an imported image came from and why it's flagged, per-dimension score dates, and the Batch API scoring queue.
10. `…10_brief_matching.sql` adds `images_near`: the approved images closest to a piece of text.
11. `…11_library_paging.sql` adds the queries behind a paged library: `library_page` (Browse, with every filter), `library_counts`, `library_boards`, `library_coverage`, `library_media` and `library_pick` (the pickers).

Apply them with the Supabase CLI (`supabase db push`) or paste each file into the SQL editor, in order.

## Briefs

Studio › Briefs › New brief: pick the client and project type (brand identity, rebrand, website, packaging or product, space and signage, campaign or print, music/film/art release, event), adjust the questions and pin any images, then copy the private link (`/b/<token>`). The client sees, on their phone or computer:

1. A welcome, then "What are you making?"
2. Warm-up: 12 images, keep or skip (pins always included).
3. This or that: up to 20 pairs. Each pair tests one dimension with two images far apart on it and close on the rest (scores plus embeddings); the next pair goes to the dimension we're least sure about. Three pairs repeat an earlier one with the sides swapped, and four ask what caught their eye.
4. The remaining questions, then thanks.

When the client has answered "What are you making?", the brief freezes its plan (rubric, warm-up and image pool with their scores), so later library changes don't affect it. The pool is up to 300 images: about three quarters are the approved images closest to their answer (embedded with Voyage and matched with `images_near`, nudged towards the project's medium), the rest are open to anything, since taste crosses over. Pins are always in. Without embeddings, or if they skip the question, the pool leans on the medium instead. Progress is saved after every answer. Results, including an early read of where their choices lean, appear on the brief's page. The engine (`lib/brief/engine.ts`) is plain functions with no database, so it can be tested with simulated clients.

## Prep page

Each brief has a prep page (Briefs › a brief › Open prep page), ready when the client finishes (or after 8 pairs, on request). When the client's last answer arrives, Claude reads their written answers against what their choices showed (`lib/brief/report.ts`, one call, saved in `reports`) and writes:

- **Contradictions**: dimensions where their words and choices are at least 1.25 apart, each with a question for the meeting. The code picks them from the numbers; Claude writes the wording.
- **Taste profile**: said (ring) against showed (square) on every dimension.
- **Confident directions**: what they kept choosing and passing over, with images.
- **Hesitations**: slow choices and repeated pairs answered differently.
- **Starter moodboard**: their strongest picks plus the closest library matches (embeddings). Reorder, remove, add from the library; paste or drop images on the page to add them to the library and the board. Export as layers (SVG on the clipboard: separate images in a Figma design file) or as a zip of JPEGs to drag into FigJam or Claude Design.

The wording is editable on the page; Regenerate rewrites it.

### Studio members

1. In Supabase, **Authentication → Sign In / Providers**: turn off "Allow new users to sign up".
2. **Authentication → Users → Add user**: create your account (email + password).
3. Put your email and name into `supabase/add-members.sql` and run it in the SQL editor. This makes you the studio owner.

More members will be invited from the studio's Settings page.

A signed-in account that isn't in `members` is signed out and shown a notice.
