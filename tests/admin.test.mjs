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
const htaccess = read('admin/.htaccess');
const publicHtml = read('index.html');
const gitignore = read('.gitignore');

await import('../admin/generate.js');
const { validate, generate } = globalThis.SwaadSeAdmin;

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
  assert.equal(site.deliveryWindows[0].startHour, 7);
  assert.equal(site.deliveryWindows[1].startHour, 16);
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
test('the password check is server-side, not in the page', () => {
  assert.match(htaccess, /AuthType\s+Basic/i);
  assert.match(htaccess, /Require\s+valid-user/i);
  assert.match(htaccess, /AuthUserFile/i);
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
        `authentication belongs in admin/.htaccess.`);
});

test('HTTPS is forced, because Basic Auth is only base64-encoded', () => {
  assert.match(htaccess, /RewriteCond\s+%\{HTTPS\}\s+!=on/i);
  assert.match(htaccess, /https:\/\/%\{HTTP_HOST\}/i);
});

test('the admin area is kept out of search engines and directory listings', () => {
  assert.match(adminHtml, /<meta name="robots" content="noindex/i);
  assert.match(htaccess, /X-Robots-Tag/i);
  assert.match(htaccess, /Options\s+-Indexes/i);
});

test('the password file can never be served or committed', () => {
  assert.match(htaccess, /htpasswd/);
  assert.match(htaccess, /Require\s+all\s+denied/i);
  assert.match(gitignore, /htpasswd/, '.htpasswd must never be committed to git');
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
  assert.match(adminHtml, /issue--error/);
});
