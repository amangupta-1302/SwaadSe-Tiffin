/* ============================================================================
 *  /api/save — the only thing in this project that can change the website.
 * ============================================================================
 *
 *  The site is static, so nothing in the browser can write anything. This runs
 *  on Netlify instead: it checks who is asking, checks the menu, and appends
 *  the new state to Supabase. netlify/edge-functions/render.js serves the
 *  latest row, so the change is live within seconds and no deploy happens.
 *
 *  THE INSERT IS THE PUBLISH. Nothing else publishes, so a refused insert is a
 *  failed save and must be reported as one — returning `saved: true` with a
 *  warning would claim success for an edit that never reached the website.
 *
 *  validate() is imported from admin/generate.js rather than restated here:
 *  one copy of "what a valid price is", shared with the page that shows the
 *  errors and the tests that cover them.
 *
 *  THE SECURITY MODEL
 *  This endpoint is the guard, not the page. /admin/ holds no secrets and is
 *  harmless to open. Everything that can cause a change is checked here, on the
 *  server, where the visitor cannot reach it:
 *
 *    - the owner logs in through Supabase Auth; every save carries their
 *      session token, which is verified with Supabase on each request
 *    - only the one account named in ADMIN_EMAIL may write, so accidentally
 *      re-enabled sign-ups grant nothing
 *    - missing settings mean saving is refused outright, never left open
 *    - there is no all-powerful database key anywhere: the insert uses the
 *      owner's own token, and row-level security keeps the table append-only
 *
 *  Setup and required environment variables: see DEPLOY.md.
 * ========================================================================== */

// Side-effect import: sets globalThis.SwaadSeAdmin = { validate, generate, … }
import '../../admin/generate.js';

export const config = { path: '/api/save' };

const json = (status, body) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

function settings() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL } = process.env;
  return {
    supabaseUrl: (SUPABASE_URL || '').replace(/\/+$/, ''),
    anonKey: SUPABASE_ANON_KEY,
    adminEmail: ADMIN_EMAIL,
    // Names only — never the values.
    missing: Object.entries({ SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL })
      .filter(([, value]) => !value)
      .map(([name]) => name),
  };
}

/**
 * Ask Supabase who this session token belongs to, then require it to be the
 * owner. Verifying over the network instead of checking the JWT signature here
 * means no crypto code, no signing-key management, and a session revoked in
 * the dashboard is refused immediately rather than until its token expires.
 */
async function verifyUser({ supabaseUrl, anonKey, adminEmail }, authHeader) {
  const token = /^Bearer (.+)$/.exec(authHeader || '')?.[1];
  if (!token) {
    return { ok: false, status: 401, error: 'You are not logged in. Log in and press Save again.' };
  }

  let user;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${token}` },
    });
    // Only Supabase saying "no" means the session is finished. Anything else —
    // the free project waking up, a rate limit, a gateway blip — is a service
    // problem, and answering 401 would make /admin/ throw away a token that is
    // still perfectly good and demand the password again mid-edit.
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403) {
        return { ok: false, status: 502, error: 'The login service is having trouble. Nothing was changed — try again in a minute.' };
      }
      return { ok: false, status: 401, error: 'Your login has expired. Log in and press Save again.' };
    }
    user = await res.json();
  } catch {
    return { ok: false, status: 502, error: 'Could not reach the login service. Nothing was changed — try again in a minute.' };
  }

  // Backstop: even if sign-ups were switched back on by mistake, only the one
  // owner account may change the website.
  if (!user?.email || user.email.toLowerCase() !== String(adminEmail).toLowerCase()) {
    return { ok: false, status: 403, error: 'This account is not allowed to change the website.' };
  }
  return { ok: true, user, token };
}

/**
 * Publish the new state by appending it to Supabase.
 *
 * The insert uses the owner's own session token, so row-level security is the
 * authorization and no key that could bypass it exists anywhere in the system.
 * The table has no update or delete policy, so every save is a new row and the
 * whole edit history stays recoverable.
 *
 * A failure here means nothing reached the website.
 *
 * @returns {Promise<{ok: boolean, detail?: string}>}
 */
async function publish({ supabaseUrl, anonKey }, token, user, state) {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/site_state`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        prefer: 'return=minimal',
      },
      body: JSON.stringify({ state, saved_by: user.id }),
    });
    if (res.ok) return { ok: true };
    return { ok: false, detail: (await res.text()).slice(0, 300) };
  } catch (error) {
    return { ok: false, detail: String(error?.message || error).slice(0, 300) };
  }
}

export default async (request) => {
  const setup = settings();

  // Lets /admin/ discover whether a real Save button can work here, and hands
  // it the Supabase connection details so the page itself carries no
  // configuration. Reports which variables are unset so setup is debuggable,
  // never their values — the URL and anon key are the exception, because they
  // are public by design: every Supabase browser client ships them, and row
  // level security plus auth do the actual guarding.
  if (request.method === 'GET') {
    return json(200, {
      ready: setup.missing.length === 0,
      missing: setup.missing,
      ...(setup.supabaseUrl && setup.anonKey
        ? { supabase: { url: setup.supabaseUrl, anonKey: setup.anonKey } }
        : {}),
    });
  }
  if (request.method !== 'POST') {
    return json(405, { error: 'Send this as a POST.' });
  }

  // Fail closed. A missing setting must never mean "anyone may save".
  if (setup.missing.length) {
    return json(503, {
      error: 'Saving is not switched on for this site yet.',
      detail: `Still to set on Netlify: ${setup.missing.join(', ')}. See DEPLOY.md.`,
    });
  }

  const auth = await verifyUser(setup, request.headers.get('authorization'));
  if (!auth.ok) {
    return json(auth.status, { error: auth.error });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Could not read what was sent.' });
  }

  const state = body?.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return json(400, { error: 'No menu data arrived with that request.' });
  }

  // The same checks the admin page shows, enforced again here — a request can
  // reach this endpoint without going through that page at all.
  const { validate } = globalThis.SwaadSeAdmin;
  let blocking;
  try {
    // validate() reads shapes the admin page can never produce — a null day, a
    // null delivery window — and a request does not have to come from that page.
    // Left unguarded it throws, and Netlify answers with a bodyless 500 that
    // /admin/ can only render as "(500)".
    blocking = validate(state).filter(([kind]) => kind === 'error').map(([, message]) => message);
  } catch {
    return json(400, { error: 'That menu data is not in a shape this website understands. Nothing was changed.' });
  }
  if (blocking.length) {
    return json(400, { error: 'Nothing was changed, because of this:', issues: blocking });
  }

  const result = await publish(setup, auth.token, auth.user, state);
  if (!result.ok) {
    // Nothing was written anywhere, so say so plainly. The owner's edits are
    // still in the page and pressing Save again is the whole retry.
    return json(502, {
      error: 'Could not save to the database. Nothing was changed — try again in a minute.',
      detail: result.detail,
    });
  }

  return json(200, {
    saved: true,
    message: 'Saved. Your website will show the change within a minute.',
  });
};
