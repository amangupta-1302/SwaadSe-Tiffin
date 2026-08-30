/**
 * SwaadSe Tiffin — per-section content assertions.
 *
 * Everything here protects a business fact: a price, a plan's contents, a
 * delivery timing, a working CTA. If the owner edits index.html and breaks one
 * of these, the suite says which one.
 *
 * Run: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

/** index.html carries ✏️ EDIT markers for the owner throughout. Content has to
 *  live in real markup, so every assertion runs against comment-stripped HTML —
 *  otherwise a comment mentioning a price would satisfy a price assertion. */
const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '');
const contentSrc = read('js/content.js');

const WA = 'https://wa.me/917895590063';

// ─── CTAs ────────────────────────────────────────────────────────────────────
test('every WhatsApp link is prefilled and uses the primary number', () => {
  const links = [...html.matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(links.length >= 10, `expected >=10 WhatsApp CTAs, found ${links.length}`);
  for (const link of links) {
    assert.ok(link.startsWith(WA), `points at the wrong number: ${link}`);
    assert.match(link, /\?text=\S+/, `missing prefilled message: ${link}`);
  }
});

test('prefilled messages never contain a raw + or a raw rupee sign', () => {
  // In a query string "+" decodes to a space, so "Lunch + Dinner" would arrive
  // in WhatsApp as "Lunch   Dinner". It has to be %2B. Likewise ₹ must be
  // percent-encoded to survive older Android WhatsApp builds.
  for (const [, text] of html.matchAll(/href="https:\/\/wa\.me\/\d+\?text=([^"]*)"/g)) {
    assert.ok(!text.includes('+'), `raw + decodes to a space: ${text}`);
    assert.ok(!text.includes('₹'), `rupee sign must be percent-encoded: ${text}`);
  }
});

test('phone numbers are tappable, all three are reachable', () => {
  assert.match(html, /href="tel:\+917895590063"/);
  for (const n of ['7900778393', '8859008393'])
    assert.ok(html.includes(`tel:+91${n}`), `alternate number ${n} is not tappable`);
});

test('persistent action bar carries labelled WhatsApp and Call links', () => {
  const bar = html.match(/<div class="action-bar">([\s\S]*?)<\/div>/);
  assert.ok(bar, 'action bar missing');
  assert.match(bar[1], /aria-label="Order on WhatsApp"/);
  assert.match(bar[1], /aria-label="Call Now"/);
});

test('mobile nav toggle is wired for assistive tech', () => {
  assert.match(html, /aria-controls="site-nav"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /<nav class="nav" id="site-nav" aria-label="Main">/);
});

test('all seven navigation destinations exist as real sections', () => {
  for (const id of ['plans', 'todays-menu', 'why-us', 'reviews', 'faq', 'contact'])
    assert.ok(new RegExp(`id="${id}"`).test(html), `nav points at #${id} but no such section`);
});

// ─── hero ────────────────────────────────────────────────────────────────────
test('hero uses the exact approved headline and subhead, with one h1', () => {
  assert.equal((html.match(/<h1/g) || []).length, 1, 'exactly one h1 per page');
  assert.ok(html.includes('Fresh Homemade Veg Tiffin Delivered Daily in Agra'));
  assert.ok(html.includes('Healthy, Hygienic &amp; Affordable Home-Style Meals for Students, Office Professionals &amp; Families.'));
});

test('WhatsApp CTA appears before the hero image in source order', () => {
  const cta = html.indexOf(WA);
  const img = html.indexOf('hero-tiffin-thali');
  assert.ok(cta > -1 && img > -1 && cta < img,
    'the CTA must precede the hero photo so it stays above the fold on mobile');
});

test('hero image is prioritised for LCP, not lazy-loaded', () => {
  const tag = html.match(/<img[^>]*hero-tiffin-thali[^>]*>/)[0];
  assert.match(tag, /fetchpriority="high"/);
  assert.ok(!tag.includes('loading="lazy"'), 'lazy-loading the hero delays LCP');
});

