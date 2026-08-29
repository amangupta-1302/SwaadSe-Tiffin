/**
 * Generates the illustrations referenced by index.html.
 *
 * These are SVGs on purpose: ~2KB each, crisp at any size, no extra request
 * beyond the file itself, and they draw from the same brand palette as the
 * stylesheet so the page reads as one piece of design.
 *
 * They are deliberately ILLUSTRATIONS, not fake photography. A drawing of a
 * thali looks intentional on a client demo, and nobody mistakes it for a photo
 * of their own food — so the reason to go and shoot the real thing survives.
 * Replace each one with a photo at the same filename and dimensions when it
 * exists; see IMAGES.md.
 *
 * The one idea worth keeping if you rewrite this: on the four plan cards, the
 * number of tiffin tiers matches the size of the plan (2, 3, 3, 4). The picture
 * carries the hierarchy, instead of four identical plates decorating four
 * different prices.
 *
 * Run: node tools/make-placeholders.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../images/', import.meta.url);
mkdirSync(OUT, { recursive: true });

/* Brand tokens, matching css/styles.css §1. */
const CREAM = '#FFF8F0';
const SURFACE = '#FFFFFF';
const STEEL = '#E4E0D8';
const LINE = '#EFE4D8';
const SAFFRON = '#F57C00';
const SAFFRON_WASH = '#FFEEDC';
const LEAF = '#2E7D32';
const INK_MUTED = '#6B5D54';

/* Food colours, derived from the brand hues so nothing reads as a foreign
   palette: dal from the saffron family, sabji from the leaf family. */
const DAL = '#E9A33C';
const SABJI = '#57A05A';
const RICE = '#FBF3E6';
const ROTI = '#E9CBA0';
const ROTI_EDGE = '#D2A971';
const PANEER = '#FFFDF8';
const PICKLE = '#C3502A';
const STEEL_DEEP = '#C9C3B8';

