/* Keeps the free-tier Supabase project awake.
 *
 * Supabase pauses free projects after about a week without traffic, and a
 * weekly menu edit sits exactly on that line. A paused project cannot take the
 * website down — the renderer falls back to the values baked into index.html —
 * but it freezes the menu there and greets the owner with a dead login. One
 * tiny request a day costs nothing and removes the surprise. If it ever fails
 * anyway, DEPLOY.md documents the two-minute "Restore project" path in the
 * Supabase dashboard.
 *
 * GET /rest/v1/ is the PostgREST root: it answers with the API description,
 * touching no table and needing no policy — the anon key alone is enough.
 */
export const config = { schedule: '@daily' };

export default async () => {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return new Response('skipped: Supabase is not configured', { status: 200 });

  const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key } });
  return new Response(`pinged Supabase: ${res.status}`, { status: 200 });
};