test('all five hero trust badges are present', () => {
  for (const badge of ['100% Pure Vegetarian', 'Freshly Cooked Daily',
    'Delivery Within 5 KM', 'Home-Style Taste', 'Affordable Monthly Plans'])
    assert.ok(html.includes(badge), `missing trust badge: ${badge}`);
});

test('no invented ratings or order volumes anywhere on the page', () => {
  // Fabricated social proof on a live commercial site is not acceptable, and
  // Google Ads treats unverifiable claims as a landing-page quality problem.
  assert.ok(!/\b4\.\d\s*(★|stars|rating)/i.test(html), 'invented star rating found');
  assert.ok(!/\b\d{2,}\+?\s*(happy customers|tiffins daily|daily tiffins|orders daily)/i.test(html),
    'invented volume claim found');
});

// ─── today's menu ────────────────────────────────────────────────────────────
test('content.js exposes a full seven-day menu with Sunday closed', async () => {
  globalThis.window = globalThis;
  await import('../js/content.js');
  const { weeklyMenu, todaysSpecial, deliveryWindows } = globalThis.SITE;

  assert.equal(weeklyMenu.length, 7);
  assert.equal(weeklyMenu[0].day, 'Monday', 'week must start on Monday');
  assert.equal(weeklyMenu[6].day, 'Sunday');
  assert.equal(weeklyMenu[6].closed, true);
  assert.ok(typeof todaysSpecial === 'string' && todaysSpecial.length > 5);

  for (const day of weeklyMenu.slice(0, 6))
    assert.ok(day.items.length >= 3, `${day.day} needs at least 3 dishes listed`);

  // The owner may run any number of windows (the admin has add/remove), so
  // the shape is pinned rather than the count: every window must be something
  // the "Next delivery" tag can actually render.
  assert.ok(deliveryWindows.length >= 1, 'at least one delivery window');
  for (const win of deliveryWindows) {
    assert.ok(typeof win.label === 'string' && win.label.trim().length > 0,
      'every delivery window needs customer-readable text');
    assert.ok(Number.isInteger(win.startHour) && win.startHour >= 0 && win.startHour <= 23);
    assert.ok(Number.isInteger(win.endHour) && win.endHour > win.startHour,
      'a delivery window must end after it starts');
  }
});

test('content.js is written for a non-developer to edit', () => {
  const comments = (contentSrc.match(/^\s*(\/\/|\/\*|\*)/gm) || []).length;
  assert.ok(comments >= 20, `only ${comments} comment lines; this file is edited weekly`);
  assert.ok(/HOW TO EDIT/i.test(contentSrc), 'needs plain-English instructions at the top');
});

test('the week is also in static HTML so it survives JavaScript being off', () => {
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
    assert.ok(html.includes(day), `${day} missing from the no-JS fallback markup`);
  assert.match(html, /<noscript>/);
});

test('scroll-reveal sections are visible without JavaScript', () => {
  // Being present in the markup is not the same as being readable. An earlier
  // version hid every .reveal section with opacity:0 in the base rule, so with
  // JavaScript off the whole page below the hero rendered blank.
  const css = read('css/styles.css');

  const hidingRules = [...css.matchAll(/([^{}]*\.reveal[^{}]*)\{([^}]*)\}/g)]
    .filter(([, , body]) => /opacity:\s*0\s*[;}]/.test(body))
    .map(([, selector]) => selector.trim());

  assert.ok(hidingRules.length > 0, 'expected the reveal animation to exist at all');
  for (const selector of hidingRules)
    assert.ok(/^\.js\b|\s\.js\b/.test(selector),
      `"${selector}" hides content without requiring the .js class, so a visitor ` +
      `with JavaScript disabled sees nothing`);

  // The .js class must come from an inline script, which cannot fail to load.
  assert.match(html, /<script>[\s\S]*documentElement\.classList\.add\('js'\)/,
    'the .js class must be set inline in <head>, not from an external file');
  // And a timer must reveal everything if main.js never runs.
  assert.match(html, /reveal-all/, 'no safety net if main.js fails to load');
});

