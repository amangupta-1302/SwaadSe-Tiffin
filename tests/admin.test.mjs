/**
 * SwaadSe Tiffin — admin area guards.
 *
 * Two jobs:
 *   1. Keep the admin honest about security. It is a static page, so it can
 *      never hold a real secret; the password check must live in server config.
 *   2. Pin validate(), which is the last thing between a typo and the live
 *      website. Nothing downstream cleans the state up — /api/save stores what
 *      the editor sends and the renderer prints it — so a rule this validator
 *      does not enforce is one the visitor reads.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const adminHtml = read('admin/index.html');
const generatorSrc = read('admin/generate.js');
const publicHtml = read('index.html');
const gitignore = read('.gitignore');
const netlifyToml = read('netlify.toml');
const schemaSql = read('supabase/schema.sql');

await import('../admin/generate.js');
const { validate, PRICE_FIELDS } = globalThis.SwaadSeAdmin;

/** Realistic prices, one per field the editor offers. */
const samplePrices = () => Object.fromEntries(PRICE_FIELDS.map(({ key }, i) => [key, 50 + i * 10]));

/** A clean seven-day week, matching what the real content.js holds. */
const fixture = () => ({
  todaysSpecial: 'Dal Tadka · Mix Veg · Jeera Rice · 4 Tawa Roti',
  weeklyMenu: [
    { day: 'Monday', short: 'Mon', items: ['Dal Tadka', 'Mix Veg', 'Rice', '4 Tawa Roti'] },
    { day: 'Tuesday', short: 'Tue', items: ['Rajma', 'Aloo Gobhi', 'Rice', '4 Tawa Roti'] },
    { day: 'Wednesday', short: 'Wed', items: ['Chana Masala', 'Lauki Kofta', 'Rice', '4 Tawa Roti'] },
    { day: 'Thursday', short: 'Thu', items: ['Dal Fry', 'Aloo Matar', 'Rice', '4 Tawa Roti'] },
    { day: 'Friday', short: 'Fri', items: ['Kadhi Pakoda', 'Bhindi Masala', 'Rice', '4 Tawa Roti'] },
    { day: 'Saturday', short: 'Sat', items: ['Dal Makhani', 'Seasonal Sabji', 'Rice', '4 Tawa Roti'] },
    { day: 'Sunday', short: 'Sun', closed: true, note: 'Kitchen closed on Sundays.', items: [] },
  ],
  deliveryWindows: [
    { label: '7:00 – 9:00 AM', startHour: 7, endHour: 9 },
    { label: '4:00 – 5:00 PM', startHour: 16, endHour: 17 },
  ],
  prices: { ...samplePrices(), 'plan-basic': 80, 'tier-single': 80, 'tier-one-meal': 2400, 'tier-lunch-dinner': 4600 },
  contact: {
    whatsapp: '917895590063',
    phones: ['7895590063', '7900778393', '8859008393'],
    addressLine1: '37/1 Om Vihar',
    addressLine2: 'Kamla Nagar',
    city: 'Agra',
    statePin: 'Uttar Pradesh 282005',
  },
});

// ─── the menu the owner can publish ──────────────────────────────────────────
test('the owner can run any number of delivery windows, not just two', () => {
  // The admin has add/remove buttons for windows, so one window (a festival
  // week) and three (an extra evening run) must both be publishable.
  const one = fixture();
  one.deliveryWindows = [{ label: 'Morning only, 7–9 AM', startHour: 7, endHour: 9 }];
  assert.deepEqual(validate(one).filter(([kind]) => kind === 'error'), []);

  const three = fixture();
  three.deliveryWindows.push({ label: '8:00 – 9:00 PM', startHour: 20, endHour: 21 });
  assert.deepEqual(validate(three).filter(([kind]) => kind === 'error'), []);

  // Zero windows stays an error — the "Next delivery" tag would have nothing
  // to say.
  const none = fixture();
  none.deliveryWindows = [];
  assert.ok(validate(none).some(([kind]) => kind === 'error'));
});

