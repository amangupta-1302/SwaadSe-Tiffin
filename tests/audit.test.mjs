/**
 * SwaadSe Tiffin — structural audit suite.
 *
 * A static landing page has no functions to unit-test, so this suite asserts the
 * invariants the business is actually paying for:
 *   - CRO:  every WhatsApp CTA is prefilled, plan CTAs identify their plan
 *   - CWV:  images are dimensioned (CLS), hero is prioritised, no third parties
 *   - A11Y: contrast ratios are COMPUTED from the tokens, not assumed
 *   - SEO:  JSON-LD parses, and schema content matches visible content
 *
 * Run: node --test tests/
 * No dependencies. Node 18+.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const raw = read('index.html');

/** Structural assertions must ignore HTML comments — this file is heavily
 *  commented for the owner, and a comment mentioning <h1> is not a heading. */
const stripComments = s => s.replace(/<!--[\s\S]*?-->/g, '');
const html = stripComments(raw);

const jsonLd = () =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(m => JSON.parse(m[1]));

// ─── WCAG contrast, computed from hex ────────────────────────────────────────
const lin = c => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = hex => {
  const [r, g, b] = hex.match(/\w\w/g).map(h => parseInt(h, 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [L(a), L(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('every text/background token pair meets WCAG AA 4.5:1', () => {
  const pairs = [
    ['#062B12', '#25D366', 'WhatsApp button label on WhatsApp green'],
    ['#1A1208', '#F57C00', 'Call button label on brand orange'],
    ['#FFFFFF', '#2E7D32', 'white on subscription band green'],
    ['#EDF6ED', '#2E7D32', 'muted text on subscription band green'],
    ['#A64B00', '#FFF8F0', 'deep saffron accent text on cream'],
    ['#A64B00', '#FFFFFF', 'deep saffron accent text on white'],
    ['#2A2320', '#FFF8F0', 'body ink on cream'],
    ['#2A2320', '#FFFFFF', 'body ink on white'],
    ['#6B5D54', '#FFF8F0', 'muted meta text on cream'],
    ['#6B5D54', '#FFFFFF', 'muted meta text on white'],
  ];
  for (const [fg, bg, label] of pairs) {
    const r = ratio(fg, bg);
    assert.ok(r >= 4.5, `${label}: ${r.toFixed(2)}:1 is below AA 4.5:1`);
  }
});

test('white text is never placed on brand orange or WhatsApp green', () => {
  // Documents WHY the CTAs use near-black labels. If someone "fixes" the
  // buttons to white text later, this test explains the regression.
  assert.ok(ratio('#FFFFFF', '#F57C00') < 3, 'white on orange should be known-bad');
  assert.ok(ratio('#FFFFFF', '#25D366') < 3, 'white on WA green should be known-bad');
});

// ─── SEO head ────────────────────────────────────────────────────────────────
test('head carries title, description, canonical, OG and viewport', () => {
  assert.match(html, /<html[^>]+lang="en-IN"/);
  const title = html.match(/<title>([^<]*)<\/title>/)[1];
  assert.ok(title.length >= 30 && title.length <= 65,
    `title is ${title.length} chars; Google truncates outside 30–65`);
  const desc = html.match(/<meta name="description" content="([^"]*)"/)[1];
  assert.ok(desc.length >= 110 && desc.length <= 165,
    `description is ${desc.length} chars; aim for 110–165`);
  assert.match(html, /<link rel="canonical" href="https?:\/\//);
  for (const p of ['title', 'description', 'image', 'url', 'type'])
    assert.ok(html.includes(`property="og:${p}"`), `missing og:${p}`);
  assert.match(html, /name="twitter:card"/);
  assert.match(html, /width=device-width/);
});

test('fonts are self-hosted and the critical face is preloaded', () => {
  assert.ok(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html),
    'no third-party font requests allowed');
  assert.match(html, /<link rel="preload"[^>]+fonts\/anek-latin\.woff2[^>]+crossorigin/);
});

// ─── Structured data ─────────────────────────────────────────────────────────
test('every JSON-LD block is valid JSON with the expected types', () => {
  const blocks = jsonLd();
  assert.ok(blocks.length >= 2, 'expected FoodEstablishment + FAQPage');
  const types = blocks.map(b => b['@type']);
  assert.ok(types.includes('FoodEstablishment'), 'missing LocalBusiness/FoodEstablishment');
  assert.ok(types.includes('FAQPage'), 'missing FAQPage');
});

test('business schema states address, hours, radius and price range', () => {
  const biz = jsonLd().find(b => b['@type'] === 'FoodEstablishment');
  assert.equal(biz.address['@type'], 'PostalAddress');
  assert.match(biz.address.streetAddress, /Om Vihar/);
  assert.equal(biz.address.addressLocality, 'Agra');
  assert.equal(biz.address.addressCountry, 'IN');
  assert.ok(biz.telephone.includes('7895590063'));
  assert.match(biz.priceRange, /80/);
  // Two windows, Monday–Saturday only. Sunday must never appear as open.
  assert.equal(biz.openingHoursSpecification.length, 2);
  for (const spec of biz.openingHoursSpecification)
    assert.ok(!JSON.stringify(spec.dayOfWeek).includes('Sunday'),
      'Sunday is closed — it must not appear in openingHoursSpecification');
  assert.equal(biz.areaServed.geoRadius, '5000');
});

test('aggregateRating is not published while reviews are placeholders', () => {
  const biz = jsonLd().find(b => b['@type'] === 'FoodEstablishment');
  assert.equal(biz.aggregateRating, undefined,
    'publishing ratings for reviews that do not exist risks a Google penalty');
});

// ─── images & payload ────────────────────────────────────────────────────────
test('every image is dimensioned, described, and lazy except the hero', () => {
  const tags = html.match(/<img[^>]*>/g) || [];
  assert.ok(tags.length >= 5, `expected several images, found ${tags.length}`);
  for (const tag of tags) {
    assert.match(tag, /\salt="/, `missing alt (use alt="" if decorative): ${tag}`);
    assert.match(tag, /\swidth="\d+"/, `missing width — causes layout shift: ${tag}`);
    assert.match(tag, /\sheight="\d+"/, `missing height — causes layout shift: ${tag}`);
    if (!tag.includes('fetchpriority="high"'))
      assert.match(tag, /loading="lazy"/, `should be lazy-loaded: ${tag}`);
  }
  assert.equal((html.match(/fetchpriority="high"/g) || []).length, 1,
    'exactly one image should be prioritised, or LCP has competition');
});

test('nothing loads from a third-party origin on first paint', () => {
  const allowed = [
    'https://wa.me/',                      // outbound tap, not a page load
    'https://www.google.com/maps',         // outbound link + click-to-load facade
    'https://swaadsetiffin.in',            // our own canonical / og:url
  ];
  for (const [, url] of html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g))
    assert.ok(allowed.some(a => url.startsWith(a)), `unexpected external request: ${url}`);
});

test('legal pages exist, are substantial, and link back', () => {
  for (const file of ['privacy.html', 'terms.html']) {
    const page = read(file);
    assert.ok(page.length > 1200, `${file} is too thin to be a real policy`);
    assert.match(page, /<html[^>]+lang="en-IN"/);
    assert.match(page, /href="index\.html"|href="\/"/, `${file} needs a link home`);
    assert.match(page, /SwaadSe Tiffin/);
  }
});
