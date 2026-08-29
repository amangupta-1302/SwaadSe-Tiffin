/**
 * SwaadSe Tiffin — admin area guards.
 *
 * Two jobs:
 *   1. Keep the admin honest about security. It is a static page, so it can
 *      never hold a real secret; the password check must live in server config.
 *   2. Prove the file generator emits valid JavaScript with the right shape. If
 *      it ever emits something broken, the live menu silently falls back to the
 *      static copy in index.html and nobody notices for a week.
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
const { validate, generate, PRICE_FIELDS } = globalThis.SwaadSeAdmin;

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

/** Execute generated content.js exactly as a browser would, and hand back SITE. */
const evaluate = code => {
  const fakeWindow = {};
  new Function('window', code)(fakeWindow);
  return fakeWindow.SITE;
};

// ─── the generator ───────────────────────────────────────────────────────────
test('generated content.js is valid JavaScript and round-trips exactly', () => {
  const state = fixture();
  const site = evaluate(generate(state));

  assert.equal(site.todaysSpecial, state.todaysSpecial);
  assert.equal(site.weeklyMenu.length, 7);
  assert.equal(site.weeklyMenu[0].day, 'Monday', 'the week must still start on Monday');
  assert.equal(site.weeklyMenu[6].day, 'Sunday');
  assert.equal(site.weeklyMenu[6].closed, true);
  assert.deepEqual(site.weeklyMenu[0].items, state.weeklyMenu[0].items);
  assert.deepEqual(site.deliveryWindows, state.deliveryWindows);
});

test('generated output satisfies the same checks as the shipped content.js', () => {
  // These mirror tests/sections.test.mjs. The editor must never produce a file
  // that would fail the suite the owner is told to run before uploading.
  const site = evaluate(generate(fixture()));
  for (const day of site.weeklyMenu.slice(0, 6))
    assert.ok(day.items.length >= 3, `${day.day} needs at least 3 dishes`);
  assert.ok(site.deliveryWindows.length >= 1, 'at least one delivery window');
  for (const win of site.deliveryWindows) {
    assert.ok(win.label.trim().length > 0, 'every window needs customer-readable text');
    assert.ok(Number.isInteger(win.startHour) && win.startHour >= 0 && win.startHour <= 23);
    assert.ok(Number.isInteger(win.endHour) && win.endHour > win.startHour);
  }
});

test('the owner can run any number of delivery windows, not just two', () => {
  // The admin has add/remove buttons for windows, so one window (a festival
  // week) and three (an extra evening run) must both survive the round trip.
  const one = fixture();
  one.deliveryWindows = [{ label: 'Morning only, 7–9 AM', startHour: 7, endHour: 9 }];
  assert.equal(evaluate(generate(one)).deliveryWindows.length, 1);
  assert.deepEqual(validate(one).filter(([kind]) => kind === 'error'), []);

  const three = fixture();
  three.deliveryWindows.push({ label: '8:00 – 9:00 PM', startHour: 20, endHour: 21 });
  assert.equal(evaluate(generate(three)).deliveryWindows.length, 3);
  assert.deepEqual(validate(three).filter(([kind]) => kind === 'error'), []);

  // Zero windows stays an error — the "Next delivery" tag would have nothing
  // to say.
  const none = fixture();
  none.deliveryWindows = [];
  assert.ok(validate(none).some(([kind]) => kind === 'error'));
});

test('dish names containing quotes or backslashes do not break the file', () => {
  const state = fixture();
  state.weeklyMenu[0].items = ['Dal "Special"', "Mother's Recipe", 'A\\B', 'Rice'];
  state.todaysSpecial = 'Today\'s "best" — 100% veg';
  const site = evaluate(generate(state));
  assert.deepEqual(site.weeklyMenu[0].items, ['Dal "Special"', "Mother's Recipe", 'A\\B', 'Rice']);
  assert.equal(site.todaysSpecial, 'Today\'s "best" — 100% veg');
});

test('empty dish boxes are dropped rather than written as blanks', () => {
  const state = fixture();
  state.weeklyMenu[1].items = ['Rajma', '', '   ', 'Rice', '4 Tawa Roti'];
  const site = evaluate(generate(state));
  assert.deepEqual(site.weeklyMenu[1].items, ['Rajma', 'Rice', '4 Tawa Roti']);
});

test('a closed day emits its note and an empty item list', () => {
  const state = fixture();
  state.weeklyMenu[6].note = 'Closed today, back tomorrow.';
  const site = evaluate(generate(state));
  assert.equal(site.weeklyMenu[6].closed, true);
  assert.equal(site.weeklyMenu[6].note, 'Closed today, back tomorrow.');
  assert.deepEqual(site.weeklyMenu[6].items, []);
});