test('the reduced-motion reset outranks the rule that hides reveals', () => {
  // A media query contributes no specificity. `.reveal { opacity: 1 }` inside
  // prefers-reduced-motion therefore LOSES to `.js .reveal { opacity: 0 }`
  // (0,1,0 against 0,2,0) and quietly does nothing at all. Measured in a real
  // browser: with .reveal-all and .is-visible stripped, the under-specified
  // version left all 58 revealed groups at opacity 0 and the corrected one left
  // none. It only ever looked correct because the safety net and the observer
  // both overrode it a moment later — so this guard was decoration resting on
  // two unrelated mechanisms, which is worse than no guard at all.
  const css = read('css/styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  const reset = [...reduced.matchAll(/([^{}]*)\{([^}]*)\}/g)]
    .find(([, selector, body]) => /\.reveal\b/.test(selector) && /opacity:\s*1/.test(body));

  assert.ok(reset, 'prefers-reduced-motion must restore .reveal to a visible resting state');
  assert.match(reset[1].trim(), /^\.js\s+\.reveal\b/,
    `"${reset[1].trim()}" is less specific than the ".js .reveal" rule it has to ` +
    `beat, so it never applies and a reduced-motion visitor can get a blank page`);
});

test('entrance animations cannot leave content invisible', () => {
  // The rule above only guards `.reveal`. Entrance animations hide content a
  // second way: a keyframe starting at opacity 0 with `backwards` fill holds
  // the element invisible through its delay. Unscoped, that blanks the hero for
  // anyone without JavaScript; unreset, it strands anyone who asked for less
  // motion on a permanently empty page.
  // Comments first, or a comment sitting above a rule gets captured as part of
  // its selector and the assertion reports nonsense.
  const css = read('css/styles.css').replace(/\/\*[\s\S]*?\*\//g, '');

  const hidingKeyframes = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)]
    .filter(([, , body]) => /(?:from|0%)\s*\{[^}]*opacity:\s*0/.test(body))
    .map(([, name]) => name);
  assert.ok(hidingKeyframes.length > 0, 'expected the entrance animations to exist at all');

  const reducedBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

  for (const name of hidingKeyframes) {
    for (const [, selector] of css.matchAll(new RegExp(`([^{}]*)\\{[^}]*animation:[^;}]*\\b${name}\\b`, 'g'))) {
      const rule = selector.trim().split(',').map(s => s.trim());
      for (const one of rule)
        assert.ok(/^\.js\b/.test(one),
          `"${one}" runs ${name}, which starts invisible, without requiring the .js class — ` +
          `a visitor with JavaScript off would never see it`);
    }
    assert.ok(reducedBlock.includes(name) || /animation:\s*none\s*!important/.test(reducedBlock),
      `${name} is never cancelled for prefers-reduced-motion`);
  }
});

// ─── why choose us ───────────────────────────────────────────────────────────
test('all ten reasons are listed under the exact section title', () => {
  assert.ok(html.includes('Why Choose SwaadSe Tiffin?'));
  // "Home-Style Taste" is capitalised the same way here as in the hero badges.
  // The brief spelled it both ways; one spelling on the page beats two.
  for (const f of ['Freshly Cooked Daily', 'Home-Style Taste', 'Hygienic Kitchen',
    'Premium Quality Ingredients', 'Affordable Monthly Plans', 'Timely Delivery',
    'Healthy Balanced Meals', 'Perfect for Students', 'Perfect for Office Lunch',
    'Made with Love'])
    assert.ok(html.includes(f), `missing reason: ${f}`);
});

// ─── meal plans ──────────────────────────────────────────────────────────────
test('four plans, exact prices, four CTAs', () => {
  for (const [name, price] of [['Basic Veg Tiffin', '₹80'], ['Standard Veg Tiffin', '₹120'],
    ['Premium Veg Tiffin', '₹150'], ['Deluxe Veg Tiffin', '₹170']]) {
    assert.ok(html.includes(name), `missing plan: ${name}`);
    assert.ok(html.includes(price), `missing price: ${price}`);
  }
  assert.equal((html.match(/Order This Plan/g) || []).length, 4);
});

test('each plan CTA names its own plan in the prefilled message', () => {
  for (const plan of ['Basic', 'Standard', 'Premium', 'Deluxe'])
    assert.match(html, new RegExp(`wa\\.me/917895590063\\?text=[^"]*${plan}%20Veg%20Tiffin`),
      `the ${plan} CTA does not identify which plan the customer wants`);
});

