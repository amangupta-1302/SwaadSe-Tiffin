# SwaadSe Tiffin — Google Ads landing page

A static, single-page landing site whose only job is to turn paid Google Search
clicks into WhatsApp inquiries and monthly tiffin subscriptions.

**No build step. No dependencies. No server code.** Open `index.html` in a browser
and the finished page renders. Deploy by uploading the folder.

```
index.html          the landing page — all sections, schema, copy
privacy.html        ┐ real pages, so the footer links work and Google Ads
terms.html          ┘ has a policy to point at
css/styles.css      design tokens + every style
js/content.js       ✏️ OWNER FILE — today's special, weekly menu, delivery windows
js/main.js          progressive enhancement only; page works without it
fonts/              3 self-hosted woff2 subsets (48 KB total)
images/             placeholders — replace with real photos, see IMAGES.md
tests/              53 assertions guarding prices, a11y, CWV and schema
tools/              regenerate placeholder images and the OG card
```

Read **`EDITING-GUIDE.md`** to change the menu, prices, reviews or phone numbers.
Read **`IMAGES.md`** to replace the photos.

## Run it locally

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>. Use a server rather than double-clicking the
file, or the fonts and JSON-LD will not load the way they do in production.

```bash
npm test
```

53 assertions, no dependencies, about 40 ms. Run this before every upload.

## Before you go live

- [ ] **Replace all three sample reviews.** Search `data-placeholder="true"` in
      `index.html`. Publishing invented testimonials misleads customers and is a
      common cause of Google Ads suspension. See EDITING-GUIDE.md §3.
- [ ] **Replace the placeholder photos**, starting with the hero and the kitchen
      photo. See IMAGES.md.
- [ ] **Set your real domain.** Replace `swaadsetiffin.in` — it appears 8× in
      `index.html`, 1× in `privacy.html`, 1× in `terms.html`, 4× in `sitemap.xml`
      and 1× in `robots.txt`.
- [ ] **Add your FSSAI registration number** in the footer. Required for Indian
      food businesses, and one of the strongest hygiene signals on the page.
- [ ] **Set the real kitchen coordinates.** The `geo` block in the JSON-LD uses
      approximate Kamla Nagar coordinates. Get exact ones by right-clicking your
      kitchen in Google Maps.
- [ ] **Add your Instagram and Facebook links**, or delete those two icons.
- [ ] **Paste your Google Business Profile link** into the "See us on Google"
      button.
- [ ] Confirm every price, timing and plan inclusion against what you actually
      sell today.
- [ ] Run `npm test` one final time.

## Deploying

Any static host works. The site has no backend.

**Netlify or Cloudflare Pages** — drag the folder onto their dashboard. Free,
gives HTTPS and a CDN automatically. Fastest option.

**Hostinger / cPanel shared hosting** — upload the folder contents into
`public_html` over FTP or the File Manager. Make sure HTTPS is switched on.

**GitHub Pages** — push the repo, then enable Pages on the `main` branch.

After deploying, confirm:

- <https://search.google.com/test/rich-results> accepts both schema blocks
  (needs the live URL — cannot be tested locally)
- <https://pagespeed.web.dev> on the live URL, mobile tab
- Share the URL to yourself on WhatsApp and check the preview card appears
- Submit `sitemap.xml` in Google Search Console

## Google Ads setup

The page is built for Landing Page Experience, which feeds Quality Score and
therefore your cost per click.

**Keyword to headline match.** The `<h1>` says *Fresh Homemade Veg Tiffin
Delivered Daily in Agra*. Keep ad headlines close to that wording — "tiffin
service Agra", "veg tiffin delivery Agra", "monthly tiffin Agra". Ads whose
wording appears on the landing page cost less per click.

**Sitelink extensions** point at real sections:

| Sitelink | URL |
|---|---|
| Meal Plans | `/#plans` |
| Today's Menu | `/#todays-menu` |
| Monthly Subscription | `/#subscription` |
| Delivery Area | `/#delivery` |
| Contact | `/#contact` |

**Call extension:** `+91 78955 90063`, scheduled Mon–Sat 07:00–17:00 so you are
not paying for calls you cannot answer.

**Conversion tracking needs a click event.** There is no thank-you page — the
customer leaves for WhatsApp — so a destination-URL conversion will never fire.
Track the outbound click instead. After you have a GA4 or Ads tag, add this once,
just before `</body>`:

```html
<script>
document.addEventListener('click', e => {
  const link = e.target.closest('a[href*="wa.me"], a[href^="tel:"]');
  if (!link) return;
  const type = link.href.includes('wa.me') ? 'whatsapp_click' : 'call_click';
  // gtag('event', type, { link_text: link.textContent.trim() });
}, { capture: true });
</script>
```

Uncomment the `gtag` line once your tag is installed. Then mark
`whatsapp_click` and `call_click` as conversions in Google Ads.

**If you add any analytics or advertising tag, update `privacy.html`** — it
currently states truthfully that the site sets no tracking cookies, and that has
to stay accurate.

## What this page is optimised for, and how it is enforced

Each of these is a test in `tests/`, not an intention:

- **The WhatsApp CTA sits above the fold** on 375×667 — verified by measurement,
  with 248 px to spare.
- **The `<h1>` is the LCP element**, not a photograph. Both hero CTAs come before
  the hero image in source order specifically to achieve this.
- **CLS is 0.** Every image carries `width` and `height`.
- **Nothing loads from a third-party origin.** Fonts are self-hosted; the Google
  Map is a click-to-load facade, saving roughly a megabyte on every visit.
- **Every WhatsApp link is prefilled** and plan buttons name their own plan, so
  you know which plan drove the inquiry before you type a word.
- **WCAG AA contrast, computed not assumed.** The audit found that white text on
  `#F57C00` is 2.70:1 and on `#25D366` is 1.98:1 — both fail. The buttons keep
  the exact brand fills with near-black labels instead, at 7.7:1 and 10.4:1.
- **The whole page works with JavaScript disabled** — all seven menu days
  visible, all six FAQ answers expandable, every button live.
- **73.5 KB gzipped** including all three font subsets.

## Regenerating the placeholder assets

```bash
node tools/make-placeholders.mjs
```

```bash
node tools/make-og-image.mjs
```

Both are dependency-free. Delete `tools/` once you have real photography.

## Not included

GA4 / Google Ads tag IDs, real photography, the FSSAI number, exact kitchen
coordinates, and Google Business Profile setup — each is listed in the
**Before you go live** checklist above with the exact place it plugs in.