test('an empty dish box is blocked, not published as a blank bullet', () => {
  // Nothing between the editor and the page strips blanks: the state is stored
  // as typed and rendered item by item. This error is what stops an empty <li>
  // appearing under Tuesday.
  const state = fixture();
  state.weeklyMenu[1].items = ['Rajma', '', '   ', 'Rice'];
  const errors = validate(state).filter(([kind]) => kind === 'error').map(([, m]) => m);
  assert.match(errors.join(' | '), /Tuesday has an empty dish box/);
});

test('a closed day still has to say something to customers', () => {
  const state = fixture();
  state.weeklyMenu[6].note = '';
  assert.match(validate(state).map(([, m]) => m).join(' | '),
    /Sunday is marked closed but has no message/);
});

// ─── prices ──────────────────────────────────────────────────────────────────
test('validator catches every way the owner can break a price', () => {
  const messages = state => validate(state).map(([, m]) => m).join(' | ');
  const kinds = state => validate(state).map(([kind]) => kind);

  let s = fixture(); s.prices['plan-basic'] = 0;
  assert.match(messages(s), /Basic Veg Tiffin: enter the price as a whole number/);

  s = fixture(); s.prices['plan-premium'] = -50;
  assert.match(messages(s), /Premium Veg Tiffin/);

  s = fixture(); s.prices['pack-naan'] = 49.5;
  assert.match(messages(s), /Butter Naan/, 'half a rupee is not a price');

  s = fixture(); s.prices['plan-deluxe'] = 170000;
  assert.match(messages(s), /looks like a typo/);

  s = fixture(); delete s.prices;
  assert.match(messages(s), /No prices found/);

  // parseInt('') is NaN, and the boxes are free text on some phone keyboards.
  // Neither may pass: the renderer ignores anything that is not a whole number
  // above zero, so the card would quietly keep showing the old amount.
  s = fixture(); s.prices['pack-dal'] = NaN;
  assert.match(messages(s), /Dal \(400 ml\)/);

  s = fixture(); s.prices['pack-rice'] = '₹140';
  assert.match(messages(s), /Rice \(400 ml\)/);

  // Two prices for the same thing, side by side on one page.
  s = fixture(); s.prices['tier-single'] = 95;
  assert.ok(kinds(s).includes('warn'));
  assert.match(messages(s), /customers will ask which is right/);

  // The "Saves ₹…" badge cannot survive this, and the owner should know why.
  s = fixture(); s.prices['tier-lunch-dinner'] = 4800;
  assert.ok(kinds(s).includes('warn'));
  assert.match(messages(s), /not cheaper than two/);
});

// ─── phone numbers and address ───────────────────────────────────────────────
test('validator catches every way the owner can break a phone number', () => {
  const messages = state => validate(state).map(([, m]) => m).join(' | ');
  const kinds = state => validate(state).map(([kind]) => kind);

  let s = fixture(); s.contact.phones[0] = '';
  assert.match(messages(s), /Phone number 1 is empty/);

  s = fixture(); s.contact.phones[1] = '12345';
  assert.match(messages(s), /Phone number 2 .* is not a 10-digit Indian mobile/);

  // Indian mobiles start 6–9. A landline pasted in here would not receive
  // WhatsApp and often will not take an SMS either.
  s = fixture(); s.contact.phones[2] = '2345678901';
  assert.match(messages(s), /Phone number 3/);

  s = fixture(); s.contact.whatsapp = '7895590063';       // missing the 91
  assert.match(messages(s), /WhatsApp number must be 91 followed by/);

  s = fixture(); s.contact.phones = ['7895590063'];
  assert.match(messages(s), /must be 3 phone numbers/);

  s = fixture(); delete s.contact;
  assert.match(messages(s), /No contact details found/);

  s = fixture(); s.contact.city = '   ';
  assert.match(messages(s), /City is empty/);

  // Two boxes holding the same number is odd but not fatal.
  s = fixture(); s.contact.phones[1] = s.contact.phones[0];
  assert.ok(kinds(s).includes('warn'));
  assert.match(messages(s), /listed more than once/);

  // A WhatsApp number that is not the main phone number is legitimate, but the
  // owner should know the buttons now point at two different phones.
  s = fixture(); s.contact.whatsapp = '919999999999';
  assert.ok(kinds(s).includes('warn'));
  assert.match(messages(s), /Call buttons will ring/);
});