test('exactly one plan is badged, and Deluxe lists all eleven items', () => {
  assert.equal((html.match(/Most Popular/g) || []).length, 1,
    'more than one badge destroys the meaning of the badge');
  for (const item of ['3 Plain Roti', '1 Missi Roti', 'Paneer Sabji', 'Mirchoni',
    'Pickle', 'Sweet', 'Raita', 'Salad'])
    assert.ok(html.includes(item), `Deluxe plan missing: ${item}`);
});

test('packing is stated for every plan', () => {
  assert.ok(html.includes('Standard Tiffin'), 'Basic plan packing missing');
  assert.ok((html.match(/Disposable/g) || []).length >= 3, 'three plans ship disposable packing');
});

// ─── subscription + packs ────────────────────────────────────────────────────
test('subscription tiers priced correctly inside the contrasting band', () => {
  const band = html.match(/class="[^"]*band--green[^"]*"([\s\S]*?)<\/section>/);
  assert.ok(band, 'subscription band missing');
  for (const price of ['₹4600', '₹2400', '₹80'])
    assert.ok(band[1].includes(price), `missing tier price: ${price}`);
  assert.ok(band[1].includes(WA), 'the subscription band needs its own WhatsApp CTA');
  assert.ok(/Mon.Sat/.test(band[1]), 'the band must say Mon–Sat so Sunday is not implied');
});

test('all eight food packs with their prices and quantities', () => {
  for (const [name, price] of [['Dal', '₹180'], ['Rice', '₹140'], ['4 Roti', '₹80'],
    ['Shahi Paneer', '₹220'], ['Butter Paneer Masala', '₹260'], ['Mixed Raita', '₹140'],
    ['Mutter Paneer', '₹140'], ['Butter Naan', '₹50']])
    assert.ok(html.includes(name) && html.includes(price), `pack missing: ${name} ${price}`);
  assert.ok(html.includes('400 ml'), 'pack quantities must be stated');
  assert.ok(html.includes('2 pcs'), 'Butter Naan quantity must be stated');
});

// ─── prices come from one place ──────────────────────────────────────────────
/**
 * Every element carrying data-price="…", with the ₹ amount baked into the
 * markup as the no-JavaScript fallback. On a link the amount lives inside the
 * prefilled WhatsApp message, not the link text.
 * @returns {Array<{tag: string, key: string, amount: number}>}
 */
