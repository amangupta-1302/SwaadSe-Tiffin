# Photos: what to shoot and where it goes

Every image on the site right now is a **drawing**, not a photograph — a thali,
stacked tiffin tiers, a kitchen. They are there so the site looks finished while
you get the real photos taken. Replace each one using the **same filename** and
nothing in the code needs to change.

They are deliberately drawings rather than stock photos of someone else's food.
A customer in Kamla Nagar can tell the difference between a studio thali and the
tiffin that will actually arrive at their door, and the second one is what makes
them subscribe. **Photographs of your own food will beat these drawings every
time** — treat them as a stand-in with a deadline, not as finished artwork.

One thing to keep if you redraw them: on the four plan cards, the number of
tiffin tiers matches the size of the plan — two for Basic, four for Deluxe, with
white paneer cubes on the two plans that include paneer. The picture tells a
customer which plan is bigger before they read the price.

Regenerate them any time with `node tools/make-placeholders.mjs`.

## The list

| Filename | What to photograph | Size (px) | Keep under |
|---|---|---|---|
| `hero-tiffin-thali.svg` → `.jpg` | **The most important one.** An open tiffin box, all compartments filled, shot from above. Dal, sabji, rice, stack of rotis. | 1200 × 900 (4:3) | 120 KB |
| `plan-basic.svg` → `.jpg` | The Basic tiffin exactly as you pack it: 4 rotis, rice, dal, seasonal sabji | 600 × 600 | 60 KB |
| `plan-standard.svg` → `.jpg` | The Standard tiffin, with raita and salad visible | 600 × 600 | 60 KB |
| `plan-premium.svg` → `.jpg` | The Premium tiffin, paneer sabji clearly visible | 600 × 600 | 60 KB |
| `plan-deluxe.svg` → `.jpg` | The Deluxe tiffin, everything in it: missi roti, sweet, mirchoni, pickle | 600 × 600 | 60 KB |
| `kitchen-hygiene.svg` → `.jpg` | Your kitchen, clean and tidy, in daylight. Clean counter, stacked steel, gas on. **This is the hygiene proof** — it does more work than any sentence on the page. | 900 × 600 (3:2) | 80 KB |
| `avatar-1/2/3.svg` | Customer photos, only if they give you permission. Otherwise leave the monogram circles — they are honest. | 96 × 96 | 10 KB |
| `og-image.png` | The preview card shown when someone shares your link on WhatsApp. Your best food photo with the logo. | 1200 × 630 | 150 KB |

### Changing the file extension

If you replace `hero-tiffin-thali.svg` with `hero-tiffin-thali.jpg`, update the
filename in `index.html` too — search for `hero-tiffin-thali`. Everything else
(the `width`, `height`, `alt` and `loading` attributes) stays exactly as it is.
**Do not remove `width` and `height`** — they stop the page jumping around while
images load, which Google measures and scores.

## Shooting them on a phone

You do not need a camera. You need light.

- **Stand next to a window in the morning.** Never use the flash, never shoot
  under yellow tube light — it turns food grey-green.
- **Shoot from directly above** for tiffin boxes and thalis. Food photographed
  from above reads as generous; from the side it reads as flat.
- **Fill the frame.** Get close enough that the food touches the edges. Empty
  table space makes portions look small.
- **Wipe the rim** of the tiffin and the plate edge before you shoot. Smudges are
  the single thing that reads as "unhygienic" in a food photo.
- **Steam sells.** Photograph within a minute of packing while it still steams.
- **No filters.** Do not increase saturation. Over-edited food looks fake, and
  fake is the opposite of what this page is selling.
- Take ten photos of each dish and pick one. That is what professionals do.

## Compressing before you upload

Photos straight off a phone are 3–6 MB. Uploading them at that size will make
your site slow, which raises what you pay per click on Google Ads. Get each one
under the limit in the table above.

**Easiest way** — no software to install: open <https://squoosh.app> in your
browser, drag the photo in, choose **WebP** or **MozJPEG**, drag quality to about
**75**, and check the size shown at the bottom before downloading.

**If you have the command line** — `sips` is built into every Mac and also
converts iPhone HEIC files:

```bash
sips -Z 1200 -s format jpeg hero-original.heic --out images/hero-tiffin-thali.jpg
```

For a smaller file at the same quality, `cwebp -q 78 -resize 1200 0 in.jpg -o
out.webp` instead.

## Keep the originals

Put full-size originals in `images/originals/`. That folder is excluded from
version control and never uploaded to the website, so it costs your visitors
nothing — but you will want the originals the next time you redesign.
