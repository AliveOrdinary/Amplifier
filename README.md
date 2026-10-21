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

## Database

Migrations are in `supabase/migrations`, applied in filename order:

1. `…01_drop_v1.sql` deletes the v1 tagger and briefing tables and their data. Afterwards, empty and delete the old `reference-images` bucket under Storage.
2. `…02_core_schema.sql` creates the v2 tables, row level security and the `library` and `portfolio` storage buckets.
3. `…03_seed_studio.sql` adds the studio, the eight taste dimensions and the question templates. Safe to re-run.

Apply them with the Supabase CLI (`supabase db push`) or paste each file into the SQL editor, in order.

### Studio members

1. In Supabase, **Authentication → Sign In / Providers**: turn off "Allow new users to sign up".
2. **Authentication → Users → Add user**: create your account (email + password).
3. Put your email and name into `supabase/add-members.sql` and run it in the SQL editor. This makes you the studio owner.

More members will be invited from the studio's Settings page.

A signed-in account that isn't in `members` is signed out and shown a notice.