const taggedPrices = () =>
  [...html.matchAll(/<(\w+)((?:[^>]*?)\bdata-price="([^"]+)"(?:[^>]*?))>([^<]*)/g)]
    .map(([, tag, attrs, key, text]) => {
      const found = tag === 'a' ? attrs.match(/%E2%82%B9(\d+)/) : text.match(/^₹(\d+)$/);
      assert.ok(found, `data-price="${key}" on <${tag}> carries no ₹ amount`);
      return { tag, key, amount: Number(found[1]) };
    });

test('every data-price key exists in content.js, and every price is used', async () => {
  globalThis.window = globalThis;
  await import('../js/content.js');
  const { prices } = globalThis.SITE;

  assert.ok(prices, 'content.js has no prices block');
  const used = new Set(taggedPrices().map(p => p.key));

  for (const key of used)
    assert.ok(Number.isInteger(prices[key]) && prices[key] > 0,
      `index.html asks for price "${key}" but content.js has no whole-rupee value for it`);

  for (const key of Object.keys(prices))
    assert.ok(used.has(key),
      `content.js defines price "${key}" but nothing in index.html uses it — dead price`);
});

test('the admin editor offers exactly the prices the page uses', async () => {
  await import('../admin/generate.js');
  const keys = globalThis.SwaadSeAdmin.PRICE_FIELDS.map(f => f.key);

  assert.equal(new Set(keys).size, keys.length, 'PRICE_FIELDS has a duplicate key');
  assert.deepEqual(keys.slice().sort(), [...new Set(taggedPrices().map(p => p.key))].sort(),
    'the price boxes in /admin/ no longer match the prices on the page');
});

test('a price and the WhatsApp message quoting it never disagree', () => {
  // The fallback amounts are what a visitor with JavaScript off sees, and what
  // the customer's prefilled message says. Two copies of ₹170 that drift apart
  // means someone taps "Order This Plan" and quotes a price we do not charge.
  const byKey = new Map();
  for (const { key, amount, tag } of taggedPrices()) {
    if (byKey.has(key))
      assert.equal(amount, byKey.get(key),
        `"${key}" is written as ₹${byKey.get(key)} in one place and ₹${amount} on a <${tag}>`);
    else byKey.set(key, amount);
  }
  assert.ok(byKey.size >= 15, `only ${byKey.size} prices are wired to content.js`);
});

test('the prices Google reads match the prices on the page', () => {
  // These three are read by search engines and social previews from the served
  // HTML, before any JavaScript runs, so they cannot be filled in from
  // content.js. They are listed in EDITING-GUIDE section 2 as a manual step.
  const baked = new Map(taggedPrices().map(p => [p.key, p.amount]));
  const planPrices = [...baked].filter(([k]) => k.startsWith('plan-')).map(([, v]) => v);

  const meta = html.match(/name="description" content="([^"]+)"/)[1];
  assert.match(meta, new RegExp(`from ₹${Math.min(...planPrices)} a meal`),
    'the search-result description quotes a cheapest price the page no longer shows');
  assert.match(meta, new RegExp(`monthly from ₹${baked.get('tier-one-meal')}`),
    'the search-result description quotes a stale monthly price');

  const og = html.match(/property="og:description" content="([^"]+)"/)[1];
  assert.match(og, new RegExp(`from ₹${Math.min(...planPrices)} a meal`),
    'the WhatsApp/social sharing preview quotes a stale price');

  const range = html.match(/"priceRange":\s*"₹(\d+)–₹(\d+)"/);
  assert.ok(range, 'the business listing has no priceRange');
  assert.equal(Number(range[1]), Math.min(...planPrices), 'priceRange low end is stale');
  assert.equal(Number(range[2]), Math.max(...planPrices), 'priceRange high end is stale');
});

