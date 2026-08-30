/* ============================================================================
 *  /api/save — the only thing in this project that can change the website.
 * ============================================================================
 *
 *  WHY THIS EXISTS
 *  The site is static, so nothing in the browser can write a file. This runs on
 *  Netlify instead: it checks who is asking, checks the menu, and commits
 *  js/content.js to GitHub. Netlify sees the commit and redeploys, so the change
 *  is live about a minute later without anyone touching a file manager.
 *
 *  WHY THE RULES ARE NOT REPEATED HERE
 *  validate() and generate() are imported from admin/generate.js — the same
 *  functions the admin page uses and tests/admin.test.mjs covers. A second copy
 *  of "what a valid price is" would drift from the tested one, and the drift
 *  would only show up as a broken live site.
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
 *    - FILE_PATH is a constant: no request can choose what file to write
 *    - the generated file is parsed before committing, so a syntax error
 *      can never reach the live site
 *    - there is no all-powerful database key anywhere: the edit-history insert
 *      uses the owner's own token, and row-level security keeps it append-only
 *
 *  Setup and required environment variables: see DEPLOY.md.
 * ========================================================================== */
import { Buffer } from 'node:buffer';
import { Script } from 'node:vm';

// Side-effect import: sets globalThis.SwaadSeAdmin = { validate, generate, … }
import '../../admin/generate.js';

/** The one and only file this endpoint may write. Never taken from a request. */
const FILE_PATH = 'js/content.js';

export const config = { path: '/api/save' };

const json = (status, body) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

function settings() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL,
          GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = process.env;
  return {
    supabaseUrl: (SUPABASE_URL || '').replace(/\/+$/, ''),
    anonKey: SUPABASE_ANON_KEY,
    adminEmail: ADMIN_EMAIL,
    token: GITHUB_TOKEN,
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH || 'main',
    // Names only — never the values.
    missing: Object.entries({ SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, GITHUB_TOKEN, GITHUB_REPO })
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
 * Write the file through the GitHub Contents API.
 *
 * GitHub needs the sha of the copy being replaced. Sending a stale one gets a
 * 409, which is exactly the protection we want if two people save at once — so
 * it is re-read and retried once rather than blindly forced.
 *
 * @returns {Promise<{ok: boolean, status: number, detail: string, commit?: string}>}
 */
async function commitFile({ token, repo, branch }, text, message) {
  const url = `https://api.github.com/repos/${repo}/contents/${FILE_PATH}`;
  const headers = {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'swaadse-tiffin-admin',
  };

  const attempt = async () => {
    const head = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers });
    if (!head.ok && head.status !== 404) {
      return { ok: false, status: 502, detail: `GitHub would not let us read the file (${head.status}).` };
    }
    const sha = head.ok ? (await head.json()).sha : undefined;

    const put = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        message,
        content: Buffer.from(text, 'utf8').toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    if (put.ok) {
      const saved = await put.json();
      return { ok: true, status: 200, detail: 'saved', commit: saved.commit?.html_url };
    }
    return { ok: false, status: put.status, detail: await put.text() };
  };

  let result = await attempt();
  if (!result.ok && result.status === 409) result = await attempt();
  return result;
}

/**
 * Append this save to the edit history in Supabase. Runs after the commit and
 * uses the owner's own token — row-level security is the authorization, so no
 * key that could bypass it exists anywhere in the system. The site has already
 * published by the time this runs, so a failure here is reported as a warning,
 * never as a failed save.
 */
async function recordHistory({ supabaseUrl, anonKey }, token, user, state, commitUrl) {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/site_state`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        prefer: 'return=minimal',
      },
      body: JSON.stringify({ state, saved_by: user.id, commit_url: commitUrl ?? null }),
    });
    return res.ok;
  } catch {
    return false;
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
  const { validate, generate } = globalThis.SwaadSeAdmin;
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

  let text;
  try {
    text = generate(state);
  } catch {
    return json(500, { error: 'Could not build the file. Nothing was changed.' });
  }

  /* Parse the result without running it. A SyntaxError here means we were about
     to commit a file that would stop the live menu loading, leaving the site on
     the stale prices baked into index.html — a silent failure, so it is worth a
     check on the way past.

     new vm.Script() parses and throws on bad syntax; running it would take a
     deliberate .runInNewContext() call, which is the point. `new Function(…)`
     would do the same job but becomes arbitrary code execution the moment
     someone appends "()" to it, and the obvious next feature request — "also
     check the shape came out right" — invites exactly that edit. The shape is
     asserted in tests/admin.test.mjs instead, where executing it is safe. */
  try {
    new Script(text);
  } catch {
    return json(500, { error: 'Refused to save: the file did not come out valid. Nothing was changed.' });
  }

  const result = await commitFile(setup, text, 'content: menu update from /admin/');
  if (!result.ok) {
    return json(result.status === 409 ? 409 : 502, {
      error: result.status === 409
        ? 'Somebody else saved a moment ago. Refresh the page and make your change again.'
        : 'Could not save to GitHub. Nothing was changed.',
      detail: result.detail?.slice(0, 300),
    });
  }

  // The commit has landed and the site is already publishing, so nothing below
  // may hold up the answer. A slow or waking Supabase gives up after 3 seconds
  // and the save is reported exactly as it would be if the insert had failed.
  let giveUp;
  const historyRecorded = await Promise.race([
    recordHistory(setup, auth.token, auth.user, state, result.commit),
    new Promise(resolve => { giveUp = setTimeout(() => resolve(false), 3000); }),
  ]);
  clearTimeout(giveUp);   // or a fast insert leaves the timer holding the runtime open

  return json(200, {
    saved: true,
    message: 'Saved. Your website will show the change in about a minute.',
    commit: result.commit,
    ...(historyRecorded ? {} : { warning: 'Saved, but this edit could not be added to the history log.' }),
  });
};
