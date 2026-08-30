/**
 * SwaadSe Tiffin — the save endpoint.
 *
 * This is the only code in the project that can change the live website, so it
 * gets tested as a gate rather than as a feature: every assertion here is a way
 * the wrong person, or the right person with a broken menu, could otherwise
 * reach the published state.
 *
 * The insert IS the publish, so a refused insert has to read as a refused save,
 * and nothing may reach the table until every check has passed — the renderer
 * serves the latest row, not the latest approved one. Supabase is stubbed; the
 * stub throws on any other host, so a second dependency cannot creep back in.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const { default: save } = await import('../netlify/functions/save.mjs');
await import('../admin/generate.js');
const { PRICE_FIELDS } = globalThis.SwaadSeAdmin;

const SUPABASE_URL = 'https://project.supabase.test';
const ANON_KEY = 'anon-key-value';
const OWNER_EMAIL = 'owner@example.test';
const OWNER_ID = 'a1b2c3d4-0000-0000-0000-000000000000';
const OWNER_TOKEN = 'a-valid-session-token';

/** A menu the validator is happy with. */
const goodState = () => ({
  todaysSpecial: 'Dal Tadka · Mix Veg · Jeera Rice · 4 Tawa Roti',
  weeklyMenu: [
    { day: 'Monday', short: 'Mon', items: ['Dal Tadka', 'Mix Veg', 'Rice'] },
    { day: 'Tuesday', short: 'Tue', items: ['Rajma', 'Aloo Gobhi', 'Rice'] },
    { day: 'Wednesday', short: 'Wed', items: ['Chana', 'Kofta', 'Rice'] },
    { day: 'Thursday', short: 'Thu', items: ['Dal Fry', 'Aloo Matar', 'Rice'] },
    { day: 'Friday', short: 'Fri', items: ['Kadhi', 'Bhindi', 'Rice'] },
    { day: 'Saturday', short: 'Sat', items: ['Dal Makhani', 'Sabji', 'Rice'] },
    { day: 'Sunday', short: 'Sun', closed: true, note: 'Closed on Sundays.', items: [] },
  ],
  deliveryWindows: [
    { label: '7:00 – 9:00 AM', startHour: 7, endHour: 9 },
    { label: '4:00 – 5:00 PM', startHour: 16, endHour: 17 },
  ],
  prices: Object.fromEntries(PRICE_FIELDS.map(({ key }, i) => [key, 80 + i])),
  contact: {
    whatsapp: '917895590063',
    phones: ['7895590063', '7900778393', '8859008393'],
    addressLine1: '37/1 Om Vihar',
    addressLine2: 'Kamla Nagar',
    city: 'Agra',
    statePin: 'Uttar Pradesh 282005',
  },
});

const post = (body, { method = 'POST', token = OWNER_TOKEN } = {}) =>
  save(new Request('https://example.test/api/save', {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  }));

let realFetch;
let calls;
/** Every request that actually published something. */
const publishCalls = () => calls.filter(c => c.url.includes('/rest/v1/site_state'));

/**
 * Stub Supabase, routed by URL. `authStatus` forces a rejected token,
 * `userEmail` a wrong account, `insertStatus` a refused publish.
 *
 * Anything that is not Supabase throws rather than returning a polite stub:
 * this endpoint should have exactly one dependency now, and a test that
 * silently tolerated a second one would hide the thing worth catching.
 */
function stubNetwork({ authStatus = 200, userEmail = OWNER_EMAIL, insertStatus = 201 } = {}) {
  calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const entry = { url: String(url), method: options.method || 'GET',
                    headers: options.headers || {}, body: options.body };
    calls.push(entry);

    if (entry.url.includes('/auth/v1/user')) {
      return authStatus === 200
        ? Response.json({ id: OWNER_ID, email: userEmail })
        : new Response('bad token', { status: authStatus });
    }
    if (entry.url.includes('/rest/v1/site_state')) {
      return new Response(insertStatus === 201 ? '' : 'refused', { status: insertStatus });
    }
    throw new Error(`the save endpoint contacted an unexpected host: ${entry.url}`);
  };
}

beforeEach(() => {
  realFetch = globalThis.fetch;
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_ANON_KEY = ANON_KEY;
  process.env.ADMIN_EMAIL = OWNER_EMAIL;
  stubNetwork();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const name of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'ADMIN_EMAIL'])
    delete process.env[name];
});

// ─── who is allowed through ───────────────────────────────────────────────────
test('a request with no login token changes nothing', async () => {
  const res = await post({ state: goodState() }, { token: null });
  assert.equal(res.status, 401);
  assert.equal(calls.length, 0, 'no service may be contacted before a token is presented');
});

test('an expired or invented token changes nothing', async () => {
  stubNetwork({ authStatus: 401 });
  const res = await post({ state: goodState() }, { token: 'stale-or-forged' });
  assert.equal(res.status, 401);
  assert.equal(publishCalls().length, 0, 'nothing may be published until the login is verified');
});

test('a logged-in account that is not the owner cannot save', async () => {
  // Sign-ups are disabled in the dashboard, but a toggle is not a guarantee.
  // Whoever else exists in the auth database, only ADMIN_EMAIL may write.
  stubNetwork({ userEmail: 'intruder@example.test' });
  const res = await post({ state: goodState() });
  assert.equal(res.status, 403);
  assert.equal(publishCalls().length, 0);
});

