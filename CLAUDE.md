# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## What this is

A static, single-page Google Ads landing site for a tiffin (home-cooked meal
delivery) business in Agra. Its only job is turning paid search clicks into
WhatsApp inquiries — no ordering, no payment, no accounts.

**No build step, no dependencies.** Server code is three files. Supabase is
reached with raw `fetch` — deliberately no supabase-js, not from a CDN and not
vendored. `render.js` transforms HTML by string replacement because
`HTMLRewriter` is absent from Netlify's Deno runtime and every workaround is a
remote import. A bundler, framework or runtime dependency works against the
design, not with it.

## Commands

| Command | What | Note |
|---|---|---|
| `npm test` | 126 tests, 6 files, ~85 ms | must end `fail 0` |
| `node --test tests/save.test.mjs` | one file | |
| `node --test --test-name-pattern "…" "tests/*.test.mjs"` | one test | **quote the glob** — bare `tests/` dies with `MODULE_NOT_FOUND` |
| `npm run serve` | `python3 -m http.server 8080` | no `/api/save`, no edge function |
| `netlify dev` | both functions, `:8888` | needs the CLI |
| `node tools/make-placeholders.mjs` | placeholder images | |
| `node tools/make-og-image.mjs` | the OG share card | |

Use a server, never a double-clicked file, or fonts and JSON-LD behave
differently from production.

## How a change reaches a visitor

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

**The latest `site_state` row is the live website.** `/admin/` is the only
thing that publishes, the INSERT *is* the publish, and no deploy runs. The
table is append-only by omission — no update or delete policy — so every past
state stays recoverable.

Reading server-side is the whole point: the no-JS contract survives, crawlers
see real content, no second origin sits in front of the first paint, and a
paused free-tier Supabase cannot take down a page Ads is billing clicks on.

**Every failure path returns the response untouched.** No path produces a blank
menu, and there must never be one:

```
  GET /  ──▶  render.js
                │
          env vars set? ───── no ──┐
                │ yes              │
          Supabase reachable? ─ no ┤
                │ yes              │
          row returned? ───── no ──┤
                │ yes              │
          transform threw? ── yes ─┤
                │ no               │
                ▼                  ▼
          filled HTML       response untouched
                            = baked index.html
                            (stale, but real prices)
```

## Files that matter

| File | Role |
|---|---|
| `index.html` | the page. Baked values are three things at once: the template `render.js` fills, the outage fallback, and what most tests assert against |
| `js/content.js` | outage fallback **only** — `todaysSpecial`, `weeklyMenu`, `deliveryWindows`, `prices`, `contact` on `window.SITE`. Nothing publishes from it; keep it roughly in step |
| `js/main.js` | progressive enhancement. Exports `addressSlots`, `nextDelivery`, `menuIndexFor` as pure functions |
| `admin/generate.js` | `validate()` + registries (`PRICE_FIELDS` 15, `ADDRESS_FIELDS` 4, `PHONE_COUNT` 3), pure and DOM-free, shared by three consumers |
| `admin/index.html` | the editor. Must never re-implement `generate.js`. `#savebar` is a phone-width sticky bar mirroring dirty state + blocking-error count; it hides whenever `state` deep-equals `loaded` |
| `netlify/edge-functions/render.js` | fills served HTML from the newest row |
| `netlify/functions/save.mjs` | verifies the login, appends the row |
| `netlify/functions/ping.mjs` | daily PostgREST hit so the free project never pauses. No table, no policy |
| `supabase/schema.sql` | `site_state` + RLS. Run once |

Seams both `render.js` and `main.js` read: `data-price`, `data-phone`,
`data-contact`, `.js-menu`, `#todays-special`.

`render.js` routes itself via its in-file `config.path` (`/`, `/index.html`,
`/privacy.html`, `/terms.html`, `/admin/`) — `netlify.toml` has **no**
`[[edge_functions]]` block.

Fixed by design: 7 days, 15 price keys, 3 phone slots — each welded to baked
markup, so "make it dynamic" means regenerating markup, not just data. Dishes
per day and delivery windows do have true add/remove.

## Prices — one number, two rendered forms

