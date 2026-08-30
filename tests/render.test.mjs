/* ============================================================================
 *  The edge renderer — netlify/edge-functions/render.js
 * ============================================================================
 *  This is the only thing standing between the database and what a visitor
 *  reads, and it runs before JavaScript does, so a bug here is invisible in a
 *  browser with devtools open. Every assertion below is a way the live page
 *  could quietly start lying about a price, a phone number or an address.
 * ========================================================================== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.window = globalThis;               // main.js reads globalThis.SITE
const { renderHtml } = await import('../netlify/edge-functions/render.js');

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

/** A published state that differs from index.html in every slot we care about. */
const state = {
  todaysSpecial: 'Paneer Butter Masala with jeera rice',
  weeklyMenu: [
    { day: 'Monday', short: 'Mon', items: ['Dal Tadka', 'Bhindi Masala'] },
    { day: 'Sunday', short: 'Sun', closed: true, note: 'Kitchen closed.' },
  ],
  deliveryWindows: [{ label: 'Lunch', startHour: 12, endHour: 14 }],
  prices: {
    'plan-basic': 99, 'plan-standard': 129, 'plan-premium': 159, 'plan-deluxe': 199,
    'tier-lunch-dinner': 4900, 'tier-one-meal': 2600, 'tier-single': 99,
    'pack-dal': 190, 'pack-rice': 150, 'pack-roti': 90,
  },
  contact: {
    whatsapp: '919999900000',
    phones: ['8887673224', '7900778393', '8859008393'],
    addressLine1: '37/1 Om Vihar',
    addressLine2: 'Kamla Nagar',
    city: 'Agra',
    statePin: 'Uttar Pradesh 282005',
  },
};

const out = renderHtml(html, state);

test('today’s special comes from the database', () => {
  assert.match(out, /id="todays-special">Paneer Butter Masala with jeera rice</);
});

test('a price in a span is rewritten, rupee sign included', () => {
  assert.match(out, /data-price="plan-basic">₹99</);
  assert.ok(!/data-price="plan-basic">₹80</.test(out), 'baked price survived');
});

test('a price inside a prefilled WhatsApp message is rewritten too', () => {
  // The amount lives in the href, not the link text. Miss this branch and the
  // customer taps "Order" and sends a price the kitchen no longer charges.
  const dal = /<a[^>]*data-price="pack-dal"[^>]*>/.exec(out)?.[0] ?? '';
  assert.match(dal, /%E2%82%B9190/);
  assert.ok(!dal.includes('%E2%82%B9180'), 'stale price still in the order message');
});

test('every WhatsApp link points at the number from the database', () => {
  // Links only, which is the same scope js/main.js has always had. The number
  // also appears in the JSON-LD block, which is deliberately NOT data-driven —
  // search engines read it before any of this runs, and EDITING-GUIDE section 2
  // lists it as a manual step. See the schema test below.
  // Counted from the source rather than hardcoded, so this also fails if the
  // transform silently drops a link — one dead CTA among two dozen is exactly
  // the kind of thing nobody notices until a week of clicks has gone nowhere.
  const before = [...html.matchAll(/href="[^"]*wa\.me\//g)].length;
  const numbers = [...out.matchAll(/href="[^"]*wa\.me\/(\d+)/g)].map(m => m[1]);
  assert.equal(numbers.length, before, 'a WhatsApp link went missing');
  assert.deepEqual([...new Set(numbers)], ['919999900000']);
});

test('the JSON-LD block is left alone, as it always has been', () => {
  // Not an oversight: this pins the existing contract so that "the schema says
  // a different number from the page" stays a known, documented manual step
  // rather than becoming a surprise the next time someone reads this file.
  const schema = /"potentialAction":\s*\{[^}]*\}/s.exec(out)?.[0] ?? '';
  assert.match(schema, /wa\.me\/917895590063/);
});

test('call links and the numbers customers read agree', () => {
  assert.match(out, /href="tel:\+918887673224"/);
  assert.match(out, /data-phone="0">88876 73224</);
});

