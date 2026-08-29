# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, single-page Google Ads landing site for a tiffin (home-cooked meal
delivery) business in Agra. Its only job is turning paid search clicks into
WhatsApp inquiries — there is no ordering, no payment, no accounts.

**No build step and no dependencies.** The only server-side code is two Netlify
functions — one that lets the owner save changes, one daily keep-alive ping for
the free Supabase project (see below). Anything that would add a bundler, a
framework, or a runtime dependency is working against the design, not extending
it. Supabase is reached with raw `fetch` on four endpoints — deliberately no
supabase-js, neither from a CDN nor vendored.

## Commands

```bash
npm test                                            # full suite, ~1s, must end "fail 0"
node --test tests/save.test.mjs                     # one file
node --test --test-name-pattern "…" "tests/*.test.mjs"   # one test by name
npm run serve                                       # python3 -m http.server 4173 (no /api/save)
netlify dev                                         # …with the save function, if the CLI is installed
node tools/make-placeholders.mjs                    # regenerate placeholder images
node tools/make-og-image.mjs                        # regenerate the OG share card
```

Quote the glob and don't pass a bare `tests/` directory — current Node resolves
that as a module path and dies with `MODULE_NOT_FOUND`.

Use a server rather than opening `index.html` directly, or fonts and JSON-LD
behave differently from production.

## The tests are the specification

`tests/` is not coverage-chasing — each assertion pins a business fact, a
conversion mechanic, or an accessibility guarantee that is easy to break by
accident and invisible when broken. Before "fixing" something that looks wrong,
check whether a test deliberately asserts it. Notable examples:

- **White text on `#F57C00` (2.70:1) and `#25D366` (1.98:1) both fail WCAG AA.**
  The buttons keep those exact brand fills with near-black labels instead.
  `tests/audit.test.mjs` computes contrast and fails if white returns.
- **The `<h1>` must be the LCP element**, not the hero photo. Both hero CTAs sit
  before the hero image in source order specifically to achieve that.
- **No invented social proof.** Reviews are marked `data-placeholder="true"`,
  and `aggregateRating` is deliberately absent from the schema. Publishing
  fabricated testimonials or ratings risks Google Ads suspension.
- **Nothing may load from a third-party origin.** Fonts are self-hosted; the
  Google Map is a click-to-load facade.

## Architecture

### Progressive enhancement is a hard contract

`index.html` is fully functional with JavaScript disabled: all seven menu days
visible, all six FAQ answers expandable, every button live. `js/main.js` only
improves on that — it never renders anything the page needs.

Animation is the trap here, in two forms, and each has its own test:

- A `.reveal` rule that sets `opacity: 0` must be scoped under the `.js` class
  (set by an inline script in `<head>`), or a visitor without JavaScript sees a
  blank page below the hero.
- An entrance keyframe starting at `opacity: 0` with `backwards` fill hides
  content the same way, for the length of its delay. Every rule using one must
  also be `.js`-scoped **and** cancelled in the `prefers-reduced-motion` block —
  otherwise someone who asked for less motion gets a permanently empty page
  rather than a still one.

### Motion

One signature, everything else quiet. This is a paid-traffic page on mid-range
Android, so motion is transform/opacity only and buys no layout cost: measured
LCP is the `<h1>` at ~80ms and CLS is 0.

- **The signature** is Today's Menu: picking a day replays `dish-in` on the
  chips, 45ms apart, like katoris going onto a thali. `select()` in `js/main.js`
  removes `.is-laying`, reads `offsetWidth` to force the removal to land, then
  re-adds it — without that the browser folds both into one frame and nothing
  replays.
- **Grid stagger**: `main.js` moves `.reveal` off a `.grid`/`.tiers`/`.steps`
  container onto its children and numbers them with `--i`, capped at 8. This
  runs *before* the IntersectionObserver collects `.reveal`, or the children are
  never watched.