```
              three files must agree on the key list
   js/content.js        index.html          admin/generate.js
      prices{}          data-price="…"        PRICE_FIELDS
   (fallback copy)   (template + baked)    (drives the inputs)
         └─────────────────┼─────────────────────┘
                           │  15 keys: 4 plan- · 3 tier- · 8 pack-
             ┌─────────────┴─────────────┐
             ▼                           ▼
        js/main.js                edge-functions/render.js
      (in the browser)               (on the server)
             │                           │
             ├─ <span data-price>  ──▶  text
             └─ <a href=wa.me…>    ──▶  rewrite href (₹ = %E2%82%B9)

   NOT filled from data — search engines read these before any JS runs:
      meta description · og:description · schema priceRange
```

Each WhatsApp CTA embeds its price *inside* the prefilled message, so `main.js`
branches on `tagName === 'A'` and rewrites the href, not the text. Miss one and
customers message you quoting a price you no longer charge.

**Tests compare structure, not values** — key sets match, and baked copies
agree with each other. Baked amounts are the last published values, so once the
client edits them an equality test would cry wolf.

The three SEO mentions are checked against the **baked** amounts, never against
`content.js` or the database: an `/admin/` price change cannot fail the suite,
but hand-editing a baked `data-price` without the meta description will.
EDITING-GUIDE §2 lists them.

The "Saves ₹200" badge is computed from the two monthly prices and removes
itself rather than claim a saving that no longer exists.

## Contact details

`SITE.contact` drives every number and the address. The 24 WhatsApp buttons
share one number, so they are rewritten by selector (`a[href*="wa.me/"]`); the
JSON-LD `target` is a 25th mention. `tel:` links differ per slot, so each
carries `data-phone="<index>"` — on an `<a>` it sets the href, on a `<span>` the
readable `78955 90063` form. Address slots come from
`data-contact="line1|line2|city-state|street|short"`, built by `addressSlots()`.

## Invariants — do not "fix" these

Each row is asserted in `tests/<name>.test.mjs`. Before changing something that
looks wrong, check whether a test deliberately pins it.

| Rule | Why | Test |
|---|---|---|
| Brand fills `#F57C00` / `#25D366` keep **near-black** labels | white on them is 2.70:1 and 1.98:1 — fails AA | `audit` |
| `<h1>` is the LCP element; both hero CTAs precede the hero image in source order | the one metric Google scores here. The hero cascade excludes the `<h1>` for this | `sections` |
| Reviews stay `data-placeholder="true"`; `aggregateRating` stays absent | invented social proof risks Ads suspension | `audit`, `sections` |
| No third-party origin — fonts self-hosted, map is a click-to-load facade | first paint | `audit` |
| Page works fully with JS off: 7 menu days, 6 FAQ answers, every button | `main.js` improves, never renders | `sections` |
| `.reveal` rules setting `opacity: 0` are scoped under `.js` | else no-JS visitors get a blank page below the hero | `sections` |
| `opacity: 0` entrance keyframes with `backwards` fill are `.js`-scoped **and** cancelled under `prefers-reduced-motion` | else "less motion" means a permanently empty page, not a still one | `sections` |
| `select()` removes `.is-laying`, reads `offsetWidth`, re-adds | without the forced reflow both fold into one frame and nothing replays | — |
| `main.js` moves `.reveal` onto grid children (`--i`, cap 8) **before** the IntersectionObserver collects them | run it after and the children are never watched | — |
| `js/content.js` stays generously commented and hand-editable | hand-editing is the only way it changes | `sections` |
| `render.js` writes text only into elements with no nested tags (the `[^<]*`); anchors rewrite the opening tag alone | a price lives inside the prefilled message, not the link text | `render` |
| `render.js` imports `addressSlots()` from `main.js`; price + phone rules are duplicated on purpose | see the `ponytail:` note there — fix both if you change either | `render`, `schedule` |
| The `window.SITE` injection anchors to the `js/content.js` script tag, **not** `</head>` | that file assigns `window.SITE` too and last wins; `index.html` loads it in the head, `/admin/` at the end of `<body>` | `render` |
| Digit-stripping and escaping in `render.js` are load-bearing | nothing normalises state; `validate()` accepts `78955 90063` | `render` |
| The JSON-LD block is never filled in | kept a known manual step, like the meta description | `render` |
| Address loop is `value !== undefined`, never `if (value)` | `addressLine2` is optional, so empty-vs-absent matters: no `addressLine1` → baked markup untouched, but past that an empty string **overwrites**. Truthy shows the visitor two addresses | `render`, `schedule`, `sections` |
| `/admin/` fetches `/api/save` at an **absolute** path | relative resolves to `/admin/api/save`, unrouted — the page then quietly decides saving is unavailable | `admin` |
| The admin page holds no Supabase config; `GET /api/save` hands it `{supabase:{url,anonKey}}` | public by design, but hardcoding fails a test | `admin` |
| Session token lives in one JS variable — never localStorage, sessionStorage, cookies, IndexedDB | a test greps all four. Expiry is handled by re-login; edits survive in memory | `admin` |
| Fail closed: any of the three env vars unset → 503; valid login, wrong email → 403 | the 403 backstops Supabase sign-ups being re-enabled | `save` |
| Nothing is written until every check passes; a refused insert fails the save | `render.js` serves the latest row, not the latest *approved* one — a rejected save leaving a row would publish itself | `save` |
| `validate()` is two-tier: `error` disables Save, `warn` is overridable advice | it is the **only** cleanup on the publish path — a rule it skips is one the visitor reads | `admin` |
| `privacy.html` / `terms.html` load no JS, so `/admin/` cannot reach them; their phone and address must still match `index.html` | a half-finished contact change cannot ship quietly | `sections` |

