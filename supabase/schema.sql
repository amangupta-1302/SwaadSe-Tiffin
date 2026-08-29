-- ============================================================================
--  SwaadSe Tiffin — Supabase schema. Run once in the SQL editor (see DEPLOY.md).
-- ============================================================================
--
--  One append-only table. The latest row is the current state; older rows are
--  the edit history. Shape-checking lives in admin/generate.js validate() —
--  the same rules the admin page and the save function enforce — so the
--  database deliberately does not duplicate them in SQL.
--
--  The published site never reads this table. Publishing is still a git commit
--  of js/content.js, which is also why losing this database loses nothing
--  that cannot be rebuilt from the repository.

create table if not exists public.site_state (
  id         bigint generated always as identity primary key,
  state      jsonb not null,
  saved_at   timestamptz not null default now(),
  saved_by   uuid references auth.users (id),
  commit_url text
);

alter table public.site_state enable row level security;

-- Only a logged-in user may read the history or append to it, and only as
-- themselves. There are deliberately NO anon policies and NO update/delete
-- policies: even a leaked session token cannot rewrite what was saved before.
create policy "history is readable when logged in"
  on public.site_state for select
  to authenticated
  using (true);

create policy "history rows are appended by their author"
  on public.site_state for insert
  to authenticated
  with check (saved_by = auth.uid());

-- Seed (optional but recommended, so the table is never empty): paste the
-- current window.SITE object from js/content.js in place of the {} below.
-- insert into public.site_state (state) values ('{}'::jsonb);