test('with settings missing, saving is refused rather than left open', async () => {
  // The dangerous default. An unset variable must never mean "anyone may write".
  for (const name of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'ADMIN_EMAIL']) {
    const value = process.env[name];
    delete process.env[name];
    const res = await post({ state: goodState() });
    assert.equal(res.status, 503, `unset ${name} must refuse the save`);
    assert.match((await res.json()).error, /not switched on/i);
    process.env[name] = value;
  }
  assert.equal(calls.length, 0);
});

test('the readiness check reports missing settings by name, and only public values', async () => {
  delete process.env.ADMIN_EMAIL;
  const body = await (await post(null, { method: 'GET' })).json();
  assert.equal(body.ready, false);
  assert.deepEqual(body.missing, ['ADMIN_EMAIL']);

  // The Supabase URL and anon key are public by design — every Supabase browser
  // client ships them, and the edge renderer reads the live menu with the same
  // pair. Nothing else may leak, and no setting's VALUE may appear at all.
  assert.equal(body.supabase.url, SUPABASE_URL);
  assert.equal(body.supabase.anonKey, ANON_KEY);
  assert.ok(!JSON.stringify(body).includes(OWNER_EMAIL),
    'a setting\u2019s value must never appear in the readiness response');
});

test('only POST can write', async () => {
  for (const method of ['PUT', 'DELETE', 'PATCH']) {
    const res = await post({ state: goodState() }, { method });
    assert.equal(res.status, 405);
  }
  assert.equal(calls.length, 0);
});

// ─── what is allowed through ──────────────────────────────────────────────────
test('a menu that fails validation is never published', async () => {
  const state = goodState();
  state.prices['plan-basic'] = 0;
  const res = await post({ state });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.issues.join(' '), /Basic Veg Tiffin/);
  assert.equal(publishCalls().length, 0, 'nothing may be published while the menu is invalid');
});

test('junk in place of a menu is refused', async () => {
  for (const state of [null, 'a string', 42, []]) {
    const res = await post({ state });
    assert.equal(res.status, 400, `state ${JSON.stringify(state)} should be refused`);
  }
  assert.equal(publishCalls().length, 0);
});

test('a good save verifies the login first, then publishes as the owner', async () => {
  const res = await post({ state: goodState() });
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.saved, true);

  assert.ok(calls[0].url.includes('/auth/v1/user'),
    'the login must be verified before anything is written');

  assert.equal(publishCalls().length, 1, 'expected exactly one publish');
  const [insert] = publishCalls();
  assert.equal(insert.method, 'POST');

  // The owner's own token, never a service key: row-level security is the
  // authorization, so no credential in this system outranks it.
  assert.equal(insert.headers.authorization, `Bearer ${OWNER_TOKEN}`);
  assert.equal(insert.headers.apikey, ANON_KEY);

  const row = JSON.parse(insert.body);
  assert.equal(row.saved_by, OWNER_ID);
  assert.equal(row.state.todaysSpecial, goodState().todaysSpecial);
  assert.equal(row.state.prices['plan-basic'], 80);
  assert.ok(!JSON.stringify(row).includes(OWNER_TOKEN),
    'the session token must never be written into the published state');
});

test('a refused insert fails the save, because nothing else published it', async () => {
  // Reporting success here would be a lie the owner only discovers by looking
  // at their own website a week later.
  stubNetwork({ insertStatus: 500 });
  const res = await post({ state: goodState() });
  assert.equal(res.status, 502);

  const body = await res.json();
  assert.notEqual(body.saved, true, 'a failed publish must never report success');
  assert.match(body.error, /Nothing was changed/i);
});

// ─── a bad request must still answer in JSON ─────────────────────────────────
test('a Supabase outage is not reported as a dead login', async () => {
  // /admin/ throws the session away on a 401, so answering 401 for a service
  // failure makes the owner re-enter their password for a token that is fine.
  for (const status of [500, 502, 503]) {
    stubNetwork({ authStatus: status });
    const res = await post({ state: goodState() });
    assert.equal(res.status, 502, `Supabase ${status} must not read as "logged out"`);
    assert.match((await res.json()).error, /try again/i);
    assert.equal(publishCalls().length, 0, 'nothing may be published');
  }

  // A genuine refusal still ends the session.
  for (const status of [401, 403]) {
    stubNetwork({ authStatus: status });
    assert.equal((await post({ state: goodState() })).status, 401);
  }
});

test('menu data of the wrong shape is refused with a reason, not a bare 500', async () => {
  // validate() reads entry.closed and win.label directly. A request does not
  // have to come from /admin/, and an unguarded throw here becomes a bodyless
  // Netlify 500 that the editor can only show as "(500)".
  const shapes = [
    { ...goodState(), weeklyMenu: [null, null, null, null, null, null, null] },
    { ...goodState(), deliveryWindows: [null] },
    { ...goodState(), weeklyMenu: ['Monday', 'Tuesday'] },
    { ...goodState(), contact: null },
    { ...goodState(), prices: null },
  ];

  for (const state of shapes) {
    const res = await post({ state });
    assert.ok(res.status === 400, `expected 400, got ${res.status} for ${JSON.stringify(state).slice(0, 60)}…`);
    assert.ok((await res.json()).error, 'a refusal must carry a readable reason');
    assert.equal(publishCalls().length, 0, 'a malformed menu must never be published');
  }
});
