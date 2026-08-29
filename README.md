# SwaadSe Tiffin — Google Ads landing page

A static, single-page landing site whose only job is to turn paid Google Search
clicks into WhatsApp inquiries and monthly tiffin subscriptions.

**No build step, no dependencies.** The only server code is two small Netlify
functions: `/api/save`, which lets the owner publish edits, and a daily ping
that keeps the free database awake.

```
index.html          the landing page — all sections, schema, copy
privacy.html        ┐ real pages, so the footer links work and Google Ads
terms.html          ┘ has a policy to point at
css/styles.css      design tokens + every style
js/content.js       ✏️ OWNER FILE — menu, delivery windows, every price
js/main.js          progressive enhancement only; page works without it
admin/              /admin/ menu + price editor behind a Supabase login
supabase/           schema.sql — the login + edit-history database, run once
fonts/              3 self-hosted woff2 subsets (48 KB total)
images/             placeholders — replace with real photos, see IMAGES.md
tests/              assertions guarding prices, a11y, CWV, schema, the admin
tools/              regenerate placeholder images and the OG card
netlify/            the save function and the daily keep-alive ping
netlify.toml        Netlify config; no build step, just the functions
_headers            makes a menu or price change appear immediately
CLAUDE.md           architecture notes for Claude Code / AI assistants
```

Docs: **`DEPLOY.md`** (Netlify + Supabase setup, env vars, client handover),
**`EDITING-GUIDE.md`** (changing content), **`IMAGES.md`** (photos).

## Run it locally

```bash
npm run serve            # page only, http://localhost:4173 — no saving
npx -y netlify-cli dev   # the whole app incl. /api/save, http://localhost:8888
```

Use a server, not a double-clicked file, or fonts and JSON-LD behave
differently from production. Under `netlify dev` with no `.env`, `/admin/`
correctly falls back to copy-and-paste mode and names the unset settings; to
test login and saving, put the six variables from DEPLOY.md in a local `.env`
(gitignored — never commit it).

```bash
npm test                 # ~1s, must end "fail 0" before anything ships
```

## Admin area — `/admin/`

The owner logs in (Supabase: one account, email + password, self-service
reset) and edits today's special, the weekly rotation, all 15 prices, the
contact details, and the delivery windows — dishes and windows have true
add/remove. Red messages block saving; amber ones are advice.

On **Save**, a Netlify function verifies the login token server-side, re-runs
the same validation the page shows, and commits `js/content.js` to GitHub;
Netlify redeploys and the change is live in about a minute. Every edit is a
revertible commit, and each save is also logged to a Supabase table with who
saved it. The live site never reads from the database — an outage there can
only inconvenience the login.

No secret ever ships in the page (tests enforce it): the session token lives
in one JavaScript variable, never browser storage, and even the Supabase
address is fetched from `/api/save` at load time. `/admin/` being publicly
reachable is intended — it holds nothing and can change nothing without a
verified login. Where `/api/save` does not exist (a plain static host, the
folder opened locally) the page falls back to copy-and-paste instead of a Save
button that could only fail.

Prices are the reason the admin exists: each price appears on the page twice —
as text and inside the prefilled WhatsApp message — and editing by hand meant
customers quoting prices you no longer charge. Three price mentions stay
manual on purpose (meta description, sharing preview, schema `priceRange`):
search engines read them before JavaScript runs. EDITING-GUIDE §2 lists them.

## Before you go live

- [ ] **Replace all three sample reviews** (`data-placeholder="true"` in
      `index.html`). Invented testimonials are a common Google Ads suspension
      cause. EDITING-GUIDE §3.
- [ ] **Replace the placeholder photos**, hero and kitchen first. IMAGES.md.
- [ ] **Set your real domain** — `swaadsetiffin.in` appears 15× across
      `index.html`, `privacy.html`, `terms.html`, `sitemap.xml`, `robots.txt`.
- [ ] **Add your FSSAI registration number** in the footer.
- [ ] **Set exact kitchen coordinates** in the JSON-LD `geo` block.
- [ ] **Add Instagram/Facebook links**, or delete those two icons.
- [ ] **Paste your Google Business Profile link** into "See us on Google".
- [ ] Confirm every price and plan inclusion via `/admin/`.
- [ ] **Set the six Netlify environment variables and confirm saving works**
      (DEPLOY.md step 6 is the checklist).
- [ ] Run `npm test` one final time.

## Deploying

**Netlify — follow `DEPLOY.md`.** Roughly: push to GitHub, import the repo on
Netlify, set up Supabase, set six environment variables. Any other static host
serves the site fine, but `/admin/` falls back to copy-and-paste there.

After deploying: check the live URL in the
[rich-results test](https://search.google.com/test/rich-results) and
[PageSpeed](https://pagespeed.web.dev) (mobile), share the URL to yourself on
WhatsApp to see the preview card, and submit `sitemap.xml` in Search Console.

## Google Ads setup

**Match headlines to the `<h1>`** (*Fresh Homemade Veg Tiffin Delivered Daily
in Agra*) — "tiffin service Agra", "veg tiffin delivery Agra". Ads whose
wording appears on the landing page cost less per click.

**Sitelinks:** Meal Plans `/#plans` · Today's Menu `/#todays-menu` · Monthly
Subscription `/#subscription` · Delivery Area `/#delivery` · Contact
`/#contact`. **Call extension:** `+91 78955 90063`, Mon–Sat 07:00–17:00.

**Conversion tracking needs a click event** — the customer leaves for
WhatsApp, so there is no thank-you page to track. After installing a GA4/Ads
tag, add before `</body>`:

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

Uncomment `gtag` once the tag is installed, then mark `whatsapp_click` and
`call_click` as conversions. **If you add any tag, update `privacy.html`** —
it currently states truthfully that the site sets no tracking cookies.

## What the tests enforce

Each is an assertion in `tests/`, not an intention: WhatsApp CTA above the
fold on 375×667; the `<h1>` is the LCP element; CLS 0 (every image has
dimensions); nothing loads from a third-party origin (self-hosted fonts,
click-to-load map); all 15 prices flow from `js/content.js` with no stale or
unused ones; every referenced file exists; WCAG AA contrast computed, not
assumed; the whole page works with JavaScript disabled. 74 KB gzipped
including fonts.

## Not included

Photo uploads from `/admin/` (needs file storage + resizing), review editing,
and automatic updates to the three SEO price mentions, the business-listing
data, the map link, and the legal pages (tests catch the legal pages
drifting). GA4/Ads tag IDs, real photography, FSSAI number, and exact
coordinates are in the checklist above.

One deliberate trade: saving commits to GitHub and waits for Netlify to
redeploy — about a minute rather than instant. In exchange the live site stays
fully static, and every change the client makes is a git commit you can revert.