const svg = (w, h, label, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">
<rect width="${w}" height="${h}" fill="${CREAM}"/>
${body}
</svg>`;

/**
 * A katori — the little steel bowl a thali is built from. Drawn as a filled
 * circle with a steel rim and a highlight, so it reads as food in metal rather
 * than a flat dot.
 */
const katori = (cx, cy, r, fill) => `
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${STEEL}"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.87}" fill="${fill}"/>
  <path d="M${cx - r * 0.55} ${cy - r * 0.3} a ${r * 0.62} ${r * 0.62} 0 0 1 ${r * 0.5} ${-r * 0.28}"
        fill="none" stroke="${SURFACE}" stroke-opacity=".45" stroke-width="${r * 0.13}" stroke-linecap="round"/>`;

/* ── hero: a thali seen from above ─────────────────────────────────────────
   Four katoris across the top arc, rice and a stack of rotis below. The rim is
   two concentric circles because a steel thali has a lip, and that lip is what
   makes it read as steel rather than as a paper plate. */
function thali(w, h, label) {
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.44;
  const kr = R * 0.2;

  // Four bowls on the upper arc, from 195° to 345°.
  const bowls = [DAL, SABJI, PANEER, PICKLE].map((fill, i) => {
    const angle = (Math.PI / 180) * (198 + i * 48);
    return katori(cx + Math.cos(angle) * R * 0.6, cy + Math.sin(angle) * R * 0.6, kr, fill);
  }).join('');

  // A stack of rotis: three ellipses, each offset a little, so it has depth.
  const rotis = [0, 1, 2].map(i => `
  <ellipse cx="${cx + R * 0.34 - i * 3}" cy="${cy + R * 0.36 - i * 9}" rx="${R * 0.29}" ry="${R * 0.2}"
           fill="${ROTI}" stroke="${ROTI_EDGE}" stroke-width="2.5"/>`).join('');

  return svg(w, h, label, `
  <circle cx="${cx}" cy="${cy}" r="${R + 10}" fill="${STEEL_DEEP}" opacity=".5"/>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="${SURFACE}"/>
  <circle cx="${cx}" cy="${cy}" r="${R * 0.93}" fill="none" stroke="${STEEL}" stroke-width="3"/>
  ${bowls}
  <ellipse cx="${cx - R * 0.33}" cy="${cy + R * 0.4}" rx="${R * 0.28}" ry="${R * 0.19}" fill="${RICE}" stroke="${STEEL}" stroke-width="2"/>
  ${/* Grains, not a single dot — a lone saffron circle on a white oval reads
        as a fried egg, which is the one thing a pure-veg kitchen must not show. */
    [[-0.11, -0.04], [0.02, 0.05], [0.13, -0.03], [-0.03, -0.09]].map(([dx, dy]) =>
      `<ellipse cx="${cx - R * 0.33 + R * dx}" cy="${cy + R * 0.4 + R * dy}" rx="${R * 0.035}" ry="${R * 0.017}" fill="${ROTI_EDGE}" opacity=".5"/>`).join('')}
  ${rotis}`);
}

/* ── plan cards: a stacked tiffin carrier, one tier per portion ────────────
   Side elevation. The first attempt drew side rods and a bail handle hugging
   the stack; at card size everything merged into one silhouette and read as a
   bread bin. Removing the frame and giving each tier its own overhanging lid
   is what makes it read as stacked steel. Fewer parts, clearer picture. */
function dabba(w, h, fills, label, accent) {
  const tiers = fills.length;
  const cx = w / 2;
  const bodyW = w * 0.44;
  const lidW = bodyW + w * 0.045;      // the lip overhangs — that is the tell
  const tierH = h * 0.132;
  const lidH = h * 0.026;
  const gap = h * 0.018;
  const unit = tierH + lidH + gap;
  const bottom = h * 0.5 + (tiers * unit) / 2 - gap;

  // `fills` runs bottom-up, packed the way a tiffin actually is: dal at the
  // base, lighter things above. 'paneer' draws cubes rather than a flat band,
  // because paneer is what the Premium and Deluxe plans are sold on and a
  // near-white stripe on a white box would say nothing at all.
  const boxes = fills.map((fill, i) => {
    const bodyY = bottom - (i + 1) * unit + gap;
    const bandY = bodyY + tierH * 0.3;
    const bandH = tierH * 0.44;
    const band = fill === 'paneer'
      ? `<rect x="${cx - bodyW / 2 + 12}" y="${bandY}" width="${bodyW - 24}" height="${bandH}" rx="${tierH * 0.16}" fill="${SAFFRON_WASH}"/>
  ${[0, 1, 2].map(c => `<rect x="${cx - bodyW / 2 + 22 + c * (bodyW - 60) / 2.6}" y="${bandY + bandH * 0.2}" width="${bandH * 0.62}" height="${bandH * 0.62}" rx="3" fill="${PANEER}" stroke="${ROTI_EDGE}" stroke-width="2"/>`).join('')}`
      : `<rect x="${cx - bodyW / 2 + 12}" y="${bandY}" width="${bodyW - 24}" height="${bandH}" rx="${tierH * 0.16}" fill="${fill}"/>`;
    return `
  <rect x="${cx - bodyW / 2}" y="${bodyY}" width="${bodyW}" height="${tierH}" rx="${tierH * 0.22}" fill="${SURFACE}" stroke="${STEEL_DEEP}" stroke-width="3.5"/>
  ${band}
  <rect x="${cx - lidW / 2}" y="${bodyY - lidH}" width="${lidW}" height="${lidH * 1.9}" rx="${lidH * 0.75}" fill="${STEEL}" stroke="${STEEL_DEEP}" stroke-width="3"/>`;
  }).join('');

  const topLid = bottom - tiers * unit + gap - lidH;
  return svg(w, h, label, `
  <ellipse cx="${cx}" cy="${bottom + 18}" rx="${bodyW * 0.6}" ry="11" fill="${STEEL_DEEP}" opacity=".4"/>
  ${boxes}
  <path d="M${cx - bodyW * 0.19} ${topLid} a ${bodyW * 0.19} ${bodyW * 0.16} 0 0 1 ${bodyW * 0.38} 0"
        fill="none" stroke="${STEEL_DEEP}" stroke-width="6" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${topLid - bodyW * 0.155}" r="7" fill="${accent}"/>`);
}

/* ── kitchen: the hygiene proof ────────────────────────────────────────────
   A clean counter in daylight — pot on the flame, stacked steel, a window.
   This one earns its place: it is the picture that answers "is this hygienic". */