- **The hero cascade deliberately excludes the `<h1>`.** It is the LCP element;
  animating it would slow the one metric Google scores here.

### `js/content.js` is the owner-edited data file

A non-developer edits this weekly — through `/admin/` or by hand. It holds
`todaysSpecial`, `weeklyMenu`, `deliveryWindows`, `prices` and `contact` on
`window.SITE`, wrapped in plain-English instructions. Keep the comments generous
and the syntax boring — a test asserts it stays commented and hand-editable, and
it is also the file the save function writes.

Everything in it also exists as baked markup in `index.html`, which is the
no-JavaScript fallback and the last-published state. Two sources of truth, on
purpose. The seams are `data-price`, `data-phone`, `data-contact`, `.js-menu` and
`#todays-special`.

### Prices: one number, two rendered forms

15 prices flow from `SITE.prices` into elements tagged `data-price`. The
non-obvious half: each WhatsApp CTA embeds its price *inside the prefilled
message* as `%E2%82%B9170` (URL-encoded ₹). `main.js` therefore branches on
`tagName === 'A'` and rewrites the href instead of the text. Update one without
the other and customers message you quoting a price you no longer charge.

Three files must agree on the key list, and tests enforce it:
`js/content.js` (`prices`) · `index.html` (`data-price`) · `admin/generate.js`
(`PRICE_FIELDS`, which also drives the admin's input boxes).

**Tests compare structure, not values.** Baked HTML amounts are the last
published values; once the client edits them the two legitimately differ, so a
test asserting equality would cry wolf after every real change. What is asserted
is that the key sets match, and that the baked copies agree *with each other* —
one stale WhatsApp link among 25 is a customer messaging a dead number.

The "Saves ₹200" badge is computed from the two monthly prices and removes
itself rather than claim a saving that no longer exists.

**Deliberately not data-driven:** the meta description, `og:description` and
schema `priceRange`. Search engines read those from served HTML before any
JavaScript runs. `npm test` does *not* compare them to `content.js`, so that
changing a price never breaks the suite; EDITING-GUIDE section 2 lists them as
a manual step.

### `/admin/` — editor for menu, prices and contact details

`admin/generate.js` holds `validate()`, `generate()` and the field registries
(`PRICE_FIELDS`, `ADDRESS_FIELDS`, `PHONE_COUNT`) as pure, DOM-free values, so
three consumers share one copy of the rules: the admin page's inputs, the Netlify
save function, and the tests. This is the riskiest code in the repo — a malformed
output means the live menu silently falls back to stale baked HTML and nobody
notices for a week. `admin/index.html` must never re-implement them; a test fails
if it does.

Validation is two-tier: `error` disables Save and Copy, `warn` is advice the
owner can override.

Dishes per day and delivery windows have true add/remove; the 7 days, the 15
price keys and the 3 phone slots are fixed by design — each is welded to baked
markup in `index.html`, so "make it dynamic" means regenerating markup, not
just data. A phone-width sticky bar (`#savebar`) mirrors dirty state and the
blocking-error count; it hides whenever `state` deep-equals `loaded`.

### Saving — `netlify/functions/save.mjs`

The deployed site is on **Netlify**; the owner's login lives in **Supabase**
(one account, email + password, sign-ups disabled). `/admin/` POSTs to
`/api/save` with the session token in the `Authorization` header. The function
verifies the token with Supabase (`GET /auth/v1/user`), requires the email to
equal `ADMIN_EMAIL`, re-runs `validate()`, and commits `js/content.js` to
GitHub via the Contents API. Netlify redeploys on the commit, so a change is
live in about a minute and every client edit is a revertible commit. After a
successful commit the save is appended to the `site_state` table in Supabase
(schema: `supabase/schema.sql`) **using the owner's own token** — RLS is the
authorization, and no key that bypasses RLS exists anywhere in the system.

The landing page **never reads from Supabase**. The database exists for login
and edit history only; if it is down or paused, only the admin login suffers.

Things that will bite you here:

- **The fetch path must be absolute** (`/api/save`). The page is served from
  `/admin/`, so a relative `api/save` resolves to `/admin/api/save`, which
  Netlify does not route — and the page then quietly decides saving is
  unavailable. There is a test for this exact mistake.
- **The admin page holds no Supabase configuration.** `GET /api/save` hands it
  `{supabase: {url, anonKey}}` (both public by design). Hardcoding either into
  the page fails a test.
- **The session token lives in one JavaScript variable.** Never localStorage,
  sessionStorage, cookies or IndexedDB — a test greps for all four. Expiry
  mid-edit is handled by re-login; the edited state survives in memory.
- **Fail closed.** Any of the five required env vars unset returns 503, never
  "allow". A valid login with the wrong email returns 403 — that is the
  backstop against Supabase sign-ups being accidentally re-enabled.
- The generated file is parsed with `new vm.Script(text)` before committing —
  parse only, never executed. Don't "improve" this into `new Function(...)()`;
  the shape is asserted in `tests/admin.test.mjs`, where running it is safe.
- **History is best-effort.** The insert runs after the commit; if it fails the
  response is still `saved: true` plus a warning, because the site *did*
  publish. Never let a history failure fail a save that already happened.

`tests/save.test.mjs` stubs Supabase and GitHub by URL and covers each guard.

`netlify/functions/ping.mjs` hits the PostgREST root once a day
(`schedule = "@daily"`) so the free Supabase project never pauses from
inactivity. It touches no table and needs no policy.

Where `/api/save` does not answer — a plain static host, or the folder opened
locally — the page falls back to the copy-and-paste flow rather than showing a
Save button that could only fail. Setup and the client-facing instructions are in
`DEPLOY.md`.

### Contact details

`SITE.contact` drives every phone number and the address. All 25 WhatsApp links
are rewritten by selector (`a[href*="wa.me/"]`) since they share one number;
`tel:` links differ, so each carries `data-phone="<index>"` — on an `<a>` it sets
the href, on a `<span>` the readable "78955 90063" form. Address slots come from
`data-contact="line1|line2|city|city-state|street|short"`.

`privacy.html` and `terms.html` load **no JavaScript at all** and so are not
reachable from `/admin/`. A test asserts their phone and address still match
`index.html`, so a half-finished contact change cannot ship quietly.

### `_headers`

One rule: make `js/content.js` revalidate, so a menu or price change appears
immediately. Without it a cached copy can serve yesterday's menu for days, which
looks exactly like the edit failed. Netlify and Cloudflare Pages read this file.
Apache hosting would need the same rule in a root `.htaccess`; there isn't one,
because this deploys to Netlify.

## Conventions

- Customer-facing wording belongs in `index.html` or `js/content.js`, never in
  `js/main.js`.
- `index.html` carries `✏️ EDIT:` markers for the owner. Tests run against
  comment-stripped HTML so a comment can never satisfy a content assertion.
- Every image needs `width` and `height` (CLS is 0 and stays 0), `loading="lazy"`
  except the hero, and a real `alt`.
- Conventional commit messages (`feat:`, `fix:`).

## Placeholders that must not ship as-is

README's "Before you go live" checklist is the authority. The big ones: the
three sample reviews, placeholder photography, the `swaadsetiffin.in` domain
(appears 15× across five files), the FSSAI registration number, and the
approximate kitchen coordinates in the JSON-LD `geo` block.

Nothing secret is in the repo. `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`ADMIN_EMAIL`, `GITHUB_TOKEN`, `GITHUB_REPO` and `GITHUB_BRANCH` are Netlify
environment variables only — never commit them, and never add a `.env`.
`GET /api/save` reports which are unset, which is the fastest way to debug a
deploy where the login does not appear. The one credential class that must
never exist anywhere is a Supabase key that bypasses RLS — a test greps for it.
