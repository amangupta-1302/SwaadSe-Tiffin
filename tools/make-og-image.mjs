/**
 * Generates images/og-image.png — the 1200×630 preview card shown when someone
 * shares the site on WhatsApp, Facebook or X.
 *
 * Why a PNG and not the SVG placeholders: WhatsApp and Facebook do not render
 * SVG link previews. For a business whose whole funnel is WhatsApp shares, the
 * preview image has to be a raster file.
 *
 * This writes the PNG by hand (deflate + CRC32) so the project keeps its
 * promise of zero dependencies. Replace it with a real photographed card at the
 * same path and size when you have food photography — see IMAGES.md.
 *
 * Run: node tools/make-og-image.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const W = 1200, H = 630;

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const CREAM = hex('#FFF8F0');
const SAFFRON = hex('#F57C00');
const LEAF = hex('#2E7D32');
const STEEL = hex('#E4E0D8');

// ── paint into a raw RGB buffer ─────────────────────────────────────────────
const px = Buffer.alloc(W * H * 3);
const set = (x, y, [r, g, b]) => {
  const i = (y * W + x) * 3;
  px[i] = r; px[i + 1] = g; px[i + 2] = b;
};

for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, CREAM);

// A tiffin seen from above: concentric rings, offset right so the left half
// stays clear for the title that social platforms overlay in their own UI.
const cx = 860, cy = H / 2;
const ring = (radius, thickness, colour) => {
  const outer = radius + thickness / 2, inner = radius - thickness / 2;
  for (let y = Math.max(0, cy - outer | 0); y < Math.min(H, cy + outer + 1 | 0); y++) {
    for (let x = Math.max(0, cx - outer | 0); x < Math.min(W, cx + outer + 1 | 0); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= outer && d >= inner) set(x, y, colour);
    }
  }
};
const disc = (radius, colour) => {
  for (let y = Math.max(0, cy - radius | 0); y < Math.min(H, cy + radius + 1 | 0); y++)
    for (let x = Math.max(0, cx - radius | 0); x < Math.min(W, cx + radius + 1 | 0); x++)
      if (Math.hypot(x - cx, y - cy) <= radius) set(x, y, colour);
};

disc(224, STEEL);
disc(214, CREAM);
ring(214, 10, SAFFRON);
ring(150, 8, STEEL);
ring(86, 26, SAFFRON);
disc(40, LEAF);

// Saffron rule along the bottom, green cap on the left — the brand's two colours.
for (let y = H - 16; y < H; y++) for (let x = 0; x < W; x++) set(x, y, SAFFRON);
for (let y = H - 16; y < H; y++) for (let x = 0; x < 230; x++) set(x, y, LEAF);
// Left keyline, so the empty title area reads as deliberate rather than blank.
for (let y = 150; y < H - 150; y++) for (let x = 96; x < 102; x++) set(x, y, SAFFRON);

// ── encode as PNG ───────────────────────────────────────────────────────────
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => {
  let c = 0xFFFFFFFF;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

// Each scanline is prefixed with filter byte 0 (no filtering).
const rows = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) {
  rows[y * (W * 3 + 1)] = 0;
  px.copy(rows, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;    // bit depth
ihdr[9] = 2;    // colour type 2 = truecolour RGB
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(rows, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = new URL('../images/og-image.png', import.meta.url);
writeFileSync(out, png);
console.log(`og-image.png written — ${W}×${H}, ${(png.length / 1024).toFixed(1)} KB`);