// ─── phone numbers and address come from one place ───────────────────────────
test('every phone number the page shows is one content.js defines', async () => {
  globalThis.window = globalThis;
  await import('../js/content.js');
  const { contact } = globalThis.SITE;
  assert.ok(contact, 'content.js has no contact block');

  const slots = [...new Set([...html.matchAll(/data-phone="(\d+)"/g)].map(m => Number(m[1])))];
  assert.ok(slots.length >= 3, `expected three phone slots, found ${slots.length}`);
  for (const slot of slots)
    assert.ok(/^[6-9]\d{9}$/.test(String(contact.phones[slot] || '')),
      `index.html shows phone slot ${slot} but content.js has no 10-digit number for it`);

  // Every tel: link must be wired, or that one keeps ringing the old number
  // after the owner changes it — the failure nobody notices until an ad runs.
  const telLinks = [...html.matchAll(/<a[^>]*href="tel:[^"]*"[^>]*>/g)].map(m => m[0]);
  assert.ok(telLinks.length >= 9, `expected at least 9 tel: links, found ${telLinks.length}`);
  for (const link of telLinks)
    assert.match(link, /data-phone="\d+"/, `an untagged tel: link would never update:\n  ${link}`);
});

test('every WhatsApp link points at one single number', async () => {
  globalThis.window = globalThis;
  await import('../js/content.js');
  const { whatsapp } = globalThis.SITE.contact;
  assert.match(whatsapp, /^91[6-9]\d{9}$/, 'the WhatsApp number needs its 91 country code');

  // Deliberately NOT compared against content.js. The amounts and numbers baked
  // into index.html are the last published values and the no-JavaScript
  // fallback; once the client edits them in /admin/ the two legitimately differ,
  // and a test that failed on that would cry wolf after every real change.
  // What must always hold is that the 25 baked links agree with each other —
  // one stale link among them is a customer messaging an abandoned number.
  const numbers = new Set([...html.matchAll(/wa\.me\/(\d+)/g)].map(m => m[1]));
  assert.equal(numbers.size, 1,
    `index.html mixes ${numbers.size} different WhatsApp numbers: ${[...numbers].join(', ')}`);
});

test('every address slot the page asks for is one main.js can fill', async () => {
  const known = ['line1', 'line2', 'city-state', 'street', 'short'];
  const used = new Set([...html.matchAll(/data-contact="([a-z0-9-]+)"/g)].map(m => m[1]));

  assert.ok(used.size >= 4, `expected several address slots, found ${used.size}`);
  for (const slot of used)
    assert.ok(known.includes(slot),
      `index.html asks for address slot "${slot}", which js/main.js does not fill in — ` +
      `that line would silently keep whatever is baked into the HTML forever`);

  // Every slot main.js supports should be reachable from the page, or it is
  // dead code pretending to be a feature.
  const main = read('js/main.js');
  for (const slot of known)
    assert.ok(main.includes(`'${slot}'`) || main.includes(`${slot},`) || main.includes(`${slot}:`),
      `js/main.js no longer produces address slot "${slot}"`);
});

test('a cleared address line overwrites the page rather than being skipped', () => {
  // validate() does not require addressLine2, so the owner may legitimately
  // empty it. If the [data-contact] loop tested truthiness, '' would be skipped
  // and the baked "Kamla Nagar" would stay on the page beside a street slot
  // that had already dropped it — two addresses, one screen, nothing to see.
  // addressSlots() returning '' is covered in tests/schedule.test.mjs; the
  // write itself needs a DOM, so the guard is pinned here instead.
  const main = read('js/main.js');
  const loop = main.match(/for \(const el of \$\$\('\[data-contact\]'\)\)[\s\S]{0,200}/);
  assert.ok(loop, 'js/main.js no longer writes address slots');
  assert.match(loop[0], /value !== undefined/,
    'the address write must tell a cleared line from a missing one, not test truthiness');
});

test('the legal pages carry the same phone number and address as the front page', () => {
  // privacy.html and terms.html deliberately load no JavaScript, so /admin/
  // cannot reach them. That makes them the one place a contact change can be
  // left half-finished — worth failing over, since a privacy policy naming a
  // dead number is the sort of thing a customer quotes back at you.
  const baked = html.match(/<a[^>]*href="tel:\+91(\d{10})"/)[1];
  const street = html.match(/data-contact="street">([^<]+)</)[1];

  for (const page of ['privacy.html', 'terms.html']) {
    const source = read(page);
    assert.ok(source.includes(baked),
      `${page} does not mention ${baked}, the number index.html shows — update it, see EDITING-GUIDE 5b`);
    assert.ok(source.includes(street),
      `${page} does not mention "${street}" — its address is out of step with index.html`);
    assert.ok(!/<script/.test(source),
      `${page} has gained a <script>; if that is intentional, wire its contact details up too`);
  }
});

// ─── how it works ────────────────────────────────────────────────────────────
test('four numbered steps in a real ordered list', () => {
  const ol = html.match(/<ol class="steps[^"]*"([\s\S]*?)<\/ol>/);
  assert.ok(ol, 'steps must be an <ol> — the order carries meaning for screen readers');
  for (const step of ['Choose Meal Plan', 'Message on WhatsApp', 'Confirm Address',
    'Fresh Food Delivered Daily'])
    assert.ok(ol[1].includes(step), `missing step: ${step}`);
  assert.equal((ol[1].match(/<li/g) || []).length, 4);
});

// ─── delivery ────────────────────────────────────────────────────────────────
test('delivery facts are stated, and Sunday is never implied to be open', () => {
  for (const fact of ['5 KM', '37/1 Om Vihar', 'Kamla Nagar', 'Agra',
    '7:00 AM – 9:00 AM', '4:00 PM – 5:00 PM', 'Sunday Closed'])
    assert.ok(html.includes(fact), `missing delivery fact: ${fact}`);
  assert.ok(html.includes('Mon–Sat'),
    '"Delivered Daily" in the h1 needs Mon–Sat nearby or the page contradicts itself');
});

test('visible delivery hours match openingHoursSpecification in the schema', () => {
  const biz = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(m => JSON.parse(m[1])).find(o => o['@type'] === 'FoodEstablishment');
  const windows = biz.openingHoursSpecification.map(s => [s.opens, s.closes]);
  assert.deepEqual(windows, [['07:00', '09:00'], ['16:00', '17:00']],
    'schema hours drifted from the 7–9 AM / 4–5 PM shown on the page');
});

// ─── reviews ─────────────────────────────────────────────────────────────────
test('review cards are accessible and flagged as placeholders', () => {
  const cards = html.match(/<li class="card card--lift review"[\s\S]*?<\/li>/g) || [];
  assert.ok(cards.length >= 3, `expected >=3 review cards, found ${cards.length}`);
  for (const card of cards) {
    assert.match(card, /<blockquote>/, 'a testimonial belongs in a blockquote');
    // Star glyphs are invisible to screen readers without a text equivalent.
    assert.match(card, /aria-label="Rated 5 out of 5"/);
    assert.match(card, /data-placeholder="true"/,
      'sample reviews must stay flagged until real quotes replace them');
  }
});

// ─── faq ─────────────────────────────────────────────────────────────────────
test('six FAQs built on native details/summary', () => {
  assert.equal((html.match(/<details/g) || []).length, 6);
  for (const q of ['What areas do you deliver', 'Can I order only one meal',
    'Do you provide monthly subscriptions', 'How do I pay',
    'Do you offer customized meals', 'Is the food prepared fresh'])
    assert.ok(html.includes(q), `missing FAQ question: ${q}`);
});

test('FAQ schema text is byte-identical to the answers on the page', () => {
  const faq = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(m => JSON.parse(m[1])).find(o => o['@type'] === 'FAQPage');
  assert.equal(faq.mainEntity.length, 6, 'schema FAQ count must match the page');

  // Prices inside an answer are wrapped in <span data-price> so JavaScript can
  // update them; the words and amounts still have to match the schema exactly.
  const visible = [...html.matchAll(/<div class="faq__answer">([\s\S]*?)<\/div>/g)]
    .map(m => m[1].replace(/<\/?span[^>]*>/g, '').trim());
  assert.equal(visible.length, 6);

  const decode = s => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  faq.mainEntity.forEach((entry, i) => {
    assert.equal(entry.acceptedAnswer.text, decode(visible[i]),
      `answer ${i + 1} differs between the schema and the page`);
  });
});

// ─── contact + map ───────────────────────────────────────────────────────────
test('contact section carries the business name, address and both CTAs', () => {
  const section = html.match(/<section class="section section--white" id="contact"([\s\S]*?)<\/section>/);
  assert.ok(section, 'contact section missing');
  assert.ok(section[1].includes('SwaadSe Tiffin'));
  assert.match(section[1], /<address>/);
  assert.ok(section[1].includes(WA), 'contact needs a WhatsApp button');
  assert.match(section[1], /href="tel:\+917895590063"/, 'contact needs a Call button');
});

test('the map is a click-to-load facade, with no iframe in the delivered HTML', () => {
  assert.ok(!html.includes('<iframe'),
    'a Google Maps iframe on load costs ~1MB and wrecks LCP');
  assert.match(html, /data-map-src="https:\/\/www\.google\.com\/maps/);
  assert.match(html, /class="btn btn--ghost btn--compact js-load-map"/);
});

// ─── footer ──────────────────────────────────────────────────────────────────
test('footer has address, legal links, FSSAI slot and labelled social icons', () => {
  const footer = html.match(/<footer class="site-footer">([\s\S]*?)<\/footer>/);
  assert.ok(footer, 'footer missing');
  assert.ok(footer[1].includes('37/1 Om Vihar'));
  assert.match(footer[1], /href="privacy\.html"/);
  assert.match(footer[1], /href="terms\.html"/);
  assert.match(footer[1], /FSSAI/, 'Indian food businesses must display an FSSAI number');
  for (const label of ['Instagram', 'Facebook', 'WhatsApp'])
    assert.match(footer[1], new RegExp(`aria-label="SwaadSe Tiffin on ${label}"`),
      `social icon for ${label} needs an accessible name`);
});
