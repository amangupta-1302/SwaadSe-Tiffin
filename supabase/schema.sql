-- ============================================================================
--  SwaadSe Tiffin — Supabase schema. Run once in the SQL editor (see DEPLOY.md).
-- ============================================================================
--
--  One append-only table. The latest row is the current state; older rows are
--  the edit history. Shape-checking lives in admin/generate.js validate() —
--  the same rules the admin page and the save function enforce — so the
--  database deliberately does not duplicate them in SQL.
--
--  The latest row IS the live website. netlify/edge-functions/render.js reads
--  it on each request (cached ~30s) and fills index.html with it before the
--  visitor gets the page, so a save is live in seconds with no deploy.
--
--  If this database is unreachable the site still renders — the edge function
--  falls back to the values baked into index.html. Stale, but a working page.

create table if not exists public.site_state (
  id         bigint generated always as identity primary key,
  state      jsonb not null,
  saved_at   timestamptz not null default now(),
  saved_by   uuid references auth.users (id)
);

alter table public.site_state enable row level security;

-- Only a logged-in user may read the whole history or append to it, and only
-- as themselves. There are deliberately NO update and NO delete policies: even
-- a leaked session token cannot rewrite or erase what was saved before, which
-- is what makes every past state recoverable.
--
-- Anon gets its own, much narrower select further down.
--
-- Every policy is dropped first so this file can be re-run. The Supabase SQL
-- editor runs a paste as one transaction, so a single "already exists" rolls
-- the whole thing back — which looks exactly like nothing happened.
drop policy if exists "history is readable when logged in" on public.site_state;
create policy "history is readable when logged in"
  on public.site_state for select
  to authenticated
  using (true);

drop policy if exists "history rows are appended by their author" on public.site_state;
create policy "history rows are appended by their author"
  on public.site_state for insert
  to authenticated
  with check (saved_by = auth.uid());

-- The renderer reads the live menu with the anon key, and that menu is on the
-- public website anyway. A grant plus a policy rather than a security-definer
-- view: nothing here bypasses row-level security.
--
-- The revoke is not tidiness. Supabase grants anon SELECT on every column of
-- every public table by default, so the column grant ADDS nothing — it narrows
-- only once the blanket grant is gone. Without it every visitor could read
-- saved_by and saved_at: who edited the site, and when.
--
-- `id` is granted because PostgREST cannot ORDER BY a column it may not read,
-- and "the newest row" has to be expressible. It leaks only how many saves
-- have happened.
revoke select on public.site_state from anon;
grant select (id, state) on public.site_state to anon;

drop policy if exists "published content is public" on public.site_state;
create policy "published content is public"
  on public.site_state for select
  to anon
  using (true);

-- Seed REQUIRED, not optional: the edge function has nothing to render from
-- until one row exists. Paste the current window.SITE object from
-- js/content.js in place of the {} below.
-- insert into public.site_state (state) values ('{}'::jsonb);