test('the savings badge is removed rather than left claiming an untrue saving', () => {
  // 2 x 2600 = 5200 against 4900 is a real 300 saving, so it stays and updates.
  assert.match(out, /js-saves">Saves ₹300 vs two single plans</);

  const noSaving = renderHtml(html, {
    ...state,
    prices: { ...state.prices, 'tier-lunch-dinner': 5400 },
  });
  assert.ok(!noSaving.includes('js-saves">Saves'), 'badge kept a saving that no longer exists');
});

test('a cleared address line blanks its slot instead of showing last week’s', () => {
  const moved = renderHtml(html, {
    ...state,
    contact: { ...state.contact, addressLine2: '' },
  });
  assert.match(moved, /data-contact="line2"><\/span>/);
  // The composite slots must drop it in the same pass, or the visitor reads
  // two different addresses on one page.
  assert.match(moved, /data-contact="street">37\/1 Om Vihar</);
  assert.match(moved, /data-contact="short">37\/1 Om Vihar, Agra</);
});

test('an address with no line 1 is not trusted, and the baked markup is left alone', () => {
  const blank = renderHtml(html, { ...state, contact: { ...state.contact, addressLine1: '' } });
  assert.match(blank, /data-contact="line1">37\/1 Om Vihar</);
});

test('the week is rebuilt from the database, in static HTML', () => {
  assert.match(out, /class="menu__day">Monday<\/p><ul class="menu__items">/);
  assert.match(out, /class="menu__item">Bhindi Masala</);
  assert.match(out, /class="menu__closed">Kitchen closed\.</);
  assert.ok(!out.includes('Aloo Gobhi'), 'a baked dish survived the menu rebuild');
});

test('main.js still receives the state, for the parts that need a clock', () => {
  // Immediately after js/content.js, never merely before </head>: the fallback
  // file assigns window.SITE too, and whichever runs last wins.
  assert.match(out, /<script src="js\/content\.js"><\/script><script>window\.SITE=\{.*?\};<\/script>/s);
  const injected = JSON.parse(/<script>window\.SITE=(.*?);<\/script>/s.exec(out)[1]);
  assert.deepEqual(injected.deliveryWindows, state.deliveryWindows);
});

test('the admin editor is handed the published state, not the fallback file', async () => {
  // /admin/ loads content.js at the end of <body>, so an injection anchored to
  // </head> would be overwritten by it — and the editor would open on a
  // snapshot nothing writes any more, silently republishing it on every save.
  const admin = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  const rendered = renderHtml(admin, state);
  assert.match(rendered,
    /<script src="\.\.\/js\/content\.js"><\/script><script>window\.SITE=\{.*?\};<\/script>/s);
  // The editor carries none of the page's slots, so nothing else may change.
  assert.equal(rendered.replace(/<script>window\.SITE=.*?<\/script>/s, ''), admin);
});

test('the injected state cannot break out of its script tag', () => {
  const nasty = renderHtml(html, { ...state, todaysSpecial: '</script><script>alert(1)</script>' });
  const injected = /<script>window\.SITE=(.*?);<\/script>/s.exec(nasty)?.[1] ?? '';
  assert.ok(!injected.includes('</script>'), 'state escaped its script tag');
  // …and the same value rendered as text is escaped, not executed.
  assert.match(nasty, /id="todays-special">&lt;\/script&gt;/);
});

test('a dish name is text, not markup', () => {
  // Nothing sanitises a dish name on the way into the database — the owner
  // types it and /api/save stores it. Escaping here is the only thing between
  // "Dal <b>Special</b> & Rice" and a broken page, or worse.
  const rendered = renderHtml(html, {
    ...state,
    weeklyMenu: [{ day: 'Monday', short: 'Mon', items: ['Dal <b>Special</b> & Rice'] }],
  });
  assert.match(rendered, /class="menu__item">Dal &lt;b&gt;Special&lt;\/b&gt; &amp; Rice</);
});

test('a phone number typed the way people read it still dials', () => {
  // The editor stores what was typed; validate() accepts spaces and +91
  // because it strips before checking. Normalising is this file's job, and a
  // tel: link with a space in it is a Call button that does nothing.
  const spaced = renderHtml(html, {
    ...state,
    contact: { ...state.contact, phones: ['78955 90063', '+91 79007 78393', '8859-008-393'] },
  });
  assert.match(spaced, /href="tel:\+917895590063"/);
  assert.match(spaced, /data-phone="0">78955 90063</);
  assert.ok(!/href="tel:[^"]*[ +-][^"]*"/.test(spaced.replace(/tel:\+91/g, 'tel:')),
    'a tel: link kept punctuation from the box the owner typed into');
});

test('elements with nested markup are never touched', () => {
  // The pack "Order" links contain a <span>; the text rule must skip them and
  // let the link rule handle the href alone.
  assert.match(out, /data-price="pack-dal"[^>]*>Order<span aria-hidden="true"> →<\/span><\/a>/);
});

test('a missing price leaves the baked amount rather than printing nothing', () => {
  const partial = renderHtml(html, { ...state, prices: { 'plan-basic': 99 } });
  assert.match(partial, /data-price="plan-standard">₹120</);
});

test('no state at all is survivable: the page is returned unchanged', () => {
  const empty = renderHtml(html, {});
  assert.equal(empty.replace(/<script>window\.SITE=.*?<\/script>/s, ''), html);
});