function kitchen(w, h, label) {
  const counterY = h * 0.66;
  const potX = w * 0.28;
  const potW = w * 0.2;

  // Steam: three rising curls over the pot. Still, not animated — motion on
  // this page is CSS's job, and an animated SVG would run even off-screen.
  const steam = [0, 1, 2].map(i => {
    const x = potX - potW * 0.22 + i * potW * 0.22;
    const top = counterY - h * 0.3 - i % 2 * 12;
    return `<path d="M${x} ${counterY - h * 0.19} c -14 -22 14 -30 0 -${counterY - top - h * 0.19}"
        fill="none" stroke="${STEEL_DEEP}" stroke-width="5" stroke-linecap="round" opacity=".55"/>`;
  }).join('');

  return svg(w, h, label, `
  <rect x="0" y="0" width="${w}" height="${counterY}" fill="${SAFFRON_WASH}" opacity=".4"/>

  <rect x="${w * 0.63}" y="${h * 0.08}" width="${w * 0.29}" height="${h * 0.34}" rx="12" fill="${SURFACE}" stroke="${STEEL_DEEP}" stroke-width="5"/>
  <line x1="${w * 0.775}" y1="${h * 0.08}" x2="${w * 0.775}" y2="${h * 0.42}" stroke="${STEEL_DEEP}" stroke-width="4"/>
  <line x1="${w * 0.63}" y1="${h * 0.25}" x2="${w * 0.92}" y2="${h * 0.25}" stroke="${STEEL_DEEP}" stroke-width="4"/>

  ${steam}

  <rect x="0" y="${counterY}" width="${w}" height="${h - counterY}" fill="${SURFACE}"/>
  <line x1="0" y1="${counterY}" x2="${w}" y2="${counterY}" stroke="${STEEL_DEEP}" stroke-width="6"/>

  <path d="M${potX - potW / 2} ${counterY - h * 0.185} h ${potW} l -${potW * 0.09} ${h * 0.16}
           a ${potW * 0.4} ${h * 0.05} 0 0 1 -${potW * 0.82} 0 z" fill="${STEEL}" stroke="${STEEL_DEEP}" stroke-width="4"/>
  <rect x="${potX - potW * 0.6}" y="${counterY - h * 0.2}" width="${potW * 1.2}" height="${h * 0.028}" rx="8" fill="${STEEL_DEEP}"/>
  <path d="M${potX - potW * 0.16} ${counterY - h * 0.02} c -12 -16 6 -22 1 -34 c 15 13 19 24 8 36 z" fill="${SAFFRON}" opacity=".85"/>
  <path d="M${potX + potW * 0.16} ${counterY - h * 0.02} c -12 -16 6 -22 1 -34 c 15 13 19 24 8 36 z" fill="${SAFFRON}" opacity=".85"/>

  ${[0, 1, 2].map(i => {
    const y = counterY - 22 - i * 30;
    return `<rect x="${w * 0.53}" y="${y}" width="${w * 0.13}" height="22" rx="7" fill="${SURFACE}" stroke="${STEEL_DEEP}" stroke-width="3.5"/>
  <rect x="${w * 0.522}" y="${y - 7}" width="${w * 0.146}" height="9" rx="4.5" fill="${STEEL}" stroke="${STEEL_DEEP}" stroke-width="3"/>`;
  }).join('')}

  <rect x="${w * 0.75}" y="${counterY - 16}" width="${w * 0.19}" height="14" rx="7" fill="${ROTI}" stroke="${ROTI_EDGE}" stroke-width="3"/>
  <circle cx="${w * 0.79}" cy="${counterY - 34}" r="15" fill="${SABJI}"/>
  <circle cx="${w * 0.85}" cy="${counterY - 30}" r="11" fill="${LEAF}" opacity=".8"/>
  <circle cx="${w * 0.9}" cy="${counterY - 35}" r="9" fill="${DAL}"/>`);
}

/** Monogram avatar — deliberately not a stock face of a person who does not exist. */
const monogram = (initials, tint) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" role="img" aria-label="${initials}">
  <circle cx="48" cy="48" r="48" fill="${tint}"/>
  <text x="48" y="48" text-anchor="middle" dominant-baseline="central" fill="#A64B00"
    font-family="system-ui, sans-serif" font-size="34" font-weight="700">${initials}</text>
</svg>`;

const files = {
  'hero-tiffin-thali.svg': thali(1200, 900, 'A thali of dal, sabji, raita, pickle, rice and rotis'),
  // 2 · 3 · 3 · 4 tiers, listed bottom-up — the picture tells you which plan is
  // bigger before the price does, and the paneer cubes tell you which two
  // include paneer.
  'plan-basic.svg': dabba(600, 600, [DAL, SABJI], 'Two-tier tiffin: dal and seasonal sabji', STEEL_DEEP),
  'plan-standard.svg': dabba(600, 600, [DAL, SABJI, RICE], 'Three-tier tiffin with raita and salad', SAFFRON),
  'plan-premium.svg': dabba(600, 600, [DAL, 'paneer', SABJI], 'Three-tier tiffin including paneer sabji', LEAF),
  'plan-deluxe.svg': dabba(600, 600, [DAL, 'paneer', SABJI, ROTI], 'Four-tier tiffin with paneer, sweet and pickle', PICKLE),
  'kitchen-hygiene.svg': kitchen(900, 600, 'A clean home kitchen: pot on the flame and stacked steel tiffins'),
  'avatar-1.svg': monogram('RS', '#FFEEDC'),
  'avatar-2.svg': monogram('AK', '#E7F2E8'),
  'avatar-3.svg': monogram('MG', '#F1EDE6'),
};

for (const [name, out] of Object.entries(files)) {
  writeFileSync(new URL(name, OUT), out);
  console.log(`  ${name.padEnd(28)} ${String(out.length).padStart(5)} bytes`);
}
console.log(`\n${Object.keys(files).length} illustrations written to images/`);
console.log('og-image.png is generated separately by tools/make-og-image.mjs');