## Gotchas that are procedures, not rules

- **`netlify dev` feeds edge functions from `.env` only, read once at startup.**
  A shell override (`SUPABASE_URL=… netlify dev`) reaches `netlify/functions/*`
  but *not* `netlify/edge-functions/*`, silently — the renderer just falls back
  and the page looks fine. Edit `.env`, restart. Costliest gotcha here.
- **The 30s memo is per edge instance, in isolate memory.** The response header
  is `cache-control: public, max-age=0, must-revalidate` — no CDN or browser
  caching at all. A longer-lived CDN copy would outlive the memo and make saves
  look like they had not landed.
- `_headers` holds one rule: revalidate `js/content.js`, so the outage fallback
  is never a month stale. `/admin/*`'s `X-Robots-Tag` is in `netlify.toml`.
- `_redirects` exists because `publish = "."` serves the repo as-is. A Netlify
  splat only matches at the end of a path, so `/*.md` does not work — root
  files are listed one by one and a new one needs a new line.
- `tests/save.test.mjs` stubs Supabase by URL and throws on any other host.
  That is what stops a second dependency creeping back in.

## Conventions

- Customer-facing wording lives in `index.html` or `js/content.js`, never
  `js/main.js`.
- `index.html` carries `✏️ EDIT:` markers. Tests run against comment-stripped
  HTML, so a comment can never satisfy a content assertion.
- Every image needs `width`/`height` (CLS is 0 and stays 0), `loading="lazy"`
  except the hero, and a real `alt`.
- Motion is transform/opacity only. LCP is the `<h1>` at ~80 ms. One signature
  — Today's Menu chips replaying `dish-in` 45 ms apart — everything else quiet.
- Conventional commits (`feat:`, `fix:`).

## Never

- **No Supabase key that bypasses RLS, anywhere.** RLS *is* the authorization:
  `save.mjs` inserts using the owner's own token. A test greps `service_role`.
- **Never commit a `.env`.** One is required locally for `netlify dev` and is
  gitignored; `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `ADMIN_EMAIL` otherwise
  live only in Netlify env vars. `GET /api/save` names the unset ones — the
  fastest way to debug a deploy where the login never appears.
- No second publishing route. Where `/api/save` does not answer, `/admin/` says
  saving is unavailable rather than showing a Save button that could only fail.
- No GitHub credential anywhere — publishing is a database insert.

## Placeholders that must not ship

README's "Before you go live" table is the authority: the three sample reviews,
placeholder photography, the `swaadsetiffin.in` domain (15× across
`index.html`, `sitemap.xml`, `privacy.html`, `terms.html`, `robots.txt`), the
FSSAI number, and the approximate kitchen coordinates in the JSON-LD `geo`.

Other docs: **`DEPLOY.md`** (setup + handover) · **`EDITING-GUIDE.md`** (what
`/admin/` cannot change) · **`IMAGES.md`** (photos).