// ─── the validator ───────────────────────────────────────────────────────────
test('a clean week produces no complaints', () => {
  assert.deepEqual(validate(fixture()), []);
});

test('validator catches every way the owner can break the menu', () => {
  const kinds = state => validate(state).map(([kind]) => kind);
  const messages = state => validate(state).map(([, m]) => m).join(' | ');

  let s = fixture(); s.todaysSpecial = '   ';
  assert.ok(kinds(s).includes('error'), 'empty special should be an error');

  s = fixture(); s.weeklyMenu[0].items = ['Dal', '', 'Rice'];
  assert.match(messages(s), /Monday has an empty dish box/);

  s = fixture(); s.weeklyMenu[2].items = [];
  assert.match(messages(s), /Wednesday has no dishes/);

  s = fixture(); s.weeklyMenu[3].items = ['Dal', 'Rice'];
  assert.ok(kinds(s).includes('warn'), 'two dishes should warn, not silently pass');
  assert.match(messages(s), /at least three/);

  s = fixture(); s.weeklyMenu[6].note = '';
  assert.match(messages(s), /marked closed but has no message/);

  s = fixture(); s.deliveryWindows[0].endHour = 5;
  assert.match(messages(s), /ends before it starts/);

  s = fixture(); s.deliveryWindows[0].startHour = 99;
  assert.match(messages(s), /whole number from 0 to 23/);

  s = fixture(); s.deliveryWindows[1].label = '';
  assert.match(messages(s), /window 2 has no text/);

  s = fixture(); s.weeklyMenu.pop();
  assert.match(messages(s), /must have exactly 7 days/);
});

test('validator survives junk input instead of throwing', () => {
  for (const junk of [null, undefined, {}, { weeklyMenu: 'nope' }])
    assert.ok(Array.isArray(validate(junk)), `validate(${JSON.stringify(junk)}) should return a list`);
});

// ─── security posture ────────────────────────────────────────────────────────
test('the login check is server-side, not in the page', () => {
  // The save function must verify the session with Supabase and require the
  // one owner account. A page can be read with Ctrl+U; the server cannot.
  const saveSrc = read('netlify/functions/save.mjs');
  assert.match(saveSrc, /\/auth\/v1\/user/, 'the token must be verified with Supabase');
  assert.match(saveSrc, /ADMIN_EMAIL/, 'only the owner account may write');
  assert.match(saveSrc, /authorization/i, 'the token must come from the Authorization header');
});

