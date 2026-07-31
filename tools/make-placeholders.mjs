/**
 * Generates the placeholder images referenced by index.html.
 *
 * These are SVGs on purpose: they are ~1KB each, stay crisp at any size, and
 * carry a visible label so nobody mistakes them for finished artwork. Replace
 * each one with a real photo at the same filename and dimensions — see IMAGES.md.
 *
 * Run: node tools/make-placeholders.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../images/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const CREAM = '#FFF8F0';
const STEEL = '#E4E0D8';
const SAFFRON = '#F57C00';
const INK = '#6B5D54';

/** A labelled placeholder with a plate-and-cutlery mark. */
const plate = (w, h, label) => {
  const cx = w / 2;
  const cy = h / 2 - h * 0.05;
  const r = Math.min(w, h) * 0.17;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label} placeholder">
  <rect width="${w}" height="${h}" fill="${CREAM}"/>
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="${STEEL}" stroke-width="2" stroke-dasharray="10 8"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${SAFFRON}" stroke-width="${Math.max(2, r * 0.055)}"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="none" stroke="${STEEL}" stroke-width="${Math.max(2, r * 0.045)}"/>
  <text x="${cx}" y="${cy + r + h * 0.115}" text-anchor="middle" fill="${INK}"
    font-family="system-ui, sans-serif" font-size="${Math.round(Math.min(w, h) * 0.058)}"
    font-weight="600" letter-spacing="1.5">${label}</text>
  <text x="${cx}" y="${cy + r + h * 0.175}" text-anchor="middle" fill="${STEEL}"
    font-family="system-ui, sans-serif" font-size="${Math.round(Math.min(w, h) * 0.042)}">replace with a real photo · ${w}×${h}</text>
</svg>`;
};

/** Monogram avatar — deliberately not a stock face of a person who does not exist. */
const monogram = (initials, tint) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" role="img" aria-label="${initials}">
  <circle cx="48" cy="48" r="48" fill="${tint}"/>
  <text x="48" y="48" text-anchor="middle" dominant-baseline="central" fill="#A64B00"
    font-family="system-ui, sans-serif" font-size="34" font-weight="700">${initials}</text>
</svg>`;

const files = {
  'hero-tiffin-thali.svg': plate(1200, 900, 'HERO — tiffin box with dal, sabji, rice, roti'),
  'plan-basic.svg': plate(600, 600, 'Basic Veg Tiffin'),
  'plan-standard.svg': plate(600, 600, 'Standard Veg Tiffin'),
  'plan-premium.svg': plate(600, 600, 'Premium Veg Tiffin'),
  'plan-deluxe.svg': plate(600, 600, 'Deluxe Veg Tiffin'),
  'kitchen-hygiene.svg': plate(900, 600, 'Our kitchen'),
  'avatar-1.svg': monogram('RS', '#FFEEDC'),
  'avatar-2.svg': monogram('AK', '#E7F2E8'),
  'avatar-3.svg': monogram('MG', '#F1EDE6'),
};

for (const [name, svg] of Object.entries(files)) {
  writeFileSync(new URL(name, OUT), svg);
  console.log(`  ${name.padEnd(28)} ${String(svg.length).padStart(5)} bytes`);
}
console.log(`\n${Object.keys(files).length} placeholders written to images/`);
console.log('og-image.png is generated separately by tools/make-og-image.mjs');