test('generated file keeps the plain-English editing instructions', () => {
  // The owner may edit by hand later; stripping the guide would strand them.
  const code = generate(fixture());
  assert.match(code, /THIS IS THE FILE YOU EDIT EVERY WEEK/);
  assert.match(code, /HOW TO EDIT/);
  assert.match(code, /Never delete a quote mark/);
  assert.match(code, /window\.SITE = \{/);
});

// ─── prices ──────────────────────────────────────────────────────────────────
test('every price survives the trip through the generated file as a number', () => {
  const state = fixture();
  const site = evaluate(generate(state));

  assert.deepEqual(site.prices, state.prices);
  for (const { key, label } of PRICE_FIELDS)
    assert.equal(typeof site.prices[key], 'number',
      `${label} came out as ${typeof site.prices[key]}; the website ignores anything but a number`);
});

test('a price typed as text or left blank never reaches the file as a broken value', () => {
  // parseInt('') is NaN and the boxes are free text on some phone keyboards.
  const state = fixture();
  state.prices['pack-dal'] = NaN;
  state.prices['pack-rice'] = '₹140';
  const site = evaluate(generate(state));

  assert.equal(site.prices['pack-dal'], 0, 'NaN must become a plain 0, not the literal NaN');
  assert.equal(site.prices['pack-rice'], 0, 'a string must not be written as a string');
  // …and the owner is stopped before they can paste it anywhere.
  assert.match(validate(state).map(([, m]) => m).join(' | '), /Dal \(400 ml\)/);
});

test('the generated file is still valid JavaScript when every price is missing', () => {
  const state = fixture();
  delete state.prices;
  const site = evaluate(generate(state));           // must not throw
  assert.equal(Object.keys(site.prices).length, PRICE_FIELDS.length);
});

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
test('contact details round-trip as digits, whatever the owner typed', () => {
  const state = fixture();
  // People type numbers the way they read them. The file must hold digits only,
  // because the website builds "tel:+91…" and "wa.me/…" out of them.
  state.contact.phones = ['78955 90063', '+91 79007 78393', '8859-008-393'];
  state.contact.whatsapp = '+91 78955 90063';
  const site = evaluate(generate(state));

  assert.deepEqual(site.contact.phones, ['7895590063', '917900778393', '8859008393']);
  assert.equal(site.contact.whatsapp, '917895590063');
  assert.equal(site.contact.city, 'Agra');
});

test('an address typed with stray spaces is trimmed', () => {
  const state = fixture();
  state.contact.addressLine1 = '  37/1 Om Vihar  ';
  assert.equal(evaluate(generate(state)).contact.addressLine1, '37/1 Om Vihar');
});

test('the generated file stays valid when contact details are missing entirely', () => {
  const state = fixture();
  delete state.contact;
  const site = evaluate(generate(state));            // must not throw
  assert.equal(site.contact.whatsapp, '');
  assert.deepEqual(site.contact.phones, []);
});

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

test('the edit history table is locked down in the committed schema', () => {
  // Tests cannot reach a live database, so the committed schema is the spec:
  // RLS on, nothing for anonymous visitors, and no way to rewrite history.
  assert.match(schemaSql, /enable row level security/i);
  assert.ok(!/to\s+anon\b/i.test(schemaSql), 'no policy may grant anything to anon');
  assert.ok(!/for\s+(update|delete)/i.test(schemaSql),
    'history must be append-only — no update or delete policies');
  assert.match(schemaSql, /with check\s*\(\s*saved_by\s*=\s*auth\.uid\(\)\s*\)/i,
    'inserts must be recorded as the user who made them');
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
  for (const name of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'ADMIN_EMAIL', 'GITHUB_TOKEN'])
    assert.match(saveSrc, new RegExp(name), `${name} must come from the environment`);
  for (const literal of [/SUPABASE_ANON_KEY\s*=\s*['"]/, /GITHUB_TOKEN\s*=\s*['"]/, /ADMIN_EMAIL\s*=\s*['"]/])
    assert.ok(!literal.test(saveSrc), `a hard-coded secret matching ${literal} is in the save function`);
});

test('the public site does not advertise the admin page', () => {
  assert.ok(!/href="[^"]*\/?admin\//.test(publicHtml),
    'index.html links to the admin area; remove the link');
});

// ─── no duplicated logic ─────────────────────────────────────────────────────
test('the editor reuses the site logic rather than copying it', () => {
  // A second copy of nextDelivery() or the generator would drift from the
  // tested one, and the preview would start lying to the owner.
  assert.match(adminHtml, /<script src="\.\.\/js\/main\.js"><\/script>/);
  assert.match(adminHtml, /<script src="generate\.js"><\/script>/);
  assert.match(adminHtml, /window\.SwaadSeAdmin/);
  assert.ok(!/function nextDelivery/.test(adminHtml), 'nextDelivery re-implemented in the admin page');
  assert.ok(!/function generate\s*\(/.test(adminHtml), 'generator re-implemented in the admin page');
  assert.ok(!/function validate\s*\(/.test(adminHtml), 'validator re-implemented in the admin page');
});

test('the editor blocks saving while there are errors', () => {
  assert.match(adminHtml, /\$\('copy'\)\.disabled = blocked/);
  assert.match(adminHtml, /\$\('save'\)\.disabled = blocked/);
  assert.match(adminHtml, /issue--error/);
});

// ─── the Save button ─────────────────────────────────────────────────────────
test('the editor calls the save function at an absolute path', () => {
  // This page is served from /admin/, so fetch('api/save') would resolve to
  // /admin/api/save — which Netlify does not route to the function. The page
  // would then silently decide saving is unavailable and show copy-and-paste,
  // exactly the thing the function exists to remove.
  const calls = [...adminHtml.matchAll(/fetch\(\s*(['"])([^'"]*save[^'"]*)\1/g)].map(m => m[2]);
  assert.ok(calls.length >= 2, `expected the readiness check and the save call, found ${calls.length}`);
  for (const path of calls)
    assert.ok(path.startsWith('/'), `fetch("${path}") is relative; it must be "/api/save"`);
});

test('the editor keeps a real login and copy-and-paste as alternatives', () => {
  for (const id of ['save-online', 'save-offline', 'save', 'copy', 'pw', 'email', 'login', 'logged-in', 'recovery'])
    assert.match(adminHtml, new RegExp(`id="${id}"`), `missing #${id}`);
  // Which one is shown is decided by asking the server, never assumed.
  assert.match(adminHtml, /function pickSavingMode/);
  assert.match(adminHtml, /useOfflineSaving/);
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