test('no credential of any kind appears in the admin page', () => {
  const forbidden = [
    /password\s*[:=]\s*['"][^'"]+['"]/i,
    /passcode\s*[:=]\s*['"][^'"]+['"]/i,
    /\b(?:api[_-]?key|secret|token)\s*[:=]\s*['"][^'"]{6,}['"]/i,
    /btoa\(\s*['"][^'"]+['"]\s*\)/,
    /prompt\(\s*['"][^'"]*password/i,
  ];
  for (const source of [adminHtml, generatorSrc])
    for (const pattern of forbidden)
      assert.ok(!pattern.test(source),
        `a client-side credential appears to be present (${pattern}). A password in ` +
        `HTML or JavaScript is readable with Ctrl+U and protects nothing — ` +
        `authentication lives in Supabase, checked by the save function.`);
});

test('the admin page holds no Supabase configuration of its own', () => {
  // The URL and anon key come from /api/save at load time. Hardcoding them
  // here would mean two copies to keep in step, and the page would break the
  // day the Supabase project is recreated.
  assert.ok(!/supabase\.(co|com|in)/i.test(adminHtml),
    'a Supabase address is hardcoded in the admin page; it must come from /api/save');
});

test('no service-role key exists anywhere in the system', () => {
  // The history insert runs with the owner's own session token and row-level
  // security. A service-role key would bypass RLS and turn one leaked
  // environment variable into full database access.
  const saveSrc = read('netlify/functions/save.mjs');
  for (const source of [saveSrc, adminHtml, generatorSrc, netlifyToml])
    assert.ok(!/service[_-]?role/i.test(source), 'a service-role key is referenced; use the user token + RLS');
});

test('the content table is locked down in the committed schema', () => {
  // Tests cannot reach a live database, so the committed schema is the spec:
  // RLS on, no way to rewrite history, and the anonymous read kept to exactly
  // the one column the website needs.
  assert.match(schemaSql, /enable row level security/i);
  assert.ok(!/for\s+(update|delete)/i.test(schemaSql),
    'history must be append-only — no update or delete policies');
  assert.match(schemaSql, /with check\s*\(\s*saved_by\s*=\s*auth\.uid\(\)\s*\)/i,
    'inserts must be recorded as the user who made them');

  // The edge renderer reads the live menu with the anon key, so anon needs a
  // select — but a column grant, never a table one. A blanket grant would hand
  // every visitor the author and timestamp of every edit ever made.
  // Assert the column LIST, not an exact string: `id` has to be in there for
  // PostgREST to order by it, and pinning the literal text would fail the next
  // time a column is legitimately added.
  const grant = /grant\s+select\s*\(([^)]*)\)\s+on\s+public\.site_state\s+to\s+anon/i.exec(schemaSql);
  assert.ok(grant, 'anon needs a column-scoped select grant');
  const columns = grant[1].split(',').map(c => c.trim());
  assert.ok(columns.includes('state'), 'the website cannot render without state');
  for (const secret of ['saved_by', 'saved_at'])
    assert.ok(!columns.includes(secret), `anon must not read ${secret}`);
  assert.ok(!/grant\s+select\s+on\s+public\.site_state\s+to\s+anon/i.test(schemaSql),
    'a table-wide grant to anon exposes every column');

  // Supabase grants anon SELECT on every column by default, so the column
  // grant above narrows nothing unless the blanket grant is revoked first —
  // and it has to happen BEFORE, or it takes the narrow grant away again.
  const revokeAt = schemaSql.search(/revoke\s+select\s+on\s+public\.site_state\s+from\s+anon/i);
  const grantAt = schemaSql.search(/grant\s+select\s*\(/i);
  assert.ok(revokeAt !== -1, 'the default table-wide grant to anon must be revoked');
  assert.ok(revokeAt < grantAt, 'the revoke must come before the column grant, or it undoes it');

  // Split rather than match: one regex spanning "create policy … to anon"
  // happily runs from the first policy into a later one and miscounts.
  const anonPolicies = schemaSql.split(/create policy/i).slice(1)
    .map(block => block.split(';')[0])
    .filter(statement => /\bto\s+anon\b/i.test(statement));
  assert.equal(anonPolicies.length, 1, 'anon should have exactly one policy');
  assert.match(anonPolicies[0], /for\s+select/i, 'the anon policy must be read-only');
});

test('the admin area is kept out of search engines', () => {
  assert.match(adminHtml, /<meta name="robots" content="noindex/i);
  assert.match(netlifyToml, /X-Robots-Tag/i, 'Netlify must send the noindex header for /admin/*');
});

test('the save function keeps its settings out of the repository', () => {
  // A committed .env would hand write access to this repo to anyone who reads it.
  assert.match(gitignore, /^\.env$/m, '.env must be gitignored');
  assert.match(gitignore, /^\.env\.\*$/m, '.env.local and friends must be gitignored too');

  const saveSrc = read('netlify/functions/save.mjs');
  for (const name of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'ADMIN_EMAIL'])
    assert.match(saveSrc, new RegExp(name), `${name} must come from the environment`);
  for (const literal of [/SUPABASE_ANON_KEY\s*=\s*['"]/, /ADMIN_EMAIL\s*=\s*['"]/])
    assert.ok(!literal.test(saveSrc), `a hard-coded secret matching ${literal} is in the save function`);

  // Publishing is a database insert. A GitHub credential here would be a write
  // token to the whole repository sitting in an env var for no reason at all.
  assert.ok(!/GITHUB_/.test(saveSrc), 'the save function must not publish through GitHub');
});

test('the public site does not advertise the admin page', () => {
  assert.ok(!/href="[^"]*\/?admin\//.test(publicHtml),
    'index.html links to the admin area; remove the link');
});

// ─── no duplicated logic ─────────────────────────────────────────────────────
test('the editor reuses the site logic rather than copying it', () => {
  // A second copy of nextDelivery() or the validator would drift from the
  // tested one: the preview would lie to the owner, and /api/save would refuse
  // a menu the page had just called clean.
  assert.match(adminHtml, /<script src="\.\.\/js\/main\.js"><\/script>/);
  assert.match(adminHtml, /<script src="generate\.js"><\/script>/);
  assert.match(adminHtml, /window\.SwaadSeAdmin/);
  assert.ok(!/function nextDelivery/.test(adminHtml), 'nextDelivery re-implemented in the admin page');
  assert.ok(!/function validate\s*\(/.test(adminHtml), 'validator re-implemented in the admin page');
});

test('the editor blocks saving while there are errors', () => {
  assert.match(adminHtml, /\$\('save'\)\.disabled = blocked/);
  assert.match(adminHtml, /issue--error/);
});

// ─── the Save button ─────────────────────────────────────────────────────────
test('the editor calls the save function at an absolute path', () => {
  // This page is served from /admin/, so fetch('api/save') would resolve to
  // /admin/api/save — which Netlify does not route to the function. The page
  // would then silently decide saving is unavailable — leaving the owner with
  // no way to publish at all.
  const calls = [...adminHtml.matchAll(/fetch\(\s*(['"])([^'"]*save[^'"]*)\1/g)].map(m => m[2]);
  assert.ok(calls.length >= 2, `expected the readiness check and the save call, found ${calls.length}`);
  for (const path of calls)
    assert.ok(path.startsWith('/'), `fetch("${path}") is relative; it must be "/api/save"`);
});

test('the editor shows a login, and only once the server says saving works', () => {
  for (const id of ['save-online', 'save', 'pw', 'email', 'login', 'logged-in', 'recovery'])
    assert.match(adminHtml, new RegExp(`id="${id}"`), `missing #${id}`);
  // Whether saving is possible is decided by asking the server, never assumed.
  assert.match(adminHtml, /function pickSavingMode/);
  assert.match(adminHtml, /function cannotSave/);
  // Publishing is the database insert. A page offering to hand the owner a
  // file to paste somewhere would be offering a route that publishes nothing.
  assert.ok(!/id="(copy|download|output)"/.test(adminHtml),
    'the editor offers a file-and-paste route, which publishes nothing');
});

test('delivery windows can be added and removed, like dishes', () => {
  // The buttons are built by renderWindows(), so this greps the script that
  // builds them — same level as the save-button checks above.
  assert.match(adminHtml, /Add a delivery window/, 'missing the add-a-window button');
  assert.match(adminHtml, /Remove delivery window/, 'missing the per-window remove button');
  assert.match(adminHtml, /deliveryWindows\.push\(/, 'the add button must grow the list');
  assert.match(adminHtml, /deliveryWindows\.splice\(/, 'the remove button must shrink the list');
});

test('the password and session token are never persisted anywhere', () => {
  // A credential in localStorage outlives the tab and is readable by any
  // script that later gets onto the page. The password stays in its field and
  // one request; the session token stays in one JavaScript variable.
  for (const sink of [/localStorage/, /sessionStorage/, /document\.cookie/, /indexedDB/])
    assert.ok(!sink.test(adminHtml), `the admin page must not use ${sink}`);
});
