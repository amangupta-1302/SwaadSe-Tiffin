# SwaadSe Tiffin — Google Ads landing page

A static, single-page landing site whose only job is to turn paid Google Search
clicks into WhatsApp inquiries and monthly tiffin subscriptions.

**No build step, no dependencies.** Server code is three small files: one
Netlify function that publishes the owner's edits, a daily ping that keeps the
free database awake, and an edge function that fills each page from the
database on the way out.

```
index.html               the landing page — all sections, schema, copy
privacy.html · terms.html  real pages, so the footer links and Ads policy work
css/styles.css           design tokens + every style
js/content.js            outage fallback — menu, delivery windows, every price
js/main.js               progressive enhancement only; page works without it
admin/                   /admin/ menu + price editor behind a Supabase login
netlify/functions/       save.mjs (publishes) · ping.mjs (daily keep-alive)
netlify/edge-functions/  render.js — fills the page from the database
supabase/schema.sql      the login + edit-history database, run once
fonts/                   3 self-hosted woff2 subsets (48 KB total)
images/                  placeholders — replace with real photos, see IMAGES.md
tests/                   126 assertions: prices, a11y, CWV, schema, admin
tools/                   regenerate placeholder images and the OG card
netlify.toml · _headers · _redirects · robots.txt · sitemap.xml
CLAUDE.md                architecture notes for Claude Code / AI assistants
```

Docs: **`DEPLOY.md`** (setup + client handover) · **`EDITING-GUIDE.md`** (what
`/admin/` cannot change) · **`IMAGES.md`** (photos).

## Run it locally

| Command | Serves | `/api/save` | Edge renderer |
|---|---|---|---|
| `npm run serve` | `:8080` | ✗ | ✗ |
| `npx -y netlify-cli dev` | `:8888` | ✓ | ✓ |

`npm test` — ~85 ms, must end `fail 0`.

Use a server, not a double-clicked file, or fonts and JSON-LD behave
differently from production. With no `.env`, `/admin/` correctly reports saving
is not switched on and names the unset settings; to test login and saving, put
the three variables from DEPLOY.md in a local `.env` (gitignored).

## Admin area — `/admin/`

```
  Owner ──edit──▶ /admin/ ──POST + token──▶ /api/save
                                                 │
                                    verify token │ email == ADMIN_EMAIL
                                                 ▼
                                             Supabase
                                          site_state row
                                     (the INSERT is the publish)
                                                 │
  Visitor ──GET /──▶ render.js ──newest row──────┘
                         │        (30s in-process memo)
                         ▼
                   filled HTML     DB down? ──▶ baked index.html
```

The owner logs in (one Supabase account, self-service reset) and edits today's
special, the weekly rotation, all 15 prices, contact details and delivery
windows. Red messages block saving; amber are advice.

- **The insert is the publish** — no deploy, live in ~30s, and the append-only
  table means any past version can be republished.
- **The same edge function fills `/admin/`**, so the editor opens on what is
  live, not on a file nothing writes.
- **Supabase down → the site still renders** from the baked values. Stale,
  never blank, which matters on paid clicks.
- **No secret ships in the page** (tests enforce): the session token lives in
  one JS variable, never browser storage, and even the Supabase address comes
  from `/api/save`. `/admin/` being public is intended — it holds nothing and
  changes nothing without a verified login.

Prices are why the admin exists: each appears twice, as text and inside the
prefilled WhatsApp message, and hand-editing meant customers quoting prices you
no longer charge. Three mentions stay manual because search engines read them
before JavaScript runs (EDITING-GUIDE §2).

## Before you go live

| ☐ | Do this | Where |
|---|---|---|
| | Replace all three sample reviews — invented testimonials are a common Ads suspension cause | `index.html`, `data-placeholder="true"` |
| | Replace the placeholder photos, hero and kitchen first | `images/` · IMAGES.md |
| | Set your real domain — `swaadsetiffin.in` appears 15× | `index.html` (8), `sitemap.xml` (4), `privacy.html`, `terms.html`, `robots.txt` |
| | Add your FSSAI registration number | `index.html`, `FSSAI Reg. No.` |
| | Set exact kitchen coordinates | `index.html`, JSON-LD `geo` |
| | Add Instagram/Facebook links, or delete the icons | `index.html`, `✏️ EDIT: replace the #` |
| | Paste your Google Business Profile link | `index.html`, "See us on Google" |
| | Confirm every price and plan inclusion | `/admin/` |
| | Set the three Netlify env vars, confirm saving works | DEPLOY.md step 5 |
| | Run `npm test` one final time | must end `fail 0` |

## Deploying

**Follow `DEPLOY.md`:** push to GitHub, import on Netlify, set up Supabase, set
three environment variables. Netlify is not optional any more — the edge
function is what fills the page from the database, so another static host would
serve only the baked values.

After deploying, check the live URL in the
[rich-results test](https://search.google.com/test/rich-results) and
[PageSpeed](https://pagespeed.web.dev) (mobile), share it to yourself on
WhatsApp to see the preview card, and submit `sitemap.xml` in Search Console.

## Google Ads setup

**Match headlines to the `<h1>`** (*Fresh Homemade Veg Tiffin Delivered Daily in
Agra*) — "tiffin service Agra", "veg tiffin delivery Agra". Ads whose wording
appears on the landing page cost less per click.

**Sitelinks:** Meal Plans `/#plans` · Today's Menu `/#todays-menu` · Monthly
Subscription `/#subscription` · Delivery Area `/#delivery` · Contact
`/#contact`. **Call extension:** `+91 78955 90063`, Mon–Sat 07:00–17:00.

**Conversion tracking needs a click event** — the customer leaves for WhatsApp,
so there is no thank-you page. After installing a GA4/Ads tag, add before
`</body>`:

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

Uncomment `gtag` once the tag is installed, then mark both events as
conversions. **If you add any tag, update `privacy.html`** — it currently states
truthfully that the site sets no tracking cookies.

## What the tests enforce

126 assertions, ~85 ms. Each is an assertion, not an intention:

| File | # | Guards |
|---|---|---|
| `sections` | 42 | CTA above the fold · `<h1>` is LCP · 15 prices, none stale or unused · a price and the message quoting it never disagree · works with JS off · legal pages match |
| `admin` | 22 | server-side login · no credential in the page · no `service_role` key · editor reuses `generate.js` · token never persisted |
| `render` | 18 | DB fills the served HTML · injected state cannot escape its script tag · no state at all is survivable · nested markup untouched |
| `schedule` | 18 | next-delivery across every day and hour · address slots, cleared line 2 included |
| `audit` | 14 | WCAG AA contrast computed, not assumed · no third-party origin · every referenced file exists · every image dimensioned (CLS 0) |
| `save` | 12 | every auth guard · a refused insert fails the save · missing settings refuse rather than allow |

74 KB gzipped including fonts.

## Not included

Photo uploads from `/admin/` and review editing. Automatic updates to the three
SEO price mentions, business-listing data, the map link, and the legal pages —
though tests catch the legal pages drifting. Tag IDs, photography, FSSAI number
and coordinates are in the checklist above.

One deliberate trade: the database is read at the **edge**, not in the browser.
That costs an edge function and a 30-second memo, and buys back everything that
makes this page work — it renders with JavaScript off, crawlers see real
content, no second origin sits in front of the first paint, and a paused
free-tier database cannot take the landing page down.
