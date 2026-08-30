# Deploying, and handing over to the client

Two audiences. **Part 1 is for you**, once, at setup. **Part 2 is the page to
send the client** — deliberately short, no jargon.

The end state: the client opens `yoursite.in/admin/`, logs in, edits the menu or
a price, presses **Save**, and the website updates about half a minute later. No
file manager, no copy-paste, no calling you — and "Forgot password?" emails them
a reset link without you either.

---

# Part 1 — setup (you, once)

## How saving works

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

`save.mjs` verifies the token with Supabase, requires the owner's account,
re-runs the validation the editor shows on screen, and appends the row. **That
insert is the publish — there is no deploy.** `render.js` reads the newest row
on each request and writes the menu, prices and contact details into the page
before the visitor receives it, so the browser never talks to Supabase and the
page still works with JavaScript off.

The table is append-only — no update or delete policy — so every past version is
kept. That is the undo history. **If Supabase is unreachable the website still
works**, falling back to the values built into `index.html`: stale, but nobody
lands on a broken page, which matters because these are paid clicks.

## 1. Put the code on GitHub

**Done** — `github.com/amangupta-1302/SwaadSe-Tiffin`, production branch
**`main`**. GitHub hosts the code only; the client's edits are rows in Supabase,
not commits, so nothing they do needs a token or a deploy. Pushing to `main`
still redeploys, which is how you ship code changes.

> Fresh machine or new repo? Create an **empty** GitHub repository (private is
> fine — Netlify reads private repos), then `git remote add origin <url>` and
> `git push -u origin main`.

## 2. Connect Netlify

netlify.com → **Add new site** → **Import an existing project** → GitHub → pick
the repo. Build command **empty**, publish directory `.` — `netlify.toml`
already says so, and there is nothing to compile. Deploy, and you get a
`something-random.netlify.app` URL immediately.

## 3. Set up Supabase (the login and the published menu)

The free tier covers all of this: one owner account with proper password
hashing, login rate limiting, reset emails, and a small table of edit history.
About ten minutes.

| # | Where | Do this |
|---|---|---|
| 1 | **New project** | Free plan. Any strong database password — you never type it again |
| 2 | **SQL Editor** | Paste `supabase/schema.sql` → **Run**. Creates `site_state`, locked so only a logged-in user can append, nobody can rewrite old rows, and anonymous visitors read one column |
| 3 | **Auth → Users → Add user** | The client's email + a first password. Tick **Auto confirm user** |
| 4 | **Auth → Sign In / Up** | **Allow new users to sign up** OFF. `save.mjs` also refuses any account but `ADMIN_EMAIL`, so even a re-enabled toggle grants nothing |
| 5 | **Auth → URL Configuration** | Site URL → `https://your-site.netlify.app/admin/`. Where password-reset emails land |
| 6 | **Auth → Emails → SMTP** | Enable custom SMTP ↓ |
| 7 | **SQL Editor** | Seed the table — **required** ↓ |
| 8 | **Settings → API** | Copy the **Project URL** and **anon (public) key** for step 4. The anon key is public by design; the `service_role` key beside it is never used anywhere in this project — leave it alone |

**Step 6 — do not skip.** Supabase's built-in sender is for development:
heavily rate-limited, no delivery guarantee, frequently spam-filed. The client
only meets it through **"Forgot password?"** — exactly when they are locked out
and least able to wait. Resend, Postmark, Brevo and SES all have free tiers big
enough for one account. Point the sender at the business's own domain once DNS
is connected, so the reset mail does not arrive from a stranger.

**Step 7 — required, not optional.** The website renders from the newest row, so
until one exists every page falls back to the baked values. Run the commented
`insert` at the bottom of `schema.sql`, pasting in the current `window.SITE`
object from `js/content.js`. Then verify — this is exactly the request the
website makes, and it must return a row, not `[]`:

```bash
curl -s -H "apikey: <anon key>" -H "authorization: Bearer <anon key>" \
  "<project url>/rest/v1/site_state?select=state&order=id.desc&limit=1"
```

`[]` with status 200 means the row exists but the anon grant from step 2 did not
apply — row-level security is hiding it.

> **Free-tier note:** Supabase pauses free projects after ~a week without
> traffic. `ping.mjs` sends one request a day to prevent that, so you should
> never see it — but if the login says it cannot reach the database, press
> **Restore project** in the dashboard. Two minutes, nothing lost. The website
> stays up on baked values while it is paused.

## 4. Set the environment variables

Netlify → **Site configuration** → **Environment variables**:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL from step 3.8, e.g. `https://abcdefgh.supabase.co` |
| `SUPABASE_ANON_KEY` | anon (public) key from step 3.8 |
| `ADMIN_EMAIL` | the client's login email — the only account allowed to save |

Three variables, read by the save function, the daily ping and the edge renderer
alike. There is deliberately no GitHub credential: publishing is a database
insert, so nothing needs write access to the repository.

Then **Deploys → Trigger deploy → Clear cache and deploy site** — environment
variables are only picked up by a fresh deploy.

## 5. Check it before you hand it over

`https://your-site.netlify.app/api/save` should answer
`{"ready":true,"missing":[],"supabase":{…}}`. If `ready` is `false` it names the
unset variables — the fastest way to debug this.

Then, on `/admin/`:

| ☐ | Check | If it fails |
|---|---|---|
| | A **login form**, not "saving is not switched on" | the function is unreachable or half-configured |
| | A wrong password is refused under the form | |
| | Log in, empty a price → Save greys out, red message | validation is not wired |
| | Change today's special, Save, reload `/admin/` — new wording still there | the edge function is not running on `/admin/`; the editor is seeding from `js/content.js` |
| | A new row in **Table Editor → site_state** | the insert is being refused |
| | Wait ~30s, reload the site, see the change | no deploy should run |
| | Reload **with JavaScript disabled** — change still there | the edge function is not running, and crawlers see stale content |
| | "Forgot password?" arrives, not in spam, links to `/admin/` | almost always step 3.6 — SMTP still off |
| | On a phone: edit, the dark **Unsaved changes** bar appears | |

## 6. Point the real domain at it

Netlify → **Domain management** → add `swaadsetiffin.in`, follow the DNS
instructions, let Netlify issue the certificate. Update the **Site URL** in
Supabase (step 3.5) at the same time, or password-reset emails keep pointing at
the old address. Then do the sweep in README's **Before you go live** table.

## Local development

| | `npm run serve` (`:8080`) | `netlify dev` (`:8888`) |
|---|---|---|
| The page | baked values only | filled from the database |
| `/api/save` | ✗ — `/admin/` says saving is unavailable | ✓ |
| Edge renderer | ✗ | ✓ |
| Settings from | — | `.env` in the project root |

Both behaviours are correct, not bugs. For the real login and Save button,
install the Netlify CLI and put the three variables in a `.env` — **the whole
thing can be configured and tested locally, before the site is ever deployed:**

```
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_ANON_KEY=eyJhbGci…
ADMIN_EMAIL=owner@example.com
```

`.env` is gitignored and must stay that way. Once step 2 is done, `netlify link`
then `netlify dev` pulls the same values from the site's own environment
variables and the local file can go.

| Gotcha | Consequence |
|---|---|
| **`netlify dev` reads `.env` once, at startup** | edits do not reload — restart, or you debug a variable you already fixed |
| **The *edge* function reads `.env` alone** | a shell override (`SUPABASE_URL=… netlify dev`) changes what `/api/save` sees but not the renderer, silently either way |
| **The login form needs all three variables** | `/admin/` calls `GET /api/save` first and reports saving unavailable unless it answers `ready: true` |
| **A local Save is not a rehearsal** | no dry-run: it appends a real row and the live site renders it within 30s. Undoing means saving the previous values again — nothing is lost, but the wrong menu is briefly public |
| **Reset emails link to the step 3.5 Site URL** | your production address. To test locally, add `http://localhost:8888/admin/` under **Auth → URL Configuration → Redirect URLs** |

The daily ping does not fire under `netlify dev` — run it with
`netlify functions:invoke ping`.

## What is not covered by the login

`/admin/` is readable by anyone who guesses the URL, deliberately: it holds no
secrets — not even the Supabase address, which it fetches from `/api/save` — and
changes nothing without a verified login. All someone learns from it is the menu
and prices, already public on the front page.

Sessions last about an hour; the editor handles expiry by asking the client to
log in again without losing their edits.

---

# Part 2 — for the client

*Everything below can be copied into an email or a WhatsApp message.*

## Updating your website

Open **yoursite.in/admin/** on your phone or computer. You can change:

- **Today's special** — the line near the top of the website
- **This week's menu** — what you are cooking each day
- **Prices** — every price on the website
- **Phone numbers and address**
- **Delivery timings**

### How to make a change

1. Edit the boxes.
2. Look at the top of the page:
   - **Green tick** — all good.
   - **Orange message** — advice. You can still save.
   - **Red message** — something must be fixed. Saving stays switched off until
     you fix it, so you cannot break the website by accident.
3. Scroll to the bottom, **log in with your email and password**, and press
   **Save to the website**. (On a phone, the dark bar at the bottom of the
   screen also takes you there.)
4. Wait about half a minute, then refresh your website. Your change is there.

### Useful to know

- **You cannot break it.** Anything that would break the website is refused
  before it saves.
- **One price changes everywhere.** Change the Deluxe Tiffin price once and it
  updates on the card *and* in the WhatsApp message customers send you. You
  never change the same price twice.
- **Undo all my changes** puts the boxes back to what is on the website now. It
  only works before you press Save.
- **Nothing is live until you press Save.** Typing in the boxes changes nothing.
- **Forgot your password?** Type your email in the login box, press **Forgot
  password?**, and follow the link in the email you get. You choose a new
  password yourself — nobody has to be called.
- **Keep your password private.** Anyone with it can change your menu and
  prices.

### If something goes wrong

| What you see | What it means, and what to do |
|---|---|
| "That email or password is not right" | Check for a capital letter or a space at the end. Still stuck? Use **Forgot password?** |
| "Your login expired" | You had the page open a long while. Log in again and press Save — your edits are still in the boxes |
| "Could not reach the website" | Your internet dropped. Press Save again |
| "Could not save to the database" | The save did not happen and nothing changed. Your edits are still in the boxes; press Save again in a minute |
| You saved but the website looks the same | Give it half a minute, then refresh. On a phone, close the tab and open it again |
| Anything else | Call your developer. Every change is recorded and can be put back exactly as it was |
